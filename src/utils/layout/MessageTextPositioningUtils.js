/**
 * Shared message text placement helpers (screen / card band geometry).
 */
import { GameConfig } from '../../config/Global.js';
import { getScreenHeight, getScreenWidth } from '../viewport/ViewportUtils.js';

/**
 * Place message text at the center of the band: inset from screen left → card left edge,
 * vertically from top of screen to top of control bar.
 *
 * @param {Object} layoutPositions
 * @param {{ width: number, height: number }} cardSize
 * @param {number} cardCenterX - Screen X of the card container center (final position).
 * @param {*} scene - Phaser scene (for screen height fallback).
 * @param {number} [insetPercentHorizontal=0] - Inset left bound in from screen left, as fraction of screen width (same idea as controlBar.insetPercent.horizontal).
 * @returns {{ centerX: number, centerY: number, maxTextWidth: number }}
 */
export function computeCenterInLeftBandPlacement(
	layoutPositions,
	cardSize,
	cardCenterX,
	scene,
	insetPercentHorizontal = 0
) {
	const cardLeft = cardCenterX - cardSize.width / 2;
	const screenW =
		typeof layoutPositions.screenWidth === 'number' && layoutPositions.screenWidth > 0
			? layoutPositions.screenWidth
			: getScreenWidth(scene);
	const requestedLeft = screenW * Math.max(0, insetPercentHorizontal);
	const minBand = 48;
	const maxLeftBound = Math.max(0, cardLeft - minBand);
	const leftBound = Math.min(requestedLeft, maxLeftBound);
	let bandBottom = layoutPositions.controlBarTop;
	if (bandBottom === undefined || bandBottom === null || Number.isNaN(bandBottom)) {
		bandBottom = layoutPositions.controlBarBackgroundTop;
	}
	const screenH = getScreenHeight(scene);
	if (
		bandBottom === undefined ||
		bandBottom === null ||
		Number.isNaN(bandBottom) ||
		bandBottom <= 0 ||
		bandBottom > screenH
	) {
		bandBottom = screenH * 0.75;
	}
	const bandRight = Math.max(0, cardLeft);
	const innerWidth = Math.max(0, bandRight - leftBound);
	const centerX = leftBound + innerWidth / 2;
	const centerY = bandBottom / 2;
	const maxTextWidth = Math.max(48, innerWidth);
	return { centerX, centerY, maxTextWidth };
}

/**
 * True when the host page shows a side paytable (or similar) so landscape-mobile should use 2-column behavior
 * (e.g. `instructionsText` below the card). Controlled by `GameConfig.ui.LANDSCAPE_MOBILE_SIDE_PAYTABLE_SELECTOR`.
 * @returns {boolean}
 */
export function isLandscapeMobileSidePaytablePanelVisible() {
	const sel = GameConfig.ui?.LANDSCAPE_MOBILE_SIDE_PAYTABLE_SELECTOR;
	if (sel == null || sel === '' || typeof document === 'undefined') {
		return false;
	}
	let el;
	try {
		el = document.querySelector(sel);
	} catch (_) {
		return false;
	}
	if (!el) {
		return false;
	}
	const style = getComputedStyle(el);
	if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
		return false;
	}
	const r = el.getBoundingClientRect();
	return r.width > 1 && r.height > 1;
}

/**
 * Place `instructionsText` at the center of the band: card right edge → screen right (inset), vertically same as
 * `computeCenterInLeftBandPlacement` (top of screen to control bar top).
 *
 * @param {Object} layoutPositions
 * @param {{ width: number, height: number }} cardSize
 * @param {number} cardCenterX
 * @param {*} scene
 * @param {number} [insetPercentFromRight=0] - Inset the right band's outer edge in from the screen right, as a fraction of screen width.
 * @returns {{ centerX: number, centerY: number, maxTextWidth: number, innerWidth: number }}
 */
export function computeCenterInRightBandPlacement(
	layoutPositions,
	cardSize,
	cardCenterX,
	scene,
	insetPercentFromRight = 0
) {
	const cardRight = cardCenterX + cardSize.width / 2;
	const screenW =
		typeof layoutPositions.screenWidth === 'number' && layoutPositions.screenWidth > 0
			? layoutPositions.screenWidth
			: getScreenWidth(scene);
	const rightEdge = screenW * (1 - Math.max(0, insetPercentFromRight));
	const leftBound = cardRight;
	const innerWidth = Math.max(0, rightEdge - leftBound);
	const centerX = leftBound + innerWidth / 2;
	let bandBottom = layoutPositions.controlBarTop;
	if (bandBottom === undefined || bandBottom === null || Number.isNaN(bandBottom)) {
		bandBottom = layoutPositions.controlBarBackgroundTop;
	}
	const screenH = getScreenHeight(scene);
	if (
		bandBottom === undefined ||
		bandBottom === null ||
		Number.isNaN(bandBottom) ||
		bandBottom <= 0 ||
		bandBottom > screenH
	) {
		bandBottom = screenH * 0.75;
	}
	const centerY = bandBottom / 2;
	const maxTextWidth = Math.max(48, innerWidth);
	return { centerX, centerY, maxTextWidth, innerWidth };
}

/**
 * Word-wrap width for message text: left-band width in landscape-mobile, otherwise most of screen width.
 *
 * @param {Object} messageTextConfig - From getMessageTextConfig
 * @param {Object} layoutPositions
 * @param {{ width: number, height: number }} cardSize
 * @param {number} cardCenterX
 * @param {*} scene
 * @param {number} screenWidth
 * @returns {number}
 */
export function resolveMessageTextWordWrapWidth(messageTextConfig, layoutPositions, cardSize, cardCenterX, scene, screenWidth) {
	if (!messageTextConfig || messageTextConfig.centerInLeftBand !== true) {
		return screenWidth * 0.9;
	}
	if (!layoutPositions || !cardSize || !(cardSize.width > 0)) {
		return screenWidth * 0.9;
	}
	const inset = messageTextConfig.insetPercentHorizontal ?? 0;
	return computeCenterInLeftBandPlacement(layoutPositions, cardSize, cardCenterX, scene, inset).maxTextWidth;
}
