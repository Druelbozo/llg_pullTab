/**
 * Layout Manager
 * Manages responsive layouts, device detection, and layout selection
 */
import { getScreenWidth, getScreenHeight, getOrientation } from '../../utils/viewport/ViewportUtils.js';
import { log, warn, error, debug } from '../../utils/logger/LoggerUtils.js';
import DeviceDetector from '../../utils/device/DeviceDetector.js';
import { getLayoutRegistry } from './core/LayoutRegistry.js';
import { selectLayout } from './core/LayoutSelector.js';
import { loadLayoutConfigs } from './config/LayoutConfigLoader.js';

/** @typedef {import('./core/LayoutTypes.js').LayoutPositions} LayoutPositions */

class LayoutManager {
    // Configuration: Debug overlay default visibility
    static DEBUG_OVERLAY_VISIBLE_BY_DEFAULT = false;
    
    // Configuration: Debug overlay default panel
    static DEBUG_OVERLAY_DEFAULT_PANEL = '4';
    
    constructor(scene, config = {}) {
        this.scene = scene;
        this.initialized = false;
        
        // Extract enabledLayouts from config, defaulting to all layouts
        const defaultEnabledLayouts = ['portrait-mobile', 'landscape-mobile', 'portrait', 'landscape'];
        this.enabledLayouts = config.enabledLayouts || defaultEnabledLayouts;
        
        // Layout calculation tracking and caching
        this._layoutCache = null;
        this._cacheKey = null;
        this._lastCalculatedLayout = null;
        this._calculating = false;
        this._cachedEnabledLayouts = null;
        this._cachedEnabledLayoutsKey = null;
        
        // Extract device-type-specific enabled layouts from config
        this.phoneEnabledLayouts = config.phoneEnabledLayouts || null;
        this.tabletEnabledLayouts = config.tabletEnabledLayouts || null;
        this.desktopEnabledLayouts = config.desktopEnabledLayouts || null;
        
        // Validate layout names for all enabled layout arrays
        this._validateLayoutNames(this.enabledLayouts);
        if (this.phoneEnabledLayouts) {
            this._validateLayoutNames(this.phoneEnabledLayouts);
        }
        if (this.tabletEnabledLayouts) {
            this._validateLayoutNames(this.tabletEnabledLayouts);
        }
        if (this.desktopEnabledLayouts) {
            this._validateLayoutNames(this.desktopEnabledLayouts);
        }
        
        // Store layout configs promise for async initialization
        this.layoutConfigsPromise = loadLayoutConfigs();
        
        // Initialize after the scene is ready
        this.initialize();
    }
    
    /**
     * Validate that all layout names exist in the registry
     * @param {Array<string>} enabledLayouts - Array of layout names to validate
     * @throws {Error} If any layout name is invalid
     * @private
     */
    _validateLayoutNames(enabledLayouts) {
        const registry = getLayoutRegistry();
        const validLayoutNames = registry.map(layout => layout.name);
        
        for (const layoutName of enabledLayouts) {
            if (!validLayoutNames.includes(layoutName)) {
                const validNamesList = validLayoutNames.join(', ');
                throw new Error(
                    `Invalid layout name: "${layoutName}". ` +
                    `Valid layout names are: ${validNamesList}`
                );
            }
        }
    }
    
