/**
 * Theme hooks for PeelCard / PeelCardEnterAnim visuals.
 */

import { GameConfig } from '../../config/Global.js';
import ColorUtils from '../color/ColorUtils.js';
import { debug } from '../logger/LoggerUtils.js';

/** When `horizontalContentInset` is missing or invalid — matches the legacy PeelCard horizontal offset (80). */
export const DEFAULT_PEEL_CARD_HORIZONTAL_CONTENT_INSET = 80;

/** Phaser texture key for theme `imageKeys.cardBack` (Preload registers slot name as key). */
export const THEME_FLAT_CARD_BACK_TEXTURE_KEY = 'cardBack';

/** Built-in NineSlice backing when no theme flat `cardBack` image is configured. */
export const LEGACY_CARD_BACK_TEXTURE_KEY = 'CardBack';

/**
 * Theme provides `imageKeys.cardBack` → use full card art instead of NineSlice + separate cover.
 *
 * @param {Record<string, unknown>|null|undefined} themeData
 */
export function themeUsesFlatCardBackImage(themeData) {
	const raw = themeData?.imageKeys?.cardBack;
	return typeof raw === 'string' && raw.trim().length > 0;
}

/** @param {Record<string, unknown>|null|undefined} themeData */
export function shouldShowPeelCardCover(themeData) {
	return !themeUsesFlatCardBackImage(themeData);
}

/** Wall-time (speed 1) for peel result video fade-out; matches {@link PeelCard} video tweens. */
export const PEEL_RESULT_VIDEO_PLAYBACK_MS_AT_SPEED_1 = 3000;

/**
 * @param {Record<string, unknown>|null|undefined} themeData
 * @param {'win'|'lose'} slot
 * @returns {string}
 */
export function resolveThemeVideoKeyStem(themeData, slot) {
	const vk = themeData?.videoKeys;
	if (!vk || typeof vk !== 'object') {
		return '';
	}
	const stem = /** @type {Record<string, unknown>} */ (vk)[slot];
	if (stem === undefined || stem === null) {
		return '';
	}
	return typeof stem === 'string' ? stem.trim() : '';
}

/** Non-empty `videoKeys` slot → preload queues that clip (empty string skips). */
export function themeDefinesPeelVideoSlot(themeData, slot) {
	return resolveThemeVideoKeyStem(themeData, slot).length > 0;
}

/**
 * Flat `imageKeys.cardBack` themes always use win/lose PNG animations on the card — never result videos.
 *
 * @param {Phaser.Scene} scene
 * @param {Record<string, unknown>|null|undefined} themeData
 * @param {'win'|'lose'} slot
 */
export function shouldUsePeelResultVideo(scene, themeData, slot) {
	if (themeUsesFlatCardBackImage(themeData)) {
		return false;
	}
	return themeDefinesPeelVideoSlot(themeData, slot) && Boolean(scene?.cache?.video?.exists?.(slot));
}

/**
 * When true, play the video clip instead of the `imageKeys` win/lose PNG animation.
 *
 * @param {Phaser.Scene} scene
 * @param {Record<string, unknown>|null|undefined} themeData
 * @param {'win'|'lose'} slot
 */
export function peelResultVideoOverridesImageAnimation(scene, themeData, slot) {
	return shouldUsePeelResultVideo(scene, themeData, slot);
}

/**
 * Position win/lose videos on the card (cover band or flat cardBack center).
 *
 * @param {{ cardBack?: Phaser.GameObjects.GameObject, dI_CardCover_Default?: Phaser.GameObjects.Image, win_Video?: Phaser.GameObjects.Video, lose_Video?: Phaser.GameObjects.Video }} peelCard
 * @param {Record<string, unknown>|null|undefined} themeData
 */
