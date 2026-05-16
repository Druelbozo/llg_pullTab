/**
 * LayoutCalculationUtils
 * 
 * Pure functions for layout calculations.
 * Extracted from Level.js to improve testability and reusability.
 */

import { getContentHeightPercent, getLayoutConfigs } from './ConfigAccessUtils.js';
import { getScreenHeight } from '../viewport/ViewportUtils.js';
import { calculateContainerDimensions } from './ControlBarLayoutUtils.js';
import { warn, debug } from '../logger/LoggerUtils.js';

/**
 * Calculate and validate container widths for layout positioning
 * 
 * @param {Phaser.Scene} scene - The Phaser scene instance
 * @param {Object} controlBarManager - ControlBarManager instance
 * @param {Object} currentUiConfig - Current UI config from layout
 * @param {Object} currentBaseUIConfig - Base UI config from layout
 * @param {number} contentHeightPercent - Content height percent from layout config
 * @param {number} availableHeight - Available height for layout
 * @param {number} height - Screen height
 * @returns {Object} Container widths object
 */
export function calculateAndValidateContainerWidths(scene, controlBarManager, currentUiConfig, currentBaseUIConfig, contentHeightPercent, availableHeight, height) {
	// Get container widths from ControlBarManager (after containers are added to scene)
	// Note: Buttons must already be created and added to scene before calling this
	const containerWidths = controlBarManager.getContainerWidths();

	// CRITICAL: Ensure radialCounter has a valid width BEFORE calculateContainerPositions is called
	// This ensures it's included in layoutGroups processing
	if (scene.radialCounter) {
		// Always calculate radialCounter width - don't rely on getContainerWidths() finding it
		// Use contentHeight to calculate radialCounter width (it's a circle, so width = height)
		const screenHeight = getScreenHeight(scene);
		const contentHeightPercentForRadial = getContentHeightPercent(currentUiConfig, null, screenHeight) || 
		                                     getContentHeightPercent(currentBaseUIConfig, null, screenHeight) || 0.075;
		containerWidths.radialCounter = screenHeight * contentHeightPercentForRadial;
		debug(`[Level] Calculated radialCounter width BEFORE layout calculation: ${containerWidths.radialCounter}, containerWidths keys: ${Object.keys(containerWidths).join(', ')}`, 'layout');
	} else {
		warn(`[Level] radialCounter not found when calculating container widths`, 'layout');
	}

	// Validate container widths - if any are 0, use fallback
	const hasZeroWidths = Object.values(containerWidths).some(w => w === 0 || !w);
	if (hasZeroWidths) {
		warn(`[Level] Some container widths are 0, using fallback calculations`, 'layout');
		// Calculate containerHeight for fallback
		const dimensions = calculateContainerDimensions({
			contentHeightPercent,
			availableHeight,
			height
		});
		const fallbackHeight = dimensions.containerHeight || 100;
		if (!containerWidths.soundButton || containerWidths.soundButton === 0) containerWidths.soundButton = fallbackHeight;
		if (!containerWidths.infoButton || containerWidths.infoButton === 0) containerWidths.infoButton = fallbackHeight;
		if (!containerWidths.playButton || containerWidths.playButton === 0) containerWidths.playButton = fallbackHeight * 2; // Play button is wider
		if (!containerWidths.autoButton || containerWidths.autoButton === 0) containerWidths.autoButton = fallbackHeight;
		if (!containerWidths.speedButton || containerWidths.speedButton === 0) containerWidths.speedButton = fallbackHeight;
		if (!containerWidths.balanceContainer || containerWidths.balanceContainer === 0) containerWidths.balanceContainer = 200;
		if (!containerWidths.radialCounter || containerWidths.radialCounter === 0) {
			// Use contentHeight to calculate radialCounter width (it's a circle, so width = height)
			const screenHeight = getScreenHeight(scene);
			const contentHeightPercentForRadial = getContentHeightPercent(currentUiConfig, null, screenHeight) || 
			                                     getContentHeightPercent(currentBaseUIConfig, null, screenHeight) || 0.075;
			containerWidths.radialCounter = screenHeight * contentHeightPercentForRadial;
		}
	}

	return containerWidths;
}

