/**
 * Stateless utility functions for formatting viewport debug information
 */

import ViewportHelper from '../../../utils/viewport/ViewportHelper.js';
import { 
	getScreenWidth, 
	getScreenHeight, 
	getScreenCenter, 
	getOrientation, 
	isPortrait, 
	isLandscape,
	getDeviceTypeFromScene,
	isMobileFromScene,
	isDesktopFromScene
} from '../../../utils/viewport/ViewportUtils.js';

/**
 * Format viewport debug information
 * @param {Phaser.Scene} scene - Phaser scene instance
 * @returns {string[]} Array of debug strings to display
 */
export function formatViewportDebugInfo(scene) {
	if (!scene) {
		return ['=== Viewport Debug ===', 'Scene not available'];
	}
	
	const lines = [];
	
	lines.push('=== Viewport Debug ===');
	
	// ViewportUtils functions
	lines.push('--- ViewportUtils ---');
	const screenWidth = getScreenWidth(scene);
	const screenHeight = getScreenHeight(scene);
	const screenCenter = getScreenCenter(scene);
	const orientation = getOrientation(scene);
	const portrait = isPortrait(scene);
	const landscape = isLandscape(scene);
	const deviceTypeFromScene = getDeviceTypeFromScene(scene);
	const mobileFromScene = isMobileFromScene(scene);
	const desktopFromScene = isDesktopFromScene(scene);
	
	lines.push(`getScreenWidth(): ${screenWidth.toFixed(1)}`);
	lines.push(`getScreenHeight(): ${screenHeight.toFixed(1)}`);
	lines.push(`getScreenCenter(): x=${screenCenter.x.toFixed(1)}, y=${screenCenter.y.toFixed(1)}`);
	lines.push(`getOrientation(): ${orientation}`);
	lines.push(`isPortrait(): ${portrait}`);
	lines.push(`isLandscape(): ${landscape}`);
	lines.push(`getDeviceTypeFromScene(): ${deviceTypeFromScene}`);
	lines.push(`isMobileFromScene(): ${mobileFromScene}`);
	lines.push(`isDesktopFromScene(): ${desktopFromScene}`);
	
	// ViewportHelper functions
	lines.push('');
	lines.push('--- ViewportHelper ---');
	const viewportWidth = ViewportHelper.getWidth();
	const viewportHeight = ViewportHelper.getHeight();
	const bottomInset = ViewportHelper.getBottomSafeAreaInset(scene);
	const visualViewportSupported = ViewportHelper.isVisualViewportSupported();
	
	lines.push(`getWidth(): ${viewportWidth.toFixed(1)}`);
	lines.push(`getHeight(): ${viewportHeight.toFixed(1)}`);
	lines.push(`getBottomSafeAreaInset(): ${bottomInset}px`);
	lines.push(`isVisualViewportSupported(): ${visualViewportSupported}`);
	
	// Viewport dimension comparison
	lines.push('');
	lines.push('--- Viewport Dimensions Comparison ---');
	const innerHeight = window.innerHeight;
	const innerWidth = window.innerWidth;
	const visualViewportHeight = window.visualViewport ? window.visualViewport.height : null;
	const visualViewportWidth = window.visualViewport ? window.visualViewport.width : null;
	
	lines.push(`window.innerWidth: ${innerWidth}`);
	lines.push(`window.innerHeight: ${innerHeight}`);
	lines.push(`ViewportHelper.getWidth(): ${viewportWidth.toFixed(1)}`);
	lines.push(`ViewportHelper.getHeight(): ${viewportHeight.toFixed(1)}`);
	
	if (visualViewportSupported && visualViewportHeight !== null) {
		lines.push(`visualViewport.width: ${visualViewportWidth}`);
		lines.push(`visualViewport.height: ${visualViewportHeight}`);
		lines.push(`Width Diff (inner - visual): ${(innerWidth - visualViewportWidth).toFixed(1)}px`);
		lines.push(`Height Diff (inner - visual): ${(innerHeight - visualViewportHeight).toFixed(1)}px`);
	} else {
		lines.push(`visualViewport: Not available`);
	}
	
	// Scene scale dimensions
	if (scene.scale) {
		lines.push('');
		lines.push('--- Scene Scale ---');
		lines.push(`scene.scale.width: ${scene.scale.width.toFixed(1)}`);
		lines.push(`scene.scale.height: ${scene.scale.height.toFixed(1)}`);
		lines.push(`Width Diff (scale - viewport): ${(scene.scale.width - viewportWidth).toFixed(1)}px`);
		lines.push(`Height Diff (scale - viewport): ${(scene.scale.height - viewportHeight).toFixed(1)}px`);
	}
	
	return lines;
}

