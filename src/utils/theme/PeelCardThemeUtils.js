/**
 * Theme hooks for PeelCard / PeelCardEnterAnim visuals.
 */

import { GameConfig } from '../../config/Global.js';
import ColorUtils from '../color/ColorUtils.js';
import { debug } from '../logger/LoggerUtils.js';

/** When `horizontalContentInset` is missing or invalid — matches the legacy PeelCard horizontal offset (80). */
export const DEFAULT_PEEL_CARD_HORIZONTAL_CONTENT_INSET = 80;

/**
 * Single horizontal inset (px). With prize labels (**legacy**) it is equal distance from **`cardBack`**
 * left → cover left **and** from peel-strip right → `cardBack` right (inside may be wider).
 * With `GameConfig.game.SHOW_PEEL_PRIZE_LABELS === false` it also sizes the gutter **between cover and peel strips**,
 * and `cardBack` width becomes `horizontalContentInset × 3 + cardCover.width + peelStrip.width`.
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

/** `GameConfig.game.SHOW_PEEL_PRIZE_LABELS === false` → three equal inset-sized gaps (L, cover→peels, R) + dynamic card width. */
export function peelCardUsesTripleHorizontalInsetGaps() {
	return GameConfig.game.SHOW_PEEL_PRIZE_LABELS === false;
}

/**
 * @param {Phaser.GameObjects.NineSlice|Phaser.GameObjects.Image} cardBack
 * @param {number} width
 * @param {number} height
 */
function resizePeelCardBackNineSlice(cardBack, width, height) {
	if (!(width > 0) || !(height > 0)) {
		return;
	}
	const ns = /** @type {{ resize?: (w:number,h:number)=>void, setDisplaySize?: (w:number,h:number)=>void, width?: number, height?: number }} */ (
		cardBack
	);
	if (typeof ns.resize === 'function') {
		ns.resize(width, height);
	} else if (typeof ns.setDisplaySize === 'function') {
		ns.setDisplaySize(width, height);
	} else if (typeof cardBack.displayWidth !== 'undefined') {
		cardBack.displayWidth = width;
		cardBack.displayHeight = height;
	}
}

/**
 * Narrow the card backing to fit cover + peels with **three** equal `horizontalContentInset` gutters
 * (left, between cover/strip, right). Legacy wide card (prize labels on) skips this — width stays authored.
 *
 * @param {{
 *   cardBack?: Phaser.GameObjects.NineSlice|Phaser.GameObjects.Image|null,
 *   peelContainer?: Phaser.GameObjects.Container|null,
 *   cardCoverImage?: Phaser.GameObjects.Image|null,
 * }} props
 * @param {Record<string, unknown>|null|undefined} themeData
 */
export function resizePeelCardBackTripleInsetWidths(props, themeData) {
	if (!peelCardUsesTripleHorizontalInsetGaps()) {
		return;
	}
	const cardBack = props.cardBack;
	const peelContainer = props.peelContainer;
	const cardCoverImage = props.cardCoverImage;
	if (!cardBack?.active || !peelContainer || !cardCoverImage?.active) {
		return;
	}
	const firstTab = peelContainer.list?.length ? peelContainer.list[0] : null;
	const strip =
		firstTab && /** @type {{ back?: Phaser.GameObjects.Image }} */ (firstTab).back
			? /** @type {{ back?: Phaser.GameObjects.Image }} */ (firstTab).back
			: /** @type {Phaser.GameObjects.Image|null} */ (firstTab);
	if (!firstTab?.active || !strip?.active) {
		return;
	}

	const inset = resolvePeelCardHorizontalContentInset(themeData);
	const covW = cardCoverImage.displayWidth;
	const peelW = strip.displayWidth;
	const targetW = inset * 3 + covW + peelW;
	const backH =
		typeof /** @type {Phaser.GameObjects.NineSlice|Phaser.GameObjects.Image} */ (cardBack).height === 'number' &&
		Number.isFinite(cardBack.height) &&
		cardBack.height > 0
			? cardBack.height
			: 650;

	resizePeelCardBackNineSlice(cardBack, Math.ceil(targetW), Math.ceil(backH));
}

