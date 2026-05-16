/**
 * Skip theme scratch cursor preload when the UI layout at load time would be a *-mobile layout.
 * Mirrors LayoutRegistry priority + LayoutManager needs*Layout rules (no Phaser scene).
 *
 * Note: If the user resizes/orients from a mobile layout to portrait/landscape (non-mobile), the cursor
 * texture may not be in cache until a future enhancement (lazy load).
 */
import DeviceDetector from '../device/DeviceDetector.js';

const DEFAULT_ENABLED_LAYOUTS = ['portrait-mobile', 'landscape-mobile', 'portrait', 'landscape'];

/** Same priority order as layoutRegistry (lower priority number = checked first). */
const LAYOUT_SELECTION_ORDER = ['landscape-mobile', 'portrait-mobile', 'landscape', 'portrait'];

/**
 * @param {string} deviceType
 * @param {{ enabledLayouts?: string[], phoneEnabledLayouts?: string[]|null, tabletEnabledLayouts?: string[]|null, desktopEnabledLayouts?: string[]|null }} [config]
 * @returns {string[]}
 */
function getEnabledLayoutsForDeviceType(deviceType, config = {}) {
	const fallback = config.enabledLayouts || DEFAULT_ENABLED_LAYOUTS;
	if (deviceType === 'phone' && config.phoneEnabledLayouts?.length) {
		return [...config.phoneEnabledLayouts];
	}
	if (deviceType === 'tablet' && config.tabletEnabledLayouts?.length) {
		return [...config.tabletEnabledLayouts];
	}
	if (deviceType === 'desktop' && config.desktopEnabledLayouts?.length) {
		return [...config.desktopEnabledLayouts];
	}
	return [...fallback];
}

function needsPortraitMobileLayout(width, height, orientation, deviceType, enabledLayouts) {
	if (!enabledLayouts.includes('portrait-mobile')) {
		return false;
	}
	if (deviceType === 'phone' && orientation === 'portrait') {
		return true;
	}
	const aspectRatio = width / height;
	return orientation === 'portrait' && height < 768 && aspectRatio < 0.7;
}

function needsLandscapeMobileLayout(width, height, orientation, deviceType, enabledLayouts) {
	if (!enabledLayouts.includes('landscape-mobile')) {
		return false;
	}
	if (deviceType === 'phone' && orientation === 'landscape') {
		return true;
	}
	const aspectRatio = width / height;
	return orientation === 'landscape' && width < 768 && aspectRatio > 1.4;
}

function needsPortraitLayout(width, height, orientation, deviceType, enabledLayouts) {
	if (!enabledLayouts.includes('portrait')) {
		return false;
	}
	if (needsPortraitMobileLayout(width, height, orientation, deviceType, enabledLayouts)) {
		return false;
	}
	return orientation === 'portrait';
}

function needsLandscapeLayout(width, height, orientation, deviceType, enabledLayouts) {
	if (!enabledLayouts.includes('landscape')) {
		return false;
	}
	if (needsLandscapeMobileLayout(width, height, orientation, deviceType, enabledLayouts)) {
		return false;
	}
	if (orientation === 'landscape') {
		return true;
	}
	if (enabledLayouts.length === 1 && enabledLayouts[0] === 'landscape') {
		return true;
	}
	return false;
}

/**
 * Which layout name would be selected at this size (same logic as LayoutSelector + filtered registry).
 * @param {number} width
 * @param {number} height
 * @param {{ enabledLayouts?: string[], phoneEnabledLayouts?: string[]|null, tabletEnabledLayouts?: string[]|null, desktopEnabledLayouts?: string[]|null }} [layoutConfig]
 * @returns {string|null}
 */
export function getPreloadSelectedLayoutName(width, height, layoutConfig = {}) {
	const deviceType = DeviceDetector.getDeviceType(width, height, navigator.userAgent);
	let enabledLayouts = getEnabledLayoutsForDeviceType(deviceType, layoutConfig);

	if (DeviceDetector.isDesktopDevice(width, height, navigator.userAgent) && enabledLayouts.includes('portrait')) {
		enabledLayouts = enabledLayouts.filter((l) => l !== 'portrait');
	}

	const orientation = height > width ? 'portrait' : 'landscape';

	for (const name of LAYOUT_SELECTION_ORDER) {
		if (!enabledLayouts.includes(name)) {
			continue;
		}
		if (name === 'landscape-mobile' && needsLandscapeMobileLayout(width, height, orientation, deviceType, enabledLayouts)) {
			return name;
		}
		if (name === 'portrait-mobile' && needsPortraitMobileLayout(width, height, orientation, deviceType, enabledLayouts)) {
			return name;
		}
		if (name === 'landscape' && needsLandscapeLayout(width, height, orientation, deviceType, enabledLayouts)) {
			return name;
		}
		if (name === 'portrait' && needsPortraitLayout(width, height, orientation, deviceType, enabledLayouts)) {
			return name;
		}
	}
	return null;
}

/**
 * @param {number} width
 * @param {number} height
 * @param {{ enabledLayouts?: string[], phoneEnabledLayouts?: string[]|null, tabletEnabledLayouts?: string[]|null, desktopEnabledLayouts?: string[]|null }} [layoutConfig]
 * @returns {boolean}
 */
export function shouldSkipThemeCursorPreload(width, height, layoutConfig = {}) {
	const name = getPreloadSelectedLayoutName(width, height, layoutConfig);
	return name === 'portrait-mobile' || name === 'landscape-mobile';
}
