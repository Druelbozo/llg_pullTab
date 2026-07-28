/**
 * Paytable tier symbol → peel-tab atlas frame index (symbol_01 → 0).
 */

/** Matches paytable tier symbols like symbol_01 → capture group 1 = 1-based tier index */
export const SYMBOL_RE = /^symbol_(\d+)$/i;

/**
 * @param {string} symbol
 * @returns {number}
 */
export function tierSymbolToFrameIndex(symbol) {
	const raw = String(symbol ?? '').trim();
	const m = SYMBOL_RE.exec(raw);
	if (!m) {
		return 0;
	}
	return Math.max(0, parseInt(m[1], 10) - 1);
}
