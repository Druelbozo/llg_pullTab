/**
 * Stateless utility functions for formatting device debug information
 */

import DeviceDetector from '../../../utils/device/DeviceDetector.js';
import { getDPR, isTouchSupported } from '../../../utils/device/DeviceUtils.js';
import { getScreenWidth, getScreenHeight } from '../../../utils/viewport/ViewportUtils.js';

/**
 * Format device debug information
 * @param {Phaser.Scene} scene - Phaser scene instance (optional, for dimensions)
 * @returns {string[]} Array of debug strings to display
 */
export function formatDeviceDebugInfo(scene = null) {
	const lines = [];
	
	lines.push('=== Device Debug ===');
	
	// Get dimensions (use scene if available, otherwise window)
	const width = scene ? getScreenWidth(scene) : window.innerWidth;
	const height = scene ? getScreenHeight(scene) : window.innerHeight;
	
	// DeviceDetector information
	lines.push('--- DeviceDetector ---');
	const browser = DeviceDetector.getBrowser();
	const os = DeviceDetector.getOS();
	const deviceType = DeviceDetector.getDeviceType(width, height);
	const deviceInfo = DeviceDetector.getDeviceInfo(width, height, undefined, scene);
	const isMobileDevice = DeviceDetector.isMobileDevice(width, height);
	const isDesktopDevice = DeviceDetector.isDesktopDevice(width, height);
	const isTablet = DeviceDetector.isTablet(width, height);
	const isPhone = DeviceDetector.isPhone(width, height);
	const isIOS = DeviceDetector.isIOS();
	const isAndroid = DeviceDetector.isAndroid();
	const isiPadOS = DeviceDetector.isiPadOS();
	
	lines.push(`getBrowser(): ${browser}`);
	lines.push(`getOS(): ${os}`);
	lines.push(`getDeviceType(): ${deviceType}`);
	lines.push(`isMobileDevice(): ${isMobileDevice}`);
	lines.push(`isDesktopDevice(): ${isDesktopDevice}`);
	lines.push(`isTablet(): ${isTablet}`);
	lines.push(`isPhone(): ${isPhone}`);
	lines.push(`isIOS(): ${isIOS}`);
	lines.push(`isAndroid(): ${isAndroid}`);
	lines.push(`isiPadOS(): ${isiPadOS}`);
	
	// DeviceInfo object details
	if (deviceInfo) {
		lines.push('');
		lines.push('--- DeviceInfo Object ---');
		lines.push(`browser: ${deviceInfo.browser}`);
		lines.push(`os: ${deviceInfo.os}`);
		lines.push(`deviceType: ${deviceInfo.deviceType}`);
		lines.push(`orientation: ${deviceInfo.orientation}`);
		lines.push(`isMobile: ${deviceInfo.isMobile}`);
		lines.push(`isMobileDevice: ${deviceInfo.isMobileDevice}`);
		lines.push(`isDesktopDevice: ${deviceInfo.isDesktopDevice}`);
		lines.push(`isTablet: ${deviceInfo.isTablet}`);
		lines.push(`isPhone: ${deviceInfo.isPhone}`);
		lines.push(`isIOS: ${deviceInfo.isIOS}`);
		lines.push(`isAndroid: ${deviceInfo.isAndroid}`);
		lines.push(`width: ${deviceInfo.width}`);
		lines.push(`height: ${deviceInfo.height}`);
	}
	
	// DeviceUtils information
	lines.push('');
	lines.push('--- DeviceUtils ---');
	const dpr = getDPR();
	const touchSupported = isTouchSupported();
	
	lines.push(`getDPR(): ${dpr}`);
	lines.push(`isTouchSupported(): ${touchSupported}`);
	
	// User Agent info
	lines.push('');
	lines.push('--- User Agent ---');
	if (typeof navigator !== 'undefined') {
		lines.push(`userAgent: ${navigator.userAgent}`);
		lines.push(`platform: ${navigator.platform || 'N/A'}`);
		lines.push(`vendor: ${navigator.vendor || 'N/A'}`);
		lines.push(`maxTouchPoints: ${navigator.maxTouchPoints !== undefined ? navigator.maxTouchPoints : 'N/A'}`);
		if (navigator.userAgentData) {
			lines.push(`userAgentData.platform: ${navigator.userAgentData.platform || 'N/A'}`);
		}
	}
	
	// Dimensions used for detection
	lines.push('');
	lines.push('--- Detection Dimensions ---');
	lines.push(`Width: ${width}`);
	lines.push(`Height: ${height}`);
	lines.push(`Max Dimension: ${Math.max(width, height)}`);
	lines.push(`Min Dimension: ${Math.min(width, height)}`);
	
	return lines;
}

