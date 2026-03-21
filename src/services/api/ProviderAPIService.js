import { getUrlParam } from '../../utils/browser/UrlUtils.js';
import { fetchWithTimeout } from '../../utils/network/fetchWithTimeout.js';
import { GameConfig } from '../../config/Global.js';

const SESSION_FETCH_TIMEOUT_MS = 15000;
const SESSION_CACHE_DURATION_MS = 5000;

export default class ProviderAPIService {
    constructor() {
        this.sessionId = null;
        this.mode = 'demo';
        this.isSessionMode = false;
        this.providerSessionData = null;
        this.providerSessionCacheTime = null;
        this.extractSessionFromURL();
    }

    extractSessionFromURL() {
        const readSession = (win) => {
            try {
                return new URLSearchParams(win.location.search).get('sessionId');
            } catch (_) {
                return null;
            }
        };
        const sessionId = readSession(window)
            || (typeof window !== 'undefined' && window.parent && readSession(window.parent))
            || (typeof window !== 'undefined' && window.top && readSession(window.top))
            || getUrlParam('sessionId');

        const mode = getUrlParam('mode') || 'demo';

        if (sessionId) {
            this.sessionId = sessionId;
            this.mode = mode === 'real' ? 'real' : 'demo';
            this.isSessionMode = true;
            console.log('[ProviderAPIService] Session mode', { sessionId: this.sessionId, mode: this.mode });
        }
    }

    _getBaseUrl() {
        const isLocal = typeof window !== 'undefined'
            && (window.location.hostname === 'localhost'
                || window.location.hostname === '127.0.0.1');
        const fallbackLocal = `http://localhost:${typeof __CORS_PROXY_PORT__ !== 'undefined' ? __CORS_PROXY_PORT__ : '3005'}`;
        const fallbackLive = 'https://kmz1ixsmv6.execute-api.us-east-1.amazonaws.com/staging';
        return isLocal
            ? (GameConfig?.api?.BASE_URL_LOCAL || fallbackLocal)
            : (GameConfig?.api?.BASE_URL_LIVE || fallbackLive);
    }

    async getSessionInfo() {
        if (!this.sessionId) {
            throw new Error('No provider session ID available');
        }

        const now = Date.now();
        if (this.providerSessionData && this.providerSessionCacheTime) {
            const cacheAge = now - this.providerSessionCacheTime;
            if (cacheAge < SESSION_CACHE_DURATION_MS) {
                console.log('[ProviderAPIService] Using cached session');
                return this.providerSessionData;
            }
        }

        const baseUrl = this._getBaseUrl();
        const url = `${baseUrl}/provider/session`;

        console.log('[ProviderAPIService] Fetching session', { url });

        try {
            const response = await fetchWithTimeout(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: this.sessionId })
            }, SESSION_FETCH_TIMEOUT_MS);

            if (!response.ok) {
                const errBody = await response.json().catch(() => ({}));
                throw new Error(errBody?.error || errBody?.body?.error || `Session fetch failed: ${response.status}`);
            }

            const sessionData = await response.json();
            this.providerSessionData = { ...sessionData, sessionId: this.sessionId };
            this.providerSessionCacheTime = now;

            console.log('[ProviderAPIService] Session received', {
                mode: sessionData.mode,
                theme: sessionData.gameMetadata?.theme
            });

            return this.providerSessionData;
        } catch (err) {
            console.error('[ProviderAPIService] Session fetch failed', err);
            if (this.providerSessionData) {
                console.warn('[ProviderAPIService] Using stale cached session');
                return this.providerSessionData;
            }
            throw err;
        }
    }
}
