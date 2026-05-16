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
 * const bottomInset = ViewportHelper.getBottomSafeAreaInset(scene);
 */
import DeviceDetector from '../device/DeviceDetector.js';

export default class ViewportHelper {

    /**
     * Size Phaser ScaleManager to match (same convention as Bingo/Keno main.js getViewportSize).
     * Trusts visualViewport when it looks valid (≥100×100 CSS px); falls back to window inner size.
     * Floors coordinates to avoid fractional canvas scaling issues across browsers.
     *
     * @returns {{width: number, height: number}}
     */
    static getPhaserCanvasDimensions() {
        if (typeof window === 'undefined') {
            return { width: 1280, height: 720 };
        }
        const vv = window.visualViewport;
        if (vv && vv.width >= 100 && vv.height >= 100) {
            return { width: Math.floor(vv.width), height: Math.floor(vv.height) };
        }
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (w < 100 || h < 100) {
            return { width: 1280, height: 720 };
        }
        return { width: Math.floor(w), height: Math.floor(h) };
    }
    
    /**
     * Get the effective viewport width
     * Same values used for layout and Phaser canvas size (aligned with Bingo/Keno).
     * @returns {number} Viewport width in pixels
     */
    static getWidth() {
        return this.getPhaserCanvasDimensions().width;
    }

    /**
     * Get the effective viewport height
     * Uses visual viewport when trustworthy so layouts sit above Safari's bottom toolbar.
     * @returns {number} Viewport height in pixels
     */
    static getHeight() {
        return this.getPhaserCanvasDimensions().height;
    }

    /**
     * Get the bottom safe area inset
     * This accounts for browser UI elements that overlay the bottom of the viewport.
     * Uses a simple lookup table based on browser, OS, and orientation.
     * @param {Phaser.Scene} [scene] - Optional Phaser scene for accurate orientation detection
     * @returns {number} Bottom safe area inset in pixels (0 if no inset)
     */
    static getBottomSafeAreaInset(scene = null) {
        const browser = DeviceDetector.getBrowser();
        const os = DeviceDetector.getOS();
        
        // Get orientation - use ViewportUtils if scene provided, otherwise use window dimensions
        let orientation = 'Portrait';
        if (scene) {
            // Use scene dimensions to determine orientation (avoids circular dependency with ViewportUtils)
            try {
                // Use dynamic import to avoid circular dependency issues
                // For now, use scene dimensions directly
                const sceneWidth = scene.sys?.game?.scale?.width || ViewportHelper.getWidth();
                const sceneHeight = scene.sys?.game?.scale?.height || ViewportHelper.getHeight();
                const orientationLower = sceneHeight > sceneWidth ? 'portrait' : 'landscape';
                orientation = orientationLower === 'portrait' ? 'Portrait' : 'Landscape';
            } catch (e) {
                // Fallback to window dimensions
                orientation = ViewportHelper.getHeight() > ViewportHelper.getWidth() ? 'Portrait' : 'Landscape';
            }
        } else {
            orientation = DeviceDetector.getOrientation();
        }
        
        // Check if iOS
        const isIOS = DeviceDetector.isIOS();
        
        // iOS Chrome Portrait: 112
        if (browser === 'Chrome iOS' && isIOS && orientation === 'Portrait') {
            return 112;
        }
        
        // iOS Chrome Landscape: 40
        if (browser === 'Chrome iOS' && isIOS && orientation === 'Landscape') {
            return 40;
        }
        
        // iOS Safari Portrait: 89
        if (browser === 'Safari iOS' && isIOS && orientation === 'Portrait') {
            return 89;
        }
        
        // iOS Safari Landscape: 89
        if (browser === 'Safari iOS' && isIOS && orientation === 'Landscape') {
            return 89;
        }
        
        // All other combinations: 0
        return 0;
    }

    /**
     * Check if visualViewport API is available
     * @returns {boolean} True if visualViewport is supported
     */
    static isVisualViewportSupported() {
        return !!(window.visualViewport && window.visualViewport.height);
    }
}

