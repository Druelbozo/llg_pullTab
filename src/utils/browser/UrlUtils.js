/**
 * @param {string} name
 * @param {Window|null} [win]
 * @returns {string|null}
 */
export function getUrlParam(name, win = typeof window !== 'undefined' ? window : null) {
    if (!win?.location?.search) return null;
    try {
        return new URLSearchParams(win.location.search).get(name);
    } catch (_) {
        return null;
    }
}
