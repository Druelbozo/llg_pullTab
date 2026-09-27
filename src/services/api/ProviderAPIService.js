import { getUrlParam } from '../../utils/browser/UrlUtils.js';
import { fetchWithTimeout } from '../../utils/network/fetchWithTimeout.js';
import { GameConfig } from '../../config/Global.js';
import {
    PRODUCTION_API_URL,
    PROVIDER_SESSION_API_BASE_PROD,
    PROVIDER_SESSION_API_BASE_STAGING,
} from '../../config/ApiConfig.js';
import { log, warn, error as logErr } from '../../utils/logger/LoggerUtils.js';

const SESSION_FETCH_TIMEOUT_MS = 15000;
const SESSION_CACHE_DURATION_MS = 5000;

function syncWindowSessionApiBase(baseUrl) {
    if (typeof window === 'undefined' || !baseUrl) {
        return;
    }
    window.__sessionApiBaseUrl = String(baseUrl).replace(/\/+$/, '');
}

export default class ProviderAPIService {
    constructor() {
        this.sessionId = null;
        this.mode = 'demo';
        this.isSessionMode = false;
        this.providerSessionData = null;
        this.providerSessionCacheTime = null;
        /** @type {string|null} */
        this.sessionApiBaseUrl = null;
        this.extractSessionFromURL();
        this.applyLaunchProviderApiBaseFromUrl();
        this.applySessionProviderApiBaseFromEnv();
        syncWindowSessionApiBase(this.getBaseUrl());
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
            log(`[ProviderAPIService] Session mode sessionId=${this.sessionId} mode=${this.mode}`, 'api');
        }
    }

    _normalizeSessionApiBaseUrl(raw) {
        const s = String(raw ?? '').trim().replace(/\/+$/, '');
        if (!s) {
            return null;
        }
        try {
            new URL(s);
        } catch {
            warn('[ProviderAPIService] Ignoring invalid session API base URL', 'api', raw);
            return null;
        }
        return s;
    }

    applyLaunchProviderApiBaseFromUrl() {
        if (!this.sessionId) {
            return;
        }
        const raw = getUrlParam('providerApiBase') ?? getUrlParam('apiBaseUrl');
        if (!raw) {
            return;
        }
        const normalized = this._normalizeSessionApiBaseUrl(raw);
        if (!normalized) {
            return;
        }
        log('[ProviderAPIService] API base from launch URL', 'api', normalized);
        this.sessionApiBaseUrl = normalized;
    }

    applySessionProviderApiBaseFromEnv() {
        if (!this.sessionId || this.sessionApiBaseUrl) {
            return;
        }
        const env = getUrlParam('env');
        if (env === 'staging') {
            this.sessionApiBaseUrl = PROVIDER_SESSION_API_BASE_STAGING;
            log('[ProviderAPIService] Session API base from env=staging', 'api', this.sessionApiBaseUrl);
            return;
        }
        this.sessionApiBaseUrl = PROVIDER_SESSION_API_BASE_PROD;
        log('[ProviderAPIService] Session API base (prod)', 'api', this.sessionApiBaseUrl);
    }

    _applySessionApiBaseUrlFromPayload(payload) {
        const normalized = this._normalizeSessionApiBaseUrl(
            typeof payload?.baseUrl === 'string' ? payload.baseUrl : '',
        );
        if (!normalized) {
            return;
        }
        if (normalized !== this.sessionApiBaseUrl) {
            log('[ProviderAPIService] Session-derived API base URL', 'api', normalized);
        }
        this.sessionApiBaseUrl = normalized;
        syncWindowSessionApiBase(normalized);
    }

    _isLocalHost() {
        return typeof window !== 'undefined'
            && (window.location.hostname === 'localhost'
                || window.location.hostname === '127.0.0.1');
    }

    getBaseUrl() {
        if (this._isLocalHost()) {
            const fallbackLocal = `http://localhost:${typeof __CORS_PROXY_PORT__ !== 'undefined' ? __CORS_PROXY_PORT__ : '3005'}`;
            return (GameConfig?.api?.BASE_URL_LOCAL || fallbackLocal).replace(/\/+$/, '');
        }
        if (this.sessionApiBaseUrl) {
            return this.sessionApiBaseUrl;
        }
        return (GameConfig?.api?.BASE_URL_LIVE || PRODUCTION_API_URL).replace(/\/+$/, '');
    }

    async getSessionInfo() {
        if (!this.sessionId) {
            throw new Error('No provider session ID available');
        }

        const now = Date.now();
        if (this.providerSessionData && this.providerSessionCacheTime) {
            const cacheAge = now - this.providerSessionCacheTime;
            if (cacheAge < SESSION_CACHE_DURATION_MS) {
                log('[ProviderAPIService] Using cached session', 'api');
                return this.providerSessionData;
            }
        }

        const baseUrl = this.getBaseUrl();
        const url = `${baseUrl}/provider/session`;

        log(`[ProviderAPIService] Fetching session url=${url}`, 'api');

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
            this._applySessionApiBaseUrlFromPayload(sessionData);
            if (sessionData.mode === 'real' || sessionData.mode === 'demo') {
                this.mode = sessionData.mode;
            }
            this.providerSessionData = { ...sessionData, sessionId: this.sessionId };
            this.providerSessionCacheTime = now;

            log(
                `[ProviderAPIService] Session received mode=${sessionData.mode} operatorBalance=${sessionData.operatorBalance ?? 'n/a'} theme=${sessionData.gameMetadata?.theme ?? ''}`,
                'api',
            );

            return this.providerSessionData;
        } catch (err) {
            logErr(`[ProviderAPIService] Session fetch failed: ${err?.message ?? err}`, 'api', err);
            if (this.providerSessionData) {
                warn('[ProviderAPIService] Using stale cached session', 'api');
                return this.providerSessionData;
            }
            throw err;
        }
    }
}
