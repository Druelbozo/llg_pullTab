/**
 * CardContainerService
 * 
 * Manages card container and message text positioning/sizing for Phaser scenes.
 * Encapsulates card container layout logic previously in Level.js.
 */

import { getMessageTextConfig } from '../../utils/layout/ConfigAccessUtils.js';
import { computeCenterInLeftBandPlacement } from '../../utils/layout/MessageTextPositioningUtils.js';
import { calculateCardContainerSize, getImageOriginalDimensions } from '../../utils/layout/CardContainerUtils.js';
import { drawCardContainerBounds, drawScratchBackingGridDebug } from '../../utils/layout/LayoutDebugUtils.js';
import { applyMessageTextTheme } from '../../utils/ui/theme/ThemeApplicationUtils.js';
import { getScreenWidth } from '../../utils/viewport/ViewportUtils.js';
import { animateScaleIn } from '../../utils/animation/AnimationUtils.js';
import { debug, warn, error } from '../../utils/logger/LoggerUtils.js';

export default class CardContainerService {
	constructor(scene) {
		this.scene = scene;
		// Cache aspect ratio to avoid recalculating
		this.cardContainerAspectRatio = 0;
		// Track if message text has been animated (to only animate on first appearance)
		this._messageTextAnimated = false;
	}

	/**
	 * Apply card container layout: calculate size, position container, and position message text
	 * 
	 * @param {Object} layoutPositions - Layout positions object
	 * @param {Object} uiConfig - UI config from layout
	 * @param {Object} baseUIConfig - Base UI config from layout
	 * @param {number} height - Screen height
	 * @param {number} verticalPaddingBottom - Vertical padding bottom
	 * @param {number} containerHeight - Container height
	 * @returns {void}
	 */
	applyLayout(layoutPositions, uiConfig, baseUIConfig, height, verticalPaddingBottom, containerHeight) {
		debug('Checking cardContainer conditions:', 'layout', {
			hasCardContainer: !!this.scene.cardContainer,
			hasShockWave: !!this.scene.shockWave,
			cardContainerX: layoutPositions.cardContainerX,
			cardContainerY: layoutPositions.cardContainerY,
			hasCardContainerConfig: !!layoutPositions.cardContainerConfig,
			controlBarBackgroundTop: layoutPositions.controlBarBackgroundTop,
			controlBarTop: layoutPositions.controlBarTop,
			allLayoutPositionKeys: Object.keys(layoutPositions)
		});

		if (!layoutPositions.cardContainerX || !layoutPositions.cardContainerY) {
			warn('cardContainerX or cardContainerY undefined:', 'layout', {
				cardContainerX: layoutPositions.cardContainerX,
				cardContainerY: layoutPositions.cardContainerY
			});
			return;
		}

		if (!this.scene.cardContainer || !this.scene.shockWave) {
			warn('cardContainer or shockWave missing:', 'layout', {
				hasCardContainer: !!this.scene.cardContainer,
				hasShockWave: !!this.scene.shockWave
			});
			return;
		}

		debug('cardContainerX and cardContainerY are defined, entering cardContainer calculation', 'layout');
		debug('cardContainer and shockWave exist, calculating size', 'layout');

		// Calculate aspect ratio if not already cached
		debug('Checking aspect ratio...', 'layout', { currentAspectRatio: this.cardContainerAspectRatio });
		if (this.cardContainerAspectRatio === 0) {
			debug('Calculating aspect ratio from shockWave...', 'layout');
			const { width, height: imgHeight } = getImageOriginalDimensions(this.scene.shockWave, 0);
			debug('Image dimensions:', 'layout', { width, height: imgHeight });
			if (width > 0 && imgHeight > 0) {
				this.cardContainerAspectRatio = width / imgHeight;
				debug(`Calculated aspect ratio: ${this.cardContainerAspectRatio}`, 'layout');
			}
		}

		// Calculate card container scale and dimensions
		// Use controlBarBackgroundTop (the actual top of the control bar) for space calculation
		const controlBarTop = layoutPositions.controlBarBackgroundTop ?? layoutPositions.controlBarTop ?? (height - verticalPaddingBottom - containerHeight);

		debug('CardContainer calculation:', 'layout', {
			controlBarBackgroundTop: layoutPositions.controlBarBackgroundTop,
			controlBarTop: layoutPositions.controlBarTop,
			fallbackControlBarTop: height - verticalPaddingBottom - containerHeight,
			usedControlBarTop: controlBarTop,
			cardContainerX: layoutPositions.cardContainerX,
			cardContainerY: layoutPositions.cardContainerY,
			cardContainerConfig: layoutPositions.cardContainerConfig,
			hasShockWave: !!this.scene.shockWave,
			aspectRatio: this.cardContainerAspectRatio
		});

		let cardSize;
		try {
			debug('About to call calculateCardContainerSize...', 'layout');
			cardSize = calculateCardContainerSize({
				scene: this.scene,
				shockWave: this.scene.shockWave,
				controlBarTop: controlBarTop,
				config: layoutPositions.cardContainerConfig,
				aspectRatio: this.cardContainerAspectRatio
			});
			debug('calculateCardContainerSize returned successfully', 'layout');
		} catch (calcError) {
			error('ERROR in calculateCardContainerSize', 'layout', calcError);
			cardSize = { scale: 1, width: 0, height: 0 };
		}

		debug('CardContainer size result:', 'layout', {
			scale: cardSize.scale,
			width: cardSize.width,
			height: cardSize.height
		});

		// Position card container
		const positioned = this.positionContainer(layoutPositions, cardSize, controlBarTop, verticalPaddingBottom, containerHeight);

		// Position message text if card container was positioned successfully
		if (positioned) {
			this.positionMessageText(layoutPositions, cardSize, uiConfig, baseUIConfig);
		}
	}