export function layoutPeelResultVideosOnCard(peelCard, themeData) {
	const cardBack = peelCard?.cardBack;
	if (!cardBack?.active) {
		return;
	}

	const flat = themeUsesFlatCardBackImage(themeData);
	const cw =
		typeof /** @type {{ displayWidth?: number, width?: number }} */ (cardBack).displayWidth === 'number'
			? cardBack.displayWidth
			: /** @type {{ width?: number }} */ (cardBack).width ?? 0;
	const ch =
		typeof /** @type {{ displayHeight?: number, height?: number }} */ (cardBack).displayHeight === 'number'
			? cardBack.displayHeight
			: /** @type {{ height?: number }} */ (cardBack).height ?? 0;
	const ox = typeof cardBack.originX === 'number' ? cardBack.originX : 0;
	const oy = typeof cardBack.originY === 'number' ? cardBack.originY : 0;
	const centerX = cardBack.x - ox * cw + cw * 0.5;
	const centerY = cardBack.y - oy * ch + ch * 0.5;
	const cover = peelCard.dI_CardCover_Default;

	/** @type {readonly ['win'|'lose', Phaser.GameObjects.Video|undefined][]} */
	const slots = [
		['win', peelCard.win_Video],
		['lose', peelCard.lose_Video],
	];

	for (const [slot, video] of slots) {
		if (!video || !themeDefinesPeelVideoSlot(themeData, slot)) {
			continue;
		}
		if (flat) {
			video.setOrigin(0.5, 0.5);
			video.setPosition(centerX, centerY);
		} else if (cover?.active) {
			video.setOrigin(1, 0);
			video.setPosition(cover.x, cover.y);
		}
		video.setVisible(false);
	}
}

/** Flat cardBack mode always hides prize column labels. */
export function shouldShowPeelPrizeLabels(themeData) {
	if (themeUsesFlatCardBackImage(themeData)) {
		return false;
	}
	return GameConfig.game.SHOW_PEEL_PRIZE_LABELS !== false;
}

/**
 * @param {Phaser.GameObjects.GameObject|null|undefined} cardBack
 */
function isPeelCardBackNineSlice(cardBack) {
	return Boolean(cardBack && typeof /** @type {{ resize?: unknown }} */ (cardBack).resize === 'function');
}

/**
 * @param {Phaser.GameObjects.Container|null|undefined} tab
 */
function getPeelRowHeight(tab) {
	if (!tab) {
		return 0;
	}
	if (typeof /** @type {{ getSize?: () => { y: number } }} */ (tab).getSize === 'function') {
		return /** @type {{ getSize: () => { y: number } }} */ (tab).getSize().y;
	}
	return tab.displayHeight ?? 0;
}

/**
 * Vertical gap between peel rows (px, card-local). Theme `peelCard.peelRowGap`.
 *
 * @param {Record<string, unknown>|null|undefined} themeData
 * @returns {number}
 */
export function resolvePeelRowGap(themeData) {
	const pc =
		themeData?.peelCard && typeof themeData.peelCard === 'object' && themeData.peelCard !== null
			? /** @type {{ peelRowGap?: unknown }} */ (themeData.peelCard)
			: {};
	const raw = Number(pc.peelRowGap);
	return Number.isFinite(raw) && raw >= 0 ? raw : 0;
}

/**
 * Stack peel rows top-to-bottom with `peelRowGap` between rows (PeelCard + enter anim).
 *
 * @param {readonly Phaser.GameObjects.GameObject[]} rows
 * @param {number} rowGap
 */
export function layoutPeelRowStack(rows, rowGap) {
	if (!Array.isArray(rows) || rows.length === 0) {
		return;
	}
	let stackExtent = 0;
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		if (!row?.active) {
			continue;
		}
		row.y = stackExtent + rowGap * i;
		if (typeof row.x === 'number') {
			row.x = 0;
		}
		stackExtent += getPeelRowHeight(row);
	}
}

/**
 * @param {readonly Phaser.GameObjects.GameObject[]} tabs
 * @param {number} rowGap
 * @returns {number}
 */
