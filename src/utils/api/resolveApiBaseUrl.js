import { GameConfig } from '../../config/Global.js';
import { PRODUCTION_API_URL } from '../../config/ApiConfig.js';

/**
 * REST API origin: local CORS proxy, then session-derived base (Novalink prod/staging), else config default.
 */
export function resolveApiBaseUrl() {
    const isLocal =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    const fallbackLocal = `http://localhost:${typeof __CORS_PROXY_PORT__ !== 'undefined' ? __CORS_PROXY_PORT__ : '3005'}`;

    if (!isLocal && typeof window !== 'undefined' && window.__sessionApiBaseUrl) {
        return String(window.__sessionApiBaseUrl).replace(/\/+$/, '');
    }

    const raw = isLocal
        ? GameConfig?.api?.BASE_URL_LOCAL || fallbackLocal
        : GameConfig?.api?.BASE_URL_LIVE || PRODUCTION_API_URL;
    return String(raw).replace(/\/+$/, '');
}
