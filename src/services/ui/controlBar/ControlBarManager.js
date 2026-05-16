/**
 * ControlBarManager - Manages control bar UI elements
 * Handles creation, layout, positioning, scaling, and theme application for control bar elements
 */

import ButtonFactory from '../../../utils/ui/factory/ButtonFactory.js';
import TextAreaFactory from '../../../utils/ui/factory/TextAreaFactory.js';
import { log, warn, error, debug } from '../../../utils/logger/LoggerUtils.js';
import { drawControlBarElementBounds } from '../../../utils/layout/LayoutDebugUtils.js';
import { getLayoutConfigs, getContentHeightPercent, getHeaderConfig } from '../../../utils/layout/ConfigAccessUtils.js';
import { getScreenWidth, getScreenHeight } from '../../../utils/viewport/ViewportUtils.js';
import { getLayoutConfigValue, getLayoutConfig } from '../../../utils/config/ConfigUtils.js';
import { GameConfig } from '../../../config/Global.js';
import { calculateControlHeight } from '../../../utils/layout/ControlBarLayoutUtils.js';
import {
    formatBuyInMinorForDisplayWithSymbol,
    formatBalanceMinorForDisplayWithSymbol,
    formatMinorForDisplayWithSymbol,
} from '../../../utils/formatting/FormattingUtils.js';
import { animateNumber } from '../../../utils/animation/AnimationUtils.js';
import gameConfig from '../../../config/game/game-config.js';
import FontUtils from '../../../utils/fonts/FontUtils.js';
import { applyInstructionsTextTheme } from '../../../utils/ui/theme/ThemeApplicationUtils.js';

// Default text scale for play button (used for both initial creation and text updates)
const DEFAULT_PLAY_BUTTON_TEXT_SCALE = 0.55;

export default class ControlBarManager {
    constructor(scene, buttonManager) {
        this.scene = scene;
        this.buttonManager = buttonManager;
        
        // Control bar element references
        this.soundButton = null;
        this.infoButton = null;
        this.playButton = null;
        this.autoButton = null;
        this.speedButton = null;
        this.balanceTextArea = null;
        
        // Button IDs for ButtonManager
        this.soundButtonId = null;
        this.infoButtonId = null;
        this.playButtonId = null;
        this.autoButtonId = null;
        this.speedButtonId = null;
        
        // Speed button text reference (for updating speed display)
        this.speedButtonText = null;
        
        // Track last play button text and dimensions to avoid unnecessary recalculations
        this._lastPlayButtonText = null;
        this._lastPlayButtonDimensions = null; // {width, height, scaleX, scaleY}
        
        // Header text fields
        this.headerTextFields = [];
        this.headerWinText = null;
        this.headerBetText = null;
        this.headerBalanceText = null;
        
        // Store corner radius for button creation
        this.cornerRadius = GameConfig.ui.DEFAULT_CORNER_RADIUS || 0.125;
        
        // Track previous layout name to detect layout changes
        this._previousLayoutName = null;
        
        // Debounce resize handler to prevent excessive layout recalculations
        this._resizeDebounceTimer = null;
        this._resizeDebounceDelay = 200; // ms - wait for resize to settle (increased to prevent spam)
        this._lastScreenWidth = 0;
        this._lastScreenHeight = 0;
        
        // Re-entrancy protection to prevent concurrent execution
        this._isRefreshing = false;
        
        // Throttle: minimum time between refreshes (even if dimensions change)
        this._lastRefreshTime = 0;
        this._minRefreshInterval = 500; // ms - minimum time between refreshes (increased to prevent spam)
        
        // Setup event listeners for resize and layout changes
        this._setupEventListeners();
    }
    
    /**
     * Setup event listeners for resize and layout change events
     * @private
     */
    _setupEventListeners() {
        // Listen for Phaser resize events with debouncing to prevent excessive layout recalculations
        if (this.scene.scale) {
            this.scene.scale.on('resize', (gameSize) => {
                // Get current dimensions from the resize event
                const newWidth = gameSize.width || getScreenWidth(this.scene);
                const newHeight = gameSize.height || getScreenHeight(this.scene);
                
                // Cancel previous debounce timer if it exists
                if (this._resizeDebounceTimer) {
                    this._resizeDebounceTimer.remove();
                    this._resizeDebounceTimer = null;
                }
                
                // Debounce: wait for resize to settle, then run layout refresh once
                // The timer will be reset if another resize event fires before it completes
                if (this.scene.time) {
                    this._resizeDebounceTimer = this.scene.time.delayedCall(this._resizeDebounceDelay, () => {
                        // Get latest dimensions (may have changed since timer was set)
                        const currentWidth = getScreenWidth(this.scene);
                        const currentHeight = getScreenHeight(this.scene);
                        
                        // Check if dimensions actually changed before refreshing
                        if (currentWidth === this._lastScreenWidth && currentHeight === this._lastScreenHeight) {
                            // Dimensions haven't actually changed, skip refresh
                            this._resizeDebounceTimer = null;
                            return;
                        }
                        
                        // Update tracked dimensions BEFORE calling refresh (refresh will check again)
                        // This prevents the debounce handler from calling refresh if dimensions haven't changed
                        const previousWidth = this._lastScreenWidth;
                        const previousHeight = this._lastScreenHeight;
                        this._resizeDebounceTimer = null;
                        
                        // Check if dimensions actually changed (with tolerance)
                        const widthChange = Math.abs(currentWidth - previousWidth);
                        const heightChange = Math.abs(currentHeight - previousHeight);
                        if (widthChange <= 1 && heightChange <= 1) {
                            // Dimensions haven't changed enough, skip refresh
                            return;
                        }
                        
                        // Only refresh if dimensions or layout actually changed
                        this._refreshControlBarLayout();
                    });
                }
            });
        }
        
        // Layout change detection will be handled in _refreshControlBarLayout
        // by comparing _previousLayoutName with current layout name
    }

    // ============================================================================
    // CONTAINER REGISTRY
    // ============================================================================

    /**
     * Get list of all containers that can be controlled by layoutGroups
     * Containers not in the current layout's layoutGroups will be hidden
     * @returns {Array<string>} Array of container names
     * @private
     */
    _getRegisteredContainers() {
        return [
            'soundButton',
            'infoButton',
            'speedButton',
            'playButton',
            'autoButton',
            'balanceContainer',
            'radialCounter'
        ];
    }

    // ============================================================================
    // PRIVATE HELPER METHODS
    // ============================================================================

    /**
     * Get control height based on current layout
     * @returns {number} Control height in pixels
     * @private
     */
    _getControlHeight() {
        if (!this.scene.layoutManager) {
            return Math.max(88, 44);
        }

        const layoutName = this.scene.layoutManager.getCurrentLayoutName();
        if (!layoutName) {
            return Math.max(88, 44);
        }

        const defaultValue = layoutName === 'portrait-mobile' ? 44 : (layoutName === 'landscape-mobile' ? 60 : 88);
        return calculateControlHeight(this.scene, layoutName, defaultValue);
    }

    /**
     * Get current layout mode name
     * @returns {string|null} Layout mode name
     * @private
     */
    _getLayoutMode() {
        if (!this.scene.layoutManager) {
            return null;
        }
        return this.scene.layoutManager.getCurrentLayoutName();
    }
    
    /**
     * Get container position from layout positions
     * @private
     */
    _getContainerPosition(layoutPositions, containerName, defaultX = 0, defaultY = 600) {
        if (!layoutPositions || !layoutPositions.containerPositions) {
            return { x: defaultX, y: defaultY };
        }
        const pos = layoutPositions.containerPositions[containerName];
        if (pos && (pos.x !== undefined || pos.y !== undefined)) {
            return {
                x: pos.x !== undefined && pos.x !== null ? pos.x : defaultX,
                y: pos.y !== undefined && pos.y !== null ? pos.y : defaultY
            };
        }
        return { x: defaultX, y: defaultY };
    }

    /**
     * Check if element is in layoutGroups config
     * @private
     */
    _isElementInLayoutGroups(elementName) {
        if (!this.scene.layoutManager) {
            return false;
        }
        try {
            const layoutName = this.scene.layoutManager.getCurrentLayoutName();
            const layoutConfig = getLayoutConfig(this.scene, layoutName);
            const baseUIConfig = getLayoutConfig(this.scene);
            const layoutGroups = layoutConfig?.controlBar?.layoutGroups || baseUIConfig?.controlBar?.layoutGroups;
            if (!layoutGroups || !Array.isArray(layoutGroups)) {
                return false;
            }
            // Flatten nested arrays and check if elementName is in any group
            const flatGroups = layoutGroups.flat(Infinity);
            return flatGroups.includes(elementName);
        } catch (err) {
            return false;
        }
    }

    /**
     * Get flattened list of containers in Tthe current layout's layoutGroups
     * @returns {Array<string>} Flat array of container names
     * @private
     */
    _getLayoutGroupsFlatList() {
        if (!this.scene.layoutManager) {
            return [];
        }
        try {
            const layoutName = this.scene.layoutManager.getCurrentLayoutName();
            const layoutConfig = getLayoutConfig(this.scene, layoutName);
            const baseUIConfig = getLayoutConfig(this.scene);
            const layoutGroups = layoutConfig?.controlBar?.layoutGroups || baseUIConfig?.controlBar?.layoutGroups;
            if (!layoutGroups || !Array.isArray(layoutGroups)) {
                return [];
            }
            // Flatten nested arrays to get a single array of container names
            return layoutGroups.flat(Infinity);
        } catch (err) {
            return [];
        }
    }

    /**
     * Update container visibility based on whether it's in layoutGroups
     * @param {string} containerName - Name of the container
     * @param {boolean} isInLayoutGroups - Whether the container is in the current layout's layoutGroups
     */
    _updateContainerVisibility(containerName, isInLayoutGroups) {
        const container = this.getContainer(containerName);
        if (container) {
            if (isInLayoutGroups) {
                container.setVisible(true);
            } else {
                container.setVisible(false);
            }
        }
    }

    /**
     * Get list of all header items that can be controlled by header.items config
     * Header items not in the current layout's header.items will be hidden
     * @returns {Array<string>} Array of header item names
     * @private
     */
    _getRegisteredHeaderItems() {
        return [
            'winText',
            'betText',
            'balanceText'
        ];
    }

    /**
     * Get list of header items from the current layout's header config
     * @returns {Array<string>} Array of header item names from config
     * @private
     */
    _getHeaderItemsList() {
        const headerConfig = this._getHeaderConfig();
        if (!headerConfig || !headerConfig.items || !Array.isArray(headerConfig.items)) {
            return [];
        }
        return headerConfig.items;
    }

    /**
     * Theme header fill color: optional controlBar.header["color-mobile"] when layout is portrait-mobile or landscape-mobile.
     * @param {Object|null|undefined} headerConfig - theme.controlBar.header
     * @returns {string}
     * @private
     */
    _resolveThemeHeaderTextColor(headerConfig) {
        if (!headerConfig) {
            return '#ffffff';
        }
        const layoutName = this.scene.layoutManager?.getCurrentLayoutName?.() ?? '';
        const isMobileLayout = layoutName === 'portrait-mobile' || layoutName === 'landscape-mobile';
        const mobileColor = headerConfig['color-mobile'];
        if (isMobileLayout && typeof mobileColor === 'string' && mobileColor.trim() !== '') {
            return mobileColor.trim();
        }
        return headerConfig.color || '#ffffff';
    }
    
