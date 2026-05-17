/**
 * Pull Tabs gameplay API (session `/pull-tabs/buy` vs QA `/pull-tabs/test/buy`).
 */

import { fetchWithTimeout } from '../../utils/network/fetchWithTimeout.js';
import { resolveApiBaseUrl } from '../../utils/api/resolveApiBaseUrl.js';
import { error, debug, log } from '../../utils/logger/LoggerUtils.js';

const BUY_TIMEOUT_MS = 20000;

export default class PullTabsService {
    /**
     * @param {string} [baseUrl] - Omit to use resolveApiBaseUrl()
     */
    constructor(baseUrl) {
        this.baseUrl = (baseUrl ?? resolveApiBaseUrl()).replace(/\/+$/, '');
        log('PullTabsService initialized', 'api', { baseUrl: this.baseUrl });
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

            return await response.json();
        } catch (buyErr) {
            error('pull-tabs buy failed', 'api', buyErr);
            throw buyErr;
        }
    }
}
