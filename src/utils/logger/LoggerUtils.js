/**
 * Logger Utility Functions
 * Provides centralized, configurable logging utilities with category-based debug logging
 */

// Logging configuration
let config = {
    enabled: true,
    debugEnabled: true, // Set to true to enable debug logs
    logLevel: 'warn', // 'debug', 'info', 'warn', 'error', 'none' - default to 'warn' to reduce console noise
    categoryFiltering: {
        debug: true,  // debug() supports categories
        log: true,    // log() supports categories
        warn: true,   // warn() supports categories
        error: false  // error() always shows (configurable)
    }
};

// Debug category configuration
// Each category can be individually enabled/disabled
let debugCategories = {
    api: false,        // API/Backend calls, requests, responses
    theme: false,      // Theme loading, application, styling
    layout: false,    // Layout calculations, positioning, responsive design
    ui: false,         // UI element creation, updates, interactions
    game: false,       // Game state, scenes, card management, animations
    assets: false     // Asset loading, preloading, resource management
};

/**
 * Configure logger settings
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Enable/disable all logging
 * @param {boolean} options.debugEnabled - Enable/disable debug logs
 * @param {string} options.logLevel - Minimum log level ('debug', 'info', 'warn', 'error', 'none')
 * @param {Object} options.categories - Category enable/disable settings (e.g., { api: true, theme: false })
 * @param {Object} options.categoryFiltering - Category filtering settings per log level (e.g., { log: true, warn: true, error: false })
 */
export function configureLogger(options = {}) {
    config = { ...config, ...options };
    
    // Update category filtering if provided
    if (options.categoryFiltering) {
        config.categoryFiltering = { ...config.categoryFiltering, ...options.categoryFiltering };
    }
    
    // Update debug categories if provided
    if (options.categories) {
        debugCategories = { ...debugCategories, ...options.categories };
    }
}

/**
 * Enable or disable a specific debug category
 * @param {string} category - Category name (api, theme, layout, ui, game, assets)
 * @param {boolean} enabled - Whether to enable the category
 */
export function setDebugCategory(category, enabled) {
    if (category in debugCategories) {
        debugCategories[category] = enabled;
    }
}

/**
 * Enable or disable multiple debug categories at once
 * @param {Object} categories - Object with category names as keys and boolean values
 */
export function setDebugCategories(categories) {
    Object.keys(categories).forEach(category => {
        if (category in debugCategories) {
            debugCategories[category] = categories[category];
        }
    });
}

/** Keys matched by `GameConfig.debug.SHOW_LOG_CATEGORIES` (and {@link applyLoggingFromGameConfig}). */
export const LOGGER_DEBUG_CATEGORY_KEYS = Object.freeze(
    ['api', 'theme', 'layout', 'ui', 'game', 'assets'],
);

/**
 * Apply `debug.SHOW_LOG_CATEGORIES` from game config (scratch-cards style). Call once at boot before scenes.
 *
 * - `[]` — disable all categories, `debugEnabled: false`, `logLevel: 'warn'`.
 * - `['all']` — every category on, `debugEnabled: true`, `logLevel: 'debug'`.
 * - `['theme', 'api', ...]` — only those categories on (subset of {@link LOGGER_DEBUG_CATEGORY_KEYS}).
 *
 * @param {{ debug?: { SHOW_LOG_CATEGORIES?: string[] } }|null|undefined} cfg - typically {@link GameConfig}
 */
export function applyLoggingFromGameConfig(cfg) {
    if (!cfg || typeof cfg !== 'object' || !cfg.debug) {
        return;
    }
    const raw = cfg.debug.SHOW_LOG_CATEGORIES;
    if (!Array.isArray(raw)) {
        return;
    }

    /** @type {Record<string, boolean>} */
    const next = {};
    if (raw.length === 0) {
        for (const k of LOGGER_DEBUG_CATEGORY_KEYS) {
            next[k] = false;
        }
        setDebugCategories(next);
        configureLogger({ debugEnabled: false, logLevel: 'warn' });
        return;
    }

    const wantsAll = raw.includes('all');
    for (const k of LOGGER_DEBUG_CATEGORY_KEYS) {
        next[k] = wantsAll || raw.includes(k);
    }
    setDebugCategories(next);
    const anyOn = wantsAll || LOGGER_DEBUG_CATEGORY_KEYS.some((k) => next[k]);
    configureLogger({
        debugEnabled: anyOn,
        logLevel: anyOn ? 'debug' : 'warn',
    });

    /** Scratch-style console panel launch: tighten in-game logger; pairs with ConsoleCapture SHOW_DEBUG_OVERLAY===6. */
    if (cfg.debug?.SHOW_DEBUG_OVERLAY === 6) {
        configureLogger({ debugEnabled: false, logLevel: 'warn' });
    }
}

/**
 * Get current debug category configuration
 * @returns {Object} Copy of current category settings
 */