	/**
	 * Position card container using calculated size
	 * 
	 * @param {Object} layoutPositions - Layout positions object
	 * @param {Object} cardSize - Card size result from calculateCardContainerSize
	 * @param {number} controlBarTop - Top of control bar
	 * @param {number} verticalPaddingBottom - Vertical padding bottom
	 * @param {number} containerHeight - Container height
	 * @returns {boolean} True if positioning was successful
	 */
	positionContainer(layoutPositions, cardSize, controlBarTop, verticalPaddingBottom, containerHeight) {
		if (!layoutPositions.cardContainerX || !layoutPositions.cardContainerY) {
			warn('cardContainerX or cardContainerY undefined:', 'layout', {
				cardContainerX: layoutPositions.cardContainerX,
				cardContainerY: layoutPositions.cardContainerY
			});
			return false;
		}

		if (!this.scene.cardContainer || !this.scene.shockWave) {
			warn('cardContainer or shockWave missing:', 'layout', {
				hasCardContainer: !!this.scene.cardContainer,
				hasShockWave: !!this.scene.shockWave
			});
			return false;
		}

		// Apply position and scale
		this.scene.cardContainer.setPosition(layoutPositions.cardContainerX, layoutPositions.cardContainerY);
		if (cardSize.scale > 0) {
			this.scene.cardContainer.setScale(cardSize.scale);
			// Ensure cardContainer is visible
			this.scene.cardContainer.setVisible(true);
			debug('CardContainer positioned and scaled:', 'layout', {
				x: layoutPositions.cardContainerX,
				y: layoutPositions.cardContainerY,
				scale: cardSize.scale,
				visible: this.scene.cardContainer.visible
			});
			return true;
		} else {
			warn('CardContainer scale is 0 or negative, not applying scale!', 'layout', {
				scale: cardSize.scale,
				cardSize,
				controlBarTop,
				availableHeight: controlBarTop - 0,
				heightPercent: layoutPositions.cardContainerConfig?.heightPercent
			});
			return false;
		}
	}

