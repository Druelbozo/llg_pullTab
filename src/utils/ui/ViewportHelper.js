/**
 * ViewportHelper - Utility for getting accurate viewport dimensions
 * 
 * Handles browser UI overlays (like Safari iOS bottom bar) by using the visualViewport API
 * when available, which provides the actual visible viewport excluding browser UI elements.
 * 
 * @example
 * // Get effective viewport dimensions
 * const width = ViewportHelper.getWidth();
 * const height = ViewportHelper.getHeight();
 * 
 * // Get bottom safe area inset (for positioning bottom elements)
 * const bottomInset = ViewportHelper.getBottomSafeAreaInset();
 */
import BrowserDetector from './BrowserDetector.js';

export default class ViewportHelper {
    // Store last detection values for debugging
    static _lastDetectionValues = {
        browser: null, 
        os: null,
        orientation: null,
        isIOS: null,
        normalizedBrowser: null,
        normalizedOrientation: null,
        matchedCondition: null,
        // Debug info
        browserType: null,
        browserLength: null,
        orientationType: null,
        orientationLength: null,
        normalizedBrowserType: null,
        normalizedBrowserLength: null,
        normalizedOrientationType: null,
        normalizedOrientationLength: null,
        chromePortraitCheck: null,
        chromeLandscapeCheck: null,
        safariPortraitCheck: null,
        safariLandscapeCheck: null,
        chromePortraitDetails: null,
        chromeLandscapeDetails: null,
        safariPortraitDetails: null,
        safariLandscapeDetails: null
    };
    
    /**
     * Get the effective viewport width
     * Uses visualViewport when available, falls back to window.innerWidth
     * @returns {number} Viewport width in pixels
     */
    static getWidth() {
        if (window.visualViewport && window.visualViewport.width) {
            return window.visualViewport.width;
        }
        return window.innerWidth;
    }

    /**
     * Get the effective viewport height
     * Uses visualViewport when available, which excludes browser UI overlays.
     * The visualViewport API automatically accounts for toolbar show/hide state.
     * Falls back to window.innerHeight for browsers without visualViewport support.
     * @returns {number} Viewport height in pixels
     */
    static getHeight() {
        if (window.visualViewport && window.visualViewport.height) {
            const visualHeight = window.visualViewport.height;
            const innerHeight = window.innerHeight;
            
            // Trust visualViewport - it accounts for all browser UI overlays
            // In landscape mode when Safari hides bars, visualViewport.height will be close to innerHeight
            // In portrait mode when Safari shows bars, visualViewport.height will be smaller
            // The API handles this dynamically, so we just use what it reports
            return visualHeight;
        }
        
        return window.innerHeight;
    }

    /**
     * Get the bottom safe area inset
     * This accounts for browser UI elements that overlay the bottom of the viewport.
     * Uses a simple lookup table based on browser, OS, and orientation.
     * @returns {number} Bottom safe area inset in pixels (0 if no inset)
     */
    static getBottomSafeAreaInset() {
        const browser = BrowserDetector.getBrowser();
        const os = BrowserDetector.getOS();
        const orientation = BrowserDetector.getOrientation();
        
        // Check if iOS
        const isIOS = BrowserDetector.isIOS();
        
        // Normalize values for comparison (trim whitespace, handle case)
        const normalizedBrowser = String(browser || '').trim();
        const normalizedOrientation = String(orientation || '').trim();
        
        // Calculate condition checks
        const chromePortraitCheck = normalizedBrowser === 'Chrome iOS' && isIOS && normalizedOrientation === 'Portrait';
        const chromeLandscapeCheck = normalizedBrowser === 'Chrome iOS' && isIOS && normalizedOrientation === 'Landscape';
        const safariPortraitCheck = normalizedBrowser === 'Safari iOS' && isIOS && normalizedOrientation === 'Portrait';
        const safariLandscapeCheck = normalizedBrowser === 'Safari iOS' && isIOS && normalizedOrientation === 'Landscape';
        
        // Store values for debugging
        ViewportHelper._lastDetectionValues = {
            browser,
            os,
            orientation,
            isIOS,
            normalizedBrowser,
            normalizedOrientation,
            matchedCondition: null,
            // Debug info
            browserType: typeof browser,
            browserLength: browser ? browser.length : 0,
            orientationType: typeof orientation,
            orientationLength: orientation ? orientation.length : 0,
            normalizedBrowserType: typeof normalizedBrowser,
            normalizedBrowserLength: normalizedBrowser.length,
            normalizedOrientationType: typeof normalizedOrientation,
            normalizedOrientationLength: normalizedOrientation.length,
            chromePortraitCheck,
            chromeLandscapeCheck,
            safariPortraitCheck,
            safariLandscapeCheck,
            chromePortraitDetails: {
                browserMatch: normalizedBrowser === 'Chrome iOS',
                isIOS: isIOS,
                orientationMatch: normalizedOrientation === 'Portrait'
            },
            chromeLandscapeDetails: {
                browserMatch: normalizedBrowser === 'Chrome iOS',
                isIOS: isIOS,
                orientationMatch: normalizedOrientation === 'Landscape'
            },
            safariPortraitDetails: {
                browserMatch: normalizedBrowser === 'Safari iOS',
                isIOS: isIOS,
                orientationMatch: normalizedOrientation === 'Portrait'
            },
            safariLandscapeDetails: {
                browserMatch: normalizedBrowser === 'Safari iOS',
                isIOS: isIOS,
                orientationMatch: normalizedOrientation === 'Landscape'
            }
        };
        
        // iOS Chrome Portrait: 112
        if (chromePortraitCheck) {
            ViewportHelper._lastDetectionValues.matchedCondition = 'Chrome iOS Portrait';
            return 112;
        }
        
        // iOS Chrome Landscape: 40
        if (chromeLandscapeCheck) {
            ViewportHelper._lastDetectionValues.matchedCondition = 'Chrome iOS Landscape';
            return 40;
        }
        
        // iOS Safari Portrait: 89
        if (safariPortraitCheck) {
            ViewportHelper._lastDetectionValues.matchedCondition = 'Safari iOS Portrait';
            return 89;
        }
        
        // iOS Safari Landscape: 89
        if (safariLandscapeCheck) {
            ViewportHelper._lastDetectionValues.matchedCondition = 'Safari iOS Landscape';
            return 89;
        }
        
        // All other combinations: 0
        ViewportHelper._lastDetectionValues.matchedCondition = 'NO MATCH';
        return 0;
    }
    
    /**
     * Get the last detection values used in getBottomSafeAreaInset()
     * Useful for debugging why inset might be 0
     * @returns {Object} Object with browser, os, orientation, isIOS, normalizedBrowser, normalizedOrientation, matchedCondition
     */
    static getLastDetectionValues() {
        return { ...ViewportHelper._lastDetectionValues };
    }

    /**
     * Check if visualViewport API is available
     * @returns {boolean} True if visualViewport is supported
     */
    static isVisualViewportSupported() {
        return !!(window.visualViewport && window.visualViewport.height);
    }
}