    /**
     * Get enabled layouts based on device type
     * Uses device-type-specific layouts if available, otherwise falls back to enabledLayouts
     * @returns {Array<string>} Array of enabled layout names
     * @private
     */
    _getEnabledLayoutsForDevice() {
        // Create cache key based on device type and enabled layouts config
        const cacheKey = `${this.deviceType}_${this.isDesktop}_${this.isMobile}`;
        
        // Return cached result if available
        if (this._cachedEnabledLayouts && this._cachedEnabledLayoutsKey === cacheKey) {
            return this._cachedEnabledLayouts;
        }
        
        // Detect device type using DeviceDetector (uses visualViewport when available)
        const viewportWidth = getScreenWidth(this.scene);
        const viewportHeight = getScreenHeight(this.scene);
        const deviceType = DeviceDetector.getDeviceType(viewportWidth, viewportHeight);
        
        let enabledLayouts;
        
        // Use device-type-specific layouts if available, otherwise fall back to enabledLayouts
        if (deviceType === 'phone' && this.phoneEnabledLayouts && this.phoneEnabledLayouts.length > 0) {
            enabledLayouts = [...this.phoneEnabledLayouts];
        } else if (deviceType === 'tablet' && this.tabletEnabledLayouts && this.tabletEnabledLayouts.length > 0) {
            enabledLayouts = [...this.tabletEnabledLayouts];
        } else if (deviceType === 'desktop' && this.desktopEnabledLayouts && this.desktopEnabledLayouts.length > 0) {
            enabledLayouts = [...this.desktopEnabledLayouts];
        } else {
            // Fallback to enabledLayouts (backward compatibility)
            enabledLayouts = [...this.enabledLayouts];
        }
        
        // Desktop should never use portrait layout (only portrait-mobile for mobile devices)
        if (this.isDesktop && enabledLayouts.includes('portrait')) {
            // Only log once when the change is first detected
            if (!this._cachedEnabledLayouts || !this._cachedEnabledLayouts.includes('portrait')) {
                debug(`[LAYOUT] Desktop device detected, removing 'portrait' from enabled layouts`, 'layout');
            }
            enabledLayouts = enabledLayouts.filter(l => l !== 'portrait');
        }
        
        // Cache the result
        this._cachedEnabledLayouts = enabledLayouts;
        this._cachedEnabledLayoutsKey = cacheKey;
        
        return enabledLayouts;
    }
    
    /**
     * Filter registry to only include enabled layouts
     * Uses device-type-specific layouts when available
     * @param {Array} registry - Full layout registry
     * @returns {Array} Filtered registry containing only enabled layouts
     * @private
     */
    _filterEnabledLayouts(registry) {
        const enabledLayouts = this._getEnabledLayoutsForDevice();
        const filtered = registry.filter(layout => enabledLayouts.includes(layout.name));
        return filtered;
    }
    
    /**
     * Initialize the responsive system
     */
    initialize() {
        // Wait for the game to be ready
        if (!this.scene.sys || !this.scene.sys.game || !this.scene.sys.game.scale) {
            setTimeout(() => {
                this.initialize();
            }, 100);
            return;
        }
        
        this.screenWidth = getScreenWidth(this.scene);
        this.screenHeight = getScreenHeight(this.scene);
        this.orientation = getOrientation(this.scene);
        
        // Device type detection using DeviceDetector (uses visualViewport when available)
        const deviceType = DeviceDetector.getDeviceType(this.screenWidth, this.screenHeight);
        
        // Use DeviceDetector for mobile/desktop flags (phone/tablet = mobile, desktop = desktop)
        this.isMobile = DeviceDetector.isMobileDevice(this.screenWidth, this.screenHeight);
        this.isDesktop = DeviceDetector.isDesktopDevice(this.screenWidth, this.screenHeight);
        
        // Store device type (phone, tablet, desktop) for layout filtering
        this.deviceType = deviceType;
        
        // Get enabled layouts for this device type
        const enabledLayouts = this._getEnabledLayoutsForDevice();
        
        this.initialized = true;
        
        log(`📱 LayoutManager initialized: ${this.screenWidth}x${this.screenHeight} (${this.orientation}, ${this.isMobile ? 'mobile' : 'desktop'}, device: ${deviceType})`);
        log(`📱 Enabled layouts for ${deviceType}: ${enabledLayouts.join(', ')}`);
        
        // Calculate initial layout and cache it before other services need it
        // This is async to wait for layout configs to load
        this.calculateInitialLayout().catch(error => {
            warn(`[LAYOUT] Error calculating initial layout: ${error.message}`, 'layout');
        });
    }
    
