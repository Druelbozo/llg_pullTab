/**
 * Pull Tabs gameplay API (session `/pull-tabs/buy` vs QA `/pull-tabs/test/buy`).
 */

import { fetchWithTimeout } from '../../utils/network/fetchWithTimeout.js';
import { resolveApiBaseUrl } from '../../utils/api/resolveApiBaseUrl.js';
import { error, debug, log } from '../../utils/logger/LoggerUtils.js';

const BUY_TIMEOUT_MS = 20000;
const PAYTABLE_INFO_TIMEOUT_MS = 15000;

export default class PullTabsService {
    /**
     * @param {string} [baseUrl] - Omit to use resolveApiBaseUrl()
     */
    constructor(baseUrl) {
        this.baseUrl = (baseUrl ?? resolveApiBaseUrl()).replace(/\/+$/, '');
        log('PullTabsService initialized', 'api', { baseUrl: this.baseUrl });
    }

    /**
     * @param {unknown} json
     * @returns {object}
     */
    static unwrapApiBody(json) {
        if (!json || typeof json !== 'object') {
            return /** @type {object} */ (json);
        }
        if (typeof json.body === 'string') {
            try {
                return JSON.parse(json.body);
            } catch (_e) {
                return /** @type {object} */ (json);
            }
        }
        if (json.body && typeof json.body === 'object') {
            return /** @type {object} */ (json.body);
        }
        return /** @type {object} */ (json);
    }

    /**
     * Session mode: `{ sessionId }` only (paytable/credit come from provider session metadata).
     * Non-session (test): `{ paytableId, creditValueMinor }`.
     *
     * @param {string} paytableId
     * @param {number} creditValueMinor
     * @returns {Promise<object>}
     */
    async buy(paytableId, creditValueMinor) {
        try {
            const sid = typeof window !== 'undefined' && window.__sessionId ? String(window.__sessionId).trim() : '';
            const isSessionMode = sid !== '';

            const requestBody = isSessionMode
                ? { sessionId: sid }
                : {
                      paytableId,
                      creditValueMinor: Math.round(Number(creditValueMinor)),
                  };

            const endpoint = isSessionMode ? '/pull-tabs/buy' : '/pull-tabs/test/buy';
            const url = `${this.baseUrl}${endpoint}`;

            debug('pull-tabs buy request', 'api', {
                url,
                isSessionMode,
                ...(isSessionMode ? {} : { paytableId, creditValueMinor: requestBody.creditValueMinor }),
            });

            const response = await fetchWithTimeout(
                url,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                },
                BUY_TIMEOUT_MS
            );

            if (!response.ok) {
                let errorData = {};
                try {
                    errorData = await response.json();
                } catch (_e) {
                    errorData = { message: response.statusText };
                }
                error('pull-tabs buy API error', 'api', {
                    status: response.status,
                    errorData,
                    url,
                    isSessionMode,
                });
                const msg =
                    errorData?.body?.error?.message ??
                    errorData?.body?.message ??
                    errorData?.error?.message ??
                    errorData?.message ??
                    response.statusText;
                const err = new Error(`API Error: ${msg}`);
                err.status = response.status;
                err.standardizedCode = errorData?.body?.error?.code ?? errorData?.error?.code;
                throw err;
            }

            return PullTabsService.unwrapApiBody(await response.json());
        } catch (buyErr) {
            error('pull-tabs buy failed', 'api', buyErr);
            throw buyErr;
        }
    }

    /**
     * Lobby / info: denomination-specific payouts and tier counts from `POST /pull-tabs/get-paytable-info`.
     *
     * @param {string} paytableId
     * @param {number} creditValueMinor
     * @returns {Promise<object>}
     */
    async getPaytableInfo(paytableId, creditValueMinor) {
        try {
            const id = String(paytableId ?? '').trim();
            const credit = Math.round(Number(creditValueMinor));
            const url = `${this.baseUrl}/pull-tabs/get-paytable-info`;

            debug('pull-tabs get-paytable-info request', 'api', {
                url,
                paytableId: id,
                creditValueMinor: credit,
            });

            const response = await fetchWithTimeout(
                url,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ paytableId: id, creditValueMinor: credit }),
                },
                PAYTABLE_INFO_TIMEOUT_MS
            );

            if (!response.ok) {
                let errorData = {};
                try {
                    errorData = await response.json();
                } catch (_e) {
                    errorData = { message: response.statusText };
                }
                error('pull-tabs get-paytable-info API error', 'api', {
                    status: response.status,
                    errorData,
                    url,
                    paytableId: id,
                });
                const unwrapped = PullTabsService.unwrapApiBody(errorData);
                const msg =
                    unwrapped?.error?.message ??
                    unwrapped?.message ??
                    errorData?.body?.error?.message ??
                    errorData?.body?.message ??
                    errorData?.error?.message ??
                    errorData?.message ??
                    response.statusText;
                const err = new Error(`API Error: ${msg}`);
                err.status = response.status;
                err.standardizedCode = unwrapped?.error?.code ?? errorData?.body?.error?.code;
                throw err;
            }

            const raw = await response.json();
            return PullTabsService.unwrapApiBody(raw);
        } catch (err) {
            error('pull-tabs get-paytable-info failed', 'api', err);
            throw err;
        }
    }
}
