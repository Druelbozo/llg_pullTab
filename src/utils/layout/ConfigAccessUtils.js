/**
 * Layout Configuration Access Utilities
 * Provides reusable functions for accessing nested layout configuration values
 * Eliminates duplication across layout calculators
 */

import { getLayoutConfig } from '../config/ConfigUtils.js';
import { getLayoutConfig as getCachedLayoutConfig } from '../../services/layout/config/LayoutConfigLoader.js';

/**
 * Get both layout-specific and base UI configs in one call
 * @param {LayoutManager} responsiveUI - The LayoutManager instance
 * @param {string} layoutName - Layout name ('landscape', 'portrait', 'landscape-mobile', 'portrait-mobile')
 * @returns {{uiConfig: Object, baseUIConfig: Object}} Object containing both configs
 */
export function getLayoutConfigs(responsiveUI, layoutName) {
    const scene = responsiveUI.scene;
    const uiConfig = getLayoutConfig(scene, layoutName, {});
    const baseUIConfig = getCachedLayoutConfig('defaults') || getLayoutConfig(scene, 'landscape', {});
    return { uiConfig, baseUIConfig };
}

/**
 * Get global spacingPercent.v with backward compatibility
 * Supports both object {h, v} and number formats
 * 
 * @param {Object} uiConfig - Layout-specific config
 * @param {Object} baseUIConfig - Base config
 * @returns {number} Spacing percent value (default: 0.0)
 */
export function getGlobalSpacingPercent(uiConfig, baseUIConfig) {
    const spacingPercentConfig = uiConfig?.global?.spacingPercent || baseUIConfig?.global?.spacingPercent;
    if (spacingPercentConfig === undefined || spacingPercentConfig === null) {
        return 0.0;
    }
    if (typeof spacingPercentConfig === 'object') {
        return spacingPercentConfig.v ?? 0.0;
    }
    if (typeof spacingPercentConfig === 'number') {
        return spacingPercentConfig; // Backward compatibility
    }
    return 0.0;
}

/**
 * Get controlBar spacingPercent with backward compatibility
 * Supports both object {items, rows} and number formats
 * 
 * @param {Object} uiConfig - Layout-specific config
 * @param {Object} baseUIConfig - Base config
 * @returns {number|Object} Spacing percent (number or {items, rows} object, default: {items: 0.1, rows: 0.2})
 */
export function getControlBarSpacingPercent(uiConfig, baseUIConfig) {
    // Check uiConfig first (layout-specific), then fall back to baseUIConfig
    const spacingPercentConfig = uiConfig?.controlBar?.spacingPercent ?? baseUIConfig?.controlBar?.spacingPercent;
    if (spacingPercentConfig === undefined || spacingPercentConfig === null) {
        return { items: 0.1, rows: 0.2 }; // Default
    }
    if (typeof spacingPercentConfig === 'object') {
        // Return full object {items, rows} - extract to ensure clean object
        return {
            items: spacingPercentConfig.items ?? spacingPercentConfig.h ?? 0.1,
            rows: spacingPercentConfig.rows ?? spacingPercentConfig.v ?? 0.2
        };
    }
    if (typeof spacingPercentConfig === 'number') {
        return spacingPercentConfig; // Backward compatibility: number used for both
    }
    return { items: 0.1, rows: 0.2 }; // Default
}

/**
 * Get controlBar insetPercent.horizontal with default
 * 
 * @param {Object} uiConfig - Layout-specific config
 * @param {Object} baseUIConfig - Base config
 * @returns {number} Inset percent horizontal (default: 0.0)
 */
export function getInsetPercent(uiConfig, baseUIConfig) {
    // Check uiConfig first (layout-specific), then fall back to baseUIConfig
    const insetPercentConfig = uiConfig?.controlBar?.insetPercent ?? baseUIConfig?.controlBar?.insetPercent;
    if (insetPercentConfig === undefined || insetPercentConfig === null) {
        return 0.0; // Default: no inset
    }
    if (typeof insetPercentConfig === 'object') {
        return insetPercentConfig.horizontal ?? insetPercentConfig.h ?? 0.0;
    }
    return 0.0; // Default: no inset
}