    /**
     * Resize all buttons and containers to target height
     * Core resizing logic extracted for reuse
     * @param {number} targetHeight - Target height in pixels
     * @private
     */
    _resizeButtonsToTargetHeight(targetHeight) {
        // Get list of buttons in layoutGroups
        const layoutGroupsList = this._getLayoutGroupsFlatList();
        
        // Resize all buttons in layoutGroups to target height
        const buttonsToResize = [
            { name: 'soundButton', button: this.soundButton, buttonId: this.soundButtonId },
            { name: 'infoButton', button: this.infoButton, buttonId: this.infoButtonId },
            { name: 'speedButton', button: this.speedButton, buttonId: this.speedButtonId },
            { name: 'autoButton', button: this.autoButton, buttonId: this.autoButtonId }
        ];
        
        for (const { name, button, buttonId } of buttonsToResize) {
            if (!layoutGroupsList.includes(name)) {
                continue; // Skip buttons not in current layout
            }
            
            if (!button || !button.container) {
                continue; // Skip if button doesn't exist
            }
            
            const container = button.container;
            
            // Get base height from button's background texture (the original size the button was created at)
            // This is the most reliable method as it's the actual texture size, unaffected by scaling
            let baseHeight = 0;
            if (button.background) {
                const bg = button.background;
                
                // Priority 1: texture frame height (most reliable - original texture size)
                if (bg.texture && bg.texture.frame) {
                    baseHeight = bg.texture.frame.height;
                } 
                // Priority 2: sprite height property (if texture frame not available)
                else if (bg.height) {
                    baseHeight = bg.height;
                } 
                // Priority 3: display height (least reliable - may be affected by scale)
                else if (bg.displayHeight) {
                    baseHeight = bg.displayHeight;
                }
            }
            
            // Fallback: try to get from ButtonManager's stored initial scale if available
            // This is more reliable than using bounds + current scale, as current scale might be hover/press scale
            if ((!baseHeight || baseHeight === 0) && buttonId && this.scene.buttonManager) {
                const buttonData = this.scene.buttonManager.buttons?.get(buttonId);
                if (buttonData && buttonData.initialScaleY) {
                    const bounds = container.getBounds();
                    if (bounds && bounds.height > 0) {
                        // Use the stored initial scale, not the current scale (which might be hover/press scale)
                        baseHeight = bounds.height / buttonData.initialScaleY;
                        debug(`[ControlBarManager] Using ButtonManager initialScale for ${name} baseHeight calculation: bounds.height=${bounds.height.toFixed(2)}, initialScaleY=${buttonData.initialScaleY.toFixed(3)}, baseHeight=${baseHeight.toFixed(2)}`, 'ui');
                    }
                }
            }
            
            // Last resort fallback: try to get from container bounds and current scale
            // WARNING: This is unreliable if button is currently hovered/pressed, as currentScale will be wrong
            if (!baseHeight || baseHeight === 0) {
                const bounds = container.getBounds();
                const currentScale = container.scaleY || 1.0;
                
                if (bounds && bounds.height > 0) {
                    baseHeight = bounds.height / currentScale;
                    warn(`[ControlBarManager] Using fallback baseHeight calculation for ${name} (may be inaccurate if button is hovered/pressed): bounds.height=${bounds.height.toFixed(2)}, currentScale=${currentScale.toFixed(3)}, baseHeight=${baseHeight.toFixed(2)}`, 'ui');
                }
            }
            
            if (!baseHeight || baseHeight === 0) {
                warn(`[ControlBarManager] _resizeButtonsToTargetHeight: Could not determine base height for ${name}`, 'ui');
                continue;
            }
            
            // Calculate new scale to reach target height
            const newScale = targetHeight / baseHeight;
            
            // Debug: log the resize operation
            debug(`[ControlBarManager] Resizing ${name}: baseHeight=${baseHeight.toFixed(2)}, targetHeight=${targetHeight.toFixed(2)}, newScale=${newScale.toFixed(3)}, buttonId=${buttonId}`, 'ui');
            
            // Apply scale
            container.setScale(newScale, newScale);
            
            // Update ButtonManager scale if buttonId exists and method is available
            if (buttonId && this.scene.buttonManager && typeof this.scene.buttonManager.updateInitialScale === 'function') {
                debug(`[ControlBarManager] Calling updateInitialScale for ${name} with buttonId=${buttonId}, newScale=${newScale.toFixed(3)}`, 'ui');
                this.scene.buttonManager.updateInitialScale(buttonId, newScale, newScale);
            } else {
                warn(`[ControlBarManager] Cannot updateInitialScale for ${name}: buttonId=${buttonId}, hasButtonManager=${!!this.scene.buttonManager}, hasMethod=${!!(this.scene.buttonManager && typeof this.scene.buttonManager.updateInitialScale === 'function')}`, 'ui');
            }
        }
        
        // Handle playButton separately (stored as container directly, not button.container)
        if (layoutGroupsList.includes('playButton') && this.playButton) {
            // Get base height from playButton's background texture (the original size the button was created at)
            let baseHeight = 0;
            const playButtonResult = this.playButton.buttonResult;
            if (playButtonResult && playButtonResult.background) {
                const bg = playButtonResult.background;
                // Priority 1: texture frame height (most reliable - original texture size)
                if (bg.texture && bg.texture.frame) {
                    baseHeight = bg.texture.frame.height;
                } 
                // Priority 2: sprite height property
                else if (bg.height) {
                    baseHeight = bg.height;
                } 
                // Priority 3: display height (least reliable)
                else if (bg.displayHeight) {
                    baseHeight = bg.displayHeight;
                }
            }
            
            // Fallback: try to get from ButtonManager's stored initial scale if available
            if ((!baseHeight || baseHeight === 0) && this.playButtonId && this.scene.buttonManager) {
                const buttonData = this.scene.buttonManager.buttons?.get(this.playButtonId);
                if (buttonData && buttonData.initialScaleY) {
                    const bounds = this.playButton.getBounds();
                    if (bounds && bounds.height > 0) {
                        baseHeight = bounds.height / buttonData.initialScaleY;
                        debug(`[ControlBarManager] Using ButtonManager initialScale for playButton baseHeight calculation: bounds.height=${bounds.height.toFixed(2)}, initialScaleY=${buttonData.initialScaleY.toFixed(3)}, baseHeight=${baseHeight.toFixed(2)}`, 'ui');
                    }
                }
            }
            
            // Last resort fallback: try to get from container bounds and current scale
            if (!baseHeight || baseHeight === 0) {
                const bounds = this.playButton.getBounds();
                if (bounds && bounds.height > 0) {
                    const currentScale = this.playButton.scaleY || 1.0;
                    baseHeight = bounds.height / currentScale;
                    warn(`[ControlBarManager] Using fallback baseHeight calculation for playButton (may be inaccurate if button is hovered/pressed): bounds.height=${bounds.height.toFixed(2)}, currentScale=${currentScale.toFixed(3)}, baseHeight=${baseHeight.toFixed(2)}`, 'ui');
                }
            }
            
            if (baseHeight && baseHeight > 0) {
                // Calculate new scale to reach target height
                const newScale = targetHeight / baseHeight;
                
                // Debug: log the resize operation
                debug(`[ControlBarManager] Resizing playButton: baseHeight=${baseHeight.toFixed(2)}, targetHeight=${targetHeight.toFixed(2)}, newScale=${newScale.toFixed(3)}, playButtonId=${this.playButtonId}`, 'ui');
                
                this.playButton.setScale(newScale, newScale);
                
                if (this.playButtonId && this.scene.buttonManager && typeof this.scene.buttonManager.updateInitialScale === 'function') {
                    debug(`[ControlBarManager] Calling updateInitialScale for playButton with playButtonId=${this.playButtonId}, newScale=${newScale.toFixed(3)}`, 'ui');
                    this.scene.buttonManager.updateInitialScale(this.playButtonId, newScale, newScale);
                } else {
                    warn(`[ControlBarManager] Cannot updateInitialScale for playButton: playButtonId=${this.playButtonId}, hasButtonManager=${!!this.scene.buttonManager}, hasMethod=${!!(this.scene.buttonManager && typeof this.scene.buttonManager.updateInitialScale === 'function')}`, 'ui');
                }
            } else {
                warn(`[ControlBarManager] _resizeButtonsToTargetHeight: Could not determine base height for playButton`, 'ui');
            }
        }
        
        // Handle radialCounter (it's a container/scene object, not a button)
        // Base size is 256x256 (defined in RadialCounter.js)
        if (layoutGroupsList.includes('radialCounter') && this.scene.radialCounter) {
            const radialCounter = this.scene.radialCounter;
            const baseSize = 256; // Base size of RadialCounter (from RadialCounter.js)
            
            // Calculate new scale to reach target height
            const newScale = targetHeight / baseSize;
            
            radialCounter.setScale(newScale, newScale);
        }
        
        // Handle balanceContainer (it's a textArea, stored in balanceTextArea.container)
        if (layoutGroupsList.includes('balanceContainer') && this.balanceTextArea?.container) {
            const container = this.balanceTextArea.container;
            let baseHeight = 0;
            
            // Try to get base height from container bounds and current scale
            const bounds = container.getBounds ? container.getBounds() : null;
            if (bounds && bounds.height > 0) {
                const currentScale = container.scaleY || 1.0;
                baseHeight = bounds.height / currentScale;
            }
            
            if (baseHeight > 0) {
                // Calculate new scale to reach target height
                const newScale = targetHeight / baseHeight;
                
                container.setScale(newScale, newScale);
            } else {
                warn(`[ControlBarManager] _resizeButtonsToTargetHeight: Could not determine base height for balanceContainer`, 'ui');
            }
        }
    }

    /**
     * Synchronously resize buttons to match current layout's contentHeight
     * Bypasses debouncing/throttling for immediate resizing on layout changes
     * Called from layoutControlBar() to ensure buttons are sized before width calculations
     * @private
     */
    _resizeButtonsSynchronously() {
        // Re-entrancy protection: prevent concurrent execution
        if (this._isRefreshing) {
            return;
        }
        
        try {
            if (!this.scene || !this.scene.layoutManager) {
                warn(`[ControlBarManager] _resizeButtonsSynchronously: No scene or layoutManager, returning early`, 'ui', {
                    hasScene: !!this.scene,
                    hasLayoutManager: !!(this.scene && this.scene.layoutManager)
                });
                return;
            }
            
            // Set flag to prevent re-entrancy
            this._isRefreshing = true;
            
            // Get current dimensions and layout
            const currentWidth = getScreenWidth(this.scene);
            const currentHeight = getScreenHeight(this.scene);
            const currentLayoutName = this.scene.layoutManager.getCurrentLayoutName();
            const layoutChanged = this._previousLayoutName !== null && this._previousLayoutName !== currentLayoutName;
            
            // Calculate dimension changes with tolerance (only refresh if change > 1px)
            const widthChange = Math.abs(currentWidth - this._lastScreenWidth);
            const heightChange = Math.abs(currentHeight - this._lastScreenHeight);
            const dimensionsChanged = widthChange > 1 || heightChange > 1;
            
            // Early exit: skip resize if dimensions and layout haven't changed
            // But allow resize on first call (when _previousLayoutName is null)
            // Also allow resize if layout changed (even if dimensions didn't change significantly)
            if (this._previousLayoutName !== null && !layoutChanged && !dimensionsChanged) {
                // Nothing changed, skip resize to prevent unnecessary calculations
                debug(`[ControlBarManager] _resizeButtonsSynchronously: Skipping resize - no layout or dimension changes (layout: ${currentLayoutName}, prevLayout: ${this._previousLayoutName})`, 'ui');
                this._isRefreshing = false;
                return;
            }
            
            // Log when we're actually resizing
            if (layoutChanged) {
                debug(`[ControlBarManager] _resizeButtonsSynchronously: Layout changed (${this._previousLayoutName} → ${currentLayoutName}), resizing buttons`, 'ui');
            } else if (dimensionsChanged) {
                debug(`[ControlBarManager] _resizeButtonsSynchronously: Dimensions changed, resizing buttons`, 'ui');
            } else {
                debug(`[ControlBarManager] _resizeButtonsSynchronously: First resize call, resizing buttons`, 'ui');
            }
            
            // Update tracked dimensions BEFORE processing (so we don't process the same change twice)
            // But DON'T update _previousLayoutName yet - update it AFTER resize completes
            // This allows multiple calls (e.g., from _refreshLayout and layoutControlBar) to both detect layout changes
            this._lastScreenWidth = currentWidth;
            this._lastScreenHeight = currentHeight;
            const now = this.scene?.time?.now || Date.now();
            this._lastRefreshTime = now;
            
            // Get layout config
            const { uiConfig, baseUIConfig } = getLayoutConfigs(this.scene.layoutManager, currentLayoutName);
            const screenHeight = getScreenHeight(this.scene);
            const availableHeight = screenHeight; // No padding in this system
            
            // Get contentHeight from config (pixels or percent)
            const contentHeightPercent = getContentHeightPercent(uiConfig, availableHeight, screenHeight) || 
                                        getContentHeightPercent(baseUIConfig, availableHeight, screenHeight) || 0.075;
            
            // Calculate target height
            const targetHeight = screenHeight * contentHeightPercent;
            
            // Only log when layout actually changed (not on every resize)
            if (layoutChanged) {
                debug(`[ControlBarManager] _resizeButtonsSynchronously: layout changed to ${currentLayoutName}, targetHeight=${targetHeight.toFixed(1)}px`, 'ui');
            }
            
            // Resize buttons to target height (synchronous, no debouncing/throttling)
            this._resizeButtonsToTargetHeight(targetHeight);
            
            // When layout changes, recreate button text at the new size to prevent blurriness
            // Text objects need to be recreated at the correct font size for the current button display size
            // Call immediately after _resizeButtonsToTargetHeight since it's synchronous
            if (layoutChanged) {
                debug(`[ControlBarManager] Layout changed, recreating button text at current display size`, 'ui');
                
                // Recreate play button text at new size
                if (this.playButton && this._lastPlayButtonText) {
                    // Force recreation by clearing dimension cache
                    this._lastPlayButtonDimensions = null;
                    // Recreate text at new size (will use current display height in _createPlayButtonTextLines)
                    this.updatePlayButtonText(this._lastPlayButtonText);
                    debug(`[ControlBarManager] Recreated play button text after layout change`, 'ui');
                }
                
                // Recreate speed button text at new size
                if (this.speedButton) {
                    this._recreateSpeedButtonText();
                }
            }
            
            // Update _previousLayoutName AFTER resize completes
            // This allows multiple calls (e.g., from _refreshLayout and layoutControlBar) to both detect layout changes
            this._previousLayoutName = currentLayoutName;
        } catch (err) {
            error(`[ControlBarManager] Error in _resizeButtonsSynchronously: ${err.message}`, 'ui');
            error(err.stack, 'ui');
        } finally {
            // Always reset flag, even if error occurred
            this._isRefreshing = false;
        }
    }

