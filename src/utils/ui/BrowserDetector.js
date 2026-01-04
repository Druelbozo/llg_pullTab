/**
 * BrowserDetector - Utility for detecting browser and operating system
 * 
 * Provides methods to detect browser type and operating system from user agent strings.
 * Useful for debugging, analytics, and browser-specific feature detection.
 * 
 * @example
 * import BrowserDetector from './src/utils/ui/BrowserDetector.js';
 * 
 * const browser = BrowserDetector.getBrowser();
 * const os = BrowserDetector.getOS();
 * console.log(`Running on ${browser} on ${os}`);
 */
export default class BrowserDetector {
    /**
     * Internal helper to safely access navigator fields
     * @returns {Navigator|Object}
     */
    static _getNavigator() {
        return (typeof navigator !== 'undefined') ? navigator : {};
    }

    /**
     * Internal helper to check a series of traits that uniquely identify iPads/iPadOS
     * @param {string} userAgent
     * @returns {boolean}
     */
    static _hasIPadTraits(userAgent = '') {
        const nav = BrowserDetector._getNavigator();
        const ua = userAgent || nav.userAgent || '';
        const platform = nav.platform || '';
        const vendor = nav.vendor || '';
        const uaDataPlatform = (nav.userAgentData && nav.userAgentData.platform) ? nav.userAgentData.platform : '';
        const maxTouchPoints = typeof nav.maxTouchPoints === 'number' ? nav.maxTouchPoints : 0;
        const hasTouchSupport = maxTouchPoints > 1;
        const pointerCoarse = (typeof window !== 'undefined' && typeof window.matchMedia === 'function')
            ? window.matchMedia('(pointer:coarse)').matches
            : false;

        if (/iPad/.test(ua)) {
            return true;
        }

        if (uaDataPlatform && /iPad|iOS/.test(uaDataPlatform)) {
            return true;
        }

        if (/MacIntel/.test(platform) && hasTouchSupport) {
            return true;
        }

        if (/Macintosh/.test(ua) && hasTouchSupport) {
            return true;
        }

        if (vendor === 'Apple' && hasTouchSupport && pointerCoarse) {
            return true;
        }

        return false;
    }

    /**
     * Check if device is iPadOS (iPadOS 13+ reports as Macintosh in UA)
     * @param {string} [userAgent] - Optional user agent string (defaults to navigator.userAgent)
     * @returns {boolean} True if iPadOS device
     */
    static isiPadOS(userAgent = BrowserDetector._getNavigator().userAgent || '') {
        return BrowserDetector._hasIPadTraits(userAgent);
    }
    
    /**
     * Get the browser name from user agent string
     * @param {string} [userAgent] - Optional user agent string (defaults to navigator.userAgent)
     * @returns {string} Browser name (e.g., 'Chrome', 'Safari iOS', 'Firefox', etc.)
     */
    static getBrowser(userAgent = navigator.userAgent) {
        const ua = userAgent;
        
        // Check iOS browsers first (they often have specific identifiers)
        if (/CriOS/.test(ua)) {
            return 'Chrome iOS';
        }
        if (/FxiOS/.test(ua)) {
            return 'Firefox iOS';
        }
        if (/OPiOS/.test(ua)) {
            return 'Opera iOS';
        }
        if (/EdgiOS/.test(ua)) {
            return 'Edge iOS';
        }
        if (/DuckDuckGo/.test(ua)) {
            return 'DuckDuckGo';
        }
        
        // Check Safari iOS (must check before general Safari)
        if (/iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && /Version\/[\d.]+/.test(ua)) {
            return 'Safari iOS';
        }
        
        // Check for iPadOS Safari (iPadOS 13+ reports as Macintosh)
        if (BrowserDetector.isiPadOS(ua) && /Safari/.test(ua) && !/Chrome/.test(ua)) {
            return 'Safari iOS';
        }
        
        // Check Edge before Chrome (Edge uses Chromium UA)
        if (/Edg/.test(ua)) {
            return 'Edge';
        }
        
        // Check Samsung Internet (uses Chrome UA but has Samsung identifier)
        if (/SamsungBrowser/.test(ua)) {
            return 'Samsung Internet';
        }
        
        // Check UC Browser (uses Chrome UA but has UC identifier)
        if (/UCBrowser|UCWEB/.test(ua)) {
            return 'UC Browser';
        }
        
        // Check Yandex Browser (uses Chrome UA but has Yandex identifier)
        if (/YaBrowser/.test(ua)) {
            return 'Yandex Browser';
        }
        
        // Check Vivaldi (uses Chrome UA but has Vivaldi identifier)
        if (/Vivaldi/.test(ua)) {
            return 'Vivaldi';
        }
        
        // Check Tor Browser (uses Firefox UA but has Tor identifier)
        if (/TorBrowser/.test(ua)) {
            return 'Tor Browser';
        }
        
        // Check desktop browsers
        if (/Chrome/.test(ua) && !/Edg/.test(ua)) {
            // Check for Brave (uses Chrome UA, check after other Chrome-based browsers)
            // Brave doesn't always include "Brave" in UA, but we can check navigator.brave
            if (navigator.brave && navigator.brave.isBrave) {
                return 'Brave';
            }
            // Some Brave versions include "Brave" in UA
            if (/Brave/.test(ua)) {
                return 'Brave';
            }
            return 'Chrome';
        }
        if (/Firefox/.test(ua)) {
            return 'Firefox';
        }
        if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
            return 'Safari';
        }
        if (/Opera|OPR/.test(ua)) {
            return 'Opera';
        }
        