export function getPeelStackTotalHeight(tabs, rowGap) {
	if (!Array.isArray(tabs) || tabs.length === 0) {
		return 0;
	}
	let total = 0;
	let count = 0;
	for (const tab of tabs) {
		if (!tab?.active) {
			continue;
		}
		if (count > 0) {
			total += rowGap;
		}
		total += getPeelRowHeight(tab);
		count++;
	}
	return total;
}

/**
 * @param {Phaser.GameObjects.Container|Phaser.GameObjects.Image|null|undefined} firstTab
 */
function getPeelStripMetrics(firstTab) {
	const strip =
		firstTab && /** @type {{ back?: Phaser.GameObjects.Image }} */ (firstTab).back
			? /** @type {{ back?: Phaser.GameObjects.Image }} */ (firstTab).back
			: /** @type {Phaser.GameObjects.Image|null|undefined} */ (firstTab);
	const peelW = strip?.displayWidth ?? 0;
	const peelLocalRight = typeof firstTab?.x === 'number' ? firstTab.x + peelW : peelW;
	return { strip, peelW, peelLocalRight };
}

/**
 * Swap backing between programmatic NineSlice and theme flat `cardBack` image (natural texture size, centered).
 *
 * @param {Phaser.Scene} scene
 * @param {Phaser.GameObjects.Container} parent
 * @param {Phaser.GameObjects.NineSlice|Phaser.GameObjects.Image|null|undefined} cardBack
 * @param {Record<string, unknown>|null|undefined} themeData
 * @returns {Phaser.GameObjects.NineSlice|Phaser.GameObjects.Image}
 */
export function ensurePeelCardBackGameObject(scene, parent, cardBack, themeData) {
	const wantFlat =
		themeUsesFlatCardBackImage(themeData) && scene.textures.exists(THEME_FLAT_CARD_BACK_TEXTURE_KEY);
	const insertIndex =
		parent && cardBack?.active && typeof parent.getIndex === 'function' ? parent.getIndex(cardBack) : 0;
	const at = Math.max(0, insertIndex);

	if (wantFlat) {
		if (
			cardBack?.active &&
			cardBack.type === 'Image' &&
			cardBack.texture?.key === THEME_FLAT_CARD_BACK_TEXTURE_KEY
		) {
			cardBack.setOrigin(0.5, 0.5);
			cardBack.setPosition(0, 0);
			if (typeof cardBack.clearTint === 'function') {
				cardBack.clearTint();
			}
			return cardBack;
		}
		cardBack?.destroy?.();
		const img = scene.add.image(0, 0, THEME_FLAT_CARD_BACK_TEXTURE_KEY);
		img.setOrigin(0.5, 0.5);
		parent.addAt(img, at);
		return img;
	}

	if (cardBack?.active && isPeelCardBackNineSlice(cardBack)) {
		return cardBack;
	}
	cardBack?.destroy?.();
	const ns = scene.add.nineslice(0, 0, LEGACY_CARD_BACK_TEXTURE_KEY, undefined, 1000, 650, 10, 10, 10, 10);
	parent.addAt(ns, at);
	return ns;
}

/**
 * Scale factor for peel rows on a flat theme `cardBack` so strips match the painted tab column
 * (default peel art is 384×100; composite cardBack images are much larger).
 *
 * Optional theme `peelCard` fields: `flatPeelHeightFillPercent`, `flatPeelWidthFillPercent`, `flatPeelStripMaxScale`, `flatPeelStripScale`.
 *
 * @param {Record<string, unknown>|null|undefined} themeData
 * @param {number} cardW
 * @param {number} cardH
 * @param {number} peelW
 * @param {number} totalPeelStackH
 * @param {number} inset
 */