    /**
     * Refresh control bar layout - resize all buttons to match current layout's contentHeight
     * Called on resize events and layout changes
     * @private
     */
    _refreshControlBarLayout() {
        // Re-entrancy protection: prevent concurrent execution
        if (this._isRefreshing) {
            return;
        }
        
        // Throttle: prevent running too frequently (minimum interval between refreshes)
        const now = this.scene?.time?.now || Date.now();
        const timeSinceLastRefresh = now - this._lastRefreshTime;
        if (timeSinceLastRefresh < this._minRefreshInterval) {
            return;
        }
        
        try {
            if (!this.scene || !this.scene.layoutManager) {
                warn(`[ControlBarManager] _refreshControlBarLayout: No scene or layoutManager, returning early`, 'ui', {
                    hasScene: !!this.scene,
                    hasLayoutManager: !!(this.scene && this.scene.layoutManager)
                });
                return;
            }
            
            // Set flag to prevent re-entrancy
            this._isRefreshing = true;
            
            // Get current dimensions and layout
            const currentWidth = getScreenWidth(this.scene);
            const currentHeight = getScreenHeight(this.scene);
            const currentLayoutName = this.scene.layoutManager.getCurrentLayoutName();
            const layoutChanged = this._previousLayoutName !== null && this._previousLayoutName !== currentLayoutName;
            
            // Calculate dimension changes with tolerance (only refresh if change > 1px)
            const widthChange = Math.abs(currentWidth - this._lastScreenWidth);
            const heightChange = Math.abs(currentHeight - this._lastScreenHeight);
            const dimensionsChanged = widthChange > 1 || heightChange > 1;
            
            // Early exit: skip refresh if dimensions and layout haven't changed
            if (!layoutChanged && !dimensionsChanged) {
                // Nothing changed, skip refresh to prevent unnecessary calculations
                this._isRefreshing = false;
                return;
            }
            
            // Update tracked values BEFORE processing (so we don't process the same change twice)
            this._lastScreenWidth = currentWidth;
            this._lastScreenHeight = currentHeight;
            this._previousLayoutName = currentLayoutName;
            this._lastRefreshTime = now;
            
            // Get layout config
            const { uiConfig, baseUIConfig } = getLayoutConfigs(this.scene.layoutManager, currentLayoutName);
            const screenHeight = getScreenHeight(this.scene);
            const availableHeight = screenHeight; // No padding in this system
            
            // Get contentHeight from config (pixels or percent)
            const contentHeightPercent = getContentHeightPercent(uiConfig, availableHeight, screenHeight) || 
                                        getContentHeightPercent(baseUIConfig, availableHeight, screenHeight) || 0.075;
            
            // Calculate target height
            const targetHeight = screenHeight * contentHeightPercent;
            
            // Only log when layout actually changed (not on every resize)
            if (layoutChanged) {
                debug(`[ControlBarManager] _refreshControlBarLayout: layout changed to ${currentLayoutName}, targetHeight=${targetHeight.toFixed(1)}px`, 'ui');
            }
            
            // Resize buttons to target height
            this._resizeButtonsToTargetHeight(targetHeight);
        } catch (err) {
            error(`[ControlBarManager] Error in _refreshControlBarLayout: ${err.message}`, 'ui');
            error(err.stack, 'ui');
        } finally {
            // Always reset flag, even if error occurred
            this._isRefreshing = false;
        }
    }

    /**
     * Create sound button
     * @param {number} [heightPercent] - Button height as percentage of screen height
     * @returns {Object|null} Button result object or null
     */
    createSoundButton(heightPercent) {
        if (this.soundButton) {
            return this.soundButton;
        }
        
        const buttonResult = ButtonFactory.createButton(this.scene, {
            label: 'soundButton',
            buttonType: 'icon',
            icon: 'icon_sound_on_128',
            iconLabel: 'soundIcon',
            iconScale: 0.75,
            aspectRatio: 1.0,
            useNineSlice: false,
            heightPercent: heightPercent,
            themeSupport: true,
            origin: { x: 0.5, y: 0.5 }
        });
        
        debug(`[ControlBarManager] Created soundButton: ${buttonResult ? 'success' : 'failed'}`, 'ui');
        
        if (buttonResult) {
            this.soundButton = buttonResult;
            // Ensure button is at depth 1 or higher to appear above background (depth -0.5)
            if (buttonResult.container) {
                buttonResult.container.setDepth(1);
            }
            // Store icon reference
            if (buttonResult.content) {
                this.scene.soundIcon = buttonResult.content;
            }
        }
        
        return buttonResult;
    }

    /**
     * Create info button
     * @param {number} [heightPercent] - Button height as percentage of screen height
     * @returns {Object|null} Button result object or null
     */
    createInfoButton(heightPercent) {
        if (this.infoButton) {
            return this.infoButton;
        }
        
        const buttonResult = ButtonFactory.createButton(this.scene, {
            label: 'infoButton',
            buttonType: 'icon',
            icon: 'Hud_InfoButton',
            iconScale: 0.75,
            aspectRatio: 1.0,
            useNineSlice: false,
            heightPercent: heightPercent,
            themeSupport: true,
            origin: { x: 0.5, y: 0.5 }
        });
        
        debug(`[ControlBarManager] Created infoButton: ${buttonResult ? 'success' : 'failed'}`, 'ui');
        
        if (buttonResult) {
            this.infoButton = buttonResult;
            // Ensure button is at depth 1 or higher to appear above background (depth -0.5)
            if (buttonResult.container) {
                buttonResult.container.setDepth(1);
            }
        }
        
        return buttonResult;
    }

    /**
     * Create the play button (mirrors video-poker's createDealButton() exactly)
     * VERSION: 2024-01-06 - Updated to mirror video-poker's dealButton pattern
     * @returns {Object|null} Button result object or null
     */
    createPlayButton() {
        // VERSION CHECK - This will only appear if the new code is loaded
        debug('===== CONTROLBARMANAGER.JS VERSION: 2024-01-06 =====', 'ui');
        debug('[ControlBarManager] createPlayButton() STARTED - mirroring video-poker\'s createDealButton()', 'ui');
        
        log(`[ControlBarManager] createPlayButton() called - mirroring video-poker's createDealButton()`, 'ui');
        
        try {
            // Get layout positions (like video-poker does)
            const layoutPositions = this.scene.layoutManager ? this.scene.layoutManager.getLayoutPositions() : { containerPositions: {} };
            const width = getScreenWidth(this.scene);
            const containerPos = this._getContainerPosition(layoutPositions, 'playButton', width / 2, 500);
            const y = containerPos.y;
            
            let buttonX;
            if (containerPos.x !== undefined && containerPos.x !== null) {
                buttonX = containerPos.x;
            } else {
                buttonX = width / 2;
            }
            
            debug(`[ControlBarManager] Play button position: x=${buttonX}, y=${y}, width=${width}`, 'ui');
            
            // Get layout name and config (exactly like video-poker's createDealButton)
            const layoutName = this.scene.layoutManager ? this.scene.layoutManager.getCurrentLayoutName() : null;
            debug(`[ControlBarManager] Layout name: ${layoutName}`, 'ui');
            
            const layoutConfig = getLayoutConfig(this.scene, layoutName, {});
            const baseUIConfig = getLayoutConfig(this.scene, null, {});
            const aspectRatio = getLayoutConfigValue(this.scene, 'controlBar.playButtonAspectRatio', layoutName, 2.0) || 2.0;
            const screenHeight = this.scene.scale.height; // Use scene.scale.height like video-poker does
            
            // Call getContentHeightPercent with proper parameters (layoutConfig, availableHeight, screenHeight)
            // Pass screenHeight as both availableHeight and screenHeight (matching video-poker's pattern)
            // When called with 2 params like video-poker, availableHeight becomes screenHeight and screenHeight becomes null
            // But we'll pass it correctly with 3 params: pass screenHeight as availableHeight, and screenHeight as screenHeight
            const availableHeight = screenHeight; // No padding in this system
            const heightPercent = getContentHeightPercent(layoutConfig, availableHeight, screenHeight) || getContentHeightPercent(baseUIConfig, availableHeight, screenHeight) || 0.08;
            
            debug(`[ControlBarManager] Play button config: aspectRatio=${aspectRatio}, heightPercent=${heightPercent}, screenHeight=${screenHeight}`, 'ui');
            
            // Create button using ButtonFactory (exactly like video-poker's dealButton)
            // Check config option for whether to show buy-in amount
            const showBuyinAmount = GameConfig.game.SHOW_PLAYBUTTON_BUYIN_AMOUNT !== false; // Default to true if not set
            debug('[ControlBarManager] Calling ButtonFactory.createButton()...', 'ui');
            
            let playButtonResult;
            if (showBuyinAmount) {
                // Create with multiline "BUY" + amount
                // Get bet amount for initial button creation
                const initialBetAmount = this._effectiveBuyInMinor(100);
                const initialBetAmountFormatted = formatBuyInMinorForDisplayWithSymbol(initialBetAmount);
                
                // Calculate button dimensions for font size calculation
                // screenHeight is already declared above, reuse it
                const buttonHeight = screenHeight * heightPercent;
                const buttonWidth = buttonHeight * aspectRatio;
                const padding = 30;
                
                // Calculate separate font scales: larger for "BUY", smaller for amount
                const line1 = "BUY";
                const line2 = initialBetAmountFormatted;
                // Calculate max scale for "BUY" alone (larger)
                const buyScale = this._calculateMaxFontSizeForTwoLines(line1, "", buttonWidth, buttonHeight, padding * 0.5);
                // Calculate max scale for amount alone (smaller)
                const amountScale = this._calculateMaxFontSizeForTwoLines("", line2, buttonWidth, buttonHeight, padding * 0.5);
                // Use moderate scale for BUY (around 0.48), smaller for amount (0.3 or calculated)
                const buyTextScale = Math.min(0.48, buyScale); // Use calculated scale, but cap at 0.48
                const amountTextScale = Math.min(0.3, amountScale * 0.8); // Make amount 20% smaller than calculated, max 0.3
                
                // Create button with multiline text from the start for "BUY"
                playButtonResult = ButtonFactory.createButton(this.scene, {
                    label: 'playButton',
                    buttonType: 'text',
                    textLines: [
                        { text: line1, percentY: 0.34, textScale: buyTextScale, textStyle: { shadow: { offsetX: 7, offsetY: 9, color: "#000000ff" } } },
                        { text: line2, percentY: 0.74, textScale: amountTextScale }
                    ],
                    aspectRatio: aspectRatio,
                    heightPercent: heightPercent,
                    cornerRadius: this.cornerRadius,
                    position: { x: buttonX, y: y },
                    origin: { x: 0.5, y: 0.5 },
                    useNineSlice: false,
                    themeSupport: true
                });
            }
            
            debug('[ControlBarManager] ButtonFactory.createButton() returned:', 'ui', { playButtonResult });
            
            // Store container reference directly (like video-poker stores drawBtn)
            this.playButton = playButtonResult ? playButtonResult.container : null;
            debug('[ControlBarManager] this.playButton =', 'ui', { playButton: this.playButton });
            
            if (playButtonResult && this.playButton) {
                // Also store the full buttonResult for theme updates
                this.playButton.buttonResult = playButtonResult;
                
                // Register with ButtonManager (like video-poker does)
                if (this.buttonManager) {
                    this.playButtonId = this.buttonManager.registerButton(playButtonResult, {
                        id: 'play_button',
                        onClick: () => {
                            if (this.scene.handlePlayButtonClick) {
                                this.scene.handlePlayButtonClick();
                            }
                        }
                    });
                    debug(`[ControlBarManager] Registered playButton with ButtonManager: ${this.playButtonId}`, 'ui');
                    log(`[ControlBarManager] Registered playButton with ButtonManager: ${this.playButtonId}`, 'ui');
                } else {
                    warn('[ControlBarManager] ButtonManager is not available!', 'ui');
                }
                
                // Ensure button is visible (video-poker sets it to false initially, but we want it visible)
                this.playButton.setVisible(true);
                this.playButton.setDepth(1);
                
                debug(`[ControlBarManager] Play button created: container=${!!this.playButton}, visible=${this.playButton.visible}, x=${this.playButton.x}, y=${this.playButton.y}`, 'ui');
                log(`[ControlBarManager] Play button created: container=${!!this.playButton}, visible=${this.playButton.visible}, x=${this.playButton.x}, y=${this.playButton.y}`, 'ui');
            } else {
                error(`[ControlBarManager] Failed to create play button - playButtonResult=${!!playButtonResult}, container=${!!this.playButton}`, 'ui');
                warn(`[ControlBarManager] Failed to create play button - playButtonResult=${!!playButtonResult}, container=${!!this.playButton}`, 'ui');
            }
            
            return playButtonResult;
        } catch (err) {
            error(`[ControlBarManager] Error in createPlayButton(): ${err.message}`, 'ui');
            error(err.stack, 'ui');
            return null;
        }
    }

    /**
     * Create auto button
     * @param {number} [heightPercent] - Button height as percentage of screen height
     * @returns {Object|null} Button result object or null
     */
    createAutoButton(heightPercent) {
        if (this.autoButton) {
            return this.autoButton;
        }
        
        const buttonResult = ButtonFactory.createButton(this.scene, {
            label: 'autoButton',
            buttonType: 'icon',
            icon: 'AutoPlay',
            iconLabel: 'autoplayIcon',
            iconScale: 0.75,
            aspectRatio: 1.0,
            useNineSlice: false,
            heightPercent: heightPercent,
            themeSupport: true,
            origin: { x: 0.5, y: 0.5 }
        });
        
        debug(`[ControlBarManager] Created autoButton: ${buttonResult ? 'success' : 'failed'}`, 'ui');
        
        if (buttonResult) {
            this.autoButton = buttonResult;
            // Ensure button is at depth 1 or higher to appear above background (depth -0.5)
            if (buttonResult.container) {
                buttonResult.container.setDepth(1);
            }
        }
        
        return buttonResult;
    }

