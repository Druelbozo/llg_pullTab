/**
 * Theme hooks for PeelCard / PeelCardEnterAnim visuals.
 */

import ColorUtils from '../color/ColorUtils.js';

/**
 * Optional merged theme field `peelCard.cardBackTint`:
 * hex `"#rrggbb"` or number `0xrrggbb` → {@link Phaser.GameObjects.Image#setTint} on the programmatic `CardBack` NineSlice.
 * Omitted / empty / `null` → clear tint when possible (original texture colors).
 *
 * @param {Phaser.GameObjects.GameObject & { setTint?: function(number): void, clearTint?: function(): void }} [obj]
 * @param {Record<string, unknown>|null|undefined} themeData
 */
export function applyPeelCardBackTintFromTheme(obj, themeData) {
    if (!obj || typeof obj.setTint !== 'function') {
        return;
    }

    const pc = themeData?.peelCard;
    const raw =
        pc && typeof pc === 'object' && pc !== null ? /** @type {{ cardBackTint?: unknown }} */ (pc).cardBackTint : undefined;

    if (raw === null || raw === undefined || raw === '') {
        if (typeof obj.clearTint === 'function') {
            obj.clearTint();
        }
        return;
    }

    const n = ColorUtils.hexToNumber(/** @type {string|number} */ (raw));
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
        if (typeof obj.clearTint === 'function') {
            obj.clearTint();
        }
        return;
    }

    obj.setTint(n);
}
