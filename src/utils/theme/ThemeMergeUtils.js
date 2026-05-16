/**
 * Merge pull-tab theme JSON with src/config/themes/default.json.
 * Mirrors the Scratch pattern: nested objects merge, arrays/primitives replace, null keeps default entry.
 */

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