	/**
	 * Position and style message text relative to card container
	 * 
	 * @param {Object} layoutPositions - Layout positions object
	 * @param {Object} cardSize - Card size result from calculateCardContainerSize
	 * @param {Object} uiConfig - UI config from layout
	 * @param {Object} baseUIConfig - Base UI config from layout
	 * @returns {void}
	 */
	positionMessageText(layoutPositions, cardSize, uiConfig, baseUIConfig) {
		if (!this.scene.messageText || !this.scene.cardContainer || !layoutPositions.cardContainerX || !layoutPositions.cardContainerY) {
			return;
		}

		const messageTextConfig = getMessageTextConfig(uiConfig, baseUIConfig);

		// Apply theme styling with layout stroke override if provided
		if (this.scene.prefab_ScratchManager?.themeData) {
			const layoutStrokeConfig = messageTextConfig.stroke || null;
			applyMessageTextTheme(this.scene.messageText, this.scene.prefab_ScratchManager.themeData, layoutStrokeConfig);
		}

		// Use cardSize.height which is the actual rendered height (already calculated correctly)
		const cardDisplayHeight = cardSize.height;
		const messageTextHeight = cardDisplayHeight * messageTextConfig.heightPercent;

		// Set origin to center for horizontal centering (0.5, 0.5)
		this.scene.messageText.setOrigin(0.5, 0.5);

		// Calculate card container bounds
		const cardTopY = layoutPositions.cardContainerY - (cardDisplayHeight / 2);
		const cardBottomY = layoutPositions.cardContainerY + (cardDisplayHeight / 2);

		let messageTextCenterX = layoutPositions.cardContainerX;
		let messageTextCenterY;
		const screenWidth = getScreenWidth(this.scene);
		let maxTextWidth = screenWidth * 0.9;
		if (messageTextConfig.centerInLeftBand === true) {
			const cardCenterX = this.scene.cardContainer?.x ?? layoutPositions.cardContainerX;
			const placement = computeCenterInLeftBandPlacement(
				layoutPositions,
				cardSize,
				cardCenterX,
				this.scene,
				messageTextConfig.insetPercentHorizontal ?? 0
			);
			messageTextCenterX = placement.centerX;
			messageTextCenterY = placement.centerY;
			maxTextWidth = placement.maxTextWidth;
		} else if (messageTextConfig.centerVertically === true) {
			// Center vertically between top of screen (0) and top of cardContainer
			// percentY is ignored when centerVertically is true
			const screenTop = 0;
			messageTextCenterY = (screenTop + cardTopY) / 2;
		} else {
			// Use percentY relative to card's rendered bounds (existing behavior)
			//   percentY = 0: vertically centered at top of card
			//   percentY = 1: vertically centered at bottom of card
			const percentY = messageTextConfig.percentY ?? 0;
			messageTextCenterY = cardTopY + (percentY * (cardBottomY - cardTopY));
		}

		this.scene.messageText.setPosition(messageTextCenterX, messageTextCenterY);

		// Set font size based on calculated height
		const fontSize = Math.max(12, messageTextHeight * 0.8); // Use 80% of height as font size, minimum 12px
		this.scene.messageText.setFontSize(fontSize);

		// Set word wrap width to prevent text from extending off-screen
		this.scene.messageText.setWordWrapWidth(maxTextWidth);

		// Animate scale-in on first appearance only
		if (!this._messageTextAnimated) {
			this._messageTextAnimated = true;

			// Always use center origin (0.5, 0.5) for animation
			this.scene.messageText.setOrigin(0.5, 0.5);

			// Set initial scale to 0 and keep hidden until animation starts
			this.scene.messageText.setScale(0);
			this.scene.messageText.setVisible(false);

			// Animate to full scale - make visible when animation starts (after delay)
			const delay = 950;
			this.scene.time.delayedCall(delay, () => {
				// Ensure origin is center (0.5, 0.5) for animation
				this.scene.messageText.setOrigin(0.5, 0.5);
				this.scene.messageText.setVisible(true);
				animateScaleIn(this.scene, this.scene.messageText, 525, {
					startScale: 0,
					targetScale: 1
				});
			});
		} else {
			// Just ensure it's visible on subsequent calls
			// Ensure origin is center (0.5, 0.5) for consistency
			this.scene.messageText.setOrigin(0.5, 0.5);
			this.scene.messageText.setVisible(true);
		}

		debug('MessageText positioned and sized:', 'layout', {
			x: messageTextCenterX,
			y: messageTextCenterY,
			fontSize: fontSize,
			heightPercent: messageTextConfig.heightPercent,
			percentY: messageTextConfig.percentY,
			centerVertically: messageTextConfig.centerVertically,
			centerInLeftBand: messageTextConfig.centerInLeftBand,
			cardDisplayHeight: cardDisplayHeight,
			cardContainerY: layoutPositions.cardContainerY,
			cardTopY: cardTopY,
			cardBottomY: cardBottomY
		});

		// Update mask position after cardContainer is scaled/positioned
		if(this.scene.main_ScratchSurface && typeof this.scene.main_ScratchSurface.updateBackingMask === 'function') {
			this.scene.main_ScratchSurface.updateBackingMask();
		}
		
		// Draw cardContainer debug bounds if enabled
		drawCardContainerBounds({
			scene: this.scene,
			cardContainer: this.scene.cardContainer,
			messageText: this.scene.messageText,
			shockWave: this.scene.shockWave,
			cardSize: cardSize
		});

		drawScratchBackingGridDebug({ scene: this.scene });
	}
}

