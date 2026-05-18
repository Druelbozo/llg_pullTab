/**
 * Theme hooks for PeelCard / PeelCardEnterAnim visuals.
 */

import ColorUtils from '../color/ColorUtils.js';
import { debug } from '../logger/LoggerUtils.js';

/** When `horizontalContentInset` is missing or invalid — matches the legacy PeelCard horizontal offset (80). */
export const DEFAULT_PEEL_CARD_HORIZONTAL_CONTENT_INSET = 80;

/**
 * Single horizontal inset (px): distance from {@link PeelCard.cardBack} **left edge** to the card cover graphic’s left edge,
 * and equal distance from the top peel-strip **right edge** to the card back’s **right edge**.
 *
 * Parsed from merged theme JSON `peelCard.horizontalContentInset` (must be finite and ≥ 0).
 *
 * @param {Record<string, unknown>|null|undefined} themeData
 */
export function resolvePeelCardHorizontalContentInset(themeData) {
	const pc =
		themeData?.peelCard && typeof themeData.peelCard === 'object' && themeData.peelCard !== null
			? /** @type {{ horizontalContentInset?: unknown }} */ (themeData.peelCard)
			: null;
	const raw = pc?.horizontalContentInset;
	const n = Number(raw);
	if (typeof n === 'number' && Number.isFinite(n) && n >= 0) {
		return n;
	}
	return DEFAULT_PEEL_CARD_HORIZONTAL_CONTENT_INSET;
}

/**
 * Applies symmetric horizontal inset to cover + peel strips (shared coordinate space as `cardBack`: same parent preferred).
 *
 * @param {{
 *   themeData: Record<string, unknown>|null|undefined,
 *   cardBack: Phaser.GameObjects.GameObject,
 *   peelContainer: Phaser.GameObjects.Container,
 *   cardCoverImage: Phaser.GameObjects.Image,
 *   syncCoverXVideos?: readonly (Phaser.GameObjects.Video|null|undefined)[],
 * }} params
 */
export function layoutPeelCardHorizontalContentInsetSubtree(params) {
	const { themeData, cardBack, peelContainer, cardCoverImage, syncCoverXVideos } = params;
	if (!cardBack?.active || !peelContainer || !cardCoverImage?.active) {
		return;
	}
	const firstTab = peelContainer.list?.length ? peelContainer.list[0] : null;
	/** Peel row uses `{@link Peel}.back`; enter-anim stubs use flat peel images instead. */
	const strip =
		firstTab && /** @type {{ back?: Phaser.GameObjects.Image }} */ (firstTab).back
			? /** @type {{ back?: Phaser.GameObjects.Image }} */ (firstTab).back
			: /** @type {Phaser.GameObjects.Image|null} */ (firstTab);
	if (!firstTab?.active || !strip?.active) {
		return;
	}

	const desiredInset = resolvePeelCardHorizontalContentInset(themeData);

	const cw = cardBack.displayWidth;
	const ox = typeof cardBack.originX === 'number' ? cardBack.originX : 0;
	const cardLeft = cardBack.x - ox * cw;
	const cardRight = cardBack.x + (1 - ox) * cw;

	const covW = cardCoverImage.displayWidth;
	const covOx = typeof cardCoverImage.originX === 'number' ? cardCoverImage.originX : 0;

	const peelW = strip.displayWidth;
	const peelLocalRight = typeof firstTab.x === 'number' ? firstTab.x + peelW : peelW;

	const inner = cardRight - cardLeft;
	const maxSymmetricInset = inner > 0 ? (inner - covW - peelW) / 2 : 0;
	const insetApplied =
		maxSymmetricInset <= 0
			? 0
			: Math.min(desiredInset, Math.max(0, maxSymmetricInset));

	if (desiredInset > insetApplied + 0.5) {
		debug(
			`PeelCard: horizontalContentInset clamped from ${desiredInset.toFixed(1)} → ${insetApplied.toFixed(1)} (card/cover/track widths leave ${maxSymmetricInset.toFixed(1)} max per side)`,
			'layout',
		);
	}

	/** Peels grow left-to-right inside `peelContainer`; place container so outer strip right aligns with inset. */
	peelContainer.x = cardRight - insetApplied - peelLocalRight;

	/** Cover left edge = cardLeft + inset; pivot respects `originX`. */
	cardCoverImage.x = cardLeft + insetApplied + covOx * covW;

	for (const v of syncCoverXVideos ?? []) {
		if (v && typeof v === 'object' && 'x' in v) {
			/** @type {Phaser.GameObjects.Video} */ (v).x = cardCoverImage.x;
		}
	}
}

/**
 * @param {{ cardBack?: Phaser.GameObjects.GameObject, peelContainer?: Phaser.GameObjects.Container, dI_CardCover_Default?: Phaser.GameObjects.Image, win_Video?: Phaser.GameObjects.Video, lose_Video?: Phaser.GameObjects.Video }} peelCard
 * @param {Record<string, unknown>|null|undefined} themeData
 */
export function layoutPeelCardHorizontalContentInset(peelCard, themeData) {
	if (!peelCard) {
		return;
	}
	layoutPeelCardHorizontalContentInsetSubtree({
		themeData,
		cardBack: peelCard.cardBack,
		peelContainer: peelCard.peelContainer,
		cardCoverImage: peelCard.dI_CardCover_Default,
		syncCoverXVideos: [peelCard.win_Video, peelCard.lose_Video],
	});
}

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