/**
 * Get content height percent from config
 * Converts pixels to percent if pixels are provided (matches video-poker approach exactly)
 * @param {Object} layoutConfig - Layout config (uiConfig or baseUIConfig)
 * @param {number} [availableHeight=null] - Available height for pixel-to-percent conversion
 * @param {number} [screenHeight=null] - Screen height for pixel-to-percent conversion (fallback)
 * @returns {number} Content height percent
 */
export function getContentHeightPercent(layoutConfig, availableHeight = null, screenHeight = null) {
    // Check for controlBar.contentHeight format (matches video-poker exactly)
    if (layoutConfig && layoutConfig.controlBar && layoutConfig.controlBar.contentHeight) {
        const contentHeight = layoutConfig.controlBar.contentHeight;
        
        // If pixels is provided and > 0, convert pixels to percent using availableHeight (same reference as percent calculation)
        // This ensures pixels and percent are consistent - both are applied to availableHeight in calculateContainerDimensions
        // Treat pixels: 0 as "not set" (same as null) - fall back to percent
        if (contentHeight.pixels !== null && contentHeight.pixels !== undefined && contentHeight.pixels > 0) {
            if (availableHeight !== null && availableHeight > 0) {
                // Use availableHeight as reference (consistent with how percent is applied)
                return contentHeight.pixels / availableHeight;
            } else if (screenHeight !== null && screenHeight > 0) {
                // Fallback to screenHeight if availableHeight not provided
                return contentHeight.pixels / screenHeight;
            }
        }
        
        // Fall back to percent if pixels is not provided or height values are not available
        if (typeof contentHeight.percent === 'number') {
            return contentHeight.percent;
        }
    }
    
    // Default: 8% of available height (will be applied to availableHeight in calculateContainerDimensions)
    return 0.08;
}

/**
 * Get content height pixels from config (optional override)
 * @param {Object} uiConfig - Layout-specific config
 * @param {Object} baseUIConfig - Base config
 * @returns {number|null} Content height in pixels or null if not set
 */
export function getContentHeightPixels(uiConfig, baseUIConfig) {
    // Check uiConfig first (layout-specific override)
    if (uiConfig?.controlBar?.contentHeight?.pixels !== undefined && 
        uiConfig?.controlBar?.contentHeight?.pixels !== null) {
        return uiConfig.controlBar.contentHeight.pixels;
    }
    // Fall back to baseUIConfig
    if (baseUIConfig?.controlBar?.contentHeight?.pixels !== undefined && 
        baseUIConfig?.controlBar?.contentHeight?.pixels !== null) {
        return baseUIConfig.controlBar.contentHeight.pixels;
    }
    return null;
}

/**
 * Get card container configuration from config
 * @param {Object} uiConfig - Layout-specific config
 * @param {Object} baseUIConfig - Base config
 * @returns {Object} Card container config with defaults
 */
export function getCardContainerConfig(uiConfig, baseUIConfig) {
    const cardConfig = uiConfig?.cardContainer || baseUIConfig?.cardContainer || {};
    // Use areaPercent if provided, otherwise fall back to individual heightPercent/maxWidthPercent (backward compatibility)
    const areaPercent = cardConfig.areaPercent ?? cardConfig.heightPercent ?? 0.65;
    // offsetYPercent: percentage of screen height to offset cardContainer Y position (positive = down, negative = up)
    const offsetYPercent = cardConfig.offsetYPercent ?? 0.0;
    return {
        areaPercent,
        offsetYPercent,
        // Include derived values for backward compatibility with code that reads these directly
        heightPercent: areaPercent,
        maxWidthPercent: areaPercent
    };
}

/**
 * Get messageText insetPercent.horizontal (insets layout area from the screen left; used with centerInLeftBand).
 * Mirrors controlBar insetPercent shape: { horizontal } or { h }.
 *
 * @param {Object} uiConfig - Layout-specific config
 * @param {Object} baseUIConfig - Base config
 * @returns {number} Horizontal inset as fraction of screen width (default 0)
 */
