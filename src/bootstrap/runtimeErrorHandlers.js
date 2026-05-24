/**
 * Global error hooks for production (index.html overlay). Not Vite — hmr.overlay only applies in dev.
 * In dev, errors log to console only (no overlay) so the game canvas stays visible while debugging.
 */

/**
 * @param {unknown} reason
 * @returns {string}
 */
function messageFromReason(reason) {
	if (reason == null) {
		return '';
	}
	if (typeof reason === 'string') {
		return reason;
	}
	if (reason instanceof Error) {
		return reason.message || String(reason);
	}
	return String(reason);
}

/**
 * @param {unknown} reason
 * @returns {boolean}
 */
export function isBenignRuntimeError(reason) {
	const msg = messageFromReason(reason);
	if (!msg) {
		return false;
	}
	const lower = msg.toLowerCase();

	const benignPatterns = [
		'failed to start the audio device',
		'audio device',
		'notallowederror',
		'not allowed',
		'aborterror',
		'interrupted',
		'audio context',
		'audiocontext',
		'play() request was interrupted',
		'user gesture',
		'resizeobserver loop',
	];

	return benignPatterns.some((p) => lower.includes(p));
}

function showFatalOverlay(title, detail) {
	// Dev: console only — Vite hmr.overlay is off; avoid blocking the canvas with index.html overlay.
	if (import.meta.env?.DEV) {
		return;
	}
	const overlay = document.getElementById('error-overlay');
	const msg = document.getElementById('error-message');
	if (!overlay || !msg) {
		return;
	}
	msg.textContent = `${title}\n\n${detail}`;
	overlay.style.display = 'block';
}

/**
 * Install window error / unhandledrejection handlers (call once from main.js).
 */
export function installRuntimeErrorHandlers() {
	if (typeof window === 'undefined' || window.__pullTabRuntimeHandlersInstalled) {
		return;
	}
	window.__pullTabRuntimeHandlersInstalled = true;

	window.addEventListener('error', (event) => {
		const reason = event.error ?? event.message;
		if (isBenignRuntimeError(reason)) {
			console.warn('[runtime] Suppressed benign error:', reason);
			return;
		}
		const detail =
			(event.message || 'Unknown error') +
			'\n\n' +
			(event.filename || '') +
			':' +
			(event.lineno || '') +
			'\n\n' +
			(event.error?.stack || '');
		console.error('[runtime] Fatal error:', detail);
		showFatalOverlay('Game failed to load', detail);
	});

	window.addEventListener('unhandledrejection', (event) => {
		const reason = event.reason;
		if (isBenignRuntimeError(reason)) {
			console.warn('[runtime] Suppressed benign promise rejection:', reason);
			event.preventDefault();
			return;
		}
		const detail =
			(reason && (reason.message || String(reason))) +
			(reason && reason.stack ? '\n\n' + reason.stack : '');
		console.error('[runtime] Unhandled promise rejection:', detail);
		showFatalOverlay('Game failed to load', `Unhandled promise rejection:\n\n${detail}`);
	});
}