    /**
     * Calculate initial layout during initialization
     * This ensures the layout is calculated and cached before other services call getLayoutPositions()
     * Waits for layout configs to be loaded before calculating
     */
    async calculateInitialLayout() {
        if (!this.initialized) {
            debug(`[LAYOUT] LayoutManager not yet initialized, skipping initial layout calculation`, 'layout');
            return;
        }
        
        // Wait for layout configs to be loaded
        try {
            await this.layoutConfigsPromise;
        } catch (error) {
            warn(`[LAYOUT] Failed to load layout configs: ${error.message}`, 'layout');
        }
        
        debug(`[LAYOUT] Calculating initial layout during initialization...`, 'layout');
        const positions = this.getLayoutPositions(); // This will cache the result
        const layoutName = this.getCurrentLayoutName();
        debug(`[LAYOUT] Initial layout calculated: ${layoutName}`, 'layout');
    }
    
    /**
     * Get device type as string
     * Returns 'mobile' for phone/tablet, 'desktop' for desktop (compatibility with old API)
     * For device-specific type (phone/tablet/desktop), use this.deviceType
     */
    getDeviceType() {
        return this.isMobile ? 'mobile' : 'desktop';
    }
    
    /**
     * Get orientation
     * Delegates to ViewportUtils.getOrientation() to avoid duplication
     */
    getOrientation() {
        return getOrientation(this.scene);
    }
    
    /**
     * Check if we need portrait mobile layout
     * If device is phone and orientation is portrait: always use portrait-mobile
     * Otherwise: requires portrait orientation, height < 768px, and aspect ratio < 0.7
     * Only returns true if portrait-mobile is enabled in the appropriate enabled layouts array
     */
    needsPortraitMobileLayout() {
        // Get the enabled layouts for the current device type
        const enabledLayouts = this._getEnabledLayoutsForDevice();
        
        // If portrait-mobile is not enabled, always return false
        if (!enabledLayouts.includes('portrait-mobile')) {
            return false;
        }
        
        // If device is phone and orientation is portrait, always use portrait-mobile
        const deviceType = DeviceDetector.getDeviceType(this.screenWidth, this.screenHeight);
        if (deviceType === 'phone' && this.getOrientation() === 'portrait') {
            return true;
        }
        
        // Otherwise, use existing width/height logic (backward compatibility)
        const aspectRatio = this.screenWidth / this.screenHeight;
        return this.getOrientation() === 'portrait' 
            && this.screenHeight < 768 
            && aspectRatio < 0.7;
    }
    
    /**
     * Check if we need portrait layout
     * Only returns true if portrait orientation AND portrait-mobile is not applicable
     */
    needsPortraitLayout() {
        // Get the enabled layouts for the current device type
        const enabledLayouts = this._getEnabledLayoutsForDevice();
        
        // If portrait is not enabled, always return false
        if (!enabledLayouts.includes('portrait')) {
            return false;
        }
        
        // Don't use portrait layout if portrait-mobile applies
        if (this.needsPortraitMobileLayout()) {
            return false;
        }
        
        return this.getOrientation() === 'portrait';
    }
    
    /**
     * Check if we need landscape layout (non-mobile)
     * Only returns true if landscape orientation AND landscape-mobile is not applicable
     */
    needsLandscapeLayout() {
        // Get the enabled layouts for the current device type
        const enabledLayouts = this._getEnabledLayoutsForDevice();
        
        // If landscape is not enabled, always return false
        if (!enabledLayouts.includes('landscape')) {
            return false;
        }
        
        // Don't use landscape layout if landscape-mobile applies
        if (this.needsLandscapeMobileLayout()) {
            return false;
        }
        
        const orientationIsLandscape = this.getOrientation() === 'landscape';
        
        if (orientationIsLandscape) {
            return true;
        }
        
        // Force landscape layout if it is the only enabled layout for this device type
        if (enabledLayouts.length === 1 && enabledLayouts[0] === 'landscape') {
            return true;
        }
        
        return false;
    }
    
