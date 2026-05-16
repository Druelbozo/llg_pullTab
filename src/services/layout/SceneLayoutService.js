/**
 * SceneLayoutService
 * 
 * Manages layout initialization and recalculation coordination for Phaser scenes.
 * Coordinates between LayoutManager, ControlBarManager, and positioning systems.
 * 
 * This service centralizes layout coordination logic previously in Level.js.
 */

import { calculateContainerDimensions, calculateContainerPositions, calculateControlBarBackgroundTop, calculateHeaderPositions } from '../../utils/layout/ControlBarLayoutUtils.js';
import { getControlBarSpacingPercent, getContentHeightPercent, getCardContainerConfig, getHeaderConfig } from '../../utils/layout/ConfigAccessUtils.js';
import { getScreenWidth, getScreenHeight } from '../../utils/viewport/ViewportUtils.js';
import { getLayoutConfigs } from '../../utils/layout/ConfigAccessUtils.js';
import { drawControlBarBackgroundBounds } from '../../utils/layout/LayoutDebugUtils.js';
import { warn, debug } from '../../utils/logger/LoggerUtils.js';

export default class SceneLayoutService {
	/**
	 * Initialize layout system for a scene
	 * Sets up layout managers, creates buttons, and calculates initial positions
	 * 
	 * @param {Phaser.Scene} scene - The Phaser scene instance
	 * @param {Object} config - Configuration object
	 * @param {Function} config.createButtonsCallback - Callback to create buttons (receives buttonHeightPercent, returns buttonResults)
	 * @param {Function} config.storeButtonReferencesCallback - Callback to store button references (receives buttonResults)
	 * @param {Function} config.registerButtonHandlersCallback - Callback to register button handlers (receives buttonResults)
	 * @param {Function} config.applyCardContainerLayoutCallback - Callback to apply card container layout (receives layoutPositions, uiConfig, baseUIConfig, height, verticalPaddingBottom, containerHeight)
	 * @param {Function} config.updateControlBarBackgroundCallback - Callback to update control bar background (receives layoutPositions)
	 * @param {Function} config.calculateContainerWidthsCallback - Callback to calculate container widths (receives config, returns containerWidths)
	 * @returns {Promise<void>}
	 */
	static async initialize(scene, config) {
		const {
			createButtonsCallback,
			storeButtonReferencesCallback,
			registerButtonHandlersCallback,
			applyCardContainerLayoutCallback,
			updateControlBarBackgroundCallback,
			calculateContainerWidthsCallback
		} = config;

		if (!scene.layoutManager || !scene.controlBarManager) {
			warn('[SceneLayoutService] LayoutManager or ControlBarManager not available');
			return;
		}

		// Wait for layout configs to load
		await scene.layoutManager.layoutConfigsPromise;

		// Calculate contentHeightPercent from layout config BEFORE creating buttons
		const layoutName = scene.layoutManager.getCurrentLayoutName();
		const { uiConfig, baseUIConfig } = getLayoutConfigs(scene.layoutManager, layoutName);

		const width = getScreenWidth(scene);
		const height = getScreenHeight(scene);

		// Padding removed - set to 0.0
		const verticalPaddingTop = 0.0;
		const verticalPaddingBottom = 0.0;
		const availableHeight = height - (verticalPaddingTop + verticalPaddingBottom);

		// Get contentHeightPercent from layout config (relative to availableHeight)
		const contentHeightPercent = getContentHeightPercent(uiConfig, availableHeight, height) || 
		                            getContentHeightPercent(baseUIConfig, availableHeight, height) || 0.08;

		// Convert contentHeightPercent (relative to availableHeight) to buttonHeightPercent (relative to screen height)
		const buttonHeightPercent = height > 0 ? (availableHeight / height) * contentHeightPercent : contentHeightPercent;

		// Create all control bar buttons
		const buttonResults = createButtonsCallback(buttonHeightPercent);

		// Store button references
		if (storeButtonReferencesCallback) {
			storeButtonReferencesCallback(buttonResults);
		}

		// Register button handlers
		if (registerButtonHandlersCallback) {
			registerButtonHandlersCallback(buttonResults);
		}

		// Get layout positions
		const layoutPositions = scene.layoutManager.getLayoutPositions();

		// Get fresh layout configs right before calculating positions
		const currentLayoutName = scene.layoutManager.getCurrentLayoutName();
		const { uiConfig: currentUiConfig, baseUIConfig: currentBaseUIConfig } = getLayoutConfigs(scene.layoutManager, currentLayoutName);

		// Ensure containers are added to scene and sized before getting widths
		if (scene.scale) {
			scene.scale.refresh();
		}

		// Wait for render cycle to ensure buttons are fully rendered before calculating layout
		const applyLayoutAfterRender = () => {
			// Resize buttons synchronously BEFORE getting widths
			if (scene.controlBarManager && typeof scene.controlBarManager._resizeButtonsSynchronously === 'function') {
				scene.controlBarManager._resizeButtonsSynchronously();
			}

			// Verify buttons have valid dimensions before proceeding
			const hasValidButtonDimensions = () => {
				const containerWidths = scene.controlBarManager?.getContainerWidths();
				if (!containerWidths || Object.keys(containerWidths).length === 0) {
					return false;
				}
				// Check if at least one button has a non-zero width
				return Object.values(containerWidths).some(w => w && w > 0);
			};

			if (!hasValidButtonDimensions()) {
				// Buttons not ready yet, wait another frame
				scene.events.once('postupdate', applyLayoutAfterRender);
				return;
			}

			// Calculate and validate container widths
			const containerWidths = calculateContainerWidthsCallback(currentUiConfig, currentBaseUIConfig, contentHeightPercent, availableHeight, height);

			// Calculate control bar positions using layout configs and container widths
			SceneLayoutService.calculateAndApplyLayout(
				scene,
				layoutPositions,
				currentUiConfig,
				currentBaseUIConfig,
				containerWidths,
				width,
				height,
				contentHeightPercent,
				availableHeight,
				verticalPaddingBottom
			);

			// Update control bar background
			if (updateControlBarBackgroundCallback) {
				updateControlBarBackgroundCallback(layoutPositions);
			}

			// Apply card container sizing and positioning
			const dimensions = calculateContainerDimensions({
				contentHeightPercent,
				availableHeight,
				height
			});
			const containerHeight = dimensions.containerHeight;

			if (applyCardContainerLayoutCallback) {
				applyCardContainerLayoutCallback(layoutPositions, uiConfig, baseUIConfig, height, verticalPaddingBottom, containerHeight);
			}

			// Force a render update to ensure layout changes are visible
			if (scene.scale) {
				scene.scale.refresh();
			}

			// Mark cameras as dirty to ensure layout is rendered immediately
			if (scene.cameras && scene.cameras.main) {
				scene.cameras.main.dirty = true;
			}
		};

		// Wait for next render cycle using postupdate event
		scene.events.once('postupdate', applyLayoutAfterRender);
	}

