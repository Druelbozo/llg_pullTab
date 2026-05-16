/**
 * SFX cache keys + effective sfx (Global defaults merged with theme.sfx by Preload).
 */

import { GameConfig } from '../../config/Global.js';

/** SFX whose playback rate follows peel speed ({@link GameConfig.game.START_SPEED} / PeelManager.speed). */
export const SFX_SPEED_CONTROLLED_KEYS = new Set(['lose', 'tally', 'thud', 'whoosh', 'win']);

/** @type {Object|null} */
let _effectiveSfx = null;

/**
 * @param {Object} sfx - Merged { configKey: "filename.ogg", ... }
 */
export function setEffectiveSfx(sfx) {
    _effectiveSfx = sfx;
}

/**
 * Phaser audio cache key from filename stem (e.g. "win.ogg" → "win").
 * @param {string} configKey
 * @returns {string|null}
 */
export function getSfxKey(configKey) {
    const config = _effectiveSfx ?? GameConfig?.sfx;
    const filename = config?.[configKey];
    if (!filename) return null;
    return filename.replace(/\.(ogg|mp3|wav)$/i, '');
}