    /**
     * Check if we need landscape mobile layout
     * If device is phone and orientation is landscape: always use landscape-mobile
     * Otherwise: requires landscape orientation, width < 768px, and aspect ratio > 1.4
     * Only returns true if landscape-mobile is enabled in the appropriate enabled layouts array
     */
    needsLandscapeMobileLayout() {
        // Get the enabled layouts for the current device type
        const enabledLayouts = this._getEnabledLayoutsForDevice();
        
        // If landscape-mobile is not enabled, always return false
        if (!enabledLayouts.includes('landscape-mobile')) {
            return false;
        }
        
        // If device is phone and orientation is landscape, always use landscape-mobile
        const deviceType = DeviceDetector.getDeviceType(this.screenWidth, this.screenHeight);
        if (deviceType === 'phone' && this.getOrientation() === 'landscape') {
            return true;
        }
        
        // Otherwise, use existing width/height logic (backward compatibility)
        const aspectRatio = this.screenWidth / this.screenHeight;
        return this.getOrientation() === 'landscape' 
            && this.screenWidth < 768 
            && aspectRatio > 1.4;
    }
    
    /**
     * Handle window resize
     */
    handleResize() {
        const newWidth = getScreenWidth(this.scene);
        const newHeight = getScreenHeight(this.scene);
        
        if (newWidth !== this.screenWidth || newHeight !== this.screenHeight) {
            this.screenWidth = newWidth;
            this.screenHeight = newHeight;
            this.orientation = getOrientation(this.scene);
            
            // Re-detect device type using DeviceDetector
            const deviceType = DeviceDetector.getDeviceType(this.screenWidth, this.screenHeight);
            const wasDesktop = this.isDesktop;
            const oldDeviceType = this.deviceType;
            this.isMobile = DeviceDetector.isMobileDevice(this.screenWidth, this.screenHeight);
            this.isDesktop = DeviceDetector.isDesktopDevice(this.screenWidth, this.screenHeight);
            this.deviceType = deviceType;
            
            // Clear enabled layouts cache if device type changed
            if (wasDesktop !== this.isDesktop || oldDeviceType !== deviceType) {
                this._cachedEnabledLayouts = null;
                this._cachedEnabledLayoutsKey = null;
            }
            
            // Clear layout cache to force recalculation
            this.clearLayoutCache();
            
            // Notify scene of resize
            if (this.scene.onResponsiveResize) {
                this.scene.onResponsiveResize();
            }
        }
    }
    
    /**
     * Refresh stored screen dims from ViewportUtils (synced vv + game.scale) before layout calculators run.
     * Without this, this.screenWidth/Height stay frozen after initialize(); embedded/live viewports drift and
     * layout math disagrees Phaser/card scaling until a resize/orientation event.
     * @private
     */
    _syncStoredDimensionsIfNeeded() {
        const nw = getScreenWidth(this.scene);
        const nh = getScreenHeight(this.scene);
        if (nw === this.screenWidth && nh === this.screenHeight) {
            return;
        }
        const oldDeviceType = this.deviceType;
        const wasDesktop = this.isDesktop;
        this.screenWidth = nw;
        this.screenHeight = nh;
        this.orientation = getOrientation(this.scene);
        const deviceType = DeviceDetector.getDeviceType(this.screenWidth, this.screenHeight);
        this.isMobile = DeviceDetector.isMobileDevice(this.screenWidth, this.screenHeight);
        this.isDesktop = DeviceDetector.isDesktopDevice(this.screenWidth, this.screenHeight);
        this.deviceType = deviceType;
        if (wasDesktop !== this.isDesktop || oldDeviceType !== deviceType) {
            this._cachedEnabledLayouts = null;
            this._cachedEnabledLayoutsKey = null;
        }
        this.clearLayoutCache();
    }