        return 'Unknown';
    }
    
    /**
     * Get the operating system name from user agent string
     * @param {string} [userAgent] - Optional user agent string (defaults to navigator.userAgent)
     * @returns {string} OS name (e.g., 'iOS (iPhone)', 'iPadOS', 'Android', 'Windows', etc.)
     */
    static getOS(userAgent = navigator.userAgent) {
        const ua = userAgent;
        
        if (/iPhone/.test(ua)) {
            return 'iOS (iPhone)';
        }
        // Check for iPadOS before checking for iPad (iPadOS 13+ reports as Macintosh)
        if (BrowserDetector.isiPadOS(ua)) {
            return 'iPadOS';
        }
        if (/iPad/.test(ua)) {
            return 'iOS (iPad)';
        }
        if (/iPod/.test(ua)) {
            return 'iOS (iPod)';
        }
        if (/Android/.test(ua)) {
            // Check for Android TV
            if (/Android.*TV|AFT[AB]|AFTM|AFTT/.test(ua)) {
                return 'Android TV';
            }
            // Check for Android Auto
            if (/AndroidAuto/.test(ua)) {
                return 'Android Auto';
            }
            return 'Android';
        }
        if (/Windows/.test(ua)) {
            return 'Windows';
        }
        if (/Mac OS X|Macintosh/.test(ua)) {
            return 'macOS';
        }
        if (/Linux/.test(ua)) {
            return 'Linux';
        }
        
        return 'Unknown';
    }
    
    /**
     * Get both browser and OS in a single object
     * @param {string} [userAgent] - Optional user agent string (defaults to navigator.userAgent)
     * @returns {{browser: string, os: string}} Object with browser and os properties
     */
    static getBrowserAndOS(userAgent = navigator.userAgent) {
        return {
            browser: BrowserDetector.getBrowser(userAgent),
            os: BrowserDetector.getOS(userAgent)
        };
    }
    
    /**
     * Check if running on iOS device (including iPadOS)
     * @param {string} [userAgent] - Optional user agent string (defaults to navigator.userAgent)
     * @returns {boolean} True if iOS device
     */
    static isIOS(userAgent = navigator.userAgent) {
        return /iPhone|iPad|iPod/.test(userAgent) || BrowserDetector.isiPadOS(userAgent);
    }
    
    /**
     * Check if running on Android device
     * @param {string} [userAgent] - Optional user agent string (defaults to navigator.userAgent)
     * @returns {boolean} True if Android device
     */
    static isAndroid(userAgent = navigator.userAgent) {
        return /Android/.test(userAgent);
    }
    
    /**
     * Check if running on mobile device (iOS or Android)
     * @param {string} [userAgent] - Optional user agent string (defaults to navigator.userAgent)
     * @returns {boolean} True if mobile device
     */
    static isMobile(userAgent = navigator.userAgent) {
        return BrowserDetector.isIOS(userAgent) || BrowserDetector.isAndroid(userAgent);
    }
    
    /**
     * Get the current device orientation
     * @returns {string} 'Portrait' or 'Landscape'
     */
    static getOrientation() {
        return window.innerWidth < window.innerHeight ? 'Portrait' : 'Landscape';
    }
    
    /**
     * Get browser, OS, and orientation in a single object
     * @param {string} [userAgent] - Optional user agent string (defaults to navigator.userAgent)
     * @returns {{browser: string, os: string, orientation: string}} Object with browser, os, and orientation properties
     */
    static getBrowserOSAndOrientation(userAgent = navigator.userAgent) {
        return {
            browser: BrowserDetector.getBrowser(userAgent),
            os: BrowserDetector.getOS(userAgent),
            orientation: BrowserDetector.getOrientation()
        };
    }
    
    /**
     * Check if device is a tablet
     * @param {number} [width] - Screen width in pixels (defaults to window.innerWidth)
     * @param {number} [height] - Screen height in pixels (defaults to window.innerHeight)
     * @param {string} [userAgent] - Optional user agent string (defaults to navigator.userAgent)
     * @returns {boolean} True if device is a tablet
     */
    static isTablet(width = window.innerWidth, height = window.innerHeight, userAgent = navigator.userAgent) {
        return BrowserDetector.getDeviceType(width, height, userAgent) === 'tablet';
    }
    
    /**
     * Check if device is a phone
     * @param {number} [width] - Screen width in pixels (defaults to window.innerWidth)
     * @param {number} [height] - Screen height in pixels (defaults to window.innerHeight)
     * @param {string} [userAgent] - Optional user agent string (defaults to navigator.userAgent)
     * @returns {boolean} True if device is a phone
     */
    static isPhone(width = window.innerWidth, height = window.innerHeight, userAgent = navigator.userAgent) {
        return BrowserDetector.getDeviceType(width, height, userAgent) === 'phone';
    }
    
    /**
     * Get device type (phone, tablet, or desktop) based on OS and user agent
     * Device type is determined by the actual device, not browser window size
     * @param {number} [width] - Screen width in pixels (defaults to window.innerWidth) - only used as fallback
     * @param {number} [height] - Screen height in pixels (defaults to window.innerHeight) - only used as fallback
     * @param {string} [userAgent] - Optional user agent string (defaults to navigator.userAgent)
     * @returns {string} Device type: 'phone', 'tablet', or 'desktop'
     */
    static getDeviceType(width = window.innerWidth, height = window.innerHeight, userAgent = navigator.userAgent) {
        const ua = userAgent;
        
        if (BrowserDetector.isiPadOS(ua)) {
            return 'tablet';
        }
        
        const os = BrowserDetector.getOS(ua);
        
        // Priority 1: Desktop OS detection
        // Windows and macOS are always desktop, regardless of window size
        if (os === 'Windows' || os === 'macOS') {
            return 'desktop';
        }
        
        // Priority 2: iOS device detection
        // Check for iPadOS first (iPadOS 13+ reports as Macintosh, would be misclassified as desktop)
        if (BrowserDetector.isiPadOS(ua)) {
            return 'tablet';
        }
        
        // iPhone and iPod are phones
        if (os === 'iOS (iPhone)' || os === 'iOS (iPod)') {
            return 'phone';
        }
        
        // iPad and iPadOS are tablets
        if (os === 'iOS (iPad)' || os === 'iPadOS') {
            return 'tablet';
        }
        
        // Also check UA patterns for iOS devices (fallback if OS detection missed something)
        if (/iPhone|iPod/.test(ua)) {
            return 'phone';
        }
        if (/iPad/.test(ua)) {
            return 'tablet';
        }
        
        // Priority 3: Android device detection
        if (os === 'Android') {
            // Android phones have "Mobile" in the UA string
            if (/Mobile/.test(ua)) {
                return 'phone';
            }
            
            // Android tablets: Android without "Mobile" or with tablet-specific indicators
            // Includes Kindle Fire tablet patterns (KF*)
            const isTabletUA = /Android(?!.*Mobile)|Tablet|PlayBook|Silk|KFAPWI|KFAPWA|KFJWA|KFJWI|KFTT|KFSOWI|KFTHWA|KFTHWI|KFASWI|KFASWA|KFTBWI|KFTBWA|KFOT|KFOTWA|KFOTWI/i.test(ua);
            if (isTabletUA) {
                return 'tablet';
            }
            
            // If Android but no clear indicator, default to phone (most common)
            return 'phone';
        }
        
        // Priority 4: Fallback to dimensions (only for unknown/ambiguous cases)
        // This should rarely happen in practice
        const maxDimension = Math.max(width, height);
        const minDimension = Math.min(width, height);
        
        // Use dimensions as last resort for unknown OS
        if (maxDimension < 768) {
            return 'phone';
        } else if (maxDimension < 1024 || (maxDimension >= 768 && maxDimension <= 1366 && minDimension >= 600)) {
            return 'tablet';
        } else {
            return 'desktop';
        }
    }
    
    /**
     * Get comprehensive device information object
     * @param {number} [width] - Screen width in pixels (defaults to window.innerWidth)
     * @param {number} [height] - Screen height in pixels (defaults to window.innerHeight)
     * @param {string} [userAgent] - Optional user agent string (defaults to navigator.userAgent)
     * @returns {{browser: string, os: string, deviceType: string, orientation: string, isMobile: boolean, isTablet: boolean, isPhone: boolean, isIOS: boolean, isAndroid: boolean}} Comprehensive device information
     */
    static getDeviceInfo(width = window.innerWidth, height = window.innerHeight, userAgent = navigator.userAgent) {
        const deviceType = BrowserDetector.getDeviceType(width, height, userAgent);
        const os = BrowserDetector.getOS(userAgent);
        
        return {
            browser: BrowserDetector.getBrowser(userAgent),
            os: os,
            deviceType: deviceType,
            orientation: BrowserDetector.getOrientation(),
            isMobile: BrowserDetector.isMobile(userAgent),
            isTablet: BrowserDetector.isTablet(width, height, userAgent),
            isPhone: BrowserDetector.isPhone(width, height, userAgent),
            isIOS: BrowserDetector.isIOS(userAgent),
            isAndroid: BrowserDetector.isAndroid(userAgent),
            width: width,
            height: height
        };
    }
}