    /**
     * Create speed button
     * @param {number} [heightPercent] - Button height as percentage of screen height
     * @returns {Object|null} Button result object or null
     */
    createSpeedButton(heightPercent) {
        if (this.speedButton) {
            log(`[ControlBarManager] speedButton already exists, returning existing`, 'ui');
            return this.speedButton;
        }
        
        log(`[ControlBarManager] Creating speedButton with heightPercent: ${heightPercent}`, 'ui');
        
        // Pull-tab: PeelManager.speed (fallback START_SPEED / 1)
        const peel = this.scene.peelManager;
        const currentSpeed = peel?.speed ?? GameConfig.game.START_SPEED ?? 1;
        const speedText = `x${currentSpeed}`;
        log(`[ControlBarManager] Current game speed: ${currentSpeed}, speedText: ${speedText}`, 'ui');
        
        let buttonResult = null;
        try {
            buttonResult = ButtonFactory.createButton(this.scene, {
                label: 'speedButton',
                buttonType: 'text',
                textLines: [
                    {text: 'Speed', percentY: 0.234, textScale: 0.2},
                    {text: speedText, percentY: 0.62, textScale: 0.5}
                ],
                aspectRatio: 1.0,
                useNineSlice: false,
                heightPercent: heightPercent,
                themeSupport: true,
                origin: { x: 0.5, y: 0.5 }
            });
            log(`[ControlBarManager] ButtonFactory.createButton returned: ${buttonResult ? 'success' : 'null'}`, 'ui');
        } catch (err) {
            error(`[ControlBarManager] Error in ButtonFactory.createButton for speedButton: ${err.message}`, 'ui');
            error(err.stack, 'ui');
            return null;
        }
        
        debug(`[ControlBarManager] Created speedButton: ${buttonResult ? 'success' : 'failed'}`, 'ui');
        
        if (buttonResult) {
            this.speedButton = buttonResult;
            // Ensure button is at depth 1 or higher to appear above background (depth -0.5)
            if (buttonResult.container) {
                buttonResult.container.setDepth(1);
            }
            
            // Extract speedButtonText from textContent (second line)
            if (buttonResult.textContent) {
                if (Array.isArray(buttonResult.textContent)) {
                    this.speedButtonText = buttonResult.textContent[1] || null;
                } else {
                    this.speedButtonText = buttonResult.textContent;
                }
            } else {
                this.speedButtonText = null;
            }
            
            // Register with ButtonManager
            if (this.buttonManager) {
                this.speedButtonId = this.buttonManager.registerButton(buttonResult, {
                    id: 'speed_button',
                    onClick: () => {
                        this.scene?.audioService?.playSfx('popupOpen');
                        // Get current speed from prefab_ScratchManager
                        const peel = this.scene.peelManager;
                        const currentSpeed = peel?.speed || 1;
                        // Cycle speed: 1 -> 2 -> 3 -> 1
                        const newSpeed = currentSpeed >= 3 ? 1 : currentSpeed + 1;

                        peel?.setGameSpeed(newSpeed);
                        
                        // Update button text
                        if (this.speedButtonText) {
                            this.speedButtonText.setText(`x${newSpeed}`);
                            log(`[ControlBarManager] Game speed changed: x${currentSpeed} → x${newSpeed}`, 'ui');
                        } else {
                            log(`[ControlBarManager] Game speed changed: x${currentSpeed} → x${newSpeed} (text display not found)`, 'ui');
                        }
                    }
                });
                log(`[ControlBarManager] Registered speedButton with ButtonManager: ${this.speedButtonId}`, 'ui');
            } else {
                warn('[ControlBarManager] ButtonManager is not available for speedButton!', 'ui');
            }
        }
        
        return buttonResult;
    }

    /**
     * Create balance text area
     * @param {number} [heightPercent] - Text area height as percentage of screen height
     * @returns {Object|null} Text area result object or null
     */
    createBalanceTextArea(heightPercent) {
        if (this.balanceTextArea) {
            return this.balanceTextArea;
        }
        
        const textAreaResult = TextAreaFactory.createTextArea(this.scene, {
            titleText: 'Balance:',
            valueText: formatBalanceMinorForDisplayWithSymbol(0),
            heightPercent: heightPercent || 0.08 // Use provided heightPercent or default
        });
        
        if (textAreaResult) {
            this.balanceTextArea = textAreaResult;
            // Ensure text area is at depth 1 or higher to appear above background (depth -0.5)
            if (textAreaResult.container) {
                textAreaResult.container.setDepth(1);
            }
        }
        
        debug(`[ControlBarManager] Created balanceTextArea: ${textAreaResult ? 'success' : 'failed'}`, 'ui');
        
        return textAreaResult;
    }

    /**
     * Get container by name (for layoutGroups mapping)
     * @param {string} containerName - Container name from layoutGroups
     * @returns {Phaser.GameObjects.Container|null} Container or null
     */
    getContainer(containerName) {
        switch (containerName) {
            case 'soundButton':
                return this.soundButton?.container || null;
            case 'infoButton':
                return this.infoButton?.container || null;
            case 'playButton':
                // playButton is now stored as container directly (like video-poker's drawBtn)
                return this.playButton || null;
            case 'autoButton':
                return this.autoButton?.container || null;
            case 'speedButton':
                return this.speedButton?.container || null;
            case 'balanceContainer':
                return this.balanceTextArea?.container || null;
            case 'radialCounter':
                return this.scene.radialCounter || null;
            default:
                warn(`[ControlBarManager] Unknown container name: ${containerName}`);
                return null;
        }
    }

    /**
     * Get container widths for layout calculation
     * Only returns widths for containers that are in the current layout's layoutGroups
     * @returns {Object} Object mapping container names to widths
     */
    getContainerWidths() {
        const widths = {};
        
        // Get list of containers that should be included in layout calculations
        const layoutGroupsList = this._getLayoutGroupsFlatList();
        
        // Only include widths for containers that are in layoutGroups
        if (layoutGroupsList.includes('soundButton') && this.soundButton?.container) {
            // Use displayWidth to account for scaling, or fallback to width
            const bounds = this.soundButton.container.getBounds ? this.soundButton.container.getBounds() : null;
            widths.soundButton = bounds?.width || this.soundButton.container.displayWidth || this.soundButton.container.width || 0;
        }
        if (layoutGroupsList.includes('infoButton') && this.infoButton?.container) {
            const bounds = this.infoButton.container.getBounds ? this.infoButton.container.getBounds() : null;
            widths.infoButton = bounds?.width || this.infoButton.container.displayWidth || this.infoButton.container.width || 0;
        }
        if (layoutGroupsList.includes('playButton') && this.playButton) {
            // playButton is now stored as container directly (like video-poker's drawBtn)
            const bounds = this.playButton.getBounds ? this.playButton.getBounds() : null;
            widths.playButton = bounds?.width || this.playButton.displayWidth || this.playButton.width || 0;
            debug(`[ControlBarManager] getContainerWidths: playButton width=${widths.playButton}, bounds=${!!bounds}`, 'ui');
        } else if (layoutGroupsList.includes('playButton')) {
            warn(`[ControlBarManager] getContainerWidths: playButton is null!`, 'ui');
        }
        if (layoutGroupsList.includes('autoButton') && this.autoButton?.container) {
            const bounds = this.autoButton.container.getBounds ? this.autoButton.container.getBounds() : null;
            widths.autoButton = bounds?.width || this.autoButton.container.displayWidth || this.autoButton.container.width || 0;
        }
        if (layoutGroupsList.includes('speedButton') && this.speedButton?.container) {
            const bounds = this.speedButton.container.getBounds ? this.speedButton.container.getBounds() : null;
            widths.speedButton = bounds?.width || this.speedButton.container.displayWidth || this.speedButton.container.width || 0;
        }
        if (layoutGroupsList.includes('balanceContainer') && this.balanceTextArea?.container) {
            const bounds = this.balanceTextArea.container.getBounds ? this.balanceTextArea.container.getBounds() : null;
            widths.balanceContainer = bounds?.width || this.balanceTextArea.container.displayWidth || this.balanceTextArea.container.width || 0;
        }
        if (layoutGroupsList.includes('radialCounter') && this.scene.radialCounter) {
            // Note: radialCounter scaling is now handled in _refreshControlBarLayout()
            // Here we just get its current width for layout calculations
            const bounds = this.scene.radialCounter.getBounds ? this.scene.radialCounter.getBounds() : null;
            widths.radialCounter = bounds?.width || this.scene.radialCounter.displayWidth || this.scene.radialCounter.width || 0;
            debug(`[ControlBarManager] getContainerWidths: radialCounter width=${widths.radialCounter}, bounds=${!!bounds}`, 'ui');
        } else if (layoutGroupsList.includes('radialCounter')) {
            debug(`[ControlBarManager] getContainerWidths: radialCounter not found`, 'ui');
        }
        
        return widths;
    }

    /**
     * Apply layout positions to containers
     * @param {Object} layoutPositions - Layout positions object containing containerPositions and other layout data
     * @param {number} width - Screen width
     */
    layoutControlBar(layoutPositions, width) {
        if (!layoutPositions) {
            warn('[ControlBarManager] layoutPositions is required');
            return;
        }
        
        // Resize buttons synchronously BEFORE positioning to ensure correct widths for layout calculations
        // This fixes button spacing collapse on layout changes by ensuring buttons are sized before getContainerWidths() is called
        // Unlike _refreshControlBarLayout(), this bypasses debouncing/throttling for immediate resizing
        this._resizeButtonsSynchronously();
        
        // Extract containerPositions from layoutPositions
        // layoutPositions should have containerPositions as a property
        const containerPositions = layoutPositions.containerPositions;
        
        debug(`[ControlBarManager] layoutControlBar: containerPositions extracted, keys: ${containerPositions ? Object.keys(containerPositions).join(', ') : 'null/undefined'}`, 'ui');
        
        if (!containerPositions || typeof containerPositions !== 'object') {
            warn('[ControlBarManager] layoutPositions.containerPositions is required and must be an object', 'ui', {
                layoutPositionsKeys: Object.keys(layoutPositions || {}),
                hasContainerPositions: !!layoutPositions?.containerPositions,
                containerPositionsType: typeof layoutPositions?.containerPositions
            });
            return;
        }
        
        // Get width from parameter or calculate from scene
        const screenWidth = width || getScreenWidth(this.scene);
        const screenHeight = getScreenHeight(this.scene);
        
        // Get list of containers that should be visible in the current layout
        const layoutGroupsList = this._getLayoutGroupsFlatList();
        
        debug(`[ControlBarManager] layoutControlBar: layoutGroupsList: ${layoutGroupsList.join(', ')}`, 'ui');
        
        // Hide/show containers based on whether they're in layoutGroups
        // Iterate through all registered containers
        for (const containerName of this._getRegisteredContainers()) {
            const isInLayoutGroups = layoutGroupsList.includes(containerName);
            this._updateContainerVisibility(containerName, isInLayoutGroups);
        }
        
        debug(`[ControlBarManager] layoutControlBar: containerPositions keys: ${Object.keys(containerPositions).join(', ')}`, 'ui');
        
        // Note: Button sizing is handled by _refreshControlBarLayout() via resize event handler
        // No need to call it here - the resize handler will trigger it when needed
        
        // Note: radialCounter scaling is handled in getContainerWidths() to ensure correct width calculation
        // No need to scale again here - it's already scaled for layout calculations
        
        // Play button positioning (mirrors video-poker's dealButton positioning)
        if (this.playButton && this._isElementInLayoutGroups('playButton')) {
            const playButtonPos = containerPositions.playButton;
            if (playButtonPos && playButtonPos.x !== undefined) {
                const CONSTANT_BUTTON_HEIGHT = this._getControlHeight();
                const layoutName = this._getLayoutMode();
                const aspectRatio = getLayoutConfigValue(this.scene, 'controlBar.playButtonAspectRatio', layoutName, 2.0) || 2.0;
                const buttonWidth = CONSTANT_BUTTON_HEIGHT * aspectRatio;
                
                debug(`[ControlBarManager] Play button layout: height=${CONSTANT_BUTTON_HEIGHT.toFixed(1)}px, aspectRatio=${aspectRatio}, calculatedWidth=${buttonWidth.toFixed(1)}px`, 'ui');
                
                // Use position.y directly from layout calculation - it's already the center Y for the row
                // All elements in the same row will have the same position.y, ensuring vertical alignment
                const centerY = playButtonPos.y !== undefined ? playButtonPos.y : (screenHeight - (CONSTANT_BUTTON_HEIGHT / 2));
                
                this.playButton.setPosition(playButtonPos.x, centerY);
                
                // Note: ButtonFactory handles graphics updates, but we may need to update graphics here if needed
                // Similar to how video-poker handles dealButton graphics updates
            }
        }
        
        // Debug: Log all containerPositions keys
        debug(`[ControlBarManager] layoutControlBar: containerPositions keys: ${Object.keys(containerPositions).join(', ')}`, 'ui');
        
        // Position other containers (sound, info, auto, balance, radialCounter)
        for (const [containerName, position] of Object.entries(containerPositions)) {
            // Skip playButton as it's handled above
            if (containerName === 'playButton') {
                continue;
            }
            
            const container = this.getContainer(containerName);
            if (!container) {
                warn(`[ControlBarManager] layoutControlBar: Container '${containerName}' not found by getContainer()`, 'ui');
                continue;
            }
            if (!position || position.x === undefined) {
                warn(`[ControlBarManager] layoutControlBar: Container '${containerName}' has invalid position: ${JSON.stringify(position)}`, 'ui');
                continue;
            }
            
            if (containerName === 'radialCounter') {
                debug(`[ControlBarManager] layoutControlBar: radialCounter found in containerPositions, position=${JSON.stringify(position)}, container=${!!container}, container.parent=${container?.parent?.constructor?.name || 'none'}, container.parentContainer=${container?.parentContainer?.constructor?.name || 'none'}`, 'ui');
            }
            
            if (container && position && position.x !== undefined) {
                const parent = container.parentContainer || container.parent;
                const hasParent = parent !== null && parent !== undefined;
                const screenHeight = this.scene.scale.height;
                
                let initialX, initialY;
                
                // Special handling for radialCounter: it's a Container that needs to be positioned like other control bar elements
                if (containerName === 'radialCounter') {
                    // Use position.y directly from layout calculation - it's already the center Y for the row
                    // All elements in the same row will have the same position.y, ensuring vertical alignment
                    const centerY = position.y !== undefined ? position.y : (screenHeight - ((container.height || container.displayHeight || (screenHeight * 0.075)) / 2));
                    
                    initialX = position.x;
                    initialY = centerY;
                    
                    if (hasParent && parent) {
                        // Get parent's world position
                        let parentWorldX = parent.x || 0;
                        let parentWorldY = parent.y || 0;
                        
                        // Traverse up the hierarchy to get full world position
                        let currentParent = parent;
                        while (currentParent && (currentParent.parentContainer || currentParent.parent)) {
                            const grandParent = currentParent.parentContainer || currentParent.parent;
                            if (grandParent) {
                                parentWorldX += grandParent.x || 0;
                                parentWorldY += grandParent.y || 0;
                                currentParent = grandParent;
                            } else {
                                break;
                            }
                        }
                        
                        // Convert world position to local position relative to parent
                        initialX = position.x - parentWorldX;
                        initialY = centerY - parentWorldY;
                    }
                    
                    container.setPosition(initialX, initialY);
                    continue; // Skip the rest of the positioning logic for radialCounter
                }
                
                // For textArea containers: Position FIRST using fixed height, then lock position
                // Text fields will be positioned within container using percent_y AFTER container is positioned
                // Container position is calculated independently of any bounds or text field positions
                if (container._fixedHeight !== undefined) {
                    // position.y is center Y for the row (same as other elements)
                    // But textArea containers have origin (0, 0) at top-left, so we need to convert center Y to top-left Y
                    // Formula: topLeftY = centerY - (height / 2)
                    const centerY = position.y !== undefined ? position.y : (screenHeight - (container._fixedHeight / 2));
                    const topLeftY = centerY - (container._fixedHeight / 2);
                    
                    initialX = position.x;
                    initialY = topLeftY;
                    
                    if (hasParent && parent) {
                        // Get parent's world position
                        let parentWorldX = parent.x || 0;
                        let parentWorldY = parent.y || 0;
                        
                        // If parent has its own parent, we need to traverse up the hierarchy
                        let currentParent = parent;
                        while (currentParent && (currentParent.parentContainer || currentParent.parent)) {
                            const grandParent = currentParent.parentContainer || currentParent.parent;
                            if (grandParent) {
                                parentWorldX += grandParent.x || 0;
                                parentWorldY += grandParent.y || 0;
                                currentParent = grandParent;
                            } else {
                                break;
                            }
                        }
                        
                        // Convert world position to local position relative to parent
                        initialX = position.x - parentWorldX;
                        initialY = topLeftY - parentWorldY;
                    }
                    
                    // Override setPosition to prevent ANY repositioning after initial placement
                    const originalSetPosition = container.setPosition.bind(container);
                    container.setPosition = function(x, y) {
                        // Only allow repositioning if position is not locked (first call)
                        if (!this._positionLocked) {
                            originalSetPosition(x, y);
                            this._positionLocked = true; // Lock after first positioning
                            this._initialX = x;
                            this._initialY = y;
                        }
                        // After locking, ignore all subsequent setPosition calls
                        // Container position should NEVER change based on text field bounds
                    };
                    
                    // Set initial position (this will lock it) - POSITION CONTAINER FIRST
                    container.setPosition(initialX, initialY);
                    
                    // Text fields are already positioned within container using percent_y in TextAreaFactory
                    // No need to reposition them - they're children of the container
                } else {
                    // Non-textArea container: Use position.y directly from layout calculations
                    // position.y is already the center Y for the row, ensuring all elements align vertically
                    // Always position containers, even if position.y is undefined (use fallback)
                    const centerY = position.y !== undefined && position.y !== null ? position.y : (screenHeight - (container.height || container.displayHeight || (screenHeight * 0.075)) / 2);
                    
                    initialX = position.x !== undefined && position.x !== null ? position.x : 0;
                    initialY = centerY;
                    
                    if (hasParent && parent) {
                        let parentWorldX = parent.x || 0;
                        let parentWorldY = parent.y || 0;
                        
                        let currentParent = parent;
                        while (currentParent && (currentParent.parentContainer || currentParent.parent)) {
                            const grandParent = currentParent.parentContainer || currentParent.parent;
                            if (grandParent) {
                                parentWorldX += grandParent.x || 0;
                                parentWorldY += grandParent.y || 0;
                                currentParent = grandParent;
                            } else {
                                break;
                            }
                        }
                        
                        initialX = position.x - parentWorldX;
                        initialY = centerY - parentWorldY;
                    }
                    
                    debug(`[ControlBarManager] layoutControlBar: Positioning ${containerName} at (${initialX.toFixed(1)}, ${initialY.toFixed(1)}) from position (${position.x?.toFixed(1) || 'undefined'}, ${position.y?.toFixed(1) || 'undefined'}), hasParent=${hasParent}`, 'ui');
                    container.setPosition(initialX, initialY);
                }
            }
        }
        
        // Draw visual debugging bounds if enabled
        drawControlBarElementBounds({
            scene: this.scene,
            elementMap: {
                soundButton: this.soundButton?.container,
                infoButton: this.infoButton?.container,
                playButton: this.playButton, // playButton is now a container directly
                autoButton: this.autoButton?.container,
                speedButton: this.speedButton?.container,
                balanceTextArea: this.balanceTextArea?.container,
                balanceContainer: this.balanceTextArea?.container, // Alias for balanceContainer
                radialCounter: this.scene.radialCounter
            },
            containerPositions: containerPositions
        });
    }

