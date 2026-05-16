/**
 * Configuration Utility Functions
 * Provides reusable functions for retrieving layout-specific configuration
 * Eliminates duplication of config retrieval patterns throughout the codebase
 */

import { getLayoutConfig as getCachedLayoutConfig } from '../../services/layout/config/LayoutConfigLoader.js';

/**
 * Get layout-specific UI configuration with automatic fallback chain
 * 
 * Retrieval priority:
 * 1. Layout-specific config (if layoutName provided)
 * 2. Base UI config (defaults.json)
 * 3. Default value (if provided)
 * 
 * @param {Phaser.Scene} scene - The scene instance
 * @param {string} [layoutName] - Optional layout name ('portrait-mobile', 'landscape-mobile', 'portrait', 'landscape')
 * @param {Object} [defaultValue={}] - Default value if config is unavailable
 * @returns {Object} UI configuration object (never null/undefined)
 * 
 * @example
 * // Get layout-specific config with fallback
 * const uiConfig = getLayoutConfig(scene, 'landscape-mobile');
 */
export function getLayoutConfig(scene, layoutName = null, defaultValue = {}) {
    // If layout name provided, try to get layout-specific config
    if (layoutName) {
        const layoutConfig = getCachedLayoutConfig(layoutName);
        if (layoutConfig && Object.keys(layoutConfig).length > 0) {
            return layoutConfig;
        }
    }
    
    // Fallback to base UI config (defaults.json)
    const baseConfig = getCachedLayoutConfig('defaults') || getCachedLayoutConfig('landscape'); // Use landscape as fallback
    if (baseConfig && Object.keys(baseConfig).length > 0) {
        return baseConfig;
    }
    
    // Final fallback to provided default
    return defaultValue || {};
}

/**
 * Get layout-specific config value with automatic fallback chain
 * 
 * Retrieval priority:
 * 1. Layout-specific config property
 * 2. Base UI config property
 * 3. Default value (if provided)
 * 
 * @param {Phaser.Scene} scene - The scene instance
 * @param {string} propertyName - Property name to retrieve (e.g., 'controlBar.contentHeight.percent')
 * @param {string} [layoutName] - Optional layout name for layout-specific config
 * @param {*} [defaultValue] - Default value if property not found
 * @returns {*} Property value or defaultValue
 * 
 * @example
 * // Get layout-specific property with fallback
 * const spacing = getLayoutConfigValue(scene, 'controlBar.spacingPercent.items', 'portrait-mobile', 0.1);
 */
export function getLayoutConfigValue(scene, propertyName, layoutName = null, defaultValue = undefined) {
    if (!propertyName) {
        return defaultValue;
    }
    
    // Try layout-specific config first (if layoutName provided)
    if (layoutName) {
        const layoutConfig = getCachedLayoutConfig(layoutName);
        if (layoutConfig) {
            // Support nested property access (e.g., 'controlBar.spacingPercent.items')
            const value = getNestedProperty(layoutConfig, propertyName);
            if (value !== undefined && value !== null) {
                return value;
            }
        }
    }
    
    // Fallback to base config
    const baseConfig = getCachedLayoutConfig('defaults') || getCachedLayoutConfig('landscape');
    if (baseConfig) {
        const value = getNestedProperty(baseConfig, propertyName);
        if (value !== undefined && value !== null) {
            return value;
        }
    }
    
    return defaultValue;
}

/**
 * Get nested property from object using dot notation
 * @param {Object} obj - Object to get property from
 * @param {string} path - Dot-notation path (e.g., 'controlBar.spacingPercent.items')
 * @returns {*} Property value or undefined
 * @private
 */
function getNestedProperty(obj, path) {
    if (!obj || !path) return undefined;
    
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
            current = current[part];
        } else {
            return undefined;
        }
    }
    
    return current;
}

