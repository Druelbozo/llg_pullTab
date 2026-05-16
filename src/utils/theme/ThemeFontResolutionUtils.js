/**
 * Map Scratch-style theme.fonts declarations to google WebFont loader family specs.
 */

/**
 * @param {Object} themeData merged theme JSON
 * @returns {string[]|null}
 */
export function googleFamilySpecsFromThemeFonts(themeData) {
	const list =
		Array.isArray(themeData?.fonts) && themeData.fonts.length > 0
			? themeData.fonts
			: Array.isArray(themeData?.fontLoader?.fonts) && themeData.fontLoader.fonts.length > 0
				? themeData.fontLoader.fonts
				: null;
	if (!list) return null;

	return list.map((en) => {
		if (typeof en === 'string') {
			return `${en.trim()}:400`;
		}
		if (en && typeof en === 'object' && typeof en.family === 'string') {
			const ws = Array.isArray(en.weights) && en.weights.length ? en.weights.join(',') : '400';
			return `${en.family.trim()}:${ws}`;
		}
		return null;
	}).filter(Boolean);
}

/**
 * @param {Object} themeData
 * @returns {string|{family: string}|undefined}
 */
export function defaultControlBarFontFamilyFromTheme(themeData) {
	const f =
		Array.isArray(themeData?.fonts) && themeData.fonts.length > 0
			? themeData.fonts[0]
			: Array.isArray(themeData?.fontLoader?.fonts) && themeData.fontLoader.fonts.length > 0
				? themeData.fontLoader.fonts[0]
				: null;
	if (!f) return undefined;
	return typeof f === 'string' ? { family: f.trim() } : { family: f.family };
}
