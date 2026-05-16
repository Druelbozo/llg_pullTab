/**
 * Minimal scratch-grid helpers (referenced by ported LayoutDebugUtils).
 */

export const DEFAULT_SCRATCH_COLUMNS = 4;
export const DEFAULT_SCRATCH_ROWS = 2;

export function normalizeScratchGridDimension(raw, fallback) {
    const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? '').trim(), 10);
    if (Number.isFinite(n) && n >= 1) {
        return Math.min(Math.round(n), 99);
    }
    return fallback;
}

export function getScratchGridFromGameConfig(gameConfigLike, fallbacks = {}) {
    const o = gameConfigLike || {};
    const fc = fallbacks.columns ?? DEFAULT_SCRATCH_COLUMNS;
    const fr = fallbacks.rows ?? DEFAULT_SCRATCH_ROWS;
    return {
        columns: normalizeScratchGridDimension(o.columns, fc),
        rows: normalizeScratchGridDimension(o.rows, fr),
    };
}