export function resolveFlatPeelStripContainerScale(themeData, cardW, cardH, peelW, totalPeelStackH, inset) {
	if (!(totalPeelStackH > 0) || !(peelW > 0) || !(cardW > 0) || !(cardH > 0)) {
		return 1;
	}
	const pc =
		themeData?.peelCard && typeof themeData.peelCard === 'object' && themeData.peelCard !== null
			? /** @type {{ flatPeelHeightFillPercent?: unknown, flatPeelWidthFillPercent?: unknown, flatPeelStripMaxScale?: unknown, flatPeelStripScale?: unknown }} */ (
					themeData.peelCard
				)
			: {};
	const heightFillRaw = Number(pc.flatPeelHeightFillPercent);
	const widthFillRaw = Number(pc.flatPeelWidthFillPercent);
	const maxScaleRaw = Number(pc.flatPeelStripMaxScale);
	const stripScaleRaw = Number(pc.flatPeelStripScale);
	const heightFill = Number.isFinite(heightFillRaw) && heightFillRaw > 0 ? heightFillRaw : 0.88;
	const widthFill = Number.isFinite(widthFillRaw) && widthFillRaw > 0 ? widthFillRaw : 0.4;
	const cap = Number.isFinite(maxScaleRaw) && maxScaleRaw > 0 ? maxScaleRaw : 2.75;
	const stripMultiplier =
		Number.isFinite(stripScaleRaw) && stripScaleRaw > 0 ? stripScaleRaw : 1;

	const availableH = Math.max(1, cardH - 2 * inset);
	const targetW = Math.max(1, cardW * widthFill);
	const scaleH = (availableH * heightFill) / totalPeelStackH;
	const scaleW = targetW / peelW;
	return Math.min(scaleH, scaleW, cap) * stripMultiplier;
}

/**
 * Overlay peel rows on a flat theme `cardBack` image.
 * Optional `peelCard.flatPeelStripAlign` (`"right"` default, or `"center"`), `flatPeelStripInsetRight` (px, nudges strips left), and `flatPeelStripY` (px from cardBack top edge to stack top; 0 = top-aligned).
 *
 * @param {{
 *   themeData: Record<string, unknown>|null|undefined,
 *   cardBack: Phaser.GameObjects.GameObject,
 *   peelContainer: Phaser.GameObjects.Container,
 * }} params
 */
