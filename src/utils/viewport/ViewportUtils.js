/**
 * Viewport Utility Functions
 * Provides helper functions for accessing viewport/screen dimensions and orientation
 *
 * Layout uses the tighter of VisualViewport sizing (Safari toolbar-safe) and Phaser game.scale dimensions.
 * Never larger than the visual viewport: avoids the toolbar covering the control bar. Never larger than
 * game.scale: avoids card math targeting excess coordinate space before the first resize settles (iframes/live).
 */

import DeviceDetector from '../device/DeviceDetector.js';
import ViewportHelper from './ViewportHelper.js';

/**
 * Screen width shared by layout/card math - min(visualViewport, Phaser canvas) when scene scale exists.
 * @param {Phaser.Scene|null|undefined} scene
 * @returns {number}
 */
export function getScreenWidth(scene) {
	const vv = ViewportHelper.getWidth();
	const gw = scene?.sys?.game?.scale?.width;
	if (typeof gw !== 'number' || !Number.isFinite(gw) || gw <= 0) {
		return vv > 0 ? vv : 1920;
	}
	if (!Number.isFinite(vv) || vv <= 0) {
		return gw;
	}
	return Math.min(vv, gw);
}

/**
 * Screen height shared by layout/card math - see {@link getScreenWidth}.
 * @param {Phaser.Scene|null|undefined} scene
 * @returns {number}
 */
export function getScreenHeight(scene) {
	const vv = ViewportHelper.getHeight();
	const gh = scene?.sys?.game?.scale?.height;
	if (typeof gh !== 'number' || !Number.isFinite(gh) || gh <= 0) {
		return vv > 0 ? vv : 1080;
	}
	if (!Number.isFinite(vv) || vv <= 0) {
		return gh;
	}
	return Math.min(vv, gh);
}

/**
 * Get screen center coordinates
 * @param {Phaser.Scene} scene - Phaser scene object
 * @returns {Object} Object with x and y center coordinates
 */
export function getScreenCenter(scene) {
	return {
		x: getScreenWidth(scene) / 2,
		y: getScreenHeight(scene) / 2
	};
}

/**
 * Check if screen is in portrait orientation
 * @param {Phaser.Scene} scene - Phaser scene object
 * @returns {boolean} True if portrait, false if landscape
 */
export function isPortrait(scene) {
	const height = getScreenHeight(scene);
	const width = getScreenWidth(scene);
	return height > width;
}

/**
 * Check if screen is in landscape orientation
 * @param {Phaser.Scene} scene - Phaser scene object
 * @returns {boolean} True if landscape, false if portrait
 */
export function isLandscape(scene) {
	return !isPortrait(scene);
}

/**
 * Get screen orientation as string
 * @param {Phaser.Scene} scene - Phaser scene object
 * @returns {'portrait'|'landscape'|'square'}
 */
export function getOrientation(scene) {
	const height = getScreenHeight(scene);
	const width = getScreenWidth(scene);

	if (height > width) {
		return 'portrait';
	} else if (width > height) {
		return 'landscape';
	} else {
		return 'square';
	}
}

/**
 * Get device type from scene
 * @param {Phaser.Scene} scene - Phaser scene object
 * @returns {string} Device type: 'mobile' or 'desktop' (compatibility with old API)
 */
export function getDeviceTypeFromScene(scene) {
	const width = getScreenWidth(scene);
	const height = getScreenHeight(scene);
	return DeviceDetector.isMobileDevice(width, height) ? 'mobile' : 'desktop';
}

/**
 * Check if device is mobile from scene
 * @param {Phaser.Scene} scene - Phaser scene object
 * @returns {boolean} True if mobile device (phone or tablet)
 */
export function isMobileFromScene(scene) {
	const width = getScreenWidth(scene);
	const height = getScreenHeight(scene);
	return DeviceDetector.isMobileDevice(width, height);
}

/**
 * Check if device is desktop from scene
 * @param {Phaser.Scene} scene - Phaser scene object
 * @returns {boolean} True if desktop device
 */
export function isDesktopFromScene(scene) {
	const width = getScreenWidth(scene);
	const height = getScreenHeight(scene);
	return DeviceDetector.isDesktopDevice(width, height);
}
