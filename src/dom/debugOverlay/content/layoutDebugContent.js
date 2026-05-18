/**
 * Stateless utility functions for formatting layout debug information for scratch cards
 */

import ViewportHelper from '../../../utils/viewport/ViewportHelper.js';
import { getScreenWidth, getScreenHeight } from '../../../utils/viewport/ViewportUtils.js';

/**
 * Format layout debug information from LayoutManager
 * @param {LayoutManager} layoutManager - LayoutManager instance (new layout system)
 * @returns {string[]} Array of debug strings to display
 */
export function formatLayoutDebugInfo(layoutManager) {
	if (!layoutManager || !layoutManager.scene) {
		return ['=== Layout Debug ===', 'LayoutManager not available'];
	}
	
	const canvasHeight = layoutManager.scene.scale.height;
	const canvasWidth = layoutManager.scene.scale.width;
	const viewportHeight = ViewportHelper.getHeight();
	const viewportWidth = ViewportHelper.getWidth();
	
	// Get current layout information
	const currentLayoutName = layoutManager.getCurrentLayoutName() || 'Unknown';
	const layoutPositions = layoutManager.getLayoutPositions();
	
	// Get device information
	const deviceType = layoutManager.deviceType || 'Unknown';
	const orientation = layoutManager.orientation || 'Unknown';
	const isDesktop = layoutManager.isDesktop || false;
	const isMobile = layoutManager.isMobile || false;
	const isTablet = layoutManager.deviceType === 'tablet';
	
	// Get control bar information from layout positions
	const controlBarTop = layoutPositions?.controlBarBackgroundTop || 0;
	const cardContainerX = layoutPositions?.cardContainerX || 0;
	const cardContainerY = layoutPositions?.cardContainerY || 0;
	const cardContainerWidth = layoutPositions?.cardContainerWidth || 0;
	const cardContainerHeight = layoutPositions?.cardContainerHeight || 0;
	
	// Get container positions
	const containerPositions = layoutPositions?.containerPositions || {};
	const containerCount = Object.keys(containerPositions).length;
	
	return [
		`=== LAYOUT DEBUG ===`,
		`--- Current Layout ---`,
		`Layout: ${currentLayoutName}`,
		`Device: ${deviceType}`,
		`Orientation: ${orientation}`,
		`Desktop: ${isDesktop ? '✅' : '❌'}`,
		`Mobile: ${isMobile ? '✅' : '❌'}`,
		`Tablet: ${isTablet ? '✅' : '❌'}`,
		`--- Canvas Dimensions ---`,
		`canvasHeight: ${canvasHeight.toFixed(1)}`,
		`canvasWidth: ${canvasWidth.toFixed(1)}`,
		`viewportHeight: ${viewportHeight.toFixed(1)}`,
		`viewportWidth: ${viewportWidth.toFixed(1)}`,
		`Height Diff: ${(canvasHeight - viewportHeight).toFixed(1)}px`,
		`--- Control Bar ---`,
		`Background Top: ${controlBarTop.toFixed(1)}`,
		`Containers: ${containerCount}`,
		`--- Card Container ---`,
		`Position: (${cardContainerX.toFixed(1)}, ${cardContainerY.toFixed(1)})`,
		`Size: ${cardContainerWidth.toFixed(1)} x ${cardContainerHeight.toFixed(1)}`,
		`--- Container Positions ---`,
		...Object.entries(containerPositions).map(([name, pos]) => 
			`${name}: (${pos.x?.toFixed(1) || 'N/A'}, ${pos.y?.toFixed(1) || 'N/A'})`
		)
	];
}

