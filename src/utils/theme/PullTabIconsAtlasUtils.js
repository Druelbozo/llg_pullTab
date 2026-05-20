/**
 * Pull-tab icons atlas helpers: ordered frame names (01.png or 0.png) and scratch-style max-size fit.
 */

const NUMERIC_FRAME_RE = /^(\d+)\.png$/i;

/**
 * @param {string} filename
 * @returns {number|null}
 */
function numericFrameSortKey(filename) {
	const m = NUMERIC_FRAME_RE.exec(String(filename ?? '').trim());
	if (!m) {
		return null;
	}
	const n = parseInt(m[1], 10);
	return Number.isFinite(n) ? n : null;
}

/**
 * @param {object|null|undefined} atlasJson
 * @returns {string[]}
 */
export function extractOrderedIconsFrameNamesFromAtlasJson(atlasJson) {
	const frames = atlasJson?.textures?.[0]?.frames;
	if (!Array.isArray(frames)) {
		return [];
	}
	/** @type {string[]} */
	const names = [];
	for (const f of frames) {
		if (typeof f?.filename === 'string' && NUMERIC_FRAME_RE.test(f.filename)) {
			names.push(f.filename);
		}
	}
	names.sort((a, b) => {
		const ka = numericFrameSortKey(a);
		const kb = numericFrameSortKey(b);
		if (ka == null && kb == null) {
			return a.localeCompare(b);
		}
		if (ka == null) {
			return 1;
		}
		if (kb == null) {
			return -1;
		}
		return ka - kb;
	});
	return names;
}

/**
 * @param {Phaser.Textures.Texture|null|undefined} texture
 * @returns {string[]}
 */
export function extractOrderedIconsFrameNamesFromTexture(texture) {
	if (!texture) {
		return [];
	}
	/** @type {string[]} */
	let names = [];
	if (typeof texture.getFrameNames === 'function') {
		names = texture.getFrameNames();
	} else if (texture.frames && typeof texture.frames === 'object') {
		names = Object.keys(texture.frames);
	}
	names = names.filter((n) => typeof n === 'string' && n !== '__BASE' && NUMERIC_FRAME_RE.test(n));
	names.sort((a, b) => {
		const ka = numericFrameSortKey(a);
		const kb = numericFrameSortKey(b);
		if (ka == null || kb == null) {
			return String(a).localeCompare(String(b));
		}
		return ka - kb;
	});
	return names;
}

/**
 * Tier / pool index 0 → first frame (lowest paytable symbol_01).
 *
 * @param {string[]} orderedFrameNames
 * @param {number} tierIndex0
 * @returns {string}
 */
export function tierIndexToIconsFrameName(orderedFrameNames, tierIndex0) {
	const names = Array.isArray(orderedFrameNames) ? orderedFrameNames : [];
	const i = Math.max(0, Math.floor(Number(tierIndex0) || 0));
	if (names.length === 0) {
		return `${i}.png`;
	}
	return names[Math.min(i, names.length - 1)];
}

/**
 * @param {Phaser.Scene} scene
 * @returns {string[]}
 */
export function getPullTabIconsFrameNames(scene) {
	const fromRegistry = scene?.registry?.get?.('pullTabIconsFrameNames');
	if (Array.isArray(fromRegistry) && fromRegistry.length > 0) {
		return fromRegistry;
	}
	const key = scene?.textures?.exists?.('icons') ? 'icons' : 'DI_Icons_Default';
	if (!scene?.textures?.exists?.(key)) {
		return [];
	}
	return extractOrderedIconsFrameNamesFromTexture(scene.textures.get(key));
}

/**
 * Peel strip row height in the icon's coordinate space (from `Peel.back`, not the icon sprite).
 *
 * @param {Phaser.Scene} scene
 * @param {Phaser.GameObjects.Sprite|null|undefined} [sampleSprite]
 * @returns {number}
 */
export function resolvePeelRowHeightForIconSizing(scene, sampleSprite) {
	/** @type {{ back?: Phaser.GameObjects.Image }} */
	const peelFromIcon = sampleSprite?.parent?.parent?.parent;
	const backs = [peelFromIcon?.back, scene?.peelCard?.peelContainer?.list?.[0]?.back];
	for (const back of backs) {
		if (!back?.frame) {
			continue;
		}
		const fh = back.frame.cutHeight || back.frame.height || 0;
		if (fh > 0) {
			return fh * (Math.abs(back.scaleY) || 1);
		}
	}
	return 0;
}

/**
 * Per-theme icon sizing in `pullTabIconsLayout` (theme JSON or atlas `pullTabLayout`):
 * - `iconMaxWidth` / `iconMaxHeight` — absolute px caps (optional)
 * - `iconMaxWidthPercent` — fraction of `iconSpacing` slot width (default 0.88)
 * - `iconMaxHeightPercent` — fraction of peel-row display height (default 0.95)
 * - `iconScale` — extra multiplier after contain-fit (default 1; e.g. 1.15 = 15% larger)
 *
 * @param {Phaser.Scene} scene
 * @param {Record<string, unknown>|null|undefined} layout
 * @param {Phaser.GameObjects.Sprite|null|undefined} sampleSprite
 * @returns {{ maxW: number, maxH: number, scaleMultiplier: number }}
 */
export function resolvePullTabIconMaxDisplaySize(scene, layout, sampleSprite) {
	const spacing = Number(layout?.iconSpacing);
	const maxWRaw = Number(layout?.iconMaxWidth);
	const maxHRaw = Number(layout?.iconMaxHeight);
	const wPct = Number(layout?.iconMaxWidthPercent);
	const hPct = Number(layout?.iconMaxHeightPercent);
	const scaleRaw = Number(layout?.iconScale);

	let maxW =
		Number.isFinite(maxWRaw) && maxWRaw > 0
			? maxWRaw
			: Number.isFinite(spacing) && spacing > 0
			  ? spacing * (Number.isFinite(wPct) && wPct > 0 ? wPct : 0.88)
			  : 88;

	// Peel strip `back` height only — never the icon's displayHeight (already includes prior iconScale).
	const peelRowH = resolvePeelRowHeightForIconSizing(scene, sampleSprite);

	let maxH =
		Number.isFinite(maxHRaw) && maxHRaw > 0
			? maxHRaw
			: peelRowH > 0
			  ? peelRowH * (Number.isFinite(hPct) && hPct > 0 ? hPct : 0.95)
			  : maxW;

	const scaleMultiplier =
		Number.isFinite(scaleRaw) && scaleRaw > 0 ? scaleRaw : 1;

	maxW = Math.max(8, maxW);
	maxH = Math.max(8, maxH);
	return { maxW, maxH, scaleMultiplier };
}

/**
 * Fit icon inside max box (scratch ScoreCard height-fill pattern; uses min scale for contain).
 *
 * @param {Phaser.GameObjects.Sprite} sprite
 * @param {number} maxW
 * @param {number} maxH
 * @param {number} [scaleMultiplier=1] — theme `iconScale` after contain-fit
 */
export function fitPullTabIconSpriteToMaxSize(sprite, maxW, maxH, scaleMultiplier = 1) {
	if (!sprite?.frame) {
		return;
	}
	sprite.setScale(1);
	const fw = sprite.frame.cutWidth || sprite.frame.width || 1;
	const fh = sprite.frame.cutHeight || sprite.frame.height || 1;
	const mul = Number(scaleMultiplier);
	const extra = Number.isFinite(mul) && mul > 0 ? mul : 1;
	const scale = Math.min(maxW / fw, maxH / fh) * extra;
	sprite.setScale(scale);
}
