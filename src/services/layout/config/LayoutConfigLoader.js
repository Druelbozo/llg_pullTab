/**
 * Layout Configuration Loader
 * Loads and merges layout configuration from JS modules
 * Merges defaults with layout-specific override files
 *
 * Uses .js (not .json) to avoid MIME type issues when served as module scripts.
 */
import { warn, log } from '../../../utils/logger/LoggerUtils.js';

import defaultsJson from '../../../config/layouts/defaults.js';
import portraitMobileJson from '../../../config/layouts/portrait-mobile.js';
import landscapeMobileJson from '../../../config/layouts/landscape-mobile.js';
import portraitJson from '../../../config/layouts/portrait.js';
import landscapeJson from '../../../config/layouts/landscape.js';

// Cache for loaded configs
let cachedConfigs = null;

/**
 * Deep merge two objects, preserving nested structure
 * @param {Object} target - Target object to merge into
 * @param {Object} source - Source object to merge from
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
    if (!source || typeof source !== 'object') {
        return target || {};
    }
    if (!target || typeof target !== 'object') {
        return source || {};
    }

    const result = { ...target };

    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
    }

    return result;
}

function buildConfigs() {
    const defaults = defaultsJson || {};
    const layoutConfigs = {
        'portrait-mobile': portraitMobileJson || {},
        'landscape-mobile': landscapeMobileJson || {},
        'portrait': portraitJson || {},
        'landscape': landscapeJson || {}
    };

    const configs = {};
    for (const [layoutName, layoutOverrides] of Object.entries(layoutConfigs)) {
        configs[layoutName] = deepMerge(defaults, layoutOverrides);
    }
    return configs;
}

/**
 * Clear the cached layout configurations
 * This forces a reload on the next call to loadLayoutConfigs()
 */
export function clearCache() {
    cachedConfigs = null;
    log('LayoutConfigLoader: Cache cleared');
}

/**
 * Reload layout configurations from JSON files
 * Clears cache and loads fresh configs
 * 
 * @returns {Promise<Object>} Promise that resolves to object with merged configs by layout name
 */
export async function reloadConfigs() {
    clearCache();
    return loadLayoutConfigs();
}

/**
 * Load layout configuration from JSON files (merged with defaults)
 * Merges defaults.js with layout-specific override files
 * Uses caching to avoid reloading on subsequent calls
 * 
 * @param {boolean} forceReload - If true, bypass cache and reload configs
 * @returns {Promise<Object>} Promise that resolves to object with merged configs by layout name
 */
export async function loadLayoutConfigs(forceReload = false) {
    if (forceReload) {
        clearCache();
    }

    if (cachedConfigs && !forceReload) {
        return cachedConfigs;
    }

    try {
        cachedConfigs = buildConfigs();
        log('LayoutConfigLoader: Layout configs loaded successfully');
        return cachedConfigs;
    } catch (error) {
        warn('LayoutConfigLoader: Failed to load layout configs', error);
        cachedConfigs = {
            'portrait-mobile': {},
            'landscape-mobile': {},
            'portrait': {},
            'landscape': {}
        };
        return cachedConfigs;
    }
}

/**
 * Get layout config by name (synchronous access to cached configs)
 * @param {string} layoutName - Layout name ('portrait-mobile', 'landscape-mobile', 'portrait', 'landscape')
 * @returns {Object|null} Layout config or null if not loaded/cached
 */
export function getLayoutConfig(layoutName) {
    if (!cachedConfigs) {
        return null;
    }
    return cachedConfigs[layoutName] || null;
}