    /**
     * Update theme colors for all buttons and text areas
     */
    updateThemeColors() {
        // Update button colors
        if (this.soundButton) {
            ButtonFactory.updateButtonBackgroundColor(this.scene, this.soundButton);
            ButtonFactory.updateButtonContentColor(this.scene, this.soundButton);
            // Update ButtonManager's stored tint values if button is registered
            if (this.buttonManager && this.soundButtonId) {
                this.buttonManager.updateButtonOriginalTint(this.soundButtonId, this.soundButton);
            }
        }
        if (this.infoButton) {
            ButtonFactory.updateButtonBackgroundColor(this.scene, this.infoButton);
            ButtonFactory.updateButtonContentColor(this.scene, this.infoButton);
            // Update ButtonManager's stored tint values if button is registered
            if (this.buttonManager && this.infoButtonId) {
                this.buttonManager.updateButtonOriginalTint(this.infoButtonId, this.infoButton);
            }
        }
        if (this.playButton && this.playButton.buttonResult) {
            // playButton is now a container, but we store buttonResult for theme updates
            const buttonResult = this.playButton.buttonResult;
            ButtonFactory.updateButtonBackgroundColor(this.scene, buttonResult);
            ButtonFactory.updateButtonContentColor(this.scene, buttonResult);
            // Update ButtonManager's stored tint values if button is registered
            if (this.buttonManager && this.playButtonId) {
                this.buttonManager.updateButtonOriginalTint(this.playButtonId, buttonResult);
            }
        }
        if (this.autoButton) {
            // Log auto button background tint before update (for comparison)
            if (this.autoButton.background) {
                const autoBgTintBefore = this.autoButton.background.tint || 0xffffff;
                debug(`[ControlBarManager] Auto button background tint before update: ${autoBgTintBefore.toString(16)}`, 'ui');
            }
            ButtonFactory.updateButtonBackgroundColor(this.scene, this.autoButton);
            ButtonFactory.updateButtonContentColor(this.scene, this.autoButton);
            // Log auto button background tint after update (for comparison)
            if (this.autoButton.background) {
                const autoBgTintAfter = this.autoButton.background.tint || 0xffffff;
                debug(`[ControlBarManager] Auto button background tint after update: ${autoBgTintAfter.toString(16)}`, 'ui');
            }
            // Update ButtonManager's stored tint values if button is registered
            if (this.buttonManager && this.autoButtonId) {
                this.buttonManager.updateButtonOriginalTint(this.autoButtonId, this.autoButton);
            }
        }
        if (this.speedButton) {
            ButtonFactory.updateButtonBackgroundColor(this.scene, this.speedButton);
            ButtonFactory.updateButtonContentColor(this.scene, this.speedButton);
            // Update ButtonManager's stored tint values if button is registered
            if (this.buttonManager && this.speedButtonId) {
                this.buttonManager.updateButtonOriginalTint(this.speedButtonId, this.speedButton);
            }
        }
        
        // Update text area colors
        if (this.balanceTextArea) {
            TextAreaFactory.updateTextAreaColors(this.scene, this.balanceTextArea);
        }

        // Update header text colors (Win, Buy, Balance) from theme.controlBar.header
        const theme = this.scene.themeData || (this.scene.prefab_ScratchManager && this.scene.prefab_ScratchManager.themeData);
        const headerConfig = theme?.controlBar?.header;
        if (headerConfig) {
            const headerColor = this._resolveThemeHeaderTextColor(headerConfig);
            const strokeColor = headerConfig.stroke?.color || '#000000';
            const strokeWidth = headerConfig.stroke?.lineWidth ?? 0;
            const headerFields = [this.headerWinText, this.headerBetText, this.headerBalanceText].filter(Boolean);
            for (const textField of headerFields) {
                if (textField && typeof textField.setStyle === 'function') {
                    const styleUpdate = { color: headerColor };
                    if (strokeWidth > 0) {
                        styleUpdate.stroke = strokeColor;
                        styleUpdate.strokeThickness = strokeWidth;
                    } else {
                        styleUpdate.stroke = strokeColor;
                        styleUpdate.strokeThickness = 0;
                    }
                    textField.setStyle(styleUpdate);
                }
            }
        }

        if (this.scene.instructionsText && theme && this.scene.layoutManager) {
            const layoutName = this.scene.layoutManager.getCurrentLayoutName();
            const { uiConfig, baseUIConfig } = getLayoutConfigs(this.scene.layoutManager, layoutName);
            applyInstructionsTextTheme(
                this.scene.instructionsText,
                theme,
                layoutName,
                uiConfig,
                baseUIConfig
            );
        }
    }

    /**
     * Set visibility of all control bar elements (buttons, balance, radialCounter, headers, background).
     * Used to hide control bar until theme colors are applied on first load.
     * When visible=true, respects layout: only shows elements in layoutGroups/header.items.
     * @param {boolean} visible - true to show, false to hide
     */
    setControlBarVisible(visible) {
        const setVis = (obj, show) => obj && obj.setVisible && obj.setVisible(show);
        if (!visible) {
            // Hide all
            if (this.soundButton?.container) setVis(this.soundButton.container, false);
            if (this.infoButton?.container) setVis(this.infoButton.container, false);
            if (this.playButton) setVis(this.playButton, false);
            if (this.autoButton?.container) setVis(this.autoButton.container, false);
            if (this.speedButton?.container) setVis(this.speedButton.container, false);
            if (this.balanceTextArea?.container) setVis(this.balanceTextArea.container, false);
            if (this.scene.radialCounter) setVis(this.scene.radialCounter, false);
            if (this.headerWinText) setVis(this.headerWinText, false);
            if (this.headerBetText) setVis(this.headerBetText, false);
            if (this.headerBalanceText) setVis(this.headerBalanceText, false);
            if (this.scene.controlBarBackground) setVis(this.scene.controlBarBackground, false);
            return;
        }
        // Show only elements that are in the current layout
        const layoutGroupsList = this._getLayoutGroupsFlatList();
        const headerItems = this._getHeaderItemsList();
        if (this.soundButton?.container) setVis(this.soundButton.container, layoutGroupsList.includes('soundButton'));
        if (this.infoButton?.container) setVis(this.infoButton.container, layoutGroupsList.includes('infoButton'));
        if (this.playButton) setVis(this.playButton, layoutGroupsList.includes('playButton'));
        if (this.autoButton?.container) setVis(this.autoButton.container, layoutGroupsList.includes('autoButton'));
        if (this.speedButton?.container) setVis(this.speedButton.container, layoutGroupsList.includes('speedButton'));
        if (this.balanceTextArea?.container) setVis(this.balanceTextArea.container, layoutGroupsList.includes('balanceContainer'));
        if (this.scene.radialCounter) setVis(this.scene.radialCounter, layoutGroupsList.includes('radialCounter'));
        if (this.headerWinText) setVis(this.headerWinText, headerItems.includes('winText'));
        if (this.headerBetText) setVis(this.headerBetText, headerItems.includes('betText'));
        if (this.headerBalanceText) setVis(this.headerBalanceText, headerItems.includes('balanceText'));
        if (this.scene.controlBarBackground) setVis(this.scene.controlBarBackground, true);
    }

    /**
     * Get play button container (mirrors video-poker's getDealButton() pattern)
     * @returns {Phaser.GameObjects.Container|null} Play button container or null
     */
    getPlayButton() {
        return this.playButton || null;
    }

    /**
     * Set play button disabled state
     * @param {boolean} disabled - true to disable, false to enable
     */
    setPlayButtonDisabled(disabled) {
        if (!this.buttonManager) {
            return;
        }
        
        // Use 'play_button' as the button ID (matches the id used in registerButton)
        // ButtonManager.setButtonEnabled expects enabled (opposite of disabled)
        const enabled = !disabled;
        this.buttonManager.setButtonEnabled('play_button', enabled);
    }

    /**
     * Set auto button disabled state
     * @param {boolean} disabled - true to disable, false to enable
     */
    setAutoButtonDisabled(disabled) {
        if (!this.buttonManager) {
            return;
        }
        
        // Use 'auto_button' as the button ID (matches the id used in registerButton)
        // ButtonManager.setButtonEnabled expects enabled (opposite of disabled)
        const enabled = !disabled;
        this.buttonManager.setButtonEnabled('auto_button', enabled);
    }

    /**
     * Get speed button (for consistency with other button getters)
     * @returns {Object|null} Speed button result object or null
     */
    getSpeedButton() {
        return this.speedButton || null;
    }

    /**
     * Get speed button text element (second line showing x1/x2/x3)
     * @returns {Phaser.GameObjects.Text|null} Speed button text or null
     */
    getSpeedButtonText() {
        return this.speedButtonText || null;
    }

    /**
     * Split text intelligently into two lines
     * @private
     */
    _splitTextForTwoLines(text) {
        if (text.includes(' ')) {
            const parts = text.split(' ');
            if (parts.length === 2) {
                return [parts[0], parts[1]];
            }
            const firstPart = parts[0];
            const remainingParts = parts.slice(1).join(' ');
            return [firstPart, remainingParts];
        }
        if (/^\d+$/.test(text)) {
            return [text, ''];
        }
        if (text.length > 6) {
            const midpoint = Math.ceil(text.length / 2);
            return [text.substring(0, midpoint), text.substring(midpoint)];
        }
        return [text, ''];
    }