    /**
     * Get layout positions based on device type
     * Uses the layout registry and selector to find the appropriate layout
     * This method delegates to the layout selector, which checks layouts by priority
     * until it finds one that matches the current device conditions
     * Only layouts specified in enabledLayouts will be considered
     * 
     * @returns {LayoutPositions} Layout positions object
     */
    getLayoutPositions() {
        this._syncStoredDimensionsIfNeeded();

        // Create cache key based on screen dimensions and orientation
        const cacheKey = `${this.screenWidth}x${this.screenHeight}_${this.getOrientation()}_${this.isMobile ? 'mobile' : 'desktop'}`;
        
        // Return cached positions if available and valid
        if (this._layoutCache && this._cacheKey === cacheKey) {
            return this._layoutCache;
        }
        
        // If calculation is in progress for the same cache key, return cached result (even if key doesn't match yet)
        // This prevents race conditions during initialization when multiple services call getLayoutPositions()
        if (this._calculating && this._layoutCache) {
            return this._layoutCache;
        }
        
        // Calculate new layout positions
        this._calculating = true;
        
        try {
            const fullRegistry = getLayoutRegistry();
            const filteredRegistry = this._filterEnabledLayouts(fullRegistry);
            const positions = selectLayout(this, filteredRegistry);
            
            // Track which layout was calculated
            const currentLayoutName = this.getCurrentLayoutName();
            
            // Log when layout changes
            if (this._lastCalculatedLayout !== currentLayoutName) {
                if (this._lastCalculatedLayout !== null) {
                    debug(`[LAYOUT] Layout changed: ${this._lastCalculatedLayout} → ${currentLayoutName}`, 'layout');
                }
                this._lastCalculatedLayout = currentLayoutName;
            }
            
            // Cache the results
            this._layoutCache = positions;
            this._cacheKey = cacheKey;
            
            return positions;
        } finally {
            this._calculating = false;
        }
    }
    
    /**
     * Clear layout cache (useful for testing or when screen size changes)
     */
    clearLayoutCache() {
        this._layoutCache = null;
        this._cacheKey = null;
    }
    
    /**
     * Get the name of the currently active layout
     * Uses the same selection logic as getLayoutPositions() but returns the layout name
     * 
     * @returns {string} Name of the currently active layout
     */
    getCurrentLayoutName() {
        this._syncStoredDimensionsIfNeeded();

        const fullRegistry = getLayoutRegistry();
        const filteredRegistry = this._filterEnabledLayouts(fullRegistry);
        
        // Find first matching layout by priority (same logic as selectLayout)
        for (const layout of filteredRegistry) {
            try {
                if (layout.condition(this)) {
                    return layout.name;
                }
            } catch (error) {
                // Continue to next layout
            }
        }
        
        // Fallback: return last layout name (should be portrait/default)
        const fallbackLayout = filteredRegistry[filteredRegistry.length - 1];
        if (fallbackLayout) {
            return fallbackLayout.name;
        }
        
        // Last resort: return unknown
        return 'unknown';
    }
    
    /**
     * Stub method for backward compatibility
     * Card container sizing is now handled by layout calculators
     */
    updateResponsiveSizing() {
        // Card container sizing is handled by layout calculators
        // This method is kept for backward compatibility
    }
    
    /**
     * Stub method for backward compatibility
     */
    setupUpdateLoop() {
        // Update loop is handled by resize events
    }
    
    /**
     * Stub method for backward compatibility
     */
    setupListeners() {
        // Listeners are set up in initialize()
    }
    
    /**
     * Stub method for backward compatibility
     * Card container aspect ratio is handled by the card container itself
     */
    calculateCardContainerAspectRatio() {
        // Aspect ratio calculation is handled elsewhere
    }
}

export default LayoutManager;