	/**
	 * Calculate and apply layout positions
	 * Core layout calculation logic shared by init and recalculation
	 * 
	 * @param {Phaser.Scene} scene - The Phaser scene instance
	 * @param {Object} layoutPositions - Layout positions object to update
	 * @param {Object} uiConfig - UI config from layout
	 * @param {Object} baseUIConfig - Base UI config from layout
	 * @param {Object} containerWidths - Container widths object
	 * @param {number} width - Screen width
	 * @param {number} height - Screen height
	 * @param {number} contentHeightPercent - Content height percent
	 * @param {number} availableHeight - Available height for layout
	 * @param {number} verticalPaddingBottom - Vertical padding bottom
	 * @returns {boolean} True if layout was successfully calculated and applied
	 */
	static calculateAndApplyLayout(scene, layoutPositions, uiConfig, baseUIConfig, containerWidths, width, height, contentHeightPercent, availableHeight, verticalPaddingBottom) {
		const containers = uiConfig?.controlBar?.layoutGroups || baseUIConfig?.controlBar?.layoutGroups;

		if (!containers || !Array.isArray(containers) || containers.length === 0) {
			return false;
		}

		const dimensions = calculateContainerDimensions({
			contentHeightPercent,
			availableHeight,
			height
		});

		const containerHeight = dimensions.containerHeight;
		const baseContainerHeight = dimensions.baseContainerHeight;

		const spacingPercent = getControlBarSpacingPercent(uiConfig, baseUIConfig);
		const horizontalPaddingLeft = 0.0;
		const horizontalPaddingRight = 0.0;
		const availableWidth = width - (horizontalPaddingLeft + horizontalPaddingRight);
		const centerX = width / 2;

		// Recalculate container positions with fresh widths
		const positionResult = calculateContainerPositions({
			containers,
			containerHeight,
			width,
			height,
			horizontalPaddingLeft,
			verticalPaddingBottom,
			availableWidth,
			centerX,
			containerWidths,
			spacingPercent,
			baseContainerHeight,
			uiConfig,
			baseUIConfig
		});

		// Recalculate controlBarBackgroundTop based on the new topmostContainerTop
		const recalculatedControlBarBackgroundTop = calculateControlBarBackgroundTop(
			positionResult.topmostContainerTop,
			uiConfig,
			baseUIConfig,
			height
		);

		// Update layoutPositions with new values
		layoutPositions.containerPositions = positionResult.containerPositions;
		layoutPositions.controlBarBackgroundTop = recalculatedControlBarBackgroundTop;
		layoutPositions.bottommostContainerBottom = height; // Always at screen bottom

		// Recalculate header positions if header config exists (they depend on controlBarBackgroundTop)
		const headerConfig = getHeaderConfig(uiConfig, baseUIConfig);
		if (headerConfig) {
			const headerResult = calculateHeaderPositions({
				items: headerConfig.items,
				controlBarBackgroundTop: recalculatedControlBarBackgroundTop,
				width,
				height,
				verticalOffset: headerConfig.verticalOffset,
				centerX,
				uiConfig,
				baseUIConfig
			});
			layoutPositions.headerPositions = headerResult.headerPositions;
		}

		// Apply positions using ControlBarManager.layoutControlBar
		if (scene.controlBarManager) {
			scene.controlBarManager.layoutControlBar(layoutPositions, width);

			// After positioning, get actual bounds to calculate accurate background dimensions
			const actualBounds = SceneLayoutService.getControlBarActualBounds(scene);
			if (actualBounds) {
				// Recalculate controlBarBackgroundTop using actualBounds.top as the base
				const actualControlBarBackgroundTop = calculateControlBarBackgroundTop(
					actualBounds.top,
					uiConfig,
					baseUIConfig,
					height
				);
				layoutPositions.controlBarBackgroundTop = actualControlBarBackgroundTop;
				layoutPositions.bottommostContainerBottom = height; // Always at screen bottom

				// Recalculate header positions with updated controlBarBackgroundTop
				if (headerConfig) {
					const headerResult = calculateHeaderPositions({
						items: headerConfig.items,
						controlBarBackgroundTop: actualControlBarBackgroundTop,
						width,
						height,
						verticalOffset: headerConfig.verticalOffset,
						centerX,
						uiConfig,
						baseUIConfig
					});
					layoutPositions.headerPositions = headerResult.headerPositions;
				}
			}

			// Create/update header text fields with final calculated positions
			if (layoutPositions.headerPositions) {
				scene.controlBarManager.createHeaderTextFields(layoutPositions);
				// Update bet text after creation (uses gameConfig.creditValueMinor)
				scene.controlBarManager.updateHeaderBetText();
			}
		}

		// Always recalculate cardContainerY after getting actual bounds
		const cardContainerConfig = getCardContainerConfig(uiConfig, baseUIConfig);
		const offsetYPercent = cardContainerConfig.offsetYPercent ?? 0.0;
		const offsetY = height * offsetYPercent;

		if (layoutPositions.controlBarBackgroundTop !== undefined && 
		    layoutPositions.controlBarBackgroundTop !== null && 
		    !isNaN(layoutPositions.controlBarBackgroundTop) && 
		    layoutPositions.controlBarBackgroundTop > 0 && 
		    layoutPositions.controlBarBackgroundTop < height) {
			const baseCardContainerY = (0 + layoutPositions.controlBarBackgroundTop) / 2;
			layoutPositions.cardContainerY = baseCardContainerY + offsetY;
		} else if (layoutPositions.controlBarTop !== undefined && 
		           layoutPositions.controlBarTop !== null && 
		           !isNaN(layoutPositions.controlBarTop) && 
		           layoutPositions.controlBarTop > 0 && 
		           layoutPositions.controlBarTop < height) {
			const baseCardContainerY = (0 + layoutPositions.controlBarTop) / 2;
			layoutPositions.cardContainerY = baseCardContainerY + offsetY;
		}

		return true;
	}

