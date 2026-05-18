/**
 * Stateless utility function for formatting console / performance debug text for the overlay.
 * Key 6: full scrolling view. Key 7: hidden log body, same payload for the Log upload button.
 */

import { getCapturedMessages, filterPreloadMessages, MAX_CAPTURED_BUFFER, getMessageCounts } from '../../../utils/logger/ConsoleCapture.js';
import { getPerformanceSummary, getMarks, getMeasures, getCustomStats } from '../../../utils/performance/PerformanceTracker.js';
import { GameConfig } from '../../../config/Global.js';
import { getSelectedConfigName } from '../../../config/game/game-config.js';

/**
 * First lines of the server upload: identify build / session / paytable.
 * @returns {string[]}
 */
function buildLogUploadHeaderLines() {
	if (typeof window === 'undefined') {
		return ['gameID: (non-browser)', ''];
	}
	const cfg = window.__selectedGameConfig || {};
	const lines = [];
	if (window.__sessionId) {
		lines.push(`gameID: ${cfg.paytableId || 'session'}`);
		lines.push(`sessionId: ${String(window.__sessionId)}`);
	} else {
		let slug = 'unknown';
		try {
			slug = getSelectedConfigName();
		} catch (_) {
			/* ignore */
		}
		lines.push(`gameID: ${slug}`);
		if (cfg.paytableId) {
			lines.push(`paytableId: ${cfg.paytableId}`);
		}
	}
	if (cfg.theme) {
		lines.push(`theme: ${cfg.theme}`);
	}
	lines.push(`capturedAt: ${new Date().toISOString()}`);
	lines.push('');
	return lines;
}

/**
 * Format console debug information
 * Returns HTML string with copy button and content (special handling in DebugOverlay)
 * Message lines in the report use warnings/errors-only when SHOW_DEBUG_OVERLAY is 6 (same as full console panel). Mode 7 only hides the overlay listing; it does not change this filter.
 * @param {Object} [options]
 * @param {boolean} [options.hideDisplayedLog] - If true (debug key 7), omit the scrolling log HTML but keep the same textContent for Log upload.
 * @returns {Object} { html: true, content, textContent }
 */