/**
 * Validate container widths during resize and apply fallbacks if needed
 * 
 * @param {Object} containerWidths - Container widths object
 * @param {number} containerHeight - Calculated container height
 * @param {Object} uiConfig - UI config from layout
 * @param {Object} baseUIConfig - Base UI config from layout
 * @param {Phaser.Scene} scene - The Phaser scene instance
 * @param {Object} layoutManager - LayoutManager instance
 * @returns {Object} Validated container widths object
 */
export function validateContainerWidthsOnResize(containerWidths, containerHeight, uiConfig, baseUIConfig, scene, layoutManager) {
	// Validate container widths - if any are 0, use calculated containerHeight as fallback
	const hasZeroWidths = Object.values(containerWidths).some(w => w === 0 || !w);
	if (hasZeroWidths) {
		warn(`[Level] Some container widths are 0 during resize, using calculated containerHeight as fallback`, 'layout');
		if (!containerWidths.soundButton || containerWidths.soundButton === 0) containerWidths.soundButton = containerHeight;
		if (!containerWidths.infoButton || containerWidths.infoButton === 0) containerWidths.infoButton = containerHeight;
		if (!containerWidths.playButton || containerWidths.playButton === 0) containerWidths.playButton = containerHeight * 2; // Play button is wider
		if (!containerWidths.autoButton || containerWidths.autoButton === 0) containerWidths.autoButton = containerHeight;
		if (!containerWidths.speedButton || containerWidths.speedButton === 0) containerWidths.speedButton = containerHeight;
		if (!containerWidths.balanceContainer || containerWidths.balanceContainer === 0) containerWidths.balanceContainer = 200;
		if (!containerWidths.radialCounter || containerWidths.radialCounter === 0) {
			// Use contentHeight to calculate radialCounter width (it's a circle, so width = height)
			const screenHeight = getScreenHeight(scene);
			const layoutName = layoutManager.getCurrentLayoutName();
			const { uiConfig: currentUiConfig, baseUIConfig: currentBaseUIConfig } = getLayoutConfigs(layoutManager, layoutName);
			const contentHeightPercent = getContentHeightPercent(currentUiConfig, null, screenHeight) || 
			                            getContentHeightPercent(currentBaseUIConfig, null, screenHeight) || 0.075;
			containerWidths.radialCounter = screenHeight * contentHeightPercent;
		}
	}

	return containerWidths;
}

/**
 * Calculate radialCounter width based on content height percent
 * 
 * @param {Phaser.Scene} scene - The Phaser scene instance
 * @param {Object} layoutManager - LayoutManager instance
 * @returns {number} RadialCounter width (same as height since it's a circle)
 */
export function calculateRadialCounterWidth(scene, layoutManager) {
	const screenHeight = getScreenHeight(scene);
	const layoutName = layoutManager.getCurrentLayoutName();
	const { uiConfig, baseUIConfig } = getLayoutConfigs(layoutManager, layoutName);
	const contentHeightPercent = getContentHeightPercent(uiConfig, null, screenHeight) || 
	                            getContentHeightPercent(baseUIConfig, null, screenHeight) || 0.075;
	return screenHeight * contentHeightPercent;
}

/**
 * Get fallback container widths for when actual widths aren't available
 * 
 * @param {number} containerHeight - Calculated container height
 * @returns {Object} Fallback container widths object
 */
export function getFallbackContainerWidths(containerHeight) {
	return {
		soundButton: containerHeight,
		infoButton: containerHeight,
		playButton: containerHeight * 2, // Play button is wider (aspect ratio 2)
		autoButton: containerHeight,
		speedButton: containerHeight,
		balanceContainer: 200
	};
}