	/**
	 * Get actual bounds of control bar containers after positioning
	 * Returns {top, bottom} or null if containers not available
	 * 
	 * @param {Phaser.Scene} scene - The Phaser scene instance
	 * @returns {Object|null} Bounds object with {top, bottom} or null
	 */
	static getControlBarActualBounds(scene) {
		if (!scene.controlBarManager) {
			return null;
		}

		let topmost = Infinity;
		let bottommost = -Infinity;
		let foundAny = false;

		// Check all control bar containers EXCEPT balanceContainer
		// balanceContainer is excluded because text field positioning should have ZERO effect on control bar position
		// The control bar height is determined by the button containers, not by text fields that may extend beyond
		const containers = [
			scene.controlBarManager.soundButton?.container,
			scene.controlBarManager.infoButton?.container,
			scene.controlBarManager.playButton?.container,
			scene.controlBarManager.autoButton?.container
			// balanceContainer is intentionally excluded - text positioning should not affect control bar bounds
		];

		for (const container of containers) {
			if (container && container.getBounds) {
				const bounds = container.getBounds();
				if (bounds) {
					const containerHeight = bounds.height;
					const top = bounds.y;
					const bottom = bounds.y + containerHeight;

					if (top < topmost) {
						topmost = top;
					}
					if (bottom > bottommost) {
						bottommost = bottom;
					}
					foundAny = true;
				}
			}
		}

		if (!foundAny || topmost === Infinity || bottommost === -Infinity) {
			return null;
		}

		return { top: topmost, bottom: bottommost };
	}

