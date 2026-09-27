/**
 * Backend API roots for session bootstrap and gameplay (aligned with video-poker).
 *
 * Session launches (`?sessionId=...`): POST /provider/session uses, in order:
 * 1) `providerApiBase` or `apiBaseUrl` query param
 * 2) `env=staging` → staging; otherwise prod (typical Novalink prod launch)
 * 3) `baseUrl` from /provider/session response for subsequent calls
 *
 * Non-session: GameConfig.api.BASE_URL_* via resolveApiBaseUrl().
 */

/** Provider API root when launch URL includes `env=staging`. */
export const PROVIDER_SESSION_API_BASE_STAGING =
    'https://kmz1ixsmv6.execute-api.us-east-1.amazonaws.com/staging';

/** Provider API root when `env` is omitted (typical prod launch). */
export const PROVIDER_SESSION_API_BASE_PROD =
    'https://j4w83l890m.execute-api.us-east-1.amazonaws.com/prod';

const viteProviderUrl =
    typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PROVIDER_API_URL;
const trimmedVite = typeof viteProviderUrl === 'string' ? viteProviderUrl.trim() : '';

/** Default non-session API root (overridable via VITE_PROVIDER_API_URL). */
export const PRODUCTION_API_URL =
    trimmedVite ||
    'https://kmz1ixsmv6.execute-api.us-east-1.amazonaws.com/staging';
