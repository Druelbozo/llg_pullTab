import { GameConfig } from '../../config/Global.js';

/**
 * Rest API origin (staging proxy locally, staging/prod Lambda in production).
 */
export function resolveApiBaseUrl() {
    const isLocal =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    const fallbackLocal = `http://localhost:${typeof __CORS_PROXY_PORT__ !== 'undefined' ? __CORS_PROXY_PORT__ : '3005'}`;
    const fallbackLive = 'https://kmz1ixsmv6.execute-api.us-east-1.amazonaws.com/staging';

    const raw = isLocal ? GameConfig?.api?.BASE_URL_LOCAL || fallbackLocal : GameConfig?.api?.BASE_URL_LIVE || fallbackLive;
    return String(raw).replace(/\/+$/, '');
}