export function getMessageTextInsetPercentHorizontal(uiConfig, baseUIConfig) {
    const insetPercentConfig =
        uiConfig?.messageText?.insetPercent ?? baseUIConfig?.messageText?.insetPercent;
    if (insetPercentConfig === undefined || insetPercentConfig === null) {
        return 0.0;
    }
    if (typeof insetPercentConfig === 'object') {
        return insetPercentConfig.horizontal ?? insetPercentConfig.h ?? 0.0;
    }
    if (typeof insetPercentConfig === 'number') {
        return insetPercentConfig;
    }
    return 0.0;
}

/**
 * Merge `messageText` from base layout and layout-specific (same idea as the rest of layout overrides).
 * @param {Object} [uiConfig]
 * @param {Object} [baseUIConfig]
 * @returns {Object}
 */
function mergeMessageTextConfig(uiConfig, baseUIConfig) {
    const base = baseUIConfig?.messageText && typeof baseUIConfig.messageText === 'object' ? baseUIConfig.messageText : {};
    const over = uiConfig?.messageText && typeof uiConfig.messageText === 'object' ? uiConfig.messageText : {};
    return { ...base, ...over };
}

/**
 * Get messageText configuration from config
 * @param {Object} uiConfig - Layout-specific config
 * @param {Object} baseUIConfig - Base config
 * @returns {Object} MessageText config with defaults
 */
export function getMessageTextConfig(uiConfig, baseUIConfig) {
    const messageTextConfig = mergeMessageTextConfig(uiConfig, baseUIConfig);
    return {
        heightPercent: messageTextConfig.heightPercent ?? 0.1,
        percentY: messageTextConfig.percentY ?? 0,
        centerVertically: messageTextConfig.centerVertically ?? false,
        centerInLeftBand: messageTextConfig.centerInLeftBand ?? false,
        insetPercentHorizontal: getMessageTextInsetPercentHorizontal(uiConfig, baseUIConfig),
        stroke: messageTextConfig.stroke ?? null // Optional stroke override from layout config
    };
}

/**
 * Font size for the score / message line — must match the calculation in `Level._positionMessageText`
 * (`heightPercent` from merged layout, 80% of reserved band height, min 12px).
 * @param {number} cardDisplayHeight
 * @param {Object} uiConfig
 * @param {Object} baseUIConfig
 * @returns {number}
 */
export function getMessageTextLayoutFontSize(cardDisplayHeight, uiConfig, baseUIConfig) {
    const messageTextConfig = getMessageTextConfig(uiConfig, baseUIConfig);
    const messageTextHeight = cardDisplayHeight * messageTextConfig.heightPercent;
    return Math.max(12, messageTextHeight * 0.8);
}

/**
 * Layout for the "Press to Scratch" line (copy is always that string; theme from control bar header, except landscape-mobile
 * 1-col where it follows `text.message` like the score message line; fontSize below unless 1-col uses message height).
 * `uiConfig` is the merged layout (defaults + layout file). Only `fontSize` and `useRightBandWhenAvailable` are read.
 */
export function getInstructionsTextConfig(uiConfig, baseUIConfig) {
    void baseUIConfig;
    const defaults = { fontSize: 32, useRightBandWhenAvailable: false };
    const merged = {
        ...defaults,
        ...(uiConfig?.instructionsText && typeof uiConfig.instructionsText === 'object' ? uiConfig.instructionsText : {})
    };
    const fontSize =
        typeof merged.fontSize === 'number' && Number.isFinite(merged.fontSize) && merged.fontSize > 0
            ? merged.fontSize
            : 32;
    return {
        fontSize,
        useRightBandWhenAvailable: Boolean(merged.useRightBandWhenAvailable)
    };
}

/**
 * Get controlBar header configuration from config
 * @param {Object} uiConfig - Layout-specific config
 * @param {Object} baseUIConfig - Base config
 * @returns {Object|null} Header config with defaults, or null if not provided
 */
export function getHeaderConfig(uiConfig, baseUIConfig) {
    const headerConfig = uiConfig?.controlBar?.header || baseUIConfig?.controlBar?.header;
    if (!headerConfig) {
        return null;
    }
    return {
        items: headerConfig.items ?? ["winText", "betText", "balanceText"],
        fontSize: headerConfig.fontSize ?? 21,
        verticalOffset: headerConfig.verticalOffset ?? 0.003,
        lines: headerConfig.lines ?? 1
    };
}

