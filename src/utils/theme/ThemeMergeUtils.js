/**
 * Merge pull-tab theme JSON with src/config/themes/default.json.
 * Mirrors the Scratch pattern: nested objects merge, arrays/primitives replace, null keeps default entry.
 */

import { fetchWithTimeout } from '../network/fetchWithTimeout.js';
import { warn } from '../logger/LoggerUtils.js';

/**
 * @param {Object|null} defaultTheme
 * @param {Object|null} themeOverride
 * @param {number} [depth]
 * @returns {Object}
 */
export function mergeThemeWithDefault(defaultTheme, themeOverride, depth = 0) {
	if (!defaultTheme || typeof defaultTheme !== 'object') {
		return themeOverride ? { ...themeOverride } : {};
	}
	if (!themeOverride || typeof themeOverride !== 'object') {
		return JSON.parse(JSON.stringify(defaultTheme));
	}

	const merged = JSON.parse(JSON.stringify(defaultTheme));

	for (const key in themeOverride) {
		if (!Object.prototype.hasOwnProperty.call(themeOverride, key)) continue;

		const overrideValue = themeOverride[key];
		const defaultValue = merged[key];

		if (overrideValue === null) {
			continue;
		}

		if (Array.isArray(overrideValue)) {
			merged[key] = overrideValue;
			continue;
		}

		if (
			typeof overrideValue === 'object' &&
			overrideValue !== null &&
			!Array.isArray(overrideValue)
		) {
			if (typeof defaultValue === 'object' && defaultValue !== null && !Array.isArray(defaultValue)) {
				merged[key] = mergeThemeWithDefault(defaultValue, overrideValue, depth + 1);
			} else {
				merged[key] = overrideValue;
			}
			continue;
		}

		merged[key] = overrideValue;
	}

	return merged;
}

/**
 * Load theme JSON before Preload queues Phaser assets (Boot scene).
 *
 * @param {string} themeName
 * @returns {Promise<{ themeData: Record<string, unknown>, themeOverride: Record<string, unknown>|null }>}
 */
export async function loadThemeWithOverride(themeName) {
	const cacheBuster = Date.now();
	let defaultTheme = null;
	let themeOverride = null;

	try {
		const defaultResponse = await fetchWithTimeout(
			`src/config/themes/default.json?t=${cacheBuster}`,
			{},
			8000,
		);
		if (defaultResponse.ok) {
			defaultTheme = await defaultResponse.json();
		}
	} catch (error) {
		warn('Failed to load default.json:', 'theme', error);
	}

	const resolvedName = themeName && themeName !== '' ? themeName : 'default';
	try {
		const themeResponse = await fetchWithTimeout(
			`src/config/themes/${resolvedName}.json?t=${cacheBuster}`,
			{},
			8000,
		);
		if (themeResponse.ok) {
			themeOverride = await themeResponse.json();
		} else if (resolvedName === 'default' && defaultTheme) {
			themeOverride = defaultTheme;
		}
	} catch (error) {
		warn(`Failed to load theme ${resolvedName}.json:`, 'theme', error);
	}

	let themeData;
	if (defaultTheme && themeOverride) {
		themeData = mergeThemeWithDefault(defaultTheme, themeOverride);
	} else if (themeOverride) {
		themeData = themeOverride;
	} else if (defaultTheme) {
		themeData = defaultTheme;
	} else {
		themeData = {};
	}

	return { themeData, themeOverride };
}
