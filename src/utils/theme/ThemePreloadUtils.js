/**
 * Theme preload helpers (Boot + Preload). Mirrors scratch: images gate Level; videos load in background.
 */

import { warn } from '../logger/LoggerUtils.js';
import { themeDefinesPeelVideoSlot, themeUsesFlatCardBackImage } from './PeelCardThemeUtils.js';
import { extractOrderedIconsFrameNamesFromAtlasJson } from './PullTabIconsAtlasUtils.js';

/**
 * @param {Record<string, unknown>|null|undefined} themeData
 * @param {string} slotKey
 * @returns {boolean}
 */
export function shouldPreloadPeelResultImageSlot(themeData, slotKey) {
	if (slotKey === 'win' || slotKey === 'lose') {
		if (themeUsesFlatCardBackImage(themeData)) {
			return true;
		}
		return !themeDefinesPeelVideoSlot(themeData, slotKey);
	}
	return true;
}

/**
 * Fetch icons atlas pullTabLayout JSON into registry (await in Boot before Preload).
 *
 * @param {Phaser.Data.DataManager} registry
 * @param {Record<string, unknown>} themeData
 */
export async function hydratePullTabIconsLayout(registry, themeData) {
	const mergedBase =
		themeData?.pullTabIconsLayout && typeof themeData.pullTabIconsLayout === 'object'
			? themeData.pullTabIconsLayout
			: {};
	const stem = themeData?.imageKeys?.icons;
	registry.set('pullTabIconsLayout', mergedBase);

	if (!stem || typeof stem !== 'string' || stem.startsWith('http')) {
		return;
	}
	try {
		const cb = Date.now();
		const r = await fetch(`assets/images/theme/icons/${stem}.json?t=${cb}`);
		if (!r.ok) {
			return;
		}
		const j = await r.json();
		const orderedNames = extractOrderedIconsFrameNamesFromAtlasJson(j);
		if (orderedNames.length > 0) {
			registry.set('pullTabIconsFrameNames', orderedNames);
		}
		if (j.pullTabLayout && typeof j.pullTabLayout === 'object') {
			registry.set('pullTabIconsLayout', {
				...mergedBase,
				...j.pullTabLayout,
			});
		}
	} catch (err) {
		warn(`[ThemePreload] Icons layout fetch failed: ${err?.message ?? err}`, 'assets', err);
	}
}

/**
 * Queue win/lose videos without blocking Preload → Level transition (scratch does not preload video).
 *
 * @param {Phaser.Scene} scene
 * @param {Record<string, unknown>|null|undefined} themeData
 */
export function queueThemeVideosBackground(scene, themeData) {
	if (themeUsesFlatCardBackImage(themeData)) {
		return;
	}
	const vk = themeData?.videoKeys;
	if (!vk || typeof vk !== 'object' || !scene?.load) {
		return;
	}

	let queued = false;
	for (const [slotKey, stem] of Object.entries(vk)) {
		if (!themeDefinesPeelVideoSlot(themeData, slotKey)) {
			continue;
		}
		if (scene.cache?.video?.exists?.(slotKey)) {
			continue;
		}

		let path = '';
		if (typeof stem === 'string' && stem.startsWith('http')) {
			path = stem;
		} else if (typeof stem === 'string') {
			path = `assets/videos/${slotKey}/${stem}.mp4?t=${Date.now()}`;
		} else {
			continue;
		}

		scene.load.video(slotKey, path, 'loadeddata', true);
		queued = true;
	}

	if (queued && !scene.load.isLoading() && scene.load.list.size > 0) {
		scene.load.start();
	}
}