export function getDebugCategories() {
    return { ...debugCategories };
}

/**
 * Get color style for log level
 * @param {string} level - Log level ('debug', 'log', 'warn', 'error')
 * @returns {string} CSS style string
 */
function getLevelColor(level) {
    const colors = {
        debug: 'color: #888; font-weight: bold;',
        log: 'color: #2196F3; font-weight: normal;', // Blue
        warn: 'color: #FF9800; font-weight: bold;', // Orange
        error: 'color: #F44336; font-weight: bold;' // Red
    };
    return colors[level] || '';
}

/**
 * Get color style for category
 * @param {string} category - Category name
 * @returns {string} CSS style string
 */
function getCategoryColor(category) {
    const colors = {
        api: 'color: #9C27B0; font-weight: bold;', // Purple
        theme: 'color: #E91E63; font-weight: bold;', // Pink
        layout: 'color: #4CAF50; font-weight: bold;', // Green
        ui: 'color: #00BCD4; font-weight: bold;', // Cyan
        game: 'color: #FF9800; font-weight: bold;', // Orange
        assets: 'color: #03A9F4; font-weight: bold;' // Light Blue
    };
    return colors[category] || 'color: #666; font-weight: bold;';
}

/**
 * Extract category from arguments if present
 * Supports first-argument string syntax: log('message', 'category', data)
 * @param {Array} args - Arguments array
 * @returns {Object} { category: string|null, logArgs: Array } - Extracted category and remaining arguments
 */
function extractCategory(args) {
    let category = null;
    let logArgs = args;
    
    // Check if first arg is a category string
    if (args.length > 0 && typeof args[0] === 'string' && args[0] in debugCategories) {
        category = args[0];
        logArgs = args.slice(1);
    }
    // Check if first arg is an object with category property
    else if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null && 'category' in args[0]) {
        category = args[0].category;
        logArgs = args.slice(1);
    }
    
    return { category, logArgs };
}

/**
 * Log an info message
 * @param {string} message - Log message
 * @param {...*} args - Additional arguments to log. If first arg is a category string, it will be used for filtering.
 * @example
 * log('Theme applied', 'theme', themeData);
 * log('Layout calculated', 'layout');
 */
export function log(message, ...args) {
    if (!config.enabled || config.logLevel === 'none') return;
    if (config.logLevel === 'error' || config.logLevel === 'warn') return;
    
    // Extract category if category filtering is enabled for log()
    if (config.categoryFiltering.log) {
        const { category, logArgs } = extractCategory(args);
        
        // If category is specified, check if it's enabled
        if (category !== null) {
            if (!debugCategories[category]) {
                return; // Category is disabled, don't log
            }
            // Format message with colored category prefix
            const categoryUpper = category.toUpperCase();
            const categoryStyle = getCategoryColor(category);
            const levelStyle = getLevelColor('log');
            if (logArgs.length > 0) {
                console.log(`%c[${categoryUpper}]%c ${message}`, categoryStyle, levelStyle, ...logArgs);
            } else {
                console.log(`%c[${categoryUpper}]%c ${message}`, categoryStyle, levelStyle);
            }
            return;
        }
        // If no category specified but category filtering is enabled, and we have specific categories enabled,
        // don't show uncategorized logs when filtering is active
        const hasEnabledCategories = Object.values(debugCategories).some(enabled => enabled);
        if (hasEnabledCategories) {
            return; // Don't show uncategorized logs when category filtering is active
        }
    }
    
    // No category filtering or category not specified - log normally
    if (args.length > 0) {
        console.log(message, ...args);
    } else {
        console.log(message);
    }
}

/**
 * Log a warning message
 * @param {string} message - Warning message
 * @param {...*} args - Additional arguments to log. If first arg is a category string, it will be used for filtering.
 * @example
 * warn('Layout calculation failed', 'layout', error);
 * warn('Theme loading issue', 'theme');
 */
export function warn(message, ...args) {
    if (!config.enabled || config.logLevel === 'none' || config.logLevel === 'error') return;
    
    // Extract category if category filtering is enabled for warn()
    if (config.categoryFiltering.warn) {
        const { category, logArgs } = extractCategory(args);
        
        // If category is specified, check if it's enabled
        if (category !== null) {
            if (!debugCategories[category]) {
                return; // Category is disabled, don't log
            }
            // Format message with colored category prefix
            const categoryUpper = category.toUpperCase();
            const categoryStyle = getCategoryColor(category);
            const levelStyle = getLevelColor('warn');
            if (logArgs.length > 0) {
                console.warn(`%c[${categoryUpper}]%c ${message}`, categoryStyle, levelStyle, ...logArgs);
            } else {
                console.warn(`%c[${categoryUpper}]%c ${message}`, categoryStyle, levelStyle);
            }
            return;
        }
        // If no category specified but category filtering is enabled, and we have specific categories enabled,
        // don't show uncategorized logs when filtering is active
        const hasEnabledCategories = Object.values(debugCategories).some(enabled => enabled);
        if (hasEnabledCategories) {
            return; // Don't show uncategorized logs when category filtering is active
        }
    }
    
    // No category filtering or category not specified - log normally
    if (args.length > 0) {
        console.warn(message, ...args);
    } else {
        console.warn(message);
    }
}

