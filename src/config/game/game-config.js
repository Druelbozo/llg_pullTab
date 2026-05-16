/**
 * Dynamic Game Configuration Selector
 *
 * Selects a configuration module from /src/config/game at runtime based on:
 * 1) URL query parameter: ?config=mega-monster
 * 2) Fallback: DEFAULT_CONFIG
 *
 * Uses import.meta.glob so Vite bundles configs as proper chunks with hashed URLs.
 * Falls back to fetch when glob unavailable (e.g. raw HTTP server).
 *
 * Default export is a Proxy to window.__selectedGameConfig (set in main.js before Phaser starts).
 */

export const DEFAULT_CONFIG = 'mega-monster';

/** String registry — no imports. Add names here; missing files fall back to default. */
export const CONFIG_REGISTRY = [
    'crazy-banana',
    'disco-kitty',
    'lumberjack-legend',
    'mega-monster',
    'yummy-hot-pot',
];

const configModules = (typeof import.meta.glob === 'function')
    ? import.meta.glob('./*.js', { eager: false })
    : {};

export function getAvailableConfigNames() {
    return [...CONFIG_REGISTRY];
}

export function getSelectedConfigName() {
    try {
        const readParam = (win) => {
            try {
                return new URLSearchParams(win.location.search).get('config');
            } catch (_) { return null; }
        };

        const fromQuery = readParam(window) || readParam(window.parent) || readParam(window.top);
        if (fromQuery) {
            const baseName = fromQuery.split(/[:;]/)[0];
            if (baseName) return baseName;
        }
    } catch (_) {
        // In non-browser contexts, fall through to default
    }
    return DEFAULT_CONFIG;
}

/**
 * Load a config by name. Returns null if file doesn't exist.
 */
export async function loadConfig(name) {
    if (name === 'game-config') return null;

    const key = `./${name}.js`;
    const loader = configModules[key];
    if (loader) {
        try {
            const m = await loader();
            return m.default;
        } catch (_) {
            /* fall through to fetch fallback */
        }
    }

    try {
        if (typeof window !== 'undefined' && window.location) {
            const url = new URL(`src/config/game/${name}.js`, window.location.href).href;
            const m = await import(/* @vite-ignore */ url);
            return m.default;
        }
    } catch (_) {
        /* ignore */
    }
    return null;
}

/**
 * Load the config for the selected name (?config=). Falls back to DEFAULT_CONFIG on failure.
 */
export async function loadSelectedConfig() {
    const name = getSelectedConfigName();
    const config = await loadConfig(name);
    return config ?? await loadConfig(DEFAULT_CONFIG);
}

/** For listings/tests — scratch-compatible shape */
export const AVAILABLE_CONFIGS = Object.fromEntries(CONFIG_REGISTRY.map((n) => [n, null]));

export const configName = getSelectedConfigName();

export default new Proxy({}, {
    get(_, prop) {
        return window.__selectedGameConfig?.[prop];
    }
});