    /**
     * Calculate maximum font size for two-line layout
     * @private
     */
    _calculateMaxFontSizeForTwoLines(line1, line2, buttonWidth, buttonHeight, padding = 30, lineGapFraction = 0.16) {
        const theme = this.scene.themeData || (this.scene.prefab_ScratchManager && this.scene.prefab_ScratchManager.themeData);
        const fontConfig = theme?.controlBar?.font || theme?.controlBar?.fontFamily || "Lato-Bold";
        const { fontFamily } = FontUtils.getFontFamily(fontConfig, theme);
        const themeFontFamily = FontUtils.getSafeFontFamily(fontFamily);

        // Use less padding for 2-line layout to allow larger text (reduced further)
        const availableWidth = buttonWidth - (padding * 0.5);
        // Allow more height for 2-line layout
        const availableHeight = buttonHeight * 0.9;

        // Start with much higher minimum scale for 2-line layout (aim for larger text)
        // Use 0.35 as minimum (35% of button height) to ensure readable text
        let minScale = 0.35;
        let maxScale = 0.6; // Increase max scale beyond default for 2-line layouts
        let bestScale = minScale;
        const iterations = 15; // More iterations for better precision

        for (let i = 0; i < iterations; i++) {
            const testScale = (minScale + maxScale) / 2;
            const testFontSize = Math.round(buttonHeight * testScale);

            const tempStyle = {
                fontFamily: themeFontFamily,
                fontSize: `${testFontSize}px`,
                fontStyle: "bold",
                stroke: "#000000ff"
            };

            const tempText1 = this.scene.add.text(0, 0, line1, tempStyle);
            const line1Width = tempText1.width;
            const line1Height = tempText1.height;
            tempText1.destroy();

            let line2Width = 0;
            let line2Height = 0;
            if (line2 && line2.trim() !== '') {
                const tempText2 = this.scene.add.text(0, 0, line2, tempStyle);
                line2Width = tempText2.width;
                line2Height = tempText2.height;
                tempText2.destroy();
            }

            const fitsWidth = line1Width <= availableWidth && line2Width <= availableWidth;
            // Line spacing: fraction of button height between lines (match percentY delta of the layout)
            const lineSpacing = buttonHeight * lineGapFraction;
            const totalHeightNeeded = line1Height + lineSpacing + line2Height;
            const fitsHeight = totalHeightNeeded <= availableHeight;

            if (fitsWidth && fitsHeight) {
                bestScale = testScale;
                minScale = testScale;
            } else {
                maxScale = testScale;
            }
        }

        // Ensure minimum scale is reasonable for readability, but aim for larger text
        // Use 0.35 as absolute minimum to ensure text is readable
        const finalScale = Math.max(0.35, bestScale);
        debug(`[ControlBarManager] Calculated scale for 2-line layout: ${finalScale.toFixed(3)} (lines: ["${line1}", "${line2}"])`, 'ui');
        return finalScale;
    }

    /**
     * Calculate text layout for play button
     * @private
     */
    _calculatePlayButtonTextLayout(text, buttonResult) {
        debug('[ControlBarManager] _calculatePlayButtonTextLayout called with:', 'ui', text);
        debug('[ControlBarManager] TEXT TYPE:', 'ui', typeof text, 'VALUE:', JSON.stringify(text));
        
        // Special case: "BUY" - show buy-in amount on second line (check FIRST, before other validations)
        const textUpper = String(text || '').trim().toUpperCase();
        debug('[ControlBarManager] BUY CHECK v4 - textUpper:', 'ui', JSON.stringify(textUpper), '=== "BUY"?', textUpper === "BUY");
        if (textUpper === "BUY") {
            
            // Check config option - if false, show single-line "BUY" (matching RESET style)
            const showBuyinAmount = GameConfig.game.SHOW_PLAYBUTTON_BUYIN_AMOUNT !== false; // Default to true if not set
            if (!showBuyinAmount) {
                debug('[ControlBarManager] SHOW_PLAYBUTTON_BUYIN_AMOUNT is false, showing single-line "BUY"', 'ui');
                // Use same style as RESET - single line, centered, default text scale
                if (!buttonResult || !buttonResult.background) {
                    return {
                        isMultiLine: false,
                        textLines: [{ text: "BUY", percentY: 0.5, textScale: DEFAULT_PLAY_BUTTON_TEXT_SCALE, textStyle: { shadow: { offsetX: 7, offsetY: 9, color: "#000000ff" } } }]
                    };
                }
                return {
                    isMultiLine: false,
                    textLines: [{ text: "BUY", percentY: 0.5, textScale: DEFAULT_PLAY_BUTTON_TEXT_SCALE, textStyle: { shadow: { offsetX: 7, offsetY: 9, color: "#000000ff" } } }]
                };
            }
            
            // Show multiline "BUY" + amount (original behavior)
            if (!buttonResult || !buttonResult.background) {
                debug('[ControlBarManager] No buttonResult, using fallback', 'ui');
                const betAmount = this._effectiveBuyInMinor(100);
                const betAmountFormatted = formatBuyInMinorForDisplayWithSymbol(betAmount);
                // Use moderate scale for BUY, smaller for amount
                return {
                    isMultiLine: true,
                    textLines: [
                        { text: "BUY", percentY: 0.34, textScale: 0.48, textStyle: { shadow: { offsetX: 7, offsetY: 9, color: "#000000ff" } } },
                        { text: betAmountFormatted, percentY: 0.74, textScale: 0.3 }
                    ]
                };
            }
            
            const baseButtonWidth = buttonResult.background.width;
            const baseButtonHeight = buttonResult.background.height;
            const padding = 30;
            
            debug('[ControlBarManager] Detected "BUY" pattern, adding buy-in amount', 'ui');
            const betAmount = this._effectiveBuyInMinor(100);
            const betAmountFormatted = formatBuyInMinorForDisplayWithSymbol(betAmount);
            const line1 = "BUY";
            const line2 = betAmountFormatted;
            
            // Calculate separate scales: larger for "BUY", smaller for amount
            // Calculate max scale for "BUY" alone (larger)
            const buyScale = this._calculateMaxFontSizeForTwoLines(line1, "", baseButtonWidth, baseButtonHeight, padding * 0.5);
            // Calculate max scale for amount alone (smaller)
            const amountScale = this._calculateMaxFontSizeForTwoLines("", line2, baseButtonWidth, baseButtonHeight, padding * 0.5);
            // Use moderate scale for BUY (around 0.48), smaller for amount (0.3 or calculated)
            // MUST match createPlayButton() and updatePlayButtonText() exactly
            const buyTextScale = Math.min(0.48, buyScale); // Use calculated scale, but cap at 0.48
            const amountTextScale = Math.min(0.3, amountScale * 0.8); // Make amount 20% smaller than calculated, max 0.3
            
            debug(`[ControlBarManager] BUY scale: ${buyTextScale.toFixed(3)}, amount scale: ${amountTextScale.toFixed(3)}`, 'ui');
            return {
                isMultiLine: true,
                textLines: [
                    { text: line1, percentY: 0.34, textScale: buyTextScale, textStyle: { shadow: { offsetX: 7, offsetY: 9, color: "#000000ff" } } },
                    { text: line2, percentY: 0.74, textScale: amountTextScale }
                ]
            };
        }
        
        // Get button dimensions for calculations
        // Use base dimensions (not display) because text will be scaled by the container
        // background.width/height are the base dimensions before container scaling
        const baseButtonWidth = buttonResult ? buttonResult.background.width : 200;
        const baseButtonHeight = buttonResult ? buttonResult.background.height : 100;
        const padding = 30;
        const defaultTextScale = 0.4;

        // AUTO + SCRATCH (Playing / until RESET): two lines, same font size; wider vertical spread
        if (textUpper === "AUTO") {
            const line1 = "AUTO";
            const line2 = "SCRATCH";
            const autoLineGap = 0.42; // percentY 0.29 / 0.71 → keep sizing in sync with placement
            const optimalScale = this._calculateMaxFontSizeForTwoLines(line1, line2, baseButtonWidth, baseButtonHeight, padding * 0.5, autoLineGap);
            const sharedScale = Math.min(0.45, optimalScale);
            const shadowStyle = { shadow: { offsetX: 7, offsetY: 9, color: "#000000ff" } };
            return {
                isMultiLine: true,
                textLines: [
                    { text: line1, percentY: 0.29, textScale: sharedScale, textStyle: shadowStyle },
                    { text: line2, percentY: 0.71, textScale: sharedScale, textStyle: shadowStyle }
                ]
            };
        }
        
        // Get theme font
        const fontFamily = this.scene.theme?.fonts?.button?.fontFamily || "Lato-Bold";
        const themeFontFamily = FontUtils.getSafeFontFamily(fontFamily);

        // Special case: Always split "STOP X" pattern
        if (text && text.includes(' ')) {
            debug('[ControlBarManager] Detected space in text, attempting 2-line split', 'ui');
            const [line1, line2] = this._splitTextForTwoLines(text);
            if (line2) {
                // Use much less padding for "STOP X" pattern to allow larger text
                // Use only 50% of padding to maximize available space
                const optimalScale = this._calculateMaxFontSizeForTwoLines(line1, line2, baseButtonWidth, baseButtonHeight, padding * 0.5);
                debug(`[ControlBarManager] Optimal scale for "STOP X": ${optimalScale.toFixed(3)}`, 'ui');
                return {
                    isMultiLine: true,
                    textLines: [
                        { text: line1, percentY: 0.3, textScale: optimalScale, textStyle: { shadow: { offsetX: 7, offsetY: 9, color: "#000000ff" } } },
                        { text: line2, percentY: 0.7, textScale: optimalScale }
                    ]
                };
            }
        }

        // Measure text at default size
        const defaultFontSize = Math.round(baseButtonHeight * defaultTextScale);
        const tempStyle = {
            fontFamily: themeFontFamily,
            fontSize: `${defaultFontSize}px`,
            fontStyle: "bold",
            stroke: "#000000ff"
        };

        const tempText = this.scene.add.text(0, 0, text, tempStyle);
        const textWidth = tempText.width;
        tempText.destroy();

        const availableWidth = baseButtonWidth - padding;

        debug(`[ControlBarManager] Measurement: baseButtonWidth=${baseButtonWidth.toFixed(1)}, textWidth=${textWidth.toFixed(1)}, availableWidth=${availableWidth.toFixed(1)}`, 'ui');

        if (textWidth <= availableWidth) {
            debug(`[ControlBarManager] "${text}" fits in single line`, 'ui');
            return {
                isMultiLine: false,
                textLines: [{ text: text, percentY: 0.5, textScale: defaultTextScale, textStyle: { shadow: { offsetX: 7, offsetY: 9, color: "#000000ff" } } }]
            };
        }

        // Text doesn't fit, calculate 2-line layout
        debug(`[ControlBarManager] "${text}" doesn't fit, splitting to 2 lines`, 'ui');
        const [line1, line2] = this._splitTextForTwoLines(text);
        debug(`[ControlBarManager] Split result: ["${line1}", "${line2}"]`, 'ui');

        if (!line2 || line2.trim() === '') {
            const reducedScale = Math.min(defaultTextScale, (availableWidth / textWidth) * defaultTextScale);
            return {
                isMultiLine: false,
                textLines: [{ text: line1, percentY: 0.5, textScale: Math.max(0.2, reducedScale), textStyle: { shadow: { offsetX: 7, offsetY: 9, color: "#000000ff" } } }]
            };
        }

        // Use much reduced padding for 2-line layout to allow larger text
        // Use only 50% of padding to maximize available space
        const optimalScale = this._calculateMaxFontSizeForTwoLines(line1, line2, baseButtonWidth, baseButtonHeight, padding * 0.5);
        debug(`[ControlBarManager] Optimal scale for 2-line layout: ${optimalScale.toFixed(3)}`, 'ui');
        return {
            isMultiLine: true,
            textLines: [
                { text: line1, percentY: 0.25, textScale: optimalScale, textStyle: { shadow: { offsetX: 7, offsetY: 9, color: "#000000ff" } } },
                { text: line2, percentY: 0.75, textScale: optimalScale }
            ]
        };
    }