/**
 * Log an error message
 * @param {string} message - Error message
 * @param {...*} args - Additional arguments to log. If first arg is a category string, it will be used for filtering (if categoryFiltering.error is true).
 * @example
 * error('API request failed', 'api', error);
 * error('Theme loading error', 'theme', error);
 */
export function error(message, ...args) {
    if (!config.enabled) return;
    // Unlike debug/log/warn, errors are not suppressed when logLevel is 'none' (production quiet mode).
    
    // Extract category if category filtering is enabled for error()
    if (config.categoryFiltering.error) {
        const { category, logArgs } = extractCategory(args);
        
        // If category is specified, check if it's enabled
        if (category !== null) {
            if (!debugCategories[category]) {
                return; // Category is disabled, don't log
            }
            // Format message with colored category prefix
            const categoryUpper = category.toUpperCase();
            const categoryStyle = getCategoryColor(category);
            const levelStyle = getLevelColor('error');
            if (logArgs.length > 0) {
                console.error(`%c[${categoryUpper}]%c ${message}`, categoryStyle, levelStyle, ...logArgs);
            } else {
                console.error(`%c[${categoryUpper}]%c ${message}`, categoryStyle, levelStyle);
            }
            return;
        }
        // If no category specified but category filtering is enabled, and we have specific categories enabled,
        // don't show uncategorized logs when filtering is active
        const hasEnabledCategories = Object.values(debugCategories).some(enabled => enabled);
        if (hasEnabledCategories) {
            return; // Don't show uncategorized logs when category filtering is active
        }
    }
    
    // No category filtering or category not specified - log normally
    if (args.length > 0) {
        console.error(message, ...args);
    } else {
        console.error(message);
    }
}

/**
 * Log a debug message (only if debug is enabled and category is enabled)
 * @param {string} message - Debug message
 * @param {...*} args - Additional arguments to log. If first arg is an object with 'category' property, it will be used as the category.
 * @example
 * debug('API call started', { category: 'api' }, requestData);
 * debug('Theme applied', 'theme', themeData);
 * debug('Layout calculated', 'layout');
 */
export function debug(message, ...args) {
    if (!config.enabled || !config.debugEnabled || config.logLevel === 'none') return;
    if (config.logLevel === 'error' || config.logLevel === 'warn' || config.logLevel === 'info') return;
    
    // Extract category from args if present
    const { category, logArgs } = extractCategory(args);
    
    // If category filtering is enabled for debug()
    if (config.categoryFiltering.debug) {
        // If category is specified, check if it's enabled
        if (category !== null) {
            if (!debugCategories[category]) {
                return; // Category is disabled, don't log
            }
            // Format message with colored level and category prefix
            const categoryUpper = category.toUpperCase();
            const debugStyle = getLevelColor('debug');
            const categoryStyle = getCategoryColor(category);
            if (logArgs.length > 0) {
                console.log(`%c[DEBUG]%c %c[${categoryUpper}]%c ${message}`, debugStyle, '', categoryStyle, '', ...logArgs);
            } else {
                console.log(`%c[DEBUG]%c %c[${categoryUpper}]%c ${message}`, debugStyle, '', categoryStyle, '');
            }
            return;
        }
        // If no category specified but category filtering is enabled, and we have specific categories enabled,
        // don't show uncategorized logs when filtering is active
        const hasEnabledCategories = Object.values(debugCategories).some(enabled => enabled);
        if (hasEnabledCategories) {
            return; // Don't show uncategorized logs when category filtering is active
        }
    }
    
    // No category filtering or category not specified - log normally with colored DEBUG
    const debugStyle = getLevelColor('debug');
    if (logArgs.length > 0) {
        console.log(`%c[DEBUG]%c ${message}`, debugStyle, '', ...logArgs);
    } else {
        console.log(`%c[DEBUG]%c ${message}`, debugStyle, '');
    }
}

/**
 * Log an info message (alias for log, for backward compatibility)
 * @param {string} message - Info message
 * @param {...*} args - Additional arguments to log
 */
export function info(message, ...args) {
    log(message, ...args);
}

/**
 * Start a console group
 * @param {string} label - Group label
 */
export function group(label) {
    if (config.enabled && config.logLevel !== 'none') {
        console.group(label);
    }
}

/**
 * End a console group
 */
export function groupEnd() {
    if (config.enabled && config.logLevel !== 'none') {
        console.groupEnd();
    }
}

/**
 * Check if logging is enabled
 * @returns {boolean} True if logging is enabled
 */
export function isLoggingEnabled() {
    return config.enabled && config.logLevel !== 'none';
}