/**
 * Resize (if triple-gap mode) then position cover/peels for one peel-card surface (`PeelCard` or `PeelCardEnterAnim`).
 *
 * @param {{
 *   cardBack: Phaser.GameObjects.NineSlice|Phaser.GameObjects.Image|null,
 *   peelContainer: Phaser.GameObjects.Container|null,
 *   cardCoverImage: Phaser.GameObjects.Image|null,
 *   syncCoverXVideos?: readonly (Phaser.GameObjects.Video|null|undefined)[],
 * }} surface
 * @param {Record<string, unknown>|null|undefined} themeData
 */
export function refreshPeelCardHorizontalLayoutSurface(surface, themeData) {
	if (!surface) {
		return;
	}
	const { cardBack, peelContainer, cardCoverImage, syncCoverXVideos } = surface;
	resizePeelCardBackTripleInsetWidths({ cardBack, peelContainer, cardCoverImage }, themeData);
	layoutPeelCardHorizontalContentInsetSubtree({
		themeData,
		cardBack,
		peelContainer,
		cardCoverImage,
		syncCoverXVideos,
		threeEqualHorizontalGaps: peelCardUsesTripleHorizontalInsetGaps(),
	});
}

/**
 * Applies symmetric horizontal inset to cover + peel strips (shared coordinate space as `cardBack`: same parent preferred).
 *
 * When `threeEqualHorizontalGaps` is true (no peel prize labels), left margin, cover→peel gutter, and right margin share one max inset `(inner − cov − peel) / 3`, matching dynamically sized card width.
 *
 * @param {{
 *   themeData: Record<string, unknown>|null|undefined,
 *   cardBack: Phaser.GameObjects.GameObject,
 *   peelContainer: Phaser.GameObjects.Container,
 *   cardCoverImage: Phaser.GameObjects.Image,
 *   syncCoverXVideos?: readonly (Phaser.GameObjects.Video|null|undefined)[],
 *   threeEqualHorizontalGaps?: boolean,
 * }} params
 */
export function layoutPeelCardHorizontalContentInsetSubtree(params) {
	const { themeData, cardBack, peelContainer, cardCoverImage, syncCoverXVideos, threeEqualHorizontalGaps = false } = params;
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
	const uniformSlots = threeEqualHorizontalGaps ? 3 : 2;
	const maxSymmetricInset =
		inner > 0 ? (inner - covW - peelW) / uniformSlots : 0;
	const insetApplied =
		maxSymmetricInset <= 0
			? 0
			: Math.min(desiredInset, Math.max(0, maxSymmetricInset));

	if (desiredInset > insetApplied + 0.5) {
		debug(
			`PeelCard: horizontalContentInset clamped from ${desiredInset.toFixed(1)} → ${insetApplied.toFixed(1)} (card/cover/track widths leave ${maxSymmetricInset.toFixed(1)} max per gutter${threeEqualHorizontalGaps ? ', triple' : ', dual-margin'})`,
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
	const triple = peelCardUsesTripleHorizontalInsetGaps();

	resizePeelCardBackTripleInsetWidths(
		{
			cardBack: peelCard.cardBack,
			peelContainer: peelCard.peelContainer,
			cardCoverImage: peelCard.dI_CardCover_Default,
		},
		themeData,
	);

	layoutPeelCardHorizontalContentInsetSubtree({
		themeData,
		cardBack: peelCard.cardBack,
		peelContainer: peelCard.peelContainer,
		cardCoverImage: peelCard.dI_CardCover_Default,
		syncCoverXVideos: [peelCard.win_Video, peelCard.lose_Video],
		threeEqualHorizontalGaps: triple,
	});

	const enter = peelCard.peelCardEnterAnim;
	if (
		enter?.cardBack &&
		enter.peelContainer &&
		/** @type {{ cardCover?: Phaser.GameObjects.Image }} */ (enter).cardCover
	) {
		const cardCover = /** @type {{ cardCover: Phaser.GameObjects.Image }} */ (enter).cardCover;
		resizePeelCardBackTripleInsetWidths(
			{
				cardBack: enter.cardBack,
				peelContainer: enter.peelContainer,
				cardCoverImage: cardCover,
			},
			themeData,
		);
		layoutPeelCardHorizontalContentInsetSubtree({
			themeData,
			cardBack: enter.cardBack,
			peelContainer: enter.peelContainer,
			cardCoverImage: cardCover,
			syncCoverXVideos: [],
			threeEqualHorizontalGaps: triple,
		});
	}
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