    /**
     * Create text lines for play button
     * @private
     */
    _createPlayButtonTextLines(textLines, buttonResult) {
        debug('[ControlBarManager] _createPlayButtonTextLines called with', 'ui', textLines.length, 'lines');
        
        if (!textLines || textLines.length === 0) return [];

        // Use base height (not display) for font size calculation
        // background.height is the base dimension before container scaling
        // The text will be scaled by the container, so we calculate font size based on base height
        // This ensures text always takes up the same percentage of button height regardless of layout
        const baseButtonHeight = buttonResult?.background?.height || 150;
        const theme = this.scene.themeData || (this.scene.prefab_ScratchManager && this.scene.prefab_ScratchManager.themeData);
        const fontConfig = theme?.controlBar?.font || theme?.controlBar?.fontFamily || "Lato-Bold";
        const { fontFamily, fontWeight } = FontUtils.getFontFamily(fontConfig, theme);
        const themeFontFamily = FontUtils.getSafeFontFamily(fontFamily);

        const textObjects = [];

        textLines.forEach((line, index) => {
            if (!line.text || line.text.trim() === '') {
                return;
            }

            debug(`[ControlBarManager] Creating line ${index}: "${line.text}", percentY=${line.percentY}, textScale=${line.textScale}`, 'ui');

            // Calculate font size based on base height (before container scaling)
            // The container will scale the text, so we use base height to ensure text always
            // takes up the same percentage of button height regardless of layout
            const calculatedFontSize = Math.round(baseButtonHeight * line.textScale);
            const fontSize = `${calculatedFontSize}px`;

            // Ensure Lato-Bold is used for play button text (Buy, AUTO SCRATCH, etc.)
            // Use the theme font if specified, otherwise default to Lato-Bold
            let finalFontFamily = themeFontFamily;
            if (!theme?.controlBar?.font && !theme?.controlBar?.fontFamily) {
                // No theme font specified, explicitly use Lato-Bold
                finalFontFamily = "Lato-Bold";
            }

            const defaultTextStyle = {
                align: "center",
                color: "#ffffffff",
                fontFamily: finalFontFamily,
                fontSize: fontSize,
                fontStyle: "bold",
                stroke: "#000000ff",
                ...line.textStyle
            };

            if (fontWeight) {
                defaultTextStyle.fontWeight = parseInt(fontWeight) || null;
            }

            const textObj = this.scene.add.text(0, 0, line.text, {});
            textObj.setOrigin(0.5, 0.5);
            textObj.setStyle(defaultTextStyle);
            // Position based on base height (container coordinates)
            textObj.y = (line.percentY - 0.5) * baseButtonHeight;

            const contentColor = theme?.controlBar?.palette?.secondaryColor || "#ffffff";
            const contentColorStr = typeof contentColor === 'string' ? contentColor : String(contentColor || '#ffffff');
            const contentColorHex = contentColorStr.replace("#", "").substring(0, 6);
            const contentColorHexString = `#${contentColorHex}`;
            textObj.setStyle({ color: contentColorHexString });

            // Add text to the button's container (not always this.playButton)
            // buttonResult.container is the correct container for the button
            const targetContainer = buttonResult?.container || this.playButton;
            targetContainer.add(textObj);
            textObjects.push(textObj);
        });

        return textObjects;
    }

    /**
     * Update play button text
     * @param {string} text - Text to display on the button
     */
    updatePlayButtonText(text) {
        debug('[ControlBarManager] updatePlayButtonText called with:', 'ui', text, typeof text);
        
        if (!this.playButton) {
            debug('[ControlBarManager] No playButton, returning early', 'ui');
            return;
        }
        
        // SPECIAL HANDLING FOR BUY - Check FIRST before anything else
        const textUpper = String(text || '').trim().toUpperCase();
        debug('[ControlBarManager] BUY CHECK - Original text:', 'ui', JSON.stringify(text), 'textUpper:', JSON.stringify(textUpper), '=== "BUY"?', textUpper === "BUY");
        
        if (textUpper === "BUY") {
            // Check config option - if false, show single-line "BUY" (matching RESET style)
            const showBuyinAmount = GameConfig.game.SHOW_PLAYBUTTON_BUYIN_AMOUNT !== false; // Default to true if not set
            if (!showBuyinAmount) {
                debug('[ControlBarManager] SHOW_PLAYBUTTON_BUYIN_AMOUNT is false, showing single-line "BUY"', 'ui');
                // Let it fall through to normal text handling which will show single-line "BUY" with default scale
                // (same as RESET)
            } else {
                debug('[ControlBarManager] *** BUY DETECTED IN updatePlayButtonText - FORCING MULTILINE ***', 'ui');
                const buttonResult = this.playButton.buttonResult;
                if (!buttonResult || !buttonResult.background) {
                    debug('[ControlBarManager] No buttonResult for BUY, skipping', 'ui');
                    return;
                }
                
                // Check if BUY text is already correctly displayed - if so, skip recalculation to maintain consistency
                const currentDimensions = {
                    width: buttonResult.background.width,
                    height: buttonResult.background.height,
                    scaleX: this.playButton.scaleX || 1.0,
                    scaleY: this.playButton.scaleY || 1.0
                };
                
                // If text is already "BUY" and dimensions match (including scale), skip update to prevent visual changes
                // IMPORTANT: Also check scaleX/scaleY because layout changes scale buttons without changing base width/height
                if (this._lastPlayButtonText === text) {
                    const dimensionsMatch = this._lastPlayButtonDimensions &&
                        this._lastPlayButtonDimensions.width === currentDimensions.width &&
                        this._lastPlayButtonDimensions.height === currentDimensions.height &&
                        Math.abs((this._lastPlayButtonDimensions.scaleX || 1.0) - currentDimensions.scaleX) < 0.001 &&
                        Math.abs((this._lastPlayButtonDimensions.scaleY || 1.0) - currentDimensions.scaleY) < 0.001;
                    
                    if (dimensionsMatch) {
                        debug('[ControlBarManager] BUY text already displayed correctly, skipping update to maintain consistency', 'ui');
                        return;
                    }
                }
                
                const betAmount = this._effectiveBuyInMinor(100);
                const betAmountFormatted = formatBuyInMinorForDisplayWithSymbol(betAmount);
                debug('[ControlBarManager] BUY - betAmount:', 'ui', betAmount, 'formatted:', betAmountFormatted);
                
                // Clear ALL existing text objects - be very thorough
                const existingText = [];
                
                // Get text from buttonResult.textContent
                if (buttonResult.textContent) {
                    if (Array.isArray(buttonResult.textContent)) {
                        existingText.push(...buttonResult.textContent);
                    } else {
                        existingText.push(buttonResult.textContent);
                    }
                }
                
                // Get ALL text objects from the container (including initial "BUY" text)
                if (this.playButton && this.playButton.list) {
                    this.playButton.list.forEach(child => {
                        if (child instanceof Phaser.GameObjects.Text && !existingText.includes(child)) {
                            existingText.push(child);
                        }
                    });
                }
                
                // Also check container's children recursively
                if (this.playButton && this.playButton.getAll) {
                    const allChildren = this.playButton.getAll('type', 'Text');
                    allChildren.forEach(textObj => {
                        if (!existingText.includes(textObj)) {
                            existingText.push(textObj);
                        }
                    });
                }
                
                // Remove and destroy all text objects
                existingText.forEach(textObj => {
                    if (textObj) {
                        // Remove from container if it's a child
                        if (textObj.parentContainer === this.playButton) {
                            this.playButton.remove(textObj, true);
                        } else if (textObj.scene) {
                            // Destroy if it exists but isn't in container
                            textObj.destroy();
                        }
                    }
                });
                
                // Clear buttonResult.textContent reference
                buttonResult.textContent = null;
                
                // Create multiline layout directly
                // Use base dimensions (not display) because text will be scaled by container
                // background.width/height are the base dimensions before container scaling
                const baseButtonWidth = buttonResult.background.width;
                const baseButtonHeight = buttonResult.background.height;
                const padding = 30;
                const line1 = "BUY";
                const line2 = betAmountFormatted;
                
                // Calculate separate scales: larger for "BUY", smaller for amount
                // Calculate max scale for "BUY" alone (larger)
                const buyScale = this._calculateMaxFontSizeForTwoLines(line1, "", baseButtonWidth, baseButtonHeight, padding * 0.5);
                // Calculate max scale for amount alone (smaller)
                const amountScale = this._calculateMaxFontSizeForTwoLines("", line2, baseButtonWidth, baseButtonHeight, padding * 0.5);
                // Use moderate scale for BUY (around 0.48), smaller for amount (0.3 or calculated)
                // MUST match createPlayButton() exactly to ensure identical appearance in both states
                const buyTextScale = Math.min(0.48, buyScale); // Use calculated scale, but cap at 0.48
                const amountTextScale = Math.min(0.3, amountScale * 0.8); // Make amount 20% smaller than calculated, max 0.3
                
                debug(`[ControlBarManager] BUY scale: ${buyTextScale.toFixed(3)}, amount scale: ${amountTextScale.toFixed(3)}`, 'ui');
                
                const textLines = [
                    { text: line1, percentY: 0.34, textScale: buyTextScale, textStyle: { shadow: { offsetX: 7, offsetY: 9, color: "#000000ff" } } },
                    { text: line2, percentY: 0.74, textScale: amountTextScale }
                ];
                
                const textObjects = this._createPlayButtonTextLines(textLines, buttonResult);
                if (textObjects.length > 0) {
                    buttonResult.textContent = textObjects.length === 1 ? textObjects[0] : textObjects;
                }
                
                // Update cache
                this._lastPlayButtonText = text;
                this._lastPlayButtonDimensions = {
                    width: baseButtonWidth,
                    height: baseButtonHeight,
                    scaleX: this.playButton.scaleX || 1.0,
                    scaleY: this.playButton.scaleY || 1.0
                };
                
                debug('[ControlBarManager] BUY multiline created:', 'ui', textObjects.length, 'text objects');
                return;
            }
        }
        
        const buttonResult = this.playButton.buttonResult;
        if (!buttonResult || !buttonResult.background) {
            debug('[ControlBarManager] No buttonResult or background, using simple text update', 'ui');
            // Fallback to simple text update
            if (buttonResult && buttonResult.textContent) {
                const textContent = buttonResult.textContent;
                if (textContent instanceof Phaser.GameObjects.Text && typeof textContent.setText === 'function') {
                    textContent.setText(text);
                }
            }
            return;
        }
        
        // Check if dimensions or scale changed
        // Scale changes require text recreation to prevent blurriness
        const currentDimensions = {
            width: buttonResult.background.width,
            height: buttonResult.background.height,
            scaleX: this.playButton.scaleX || 1.0,
            scaleY: this.playButton.scaleY || 1.0
        };
        
        const dimensionsChanged = !this._lastPlayButtonDimensions || 
            this._lastPlayButtonDimensions.width !== currentDimensions.width ||
            this._lastPlayButtonDimensions.height !== currentDimensions.height ||
            Math.abs((this._lastPlayButtonDimensions.scaleX || 1.0) - currentDimensions.scaleX) > 0.001 ||
            Math.abs((this._lastPlayButtonDimensions.scaleY || 1.0) - currentDimensions.scaleY) > 0.001;
        
        // Always recreate text if dimensions or scale changed, even if text is the same
        // This prevents blurry text when buttons are resized during layout changes
        // Also force recreation if _forceTextRecreation flag is set (used during layout changes)
        if (this._lastPlayButtonText === text && !dimensionsChanged && !this._forceTextRecreation) {
            debug('[ControlBarManager] Text and dimensions unchanged, skipping update', 'ui');
            return;
        }
        
        if (this._forceTextRecreation) {
            debug('[ControlBarManager] Forcing text recreation due to layout change', 'ui');
        }
        
        // Calculate layout for the new text
        const layout = this._calculatePlayButtonTextLayout(text, buttonResult);
        
        // Clear existing text
        const existingText = [];
        if (buttonResult.textContent) {
            if (Array.isArray(buttonResult.textContent)) {
                existingText.push(...buttonResult.textContent);
            } else {
                existingText.push(buttonResult.textContent);
            }
        }
        // Also check container children
        if (this.playButton.list) {
            this.playButton.list.forEach(child => {
                if (child instanceof Phaser.GameObjects.Text && !existingText.includes(child)) {
                    existingText.push(child);
                }
            });
        }
        
        // Remove and destroy all existing text objects
        existingText.forEach(textObj => {
            if (textObj) {
                if (textObj.parentContainer === this.playButton) {
                    this.playButton.remove(textObj, true);
                } else if (textObj.scene) {
                    textObj.destroy();
                }
            }
        });
        
        // Clear buttonResult.textContent reference
        buttonResult.textContent = null;
        
        // Create text lines based on layout
        const textObjects = this._createPlayButtonTextLines(layout.textLines, buttonResult);
        debug('[ControlBarManager] Created', 'ui', textObjects.length, 'text objects');
        
        // Update buttonResult.textContent
        if (textObjects.length > 0) {
            buttonResult.textContent = textObjects.length === 1 ? textObjects[0] : textObjects;
        }
        
        // Update cache
        this._lastPlayButtonText = text;
        this._lastPlayButtonDimensions = currentDimensions;
    }
    
    /**
     * Recreate speed button text after layout changes
     * This ensures text is recreated at the correct size for the current button display size
     * @private
     */
    _recreateSpeedButtonText() {
        if (!this.speedButton) {
            debug(`[ControlBarManager] _recreateSpeedButtonText: speedButton not available`, 'ui');
            return;
        }
        
        const buttonResult = this.speedButton;
        if (!buttonResult || !buttonResult.background || !buttonResult.container) {
            debug(`[ControlBarManager] _recreateSpeedButtonText: buttonResult invalid`, 'ui');
            return;
        }
        
        // Get current speed value from existing text
        let currentSpeed = 1;
        if (this.speedButtonText && this.speedButtonText.text) {
            const speedText = this.speedButtonText.text || '';
            const speedMatch = speedText.match(/x(\d+)/);
            if (speedMatch) {
                currentSpeed = parseInt(speedMatch[1]);
            }
        } else {
            // Fallback: get from prefab_ScratchManager
            currentSpeed = this.scene.peelManager?.speed ?? GameConfig.game.START_SPEED ?? 1;
        }
        
        // Clear existing text
        if (buttonResult.textContent) {
            const textContent = Array.isArray(buttonResult.textContent) 
                ? buttonResult.textContent 
                : [buttonResult.textContent];
            textContent.forEach(textObj => {
                if (textObj && textObj.parentContainer === buttonResult.container) {
                    buttonResult.container.remove(textObj, true);
                }
            });
            buttonResult.textContent = null;
        }
        this.speedButtonText = null;
        
        // Recreate text using _createPlayButtonTextLines with current display size
        const textLines = [
            {text: 'Speed', percentY: 0.234, textScale: 0.2},
            {text: `x${currentSpeed}`, percentY: 0.62, textScale: 0.5}
        ];
        const newTextObjects = this._createPlayButtonTextLines(textLines, buttonResult);
        if (newTextObjects.length > 0) {
            buttonResult.textContent = newTextObjects.length === 1 ? newTextObjects[0] : newTextObjects;
            this.speedButtonText = newTextObjects[1] || newTextObjects[0] || null;
        }
        
        debug(`[ControlBarManager] _recreateSpeedButtonText: Recreated speed button text at current display size`, 'ui');
    }
    
