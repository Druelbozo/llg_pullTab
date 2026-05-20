/**
 * CSS sprite helpers for DOM paytable icons (same atlas paths as Preload / ThemePreloadUtils).
 */

import {
	extractOrderedIconsFrameNamesFromAtlasJson,
	getPullTabIconsFrameNames,
	tierIndexToIconsFrameName,
} from '../theme/PullTabIconsAtlasUtils.js';

/** @type {string} */
export const THEME_ICONS_ATLAS_BASE = 'assets/images/theme/icons';

/**
 * @param {object} atlasJson
 * @param {number} atlasFrameIndex — `0.png` maps to symbol `symbol_01`
 * @param {number} displayPx
 * @returns {{ styleAttr: string, boxW: number, boxH: number } | null}
 */
export function buildIconsAtlasSpriteCss(atlasJson, atlasFrameIndex, displayPx = 36) {
	const tex = atlasJson?.textures?.[0];
	const frames = tex?.frames;
	if (!Array.isArray(frames) || frames.length === 0) {
		return null;
	}

	const orderedNames = extractOrderedIconsFrameNamesFromAtlasJson(atlasJson);
	const filename = tierIndexToIconsFrameName(orderedNames, atlasFrameIndex);
	const hit = frames.find((f) => f.filename === filename);
	if (!hit?.frame) {
		return null;
	}

	const fx = Number(hit.frame.x) || 0;
	const fy = Number(hit.frame.y) || 0;
	const fw = Number(hit.frame.w) || 32;
	const fh = Number(hit.frame.h) || 32;
	const sheetW = Number(tex.size?.w) || 512;
	const sheetH = Number(tex.size?.h) || 512;

	const scaleFactor = displayPx / Math.max(fw, 1);
	const bgW = Math.round(sheetW * scaleFactor);
	const bgH = Math.round(sheetH * scaleFactor);
	const posX = -Math.round(fx * scaleFactor);
	const posY = -Math.round(fy * scaleFactor);
	const boxW = Math.round(fw * scaleFactor);
	const boxH = Math.round(fh * scaleFactor);

	const imgRel = tex.image ?? '';
	if (!imgRel || typeof imgRel !== 'string') {
		return null;
	}

	const url = encodeURI(`${THEME_ICONS_ATLAS_BASE}/${imgRel}`);

	const styleAttr =
		`width:${boxW}px;height:${boxH}px;` +
		`background-image:url('${url}');` +
		`background-repeat:no-repeat;background-size:${bgW}px ${bgH}px;` +
		`background-position:${posX}px ${posY}px;`;

	return { styleAttr, boxW, boxH };
}

/**
 * Build paytable sprite CSS from the icons atlas already loaded in Phaser (avoids a second fetch).
 *
 * @param {Phaser.Scene|null|undefined} scene
 * @param {number} atlasFrameIndex
 * @param {number} displayPx
 * @returns {{ styleAttr: string, boxW: number, boxH: number } | null}
 */
export function buildIconsAtlasSpriteCssFromScene(scene, atlasFrameIndex, displayPx = 36) {
	const textureKey = 'icons';
	if (!scene?.textures?.exists?.(textureKey)) {
		return null;
	}

	const texture = scene.textures.get(textureKey);
	const orderedNames = getPullTabIconsFrameNames(scene);
	const frameName = tierIndexToIconsFrameName(orderedNames, atlasFrameIndex);
	if (!texture.has(frameName)) {
		return null;
	}

	const frame = texture.get(frameName);
	const source = texture.source[0];
	if (!source) {
		return null;
	}

	const fx = frame.cutX ?? frame.x ?? 0;
	const fy = frame.cutY ?? frame.y ?? 0;
	const fw = frame.cutWidth || frame.width || 32;
	const fh = frame.cutHeight || frame.height || 32;
	const sheetW = source.width;
	const sheetH = source.height;

	const scaleFactor = displayPx / Math.max(fw, 1);
	const bgW = Math.round(sheetW * scaleFactor);
	const bgH = Math.round(sheetH * scaleFactor);
	const posX = -Math.round(fx * scaleFactor);
	const posY = -Math.round(fy * scaleFactor);
	const boxW = Math.round(fw * scaleFactor);
	const boxH = Math.round(fh * scaleFactor);

	let url = source.url || source.image?.currentSrc || source.image?.src || '';
	if (!url) {
		return null;
	}
	// Keep relative paths stable for embedded games (strip origin when same host).
	try {
		if (typeof window !== 'undefined' && url.startsWith(window.location.origin)) {
			url = url.slice(window.location.origin.length);
			if (url.startsWith('/')) {
				url = url.slice(1);
			}
		}
	} catch {
		/* non-browser */
	}

	const styleAttr =
		`width:${boxW}px;height:${boxH}px;` +
		`background-image:url('${encodeURI(url)}');` +
		`background-repeat:no-repeat;background-size:${bgW}px ${bgH}px;` +
		`background-position:${posX}px ${posY}px;`;

	return { styleAttr, boxW, boxH };
}

/**
 * @param {string} themeName
 * @returns {Promise<object|null>}
 */
export async function fetchIconsAtlasJson(themeName) {
	const t = String(themeName || 'mega-monster').trim() || 'mega-monster';
	const cacheBuster = Date.now();

	let iconsKey = 'icons-default';
	try {
		const themeRes = await fetch(`src/config/themes/${encodeURIComponent(t)}.json?t=${cacheBuster}`, {
			cache: 'no-store',
		});
		if (themeRes.ok) {
			const themeJson = await themeRes.json();
			const ik = themeJson?.imageKeys?.icons;
			if (typeof ik === 'string' && ik.trim()) {
				iconsKey = ik.trim();
			}
		}
	} catch {
		/* theme json optional */
	}

	const atlasUrl = `${THEME_ICONS_ATLAS_BASE}/${encodeURIComponent(iconsKey)}.json?t=${cacheBuster}`;
	try {
		const atlasRes = await fetch(atlasUrl, { cache: 'no-store' });
		if (!atlasRes.ok) {
			return null;
		}
		return await atlasRes.json();
	} catch {
		return null;
	}
}

/**
 * @param {Phaser.Scene|null|undefined} scene
 * @param {object|null|undefined} atlasJson
 * @param {number} atlasFrameIndex
 * @param {number} displayPx
 * @returns {{ styleAttr: string, boxW: number, boxH: number } | null}
 */
export function resolvePaytableIconSpriteCss(scene, atlasJson, atlasFrameIndex, displayPx = 36) {
	return (
		(atlasJson ? buildIconsAtlasSpriteCss(atlasJson, atlasFrameIndex, displayPx) : null) ||
		buildIconsAtlasSpriteCssFromScene(scene, atlasFrameIndex, displayPx)
	);
}
