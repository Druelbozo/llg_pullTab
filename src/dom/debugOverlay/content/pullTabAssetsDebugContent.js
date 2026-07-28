/**
 * Pull-tab theme / atlas / peel layout registry (scratch key 5 is prize sprite mapping; this is the peel equivalent).
 */

import { getLastPullTabBuyDebug } from '../../../utils/game/pullTabLastBuyDebug.js';

/**
 * @param {Phaser.Scene} scene
 * @returns {string[]}
 */
export function formatPullTabAssetsDebugInfo(scene) {
	if (!scene) {
		return ['=== Pull-tab assets ===', 'Scene not available'];
	}
	const lines = ['=== Pull-tab assets / layout registry ===', ''];

	lines.push('--- Textures (common keys) ---');
	for (const key of ['peel', 'peelBack', 'card', 'icons', 'CardBack', 'DI_CardCover_Default']) {
		const ok = scene.textures?.exists?.(key);
		lines.push(`${key}: ${ok ? '✅' : '❌'}`);
	}
	lines.push('');

	lines.push('--- peelTabIconsLayout (registry) ---');
	const layout = scene.registry?.get('pullTabIconsLayout');
	if (layout && typeof layout === 'object') {
		for (const [k, v] of Object.entries(layout)) {
			lines.push(`  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
		}
	} else {
		lines.push('  (not set)');
	}
	lines.push('');

	lines.push('--- window.__selectedGameConfig (summary) ---');
	if (typeof window !== 'undefined' && window.__selectedGameConfig) {
		const c = window.__selectedGameConfig;
		lines.push(`  theme: ${c.theme ?? 'N/A'}`);
		lines.push(`  rowCount: ${c.rowCount ?? 'N/A'}`);
		lines.push(`  paytableId: ${c.paytableId ?? 'N/A'}`);
		lines.push(`  creditValueMinor: ${c.creditValueMinor ?? 'N/A'}`);
		if (Array.isArray(c.prizes)) {
			lines.push(`  prizes (${c.prizes.length}): ${c.prizes.slice(0, 8).join(', ')}${c.prizes.length > 8 ? '…' : ''}`);
		}
	} else {
		lines.push('  (none)');
	}
	lines.push('');

	lines.push('--- serverManager.gameConfig (if awake) ---');
	const gc = scene.serverManager?.gameConfig;
	if (gc && typeof gc === 'object') {
		lines.push(`  rowCount: ${gc.rowCount ?? 'N/A'}`);
		lines.push(`  message: ${typeof gc.message === 'string' ? gc.message.slice(0, 80) : 'N/A'}`);
		if (Array.isArray(gc.prizes)) {
			lines.push(`  prizes (${gc.prizes.length})`);
		}
	} else {
		lines.push('  (not loaded yet)');
	}
	lines.push('');

	lines.push('--- last buy (debug) ---');
	const lastBuy = getLastPullTabBuyDebug();
	if (lastBuy && typeof lastBuy === 'object') {
		for (const [k, v] of Object.entries(lastBuy)) {
			lines.push(`  ${k}: ${v == null ? 'N/A' : String(v)}`);
		}
	} else {
		lines.push('  (none yet)');
	}

	return lines;
}