export function formatConsoleDebugInfo(options = {}) {
	const hideDisplayedLog = options.hideDisplayedLog === true;
	const overlayMode = GameConfig?.debug?.SHOW_DEBUG_OVERLAY;
	const onlyWarningsAndErrors = overlayMode === 6;

	// When launch mode is 6: warnings and errors only in this report section. Otherwise: preload-related messages
	const allMessages = getCapturedMessages({ limit: MAX_CAPTURED_BUFFER });
	const displayMessages = onlyWarningsAndErrors
		? getCapturedMessages({ levels: ['error', 'warn'], limit: MAX_CAPTURED_BUFFER })
		: filterPreloadMessages(allMessages);
	
	const lines = [
		...buildLogUploadHeaderLines(),
		`=== PRELOAD DEBUG INFO ===`,
		``,
		`--- Performance Summary (Current Session) ---`
	];

	// Phase breakdown (Boot, Preflight, Preload, Level)
	const measures = getMeasures();
	const measureMap = Object.fromEntries(measures.map(m => [m.name, m.duration]));
	const customStats = getCustomStats();
	const phaseLines = [];
	if (measureMap['boot:themeFetch:duration'] != null) {
		phaseLines.push(`Boot theme fetch: ${measureMap['boot:themeFetch:duration'].toFixed(2)}ms`);
	}
	if (measureMap['preload:preflight:duration'] != null) {
		const preflightCount = customStats.preflightRequestCount;
		phaseLines.push(`Preload preflight: ${measureMap['preload:preflight:duration'].toFixed(2)}ms${preflightCount != null ? ` (${preflightCount} HEAD requests)` : ''}`);
	}
	if (measureMap['preload:total'] != null) {
		phaseLines.push(`Preload total: ${measureMap['preload:total'].toFixed(2)}ms`);
	}
	if (measureMap['level:create:duration'] != null) {
		phaseLines.push(`Level create: ${measureMap['level:create:duration'].toFixed(2)}ms`);
	}
	if (measureMap['level:editorCreate:duration'] != null) {
		phaseLines.push(`  - editorCreate: ${measureMap['level:editorCreate:duration'].toFixed(2)}ms`);
	}
	if (measureMap['level:sceneInit:duration'] != null) {
		phaseLines.push(`  - sceneInit: ${measureMap['level:sceneInit:duration'].toFixed(2)}ms`);
	}
	if (measureMap['level:layoutInit:duration'] != null) {
		phaseLines.push(`  - layoutInit (sync): ${measureMap['level:layoutInit:duration'].toFixed(2)}ms`);
	}
	if (measureMap['level:layoutCallback:duration'] != null) {
		phaseLines.push(`  - layoutCallback (async): ${measureMap['level:layoutCallback:duration'].toFixed(2)}ms`);
	}
	if (measureMap['level:postAwake:duration'] != null) {
		phaseLines.push(`  - postAwake: ${measureMap['level:postAwake:duration'].toFixed(2)}ms`);
	}
	if (measureMap['level:sceneAwake:duration'] != null) {
		phaseLines.push(`    - scene-awake listeners: ${measureMap['level:sceneAwake:duration'].toFixed(2)}ms`);
	}
	if (phaseLines.length > 0) {
		lines.push(`--- Phase Breakdown ---`);
		phaseLines.forEach(l => lines.push(l));
		lines.push(``);
	}

	// Tile creation stats (from Prefab_ScratchSurface)
	const tileTextureCount = customStats.tileTextureCount;
	const tileSpriteCount = customStats.tileSpriteCount;
	const tileImageDimensions = customStats.tileImageDimensions;
	const tileOverlapUsed = customStats.tileOverlapUsed;
	const tileSize = customStats.tileSize;
	if (tileTextureCount != null || tileSpriteCount != null || tileImageDimensions != null) {
		lines.push(`--- Tile Creation ---`);
		if (tileTextureCount != null) lines.push(`Texture count: ${tileTextureCount}`);
		if (tileSpriteCount != null) lines.push(`Sprite count: ${tileSpriteCount}`);
		if (tileImageDimensions != null) lines.push(`Image dimensions: ${tileImageDimensions}`);
		if (tileOverlapUsed != null) lines.push(`Overlap optimization: ${tileOverlapUsed ? 'yes' : 'no'}`);
		if (tileSize != null) lines.push(`Tile size: ${tileSize}px`);
		lines.push(``);
	}

	// Scratch cover pipeline (custom stats from Prefab_ScratchSurface.processImage — always in plain text for uploads)
	const scratchDiagKeys = [
		'scratchCoverDecodeRetries',
		'scratchCoverProcessGen',
		'scratchCoverNaturalPx',
		'scratchThemeCoverFileKey'
	];
	if (scratchDiagKeys.some(k => customStats[k] != null)) {
		lines.push(`--- Scratch cover (upload diagnostics) ---`);
		scratchDiagKeys.forEach((k) => {
			if (customStats[k] != null) {
				lines.push(`${k}: ${customStats[k]}`);
			}
		});
		if (typeof window !== 'undefined') {
			const dpr = window.devicePixelRatio;
			lines.push(`viewport: ${window.innerWidth}x${window.innerHeight}px css (dpr ${dpr != null ? dpr : '?'})`);
		}
		lines.push(``);
	}

	// Navigation timing
	if (typeof performance !== 'undefined' && performance.timing) {
		const pt = performance.timing;
		const navLines = [];
		if (pt.domContentLoadedEventEnd > 0 && pt.navigationStart > 0) {
			navLines.push(`DOMContentLoaded: ${(pt.domContentLoadedEventEnd - pt.navigationStart).toFixed(0)}ms from load`);
		}
		if (pt.loadEventEnd > 0 && pt.navigationStart > 0) {
			navLines.push(`loadEventEnd: ${(pt.loadEventEnd - pt.navigationStart).toFixed(0)}ms from load`);
		}
		const marks = getMarks();
		const preloadStartMark = marks.find(m => m.name === 'preload:start');
		if (preloadStartMark) {
			navLines.push(`Time to preload:start: ${preloadStartMark.timestamp.toFixed(0)}ms from page load`);
		}
		if (navLines.length > 0) {
			lines.push(`--- Navigation Timing ---`);
			navLines.forEach(l => lines.push(l));
			lines.push(``);
		}
	}

	// WebGL context events (from all captured messages)
	const allMsgs = getCapturedMessages({ limit: MAX_CAPTURED_BUFFER });
	const msgLower = (m) => (m.message || '').toLowerCase();
	const contextLostCount = allMsgs.filter(m => msgLower(m).includes('context lost')).length;
	const contextRestoredCount = allMsgs.filter(m => msgLower(m).includes('context restored')).length;
	if (contextLostCount > 0 || contextRestoredCount > 0) {
		lines.push(`--- WebGL Context Events ---`);
		lines.push(`Context lost: ${contextLostCount}, Context restored: ${contextRestoredCount}`);
		lines.push(``);
	}

	// Add performance summary (marks and measures)
	const perfSummary = getPerformanceSummary();
	if (perfSummary && perfSummary.trim().length > 0) {
		lines.push(perfSummary);
		lines.push(``);
	} else {
		lines.push(`No performance data yet.`);
		lines.push(``);
	}
	
	// Show messages (warnings/errors only when SHOW_DEBUG_OVERLAY is 6, else preload-related)
	const sectionTitle = onlyWarningsAndErrors
		? `--- Warnings & Errors Only (${displayMessages.length}) ---`
		: `--- Preload-Related Logs (${displayMessages.length} of ${allMessages.length} total) ---`;
	lines.push(sectionTitle);
	
	if (displayMessages.length === 0) {
		lines.push(onlyWarningsAndErrors
			? `No warnings or errors captured.`
			: `No preload-related messages captured.`);
		if (!onlyWarningsAndErrors) {
			lines.push(`(Showing only messages with: [Preload], [Perf], assets, theme, loading, etc.)`);
		}
	} else {
		displayMessages.forEach((msg, index) => {
			// Format timestamp (show time only, not full ISO string)
			const timeStr = new Date(msg.timestamp).toLocaleTimeString();
			
			// Format level with emoji
			let levelEmoji = '';
			if (msg.level === 'error') {
				levelEmoji = '❌';
			} else if (msg.level === 'warn') {
				levelEmoji = '⚠️';
			} else {
				levelEmoji = 'ℹ️';
			}
			
			lines.push(``);
			lines.push(`${index + 1}. [${timeStr}] ${levelEmoji} ${msg.level.toUpperCase()}`);
			lines.push(`   ${msg.message}`);
			
			// Full stack trace for uploads (no line cap)
			if (msg.stack) {
				msg.stack.split('\n').forEach(line => {
					lines.push(`   ${line.trim()}`);
				});
			}
		});

		const capInfo = getMessageCounts();
		if (capInfo.total >= MAX_CAPTURED_BUFFER) {
			lines.push(``);
			lines.push(`(Console capture buffer full: ${MAX_CAPTURED_BUFFER} messages kept; older entries were dropped.)`);
		}
	}
	
	// Build text content (this is what Log POSTs to the server)
	const textContent = lines.join('\n');

	if (hideDisplayedLog) {
		return {
			html: true,
			content: `<div id="console-debug-content"><p style="margin:0;padding:8px 10px;font-size:12px;line-height:1.35;opacity:0.9;">Log listing is hidden here. <strong>Log</strong> uploads the same debug report as key 6 for this launch config (perf + message section). Browser / in-game logs follow <strong>SHOW_LOG_CATEGORIES</strong> unless key 6 is active.</p></div>`,
			textContent
		};
	}

	// Escape HTML characters in text content for display
	const escapedContent = textContent
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')
		.replace(/\n/g, '<br>');

	return {
		html: true,
		content: `<div id="console-debug-content">${escapedContent}</div>`,
		textContent: textContent
	};
}