export function layoutPeelStripsOnFlatCardBackSubtree(params) {
	const { themeData, cardBack, peelContainer } = params;
	if (!cardBack?.active || !peelContainer) {
		return;
	}
	peelContainer.setScale(1, 1);

	const list = peelContainer.list;
	if (!Array.isArray(list) || list.length === 0) {
		return;
	}
	const firstTab = list[0];
	const { strip, peelW, peelLocalRight } = getPeelStripMetrics(firstTab);
	if (!firstTab?.active || !strip?.active) {
		return;
	}

	const inset = resolvePeelCardHorizontalContentInset(themeData);
	const cw = cardBack.displayWidth;
	const ch = cardBack.displayHeight;
	const ox = typeof cardBack.originX === 'number' ? cardBack.originX : 0.5;
	const oy = typeof cardBack.originY === 'number' ? cardBack.originY : 0.5;
	const cardLeft = cardBack.x - ox * cw;
	const cardTop = cardBack.y - oy * ch;
	const cardRight = cardLeft + cw;

	const rowGap = resolvePeelRowGap(themeData);
	const totalH = getPeelStackTotalHeight(list, rowGap);

	const fitScale = resolveFlatPeelStripContainerScale(themeData, cw, ch, peelW, totalH, inset);
	peelContainer.setScale(fitScale, fitScale);

	const scaledPeelLocalRight = peelLocalRight * fitScale;

	const pc =
		themeData?.peelCard && typeof themeData.peelCard === 'object' && themeData.peelCard !== null
			? /** @type {{ flatPeelStripAlign?: unknown, flatPeelStripInsetRight?: unknown, flatPeelStripY?: unknown }} */ (themeData.peelCard)
			: {};
	const stripAlign =
		typeof pc.flatPeelStripAlign === 'string' && pc.flatPeelStripAlign.toLowerCase() === 'center'
			? 'center'
			: 'right';
	const insetRightRaw = Number(pc.flatPeelStripInsetRight);
	const stripYRaw = Number(pc.flatPeelStripY);
	const extraInsetRight = Number.isFinite(insetRightRaw) ? insetRightRaw : 0;
	const stripY = Number.isFinite(stripYRaw) ? stripYRaw : 0;

	if (stripAlign === 'center') {
		peelContainer.x = cardBack.x - scaledPeelLocalRight / 2 - extraInsetRight;
	} else {
		peelContainer.x = cardRight - inset - scaledPeelLocalRight - extraInsetRight;
	}
	peelContainer.y = cardTop + stripY;
}

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
export function peelCardUsesTripleHorizontalInsetGaps(themeData) {
	if (themeUsesFlatCardBackImage(themeData)) {
		return false;
	}
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
	if (themeUsesFlatCardBackImage(themeData) || !peelCardUsesTripleHorizontalInsetGaps(themeData)) {
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

	if (themeUsesFlatCardBackImage(themeData)) {
		if (cardCoverImage) {
			cardCoverImage.setVisible(false);
		}
		layoutPeelStripsOnFlatCardBackSubtree({ themeData, cardBack, peelContainer });
		return;
	}

	if (cardCoverImage) {
		cardCoverImage.setVisible(true);
	}

	resizePeelCardBackTripleInsetWidths({ cardBack, peelContainer, cardCoverImage }, themeData);
	layoutPeelCardHorizontalContentInsetSubtree({
		themeData,
		cardBack,
		peelContainer,
		cardCoverImage,
		syncCoverXVideos,
		threeEqualHorizontalGaps: peelCardUsesTripleHorizontalInsetGaps(themeData),
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

	const showCover = shouldShowPeelCardCover(themeData);
	const cover = peelCard.dI_CardCover_Default;
	if (cover) {
		cover.setVisible(showCover);
	}
	if (peelCard.prizeContainer) {
		peelCard.prizeContainer.setVisible(shouldShowPeelPrizeLabels(themeData));
	}
	if (themeUsesFlatCardBackImage(themeData)) {
		layoutPeelStripsOnFlatCardBackSubtree({
			themeData,
			cardBack: peelCard.cardBack,
			peelContainer: peelCard.peelContainer,
		});
		layoutPeelResultVideosOnCard(peelCard, themeData);

		const enter = peelCard.peelCardEnterAnim;
		if (enter?.cardBack && enter.peelContainer) {
			if (enter.cardCover) {
				enter.cardCover.setVisible(false);
			}
			if (enter.prizeContainer) {
				enter.prizeContainer.setVisible(false);
			}
			layoutPeelStripsOnFlatCardBackSubtree({
				themeData,
				cardBack: enter.cardBack,
				peelContainer: enter.peelContainer,
			});
		}
		return;
	}

	if (peelCard.peelContainer) {
		peelCard.peelContainer.setScale(1, 1);
	}

	const triple = peelCardUsesTripleHorizontalInsetGaps(themeData);

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
	layoutPeelResultVideosOnCard(peelCard, themeData);

	const enter = peelCard.peelCardEnterAnim;
	if (
		enter?.cardBack &&
		enter.peelContainer &&
		/** @type {{ cardCover?: Phaser.GameObjects.Image }} */ (enter).cardCover
	) {
		const cardCover = /** @type {{ cardCover: Phaser.GameObjects.Image }} */ (enter).cardCover;
		if (cardCover) {
			cardCover.setVisible(true);
		}
		if (enter.prizeContainer) {
			enter.prizeContainer.setVisible(shouldShowPeelPrizeLabels(themeData));
		}
		if (enter.peelContainer) {
			enter.peelContainer.setScale(1, 1);
		}
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

	if (themeUsesFlatCardBackImage(themeData)) {
		if (typeof obj.clearTint === 'function') {
			obj.clearTint();
		}
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
