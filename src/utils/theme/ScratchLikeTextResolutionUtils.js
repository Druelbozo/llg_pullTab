import FontUtils from '../fonts/FontUtils.js';

/**
 * Build Phaser Text style fields for peel-card banner copy (formerly text.mainText).
 * Prefers Scratch-style text.font + text.palette + text.message over legacy text.mainText.
 *
 * @param {Object|null|undefined} themeData
 * @returns {Object} style snippet for Text.setStyle — fontFamily (string), fontSize (number), color, stroke, strokeThickness, optional fontWeight
 */
export function resolvePeelBannerTextStyle(themeData) {
	if (!themeData?.text || typeof themeData.text !== 'object') {
		return {
			fontFamily: 'New Amsterdam',
			fontSize: 65,
			color: '#fdb50f',
			stroke: '#0',
			strokeThickness: 15,
		};
	}

	const palette = themeData.text.palette || {};
	const msg = themeData.text.message;
	const legacy = themeData.text.mainText;

	const fontRoot = themeData.text.font ?? (typeof legacy?.fontFamily === 'string' ? legacy.fontFamily : null);
	let fontCfg = typeof fontRoot === 'string' ? { family: fontRoot } : fontRoot;
	if (!fontCfg && typeof legacy?.fontFamily === 'string') {
		fontCfg = { family: legacy.fontFamily };
	}
	const { fontFamily: ff, fontWeight } = FontUtils.getFontFamily(fontCfg || { family: 'New Amsterdam' }, themeData);

	const fontSize =
		(msg?.font?.size != null && msg.font.size !== '')
			? Number(msg.font.size)
			: (legacy?.fontSize != null ? Number(legacy.fontSize) : 65);

	const color =
		msg?.font?.color ||
		msg?.font?.colour ||
		palette.primaryColor ||
		legacy?.color ||
		'#fdb50f';

	const strokeColor =
		msg?.stroke?.color ||
		palette.secondaryColor ||
		legacy?.strokeColor ||
		'#0';

	const strokeThickness =
		msg?.stroke?.lineWidth != null
			? Number(msg.stroke.lineWidth)
			: (legacy?.strokeThickness != null ? Number(legacy.strokeThickness) : 15);

	const out = {
		fontFamily: FontUtils.getSafeFontFamily(ff || 'New Amsterdam'),
		fontSize,
		color,
		stroke: strokeColor,
		strokeThickness,
	};
	if (fontWeight != null && fontWeight !== '') {
		const w = parseInt(String(fontWeight), 10);
		if (Number.isFinite(w)) {
			out.fontWeight = w;
		}
	}
	return out;
}

/**
 * Winnings amount line above results art (Prefab_Results). Scratch-style uses text.score.
 *
 * @param {Object|null|undefined} themeData
 * @returns {Object}
 */
export function resolvePrizeAmountTextStyle(themeData) {
	if (!themeData?.text || typeof themeData.text !== 'object') {
		return resolvePeelBannerTextStyle(themeData);
	}

	const banner = resolvePeelBannerTextStyle(themeData);
	const palette = themeData.text.palette || {};
	const scoreCfg = themeData.text.score;
	const legacy = themeData.text.mainText;

	let fontSize = banner.fontSize + 40;
	if (scoreCfg?.font?.size != null && scoreCfg.font.size !== '') {
		fontSize = Number(scoreCfg.font.size);
	} else if (legacy?.fontSize != null && Number.isFinite(Number(legacy.fontSize))) {
		fontSize = Number(legacy.fontSize) + 40;
	}

	const fontRoot = scoreCfg?.font?.family ? { family: scoreCfg.font.family } : themeData.text.font;
	let fontCfg = typeof fontRoot === 'string' ? { family: fontRoot } : fontRoot;
	if (!fontCfg || !fontCfg.family) {
		fontCfg = themeData.text.font ?? (typeof banner.fontFamily === 'string' ? { family: banner.fontFamily } : null);
	}
	const { fontFamily: ff, fontWeight } = FontUtils.getFontFamily(
		fontCfg || { family: 'New Amsterdam' },
		themeData
	);

	const color =
		scoreCfg?.font?.color ||
		scoreCfg?.font?.colour ||
		palette.primaryColor ||
		banner.color;

	const strokeColor =
		scoreCfg?.stroke?.color ||
		palette.secondaryColor ||
		banner.stroke;

	const strokeThickness =
		scoreCfg?.stroke?.lineWidth != null
			? Number(scoreCfg.stroke.lineWidth)
			: banner.strokeThickness;

	const out = {
		fontFamily: FontUtils.getSafeFontFamily(ff || banner.fontFamily),
		fontSize,
		color,
		stroke: strokeColor,
		strokeThickness,
	};
	if (fontWeight != null && fontWeight !== '') {
		const w = parseInt(String(fontWeight), 10);
		if (Number.isFinite(w)) {
			out.fontWeight = w;
		}
	}
	return out;
}