    /**
     * Get header configuration from layout config
     * @returns {Object|null} Header config or null if not provided
     * @private
     */
    _getHeaderConfig() {
        if (!this.scene.layoutManager) {
            return null;
        }
        
        const layoutName = this.scene.layoutManager.getCurrentLayoutName();
        if (!layoutName) {
            return null;
        }
        
        const { uiConfig, baseUIConfig } = getLayoutConfigs(this.scene.layoutManager, layoutName);
        return getHeaderConfig(uiConfig, baseUIConfig);
    }
    
    /**
     * Create header text fields (winText, betText, balanceText) above the control bar
     * @param {Object} layoutPositions - Layout positions object with headerPositions
     */
    createHeaderTextFields(layoutPositions) {
        if (!layoutPositions || !layoutPositions.headerPositions) {
            debug(`[ControlBarManager] No header positions in layoutPositions, skipping header creation`, 'ui');
            return;
        }
        
        const headerPositions = layoutPositions.headerPositions;
        const headerConfig = this._getHeaderConfig();
        
        if (!headerConfig) {
            debug(`[ControlBarManager] No header config found, skipping header creation`, 'ui');
            return;
        }
        
        // Get list of items from config (supports 0-3 items)
        const items = this._getHeaderItemsList();
        const fontSize = headerConfig.fontSize || 21;
        const lines = headerConfig.lines || 1;
        
        // Get list of registered header items
        const registeredItems = this._getRegisteredHeaderItems();
        
        // Update visibility for all registered header items (similar to layoutGroups)
        for (const itemName of registeredItems) {
            const isInConfig = items.includes(itemName);
            let textField = null;
            
            if (itemName === 'winText') {
                textField = this.headerWinText;
            } else if (itemName === 'betText') {
                textField = this.headerBetText;
            } else if (itemName === 'balanceText') {
                textField = this.headerBalanceText;
            }
            
            // Check if field exists and has setVisible method
            if (textField && typeof textField.setVisible === 'function') {
                // Update visibility (show/hide) instead of destroying
                textField.setVisible(isInConfig);
            }
        }
        
        // Update positions and create missing fields for each item in the config
        for (let i = 0; i < items.length; i++) {
            const itemName = items[i];
            const position = headerPositions[itemName];
            
            if (!position) {
                warn(`[ControlBarManager] No position found for header item: ${itemName}`, 'ui');
                continue;
            }
            
            // Get existing field if it exists
            let textField = null;
            if (itemName === 'winText') {
                textField = this.headerWinText;
            } else if (itemName === 'betText') {
                textField = this.headerBetText;
            } else if (itemName === 'balanceText') {
                textField = this.headerBalanceText;
            }
            
            debug(`[ControlBarManager] createHeaderTextFields: Processing ${itemName}, hasTextField=${!!textField}, textFieldActive=${!!(textField && textField.active)}`, 'ui');
            
            // Determine origin based on alignment pattern (matches layoutGroups row alignment)
            // - 1 item: center (originX = 0.5)
            // - 2 items: left (originX = 0), right (originX = 1)
            // - 3 items: left (originX = 0), center (originX = 0.5), right (originX = 1)
            // - 4+ items: first left (originX = 0), last right (originX = 1), others center (originX = 0.5)
            let originX;
            if (items.length === 1) {
                originX = 0.5;
            } else if (items.length === 2) {
                originX = i === 0 ? 0 : 1;
            } else if (items.length === 3) {
                originX = i === 0 ? 0 : (i === 1 ? 0.5 : 1);
            } else {
                if (i === 0) {
                    originX = 0;
                } else if (i === items.length - 1) {
                    originX = 1;
                } else {
                    originX = 0.5;
                }
            }
            
            // Determine text alignment
            let textAlign;
            if (lines === 2) {
                textAlign = 'center';
            } else {
                if (originX === 0) {
                    textAlign = 'left';
                } else if (originX === 1) {
                    textAlign = 'right';
                } else {
                    textAlign = 'center';
                }
            }
            
            // Check if field exists and has required methods (similar to layoutGroups positioning)
            // Phaser Text objects might not always have 'active' property, so check for existence and setPosition method
            const fieldExists = textField !== null && textField !== undefined;
            const hasSetPosition = fieldExists && typeof textField.setPosition === 'function';
            
            if (fieldExists && hasSetPosition) {
                // Field exists - update position and alignment (similar to layoutControlBar)
                // Update position first (critical for resize events)
                const oldX = textField.x || 0;
                const oldY = textField.y || 0;
                
                debug(`[ControlBarManager] Updating header field ${itemName}: position (${oldX.toFixed(1)}, ${oldY.toFixed(1)}) -> (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`, 'ui');
                
                textField.setPosition(position.x, position.y);
                textField.setOrigin(originX, 1);
                textField.setVisible(true);
                
                // Update text alignment if it changed
                const currentAlign = textField.style?.align;
                if (currentAlign !== textAlign) {
                    textField.setStyle({ align: textAlign });
                }
                
                // Update fontSize if it changed
                const currentFontSize = parseInt(textField.style?.fontSize) || fontSize;
                if (currentFontSize !== fontSize) {
                    textField.setStyle({ fontSize: `${fontSize}px` });
                }
                
                // Update color and stroke if theme changed
                const theme = this.scene.themeData || (this.scene.prefab_ScratchManager && this.scene.prefab_ScratchManager.themeData);
                const headerConfig = theme?.controlBar?.header;
                const headerColor = this._resolveThemeHeaderTextColor(headerConfig);
                const strokeColor = headerConfig?.stroke?.color || '#000000';
                const strokeWidth = headerConfig?.stroke?.lineWidth ?? 0;
                
                const currentColor = textField.style?.color || '#ffffff';
                const currentStroke = textField.style?.stroke || '#000000';
                const currentStrokeWidth = textField.style?.strokeThickness || 0;
                
                if (currentColor !== headerColor || currentStroke !== strokeColor || currentStrokeWidth !== strokeWidth) {
                    textField.setStyle({ 
                        color: headerColor,
                        stroke: strokeColor,
                        strokeThickness: strokeWidth
                    });
                }
                
                // Update text format with new lines value when layout changes
                // This ensures the text is reformatted (1-line vs 2-line) when switching layouts
                if (itemName === 'winText') {
                    // Get current win amount from scratch manager results, default to 0
                    const winAmountPennies = this.scene.prefab_ScratchManager?.scratchCardResults?.payoutMinor || 0;
                    this.updateHeaderWinText(winAmountPennies);
                } else if (itemName === 'betText') {
                    this.updateHeaderBetText();
                } else if (itemName === 'balanceText') {
                    const balancePennies = this.scene.balancePennies || 0;
                    this.updateHeaderBalanceText(balancePennies, false);
                }
            } else {
                // Field doesn't exist or doesn't have required methods - create it
                debug(`[ControlBarManager] Creating header field ${itemName} (fieldExists=${fieldExists}, hasSetPosition=${hasSetPosition})`, 'ui');
                
                let initialText = '';
                if (itemName === 'winText') {
                    initialText = this._formatHeaderText('Win:', formatMinorForDisplayWithSymbol(0), lines);
                } else if (itemName === 'betText') {
                    const creditValueMinor = this._effectiveBuyInMinor(0);
                    initialText = this._formatHeaderText('Buy:', formatBuyInMinorForDisplayWithSymbol(creditValueMinor), lines);
                } else if (itemName === 'balanceText') {
                    const balancePennies = this.scene.balancePennies || 0;
                    initialText = this._formatHeaderText('Balance:', formatBalanceMinorForDisplayWithSymbol(balancePennies), lines);
                } else {
                    initialText = itemName;
                }
                
                // Get header config from theme (color, stroke color, stroke width)
                const theme = this.scene.themeData || (this.scene.prefab_ScratchManager && this.scene.prefab_ScratchManager.themeData);
                const headerConfig = theme?.controlBar?.header;
                const headerColor = this._resolveThemeHeaderTextColor(headerConfig);
                const strokeColor = headerConfig?.stroke?.color || '#000000';
                const strokeWidth = headerConfig?.stroke?.lineWidth ?? 0;
                
                const textStyle = {
                    fontFamily: 'Lato-Bold',
                    fontSize: `${fontSize}px`,
                    color: headerColor,
                    align: textAlign
                };
                
                // Only add stroke properties if strokeWidth is greater than 0
                if (strokeWidth > 0) {
                    textStyle.stroke = strokeColor;
                    textStyle.strokeThickness = strokeWidth;
                }
                
                textField = this.scene.add.text(position.x, position.y, initialText, textStyle);
                
                textField.setOrigin(originX, 1);
                textField.setDepth(10);
                textField.setVisible(true);
                
                // Store references
                if (itemName === 'winText') {
                    this.headerWinText = textField;
                } else if (itemName === 'betText') {
                    this.headerBetText = textField;
                } else if (itemName === 'balanceText') {
                    this.headerBalanceText = textField;
                }
                
                // Add to headerTextFields array if not already there
                if (!this.headerTextFields.includes(textField)) {
                    this.headerTextFields.push(textField);
                }
            }
        }
        
        // Update headerTextFields array to only include valid fields that are in the config
        if (this.headerTextFields && this.headerTextFields.length > 0) {
            this.headerTextFields = this.headerTextFields.filter(textField => {
                // Check if field exists and has required methods (not just 'active')
                if (!textField || typeof textField.setPosition !== 'function') {
                    return false;
                }
                const fieldName = textField === this.headerWinText ? 'winText' :
                                 textField === this.headerBetText ? 'betText' :
                                 textField === this.headerBalanceText ? 'balanceText' : null;
                return fieldName && items.includes(fieldName);
            });
        } else {
            this.headerTextFields = [];
        }
        
        debug(`[ControlBarManager] Created/updated ${this.headerTextFields.length} header text fields with fontSize=${fontSize}`, 'ui');
    }
    
    /**
     * Format header text with label and value based on lines setting
     * @param {string} label - Label text (e.g., "Win:", "Buy:", "Balance:")
     * @param {string} value - Value text (e.g., "$0", "$1", "$1,000")
     * @param {number} [lines] - Number of lines (1 or 2, defaults to 1)
     * @returns {string} Formatted text
     * @private
     */
    _formatHeaderText(label, value, lines = 1) {
        if (lines === 2) {
            return `${label}\n${value}`;
        }
        return `${label} ${value}`;
    }
    
    /**
     * Buy-in (minor units) for UI: prefer BalanceService after Level.create() session sync, else game config, else fallback.
     * @param {number} fallbackMinor
     * @returns {number}
     * @private
     */
    _effectiveBuyInMinor(fallbackMinor) {
        const fromService = this.scene?.balanceService?.betAmountPennies;
        if (fromService != null && fromService > 0) {
            return fromService;
        }
        const fromConfig = gameConfig.creditValueMinor;
        if (fromConfig != null && fromConfig > 0) {
            return fromConfig;
        }
        return fallbackMinor;
    }
    
    /**
     * Update header bet text with creditValueMinor from game config
     */
    updateHeaderBetText() {
        if (!this.headerBetText) {
            return;
        }
        
        const headerConfig = this._getHeaderConfig();
        const lines = headerConfig?.lines || 1;
        const creditValueMinor = this._effectiveBuyInMinor(0);
        this.headerBetText.setText(this._formatHeaderText('Buy:', formatBuyInMinorForDisplayWithSymbol(creditValueMinor), lines));
    }
    
    /**
     * Update header balance text
     * @param {number} balancePennies - Balance in pennies
     * @param {boolean} animate - Whether to animate the change (default: false)
     * @param {number} startValue - Starting value for animation (default: current balance)
     */
    /**
     * @param {number} balancePennies
     * @param {boolean} animate
     * @param {number|null} [startValue]
     * @param {boolean} stopLoopingSfxWhenComplete - e.g. after win payout tally (@see Scratch PointsCountUp)
     */
    updateHeaderBalanceText(balancePennies, animate = false, startValue = null, stopLoopingSfxWhenComplete = false) {
        if (!this.headerBalanceText) {
            return;
        }
        
        const headerConfig = this._getHeaderConfig();
        const lines = headerConfig?.lines || 1;
        
        if (animate) {
            // Animate balance change (similar to balanceTextArea)
            const startingBalance = startValue !== null && startValue !== undefined ? startValue : (this.scene.balancePennies || 0);
            
            // Stop any existing tween
            if (this.headerBalanceText.tween) {
                this.headerBalanceText.tween.stop();
            }
            
            const scene = this.scene;
            this.headerBalanceText.tween = animateNumber(
                this.scene,
                this.headerBalanceText,
                balancePennies,
                1000, // Duration matches PointsCountUp
                {
                    startValue: startingBalance,
                    formatter: (val) => this._formatHeaderText('Balance:', formatBalanceMinorForDisplayWithSymbol(Math.floor(val)), lines),
                    onComplete: stopLoopingSfxWhenComplete
                        ? () => scene.audioService?.stopLoopingSfx()
                        : undefined,
                }
            );
        } else {
            // Update immediately without animation
            this.headerBalanceText.setText(this._formatHeaderText('Balance:', formatBalanceMinorForDisplayWithSymbol(balancePennies), lines));
        }
    }
    
    /**
     * Update header win text with win amount
     * @param {number} winAmountPennies - Win amount in pennies
     */
    updateHeaderWinText(winAmountPennies) {
        if (!this.headerWinText) {
            return;
        }
        
        const headerConfig = this._getHeaderConfig();
        const lines = headerConfig?.lines || 1;
        this.headerWinText.setText(this._formatHeaderText('Win:', formatMinorForDisplayWithSymbol(winAmountPennies), lines));
    }
}


