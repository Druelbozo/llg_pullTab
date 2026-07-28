/**
 * Last pull-tabs buy attempt (demo / session) for debug overlay and error modals.
 */

/** @type {object|null} */
let _lastBuy = null;

/**
 * @param {object} record
 */
export function setLastPullTabBuyDebug(record) {
	_lastBuy = {
		at: new Date().toISOString(),
		...record,
	};
	if (typeof window !== 'undefined') {
		window.__pullTabLastBuyDebug = _lastBuy;
	}
}

/** @returns {object|null} */
export function getLastPullTabBuyDebug() {
	return _lastBuy;
}

/**
 * @param {Error|object|unknown} errOrDebug
 * @returns {string}
 */
export function formatPullTabBuyErrorDetail(errOrDebug) {
	const source = errOrDebug || getLastPullTabBuyDebug();
	if (!source || source.ok === true) {
		return '';
	}

	const statusRaw = source.status;
	const status = statusRaw === 'pending' ? NaN : Number(statusRaw);
	const msg = String(source.message || source.error || source);
	const base =
		'We could not process your purchase just now. You have not been charged for this round. Please try again in a few moments.';

	if (status === 401 || /IP authentication failed|not in whitelist/i.test(msg)) {
		return `${base}\n\nReason: Your IP is not whitelisted for demo buys (HTTP 401).`;
	}
	if (status === 400 || /Request body is required/i.test(msg)) {
		return `${base}\n\nReason: The server did not receive a valid buy request (HTTP 400). Restart the CORS proxy if testing locally.`;
	}
	if (status === 404 || /Paytable.*not found/i.test(msg)) {
		return `${base}\n\nReason: Paytable not found (HTTP 404). Check paytableId in game config and Dynamo.`;
	}
	if (/abort|timeout|timed out|Failed to fetch|NetworkError|Proxy error/i.test(msg)) {
		return `${base}\n\nReason: Network or timeout — ${msg}`;
	}
	if (Number.isFinite(status) && status > 0) {
		return `${base}\n\nReason: HTTP ${status} — ${msg.replace(/^API Error:\s*/i, '')}`;
	}
	if (msg && msg !== '[object Object]' && !msg.startsWith('API Error:')) {
		return `${base}\n\nReason: ${msg}`;
	}
	if (msg && msg !== '[object Object]') {
		return `${base}\n\nReason: ${msg.replace(/^API Error:\s*/i, '')}`;
	}
	return base;
}
