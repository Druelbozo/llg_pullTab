/**
 * DOM debug overlay + scratch-style panel keys 1–7 (see {@link GameConfig.debug.SHOW_DEBUG_OVERLAY}).
 */

import DebugOverlay from '../../dom/DebugOverlay.js';
import { formatGameDebugInfo } from '../../dom/debugOverlay/content/pullTabGameDebugContent.js';
import { formatLayoutDebugInfo } from '../../dom/debugOverlay/content/layoutDebugContent.js';
import { formatDeviceDebugInfo } from '../../dom/debugOverlay/content/deviceDebugContent.js';
import { formatViewportDebugInfo } from '../../dom/debugOverlay/content/viewportDebugContent.js';
import { formatPullTabAssetsDebugInfo } from '../../dom/debugOverlay/content/pullTabAssetsDebugContent.js';
import { formatConsoleDebugInfo } from '../../dom/debugOverlay/content/consoleDebugContent.js';
import LayoutManager from '../layout/LayoutManager.js';
import { GameConfig } from '../../config/Global.js';
import { debug, warn } from '../../utils/logger/LoggerUtils.js';

/**
 * @param {Phaser.Scene} scene
 * @returns {void}
 */
export function setupPullTabDebugOverlay(scene) {
	if (!scene.layoutManager) {
		return;
	}

	const defaultPanel = LayoutManager.DEBUG_OVERLAY_VISIBLE_BY_DEFAULT
		? LayoutManager.DEBUG_OVERLAY_DEFAULT_PANEL
		: null;

	scene.debugOverlay = new DebugOverlay(scene, {
		defaultVisibleKey: defaultPanel,
		enablePanelNumberHotkeys: GameConfig.debug.ENABLE_VISUAL_DEBUG_SHORTCUTS,
	});

	scene.debugOverlay.registerFormatter('1', () => formatGameDebugInfo(scene), false);

	scene.debugOverlay.registerFormatter(
		'2',
		() => formatLayoutDebugInfo(scene.layoutManager),
		true,
	);

	scene.debugOverlay.registerFormatter('3', () => formatDeviceDebugInfo(scene), false);

	scene.debugOverlay.registerFormatter('4', () => formatViewportDebugInfo(scene), true);

	scene.debugOverlay.registerFormatter('5', () => formatPullTabAssetsDebugInfo(scene), false);

	scene.debugOverlay.registerFormatter('6', () => formatConsoleDebugInfo(), true);

	scene.debugOverlay.registerFormatter('7', () => formatConsoleDebugInfo({ hideDisplayedLog: true }), true);

	if (LayoutManager.DEBUG_OVERLAY_VISIBLE_BY_DEFAULT && defaultPanel) {
		if (scene.debugOverlay.formatters.has(defaultPanel)) {
			scene.debugOverlay.show(defaultPanel);
		}
	}

	if (LayoutManager.DEBUG_OVERLAY_VISIBLE_BY_DEFAULT && defaultPanel) {
		scene.time.delayedCall(500, () => {
			if (scene.debugOverlay?.formatters.has(defaultPanel) && !scene.debugOverlay.isVisible) {
				debug(`Debug overlay not visible, showing panel '${defaultPanel}' via delayed call`, 'ui');
				scene.debugOverlay.show(defaultPanel);
			}
		});
	}

	const debugOverlayValue = GameConfig.debug.SHOW_DEBUG_OVERLAY;
	if (
		debugOverlayValue !== null &&
		debugOverlayValue !== undefined &&
		debugOverlayValue >= 1 &&
		debugOverlayValue <= 7
	) {
		scene.time.delayedCall(500, () => {
			const debugKey = String(debugOverlayValue);
			if (scene.debugOverlay?.formatters.has(debugKey)) {
				scene.debugOverlay.show(debugKey);
			} else {
				warn('[PullTab] Debug overlay formatter not registered for key', 'ui', debugKey);
			}
		});
	}
}