	/**
	 * Recalculate control bar layout with fresh container widths
	 * Called during resize events to update positions and background
	 * 
	 * @param {Phaser.Scene} scene - The Phaser scene instance
	 * @param {Object} config - Configuration object
	 * @param {Function} config.applyCardContainerLayoutCallback - Callback to apply card container layout
	 * @param {Function} config.validateContainerWidthsCallback - Callback to validate container widths
	 * @returns {void}
	 */
	static recalculate(scene, config) {
		const {
			applyCardContainerLayoutCallback,
			validateContainerWidthsCallback
		} = config;

		// Prevent concurrent executions
		if (scene._isRecalculatingLayout) {
			return;
		}
		scene._isRecalculatingLayout = true;

		try {
			if (!scene.layoutManager || !scene.controlBarManager) {
				return;
			}

			// Get current layout name and fresh configs FIRST
			const layoutName = scene.layoutManager.getCurrentLayoutName();
			const { uiConfig, baseUIConfig } = getLayoutConfigs(scene.layoutManager, layoutName);

			// Clear layout cache to ensure we get fresh results
			scene.layoutManager.clearLayoutCache();

			// Resize buttons synchronously BEFORE getting widths
			if (scene.controlBarManager && typeof scene.controlBarManager._resizeButtonsSynchronously === 'function') {
				scene.controlBarManager._resizeButtonsSynchronously();
			}

			// Get fresh container widths from ControlBarManager (after buttons are resized)
			let containerWidths = scene.controlBarManager.getContainerWidths();

			// Get layout positions (this will recalculate with fresh cache)
			const layoutPositions = scene.layoutManager.getLayoutPositions();

			const width = getScreenWidth(scene);
			const height = getScreenHeight(scene);

			// Padding removed - set to 0.0
			const verticalPaddingTop = 0.0;
			const verticalPaddingBottom = 0.0;
			const horizontalPaddingLeft = 0.0;
			const horizontalPaddingRight = 0.0;

			const availableWidth = width - (horizontalPaddingLeft + horizontalPaddingRight);
			const availableHeight = height - (verticalPaddingTop + verticalPaddingBottom);
			const centerX = width / 2;

			const contentHeightPercent = getContentHeightPercent(uiConfig, availableHeight, height) || 
			                            getContentHeightPercent(baseUIConfig, availableHeight, height) || 0.08;
			const spacingPercent = getControlBarSpacingPercent(uiConfig, baseUIConfig);

			const containers = uiConfig?.controlBar?.layoutGroups || baseUIConfig?.controlBar?.layoutGroups;

			if (containers && Array.isArray(containers) && containers.length > 0) {
				const dimensions = calculateContainerDimensions({
					contentHeightPercent,
					availableHeight,
					height
				});

				const containerHeight = dimensions.containerHeight;
				const baseContainerHeight = dimensions.baseContainerHeight;

				// Validate container widths if callback provided
				if (validateContainerWidthsCallback) {
					containerWidths = validateContainerWidthsCallback(containerWidths, containerHeight, uiConfig, baseUIConfig);
				}

				// Recalculate container positions with fresh widths
				const positionResult = calculateContainerPositions({
					containers,
					containerHeight,
					width,
					height,
					horizontalPaddingLeft,
					verticalPaddingBottom,
					availableWidth,
					centerX,
					containerWidths,
					spacingPercent,
					baseContainerHeight,
					uiConfig,
					baseUIConfig
				});

				// Recalculate controlBarBackgroundTop based on the new topmostContainerTop
				const recalculatedControlBarBackgroundTop = calculateControlBarBackgroundTop(
					positionResult.topmostContainerTop,
					uiConfig,
					baseUIConfig,
					height
				);

				// Update layoutPositions with new values
				layoutPositions.containerPositions = positionResult.containerPositions;
				layoutPositions.controlBarBackgroundTop = recalculatedControlBarBackgroundTop;
				layoutPositions.bottommostContainerBottom = height; // Always at screen bottom

				// Recalculate header positions if header config exists
				const headerConfig = getHeaderConfig(uiConfig, baseUIConfig);
				if (headerConfig) {
					const headerResult = calculateHeaderPositions({
						items: headerConfig.items,
						controlBarBackgroundTop: recalculatedControlBarBackgroundTop,
						width,
						height,
						verticalOffset: headerConfig.verticalOffset,
						centerX,
						uiConfig,
						baseUIConfig
					});
					layoutPositions.headerPositions = headerResult.headerPositions;
				}

				// Apply positions using ControlBarManager.layoutControlBar
				if (scene.controlBarManager) {
					scene.controlBarManager.layoutControlBar(layoutPositions, width);

					// After positioning, get actual bounds to calculate accurate background dimensions
					const actualBounds = SceneLayoutService.getControlBarActualBounds(scene);
					if (actualBounds) {
						const actualControlBarBackgroundTop = calculateControlBarBackgroundTop(
							actualBounds.top,
							uiConfig,
							baseUIConfig,
							height
						);
						layoutPositions.controlBarBackgroundTop = actualControlBarBackgroundTop;
						layoutPositions.bottommostContainerBottom = height;

						// Recalculate header positions with updated controlBarBackgroundTop
						if (headerConfig) {
							const headerResult = calculateHeaderPositions({
								items: headerConfig.items,
								controlBarBackgroundTop: actualControlBarBackgroundTop,
								width,
								height,
								verticalOffset: headerConfig.verticalOffset,
								centerX,
								uiConfig,
								baseUIConfig
							});
							layoutPositions.headerPositions = headerResult.headerPositions;
						}
					}

					// Create/update header text fields with final calculated positions
					if (layoutPositions.headerPositions) {
						scene.controlBarManager.createHeaderTextFields(layoutPositions);
						scene.controlBarManager.updateHeaderBetText();
					}
				}

				// Always recalculate cardContainerY after getting actual bounds
				const cardContainerConfig = getCardContainerConfig(uiConfig, baseUIConfig);
				const offsetYPercent = cardContainerConfig.offsetYPercent ?? 0.0;
				const offsetY = height * offsetYPercent;

				if (layoutPositions.controlBarBackgroundTop !== undefined && 
				    layoutPositions.controlBarBackgroundTop !== null && 
				    !isNaN(layoutPositions.controlBarBackgroundTop) && 
				    layoutPositions.controlBarBackgroundTop > 0 && 
				    layoutPositions.controlBarBackgroundTop < height) {
					const baseCardContainerY = (0 + layoutPositions.controlBarBackgroundTop) / 2;
					layoutPositions.cardContainerY = baseCardContainerY + offsetY;
				} else if (layoutPositions.controlBarTop !== undefined && 
				           layoutPositions.controlBarTop !== null && 
				           !isNaN(layoutPositions.controlBarTop) && 
				           layoutPositions.controlBarTop > 0 && 
				           layoutPositions.controlBarTop < height) {
					const baseCardContainerY = (0 + layoutPositions.controlBarTop) / 2;
					layoutPositions.cardContainerY = baseCardContainerY + offsetY;
				}

				// Apply card container layout if callback provided
				if (applyCardContainerLayoutCallback) {
					applyCardContainerLayoutCallback(layoutPositions, uiConfig, baseUIConfig, height, verticalPaddingBottom, containerHeight);
				}
			}
		} finally {
			scene._isRecalculatingLayout = false;
		}
	}
}

