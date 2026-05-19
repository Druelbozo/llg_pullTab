/**
 * Win/lose result graphic sizing and placement for pull-tab (mirrors scratch Prefab_Results).
 */

import { debug } from '../logger/LoggerUtils.js';

/**
 * @param {Phaser.Scene} scene
 * @returns {import('../../prefabs/peelTab/Prefab_Results.js').default|null|undefined}
 */
function getPeelCardResults(scene) {
	const peel = scene?.peelCard;
	return peel?.prefab_Results ?? peel?.results;
}

/**
 * Place results container at the vertical (and horizontal) center of the peel card backing.
 *
 * @param {Phaser.Scene} scene
 */
export function layoutResultsOnPeelCard(scene) {
	const results = getPeelCardResults(scene);
	const cardBack = scene?.peelCard?.cardBack;
	if (!results?.active || !cardBack?.active) {
		return;
	}

	const x = typeof cardBack.x === 'number' ? cardBack.x : 0;
	const y = typeof cardBack.y === 'number' ? cardBack.y : 0;
	results.setPosition(x, y);
}

/**
 * @param {Phaser.Scene} scene
 * @returns {number}
 */
export function getPeelCardReferenceHeight(scene) {
	const peel = scene?.peelCard;
	const cardBack = peel?.cardBack;
	if (cardBack?.active) {
		const h = cardBack.displayHeight;
		if (Number.isFinite(h) && h > 0) {
			return h;
		}
	}
	const lp = scene?.layoutManager?.getLayoutPositions?.();
	if (lp?.cardBackDisplay?.height > 0) {
		const peelScale = lp.peelCardScale ?? peel?.scaleY ?? 1;
		const s = peelScale > 0 ? peelScale : 1;
		return lp.cardBackDisplay.height / s;
	}
	return scene?.scale?.height ? scene.scale.height * 0.5 : 400;
}

/**
 * Scale win/lose image so displayed height ≈ cardHeight × theme `cardHeightPercent`.
 *
 * @param {Phaser.Scene} scene
 * @param {Phaser.GameObjects.Image|null|undefined} image
 * @param {'win'|'lose'} role
 * @param {Phaser.GameObjects.Container|null|undefined} [resultsContainer]
 */
export function applyResultGraphicScale(scene, image, role, resultsContainer) {
	if (!image?.active || !scene) {
		return;
	}

	const theme = scene.themeData || scene.registry?.get?.('preloadThemeData');
	const cfg = theme?.[role];
	const cardHeightPercent =
		typeof cfg?.cardHeightPercent === 'number' && cfg.cardHeightPercent > 0 ? cfg.cardHeightPercent : 0.8;

	const cardHeight = getPeelCardReferenceHeight(scene);
	const parentScale = resultsContainer?.parent?.scaleY ?? resultsContainer?.scaleY ?? 1;
	const effectiveScale = parentScale > 0 ? parentScale : 1;
	const targetLocalHeight = (cardHeight * cardHeightPercent) / effectiveScale;

	let origWidth;
	let origHeight;
	const tex = image.texture;
	if (tex && tex.key !== '_MISSING' && typeof tex.getSourceImage === 'function') {
		const src = tex.getSourceImage();
		if (src) {
			origWidth = src.width;
			origHeight = src.height;
		}
	}
	if (!origWidth || !origHeight || origWidth <= 0 || origHeight <= 0) {
		origWidth = image.frame?.width ?? image.width ?? 500;
		origHeight = image.frame?.height ?? image.height ?? 500;
	}

	const finalScale = targetLocalHeight / origHeight;
	image.setScale(finalScale);
	image.setPosition(0, 0);

	debug(`applyResultGraphicScale(${role})`, 'layout', {
		cardHeightPercent,
		cardHeight,
		targetLocalHeight,
		origHeight,
		finalScale,
	});
}
