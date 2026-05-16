/**
 * Control Bar Background Service
 * Handles creation and updates of the control bar background graphics object
 * 
 * Note: The graphics object (containerBar) draws the visual background rectangle
 * behind control bar elements. It is styled via theme.controlBar.background.
 */

import { getScreenWidth, getScreenHeight } from '../../../utils/viewport/ViewportUtils.js';
import GraphicsUtils from '../../../utils/ui/graphics/GraphicsUtils.js';
import { warn, debug } from '../../../utils/logger/LoggerUtils.js';

export default class ControlBarBackgroundService {
    constructor(scene) {
        this.scene = scene;
        
        // Control bar background graphics object
        this.containerBar = null;
    }

    /**
     * Create or update the control bar background graphics object
     * The background bar extends from the calculated top position (from layout, adjusted for top padding) 
     * to the calculated bottom position (adjusted for bottom padding), using full screen width.
     * Padding extends the background above/below content by configurable percentages of screenHeight.
     * @param {Phaser.GameObjects.Graphics} containerBar - Existing control bar background graphics object
     * @param {Object} layoutPositions - Full LayoutPositions object from layout calculator
     * @returns {Phaser.GameObjects.Graphics} Updated or newly created control bar background graphics object
     */
    createOrUpdateContainerBar(containerBar, layoutPositions, currentWidth, currentHeight) {
        debug(`[ControlBarBackgroundService] createOrUpdateContainerBar called:`, 'layout', {
            hasContainerBar: !!containerBar,
            hasLayoutPositions: !!layoutPositions,
            controlBarBackgroundTop: layoutPositions?.controlBarBackgroundTop,
            bottommostContainerBottom: layoutPositions?.bottommostContainerBottom
        });
        
        // Get control bar background config from theme
        // This project uses scene.themeData or scene.prefab_ScratchManager.themeData
        const themeData = this.scene.themeData || (this.scene.prefab_ScratchManager && this.scene.prefab_ScratchManager.themeData);
        
        // Fallback when theme not yet loaded (layout runs before theme loads)
        const DEFAULT_BACKGROUND = { color: '#000000', alpha: 0.65 };
        let containerBarConfig = themeData?.controlBar?.background;
        
        if (!containerBarConfig) {
            if (!themeData) {
                debug('[ControlBarBackgroundService] No theme data yet, using default background until theme loads', 'layout');
            } else {
                warn('[ControlBarBackgroundService] No controlBar.background config in theme, using default', 'layout');
            }
            containerBarConfig = DEFAULT_BACKGROUND;
        }
        
        // Extract control bar background top and bottom positions from layout positions
        // Use the actual content bounds to match exactly
        const barTop = layoutPositions?.controlBarBackgroundTop;
        const bottommostContainerBottom = layoutPositions?.bottommostContainerBottom;
        
        // CRITICAL: Validate barTop IMMEDIATELY - if invalid, return early before any processing
        // Control bar should never start at y=0 (top of screen) - that's invalid layout
        if (barTop === undefined || barTop === null || isNaN(barTop) || barTop === 0) {
            // Hide existing bar if it exists
            if (containerBar) {
                containerBar.clear(); // Clear any existing drawing
                containerBar.setVisible(false);
            }
            debug(`[ControlBarBackgroundService] barTop is invalid (${barTop}), hiding background until layout is ready`, 'layout');
            return containerBar; // Return existing bar (hidden) or null if doesn't exist yet
        }
        
        // Get screen height to validate barTop is reasonable (at least 10% down the screen)
        let screenHeight;
        if (this.scene.sys && this.scene.sys.game && this.scene.sys.game.canvas) {
            screenHeight = this.scene.sys.game.canvas.height;
        } else if (this.scene.sys && this.scene.sys.game && this.scene.sys.game.scale) {
            screenHeight = this.scene.sys.game.scale.height;
        } else {
            screenHeight = getScreenHeight(this.scene);
        }
        
        // Additional validation: barTop should be at least 10% down the screen (reasonable minimum)
        if (barTop < screenHeight * 0.1) {
            // Hide existing bar if it exists
            if (containerBar) {
                containerBar.clear(); // Clear any existing drawing
                containerBar.setVisible(false);
            }
            debug(`[ControlBarBackgroundService] barTop (${barTop}) is too small (< ${screenHeight * 0.1}), hiding background until layout is ready`, 'layout');
            return containerBar; // Return existing bar (hidden) or null if doesn't exist yet
        }
        
        // Get screen dimensions
        // CRITICAL: If currentWidth/currentHeight are provided, use them directly (they match layout calculation)
        // Otherwise, use the same utilities as layout calculations to ensure consistency
        // This is critical when width decreases - we must use the EXACT same dimensions as the layout
        let width, height;
        
        if (currentWidth != null && currentWidth > 0 && currentHeight != null && currentHeight > 0) {
            // Use provided dimensions - these are the EXACT values from layout calculation
            width = Number(currentWidth);
            height = Number(currentHeight);
            
            // Ensure they're valid numbers
            if (isNaN(width) || isNaN(height)) {
                // Fallback if somehow invalid
                width = getScreenWidth(this.scene);
                height = getScreenHeight(this.scene);
                warn(`[ControlBarBackgroundService] Provided dimensions were NaN, using getScreenWidth/Height()`, 'layout', {
                    providedWidth: currentWidth,
                    providedHeight: currentHeight
                });
            } else {
                debug(`[ControlBarBackgroundService] Using provided dimensions:`, 'layout', {
                    width,
                    height,
                    providedWidth: currentWidth,
                    providedHeight: currentHeight,
                    note: 'These match the layout calculation exactly'
                });
            }
        } else {
            // No valid dimensions provided - use utilities (shouldn't happen in normal flow)
            width = getScreenWidth(this.scene);
            height = getScreenHeight(this.scene);
            
            warn(`[ControlBarBackgroundService] ⚠️ No valid dimensions provided, using getScreenWidth/Height():`, 'layout', {
                providedWidth: currentWidth,
                providedHeight: currentHeight,
                calculatedWidth: width,
                calculatedHeight: height,
                note: 'This may cause dimension mismatch with layout calculation'
            });
            
            // Fallback to canvas dimensions if utilities fail (shouldn't happen, but safety check)
            if ((!width || width <= 0 || !height || height <= 0) && this.scene.sys && this.scene.sys.game && this.scene.sys.game.canvas) {
                width = this.scene.sys.game.canvas.width;
                height = this.scene.sys.game.canvas.height;
            }
            
            // Final fallback to scale dimensions
            if ((!width || width <= 0 || !height || height <= 0) && this.scene.sys && this.scene.sys.game && this.scene.sys.game.scale) {
                width = this.scene.sys.game.scale.width;
                height = this.scene.sys.game.scale.height;
            }
        }
        
        // Always verify against layoutPositions dimensions and warn if mismatch
        // This helps diagnose when layout calculations are using stale dimensions
        if (layoutPositions?.screenWidth !== undefined && layoutPositions?.screenHeight !== undefined) {
            const widthDiff = Math.abs(layoutPositions.screenWidth - width);
            const heightDiff = Math.abs(layoutPositions.screenHeight - height);
            if (widthDiff > 1 || heightDiff > 1) {
                debug(`[ControlBarBackgroundService] ⚠️ LayoutPositions dimensions are stale, using current screen dimensions:`, 'layout', {
                    layoutWidth: layoutPositions.screenWidth,
                    layoutHeight: layoutPositions.screenHeight,
                    currentWidth: width,
                    currentHeight: height,
                    widthDiff,
                    heightDiff,
                    note: 'This may cause bottom padding and right inset to collapse. Layout calculation should use getScreenWidth/Height() directly.'
                });
            }
        }
        
        // Calculate bar dimensions
        // Background bottom is ALWAYS at current screen bottom (height)
        // Bottom padding shifts content up, not background down
        // Use bottommostContainerBottom if provided (it matches layout calculation), otherwise use height
        const barBottom = (bottommostContainerBottom !== undefined && bottommostContainerBottom !== null && !isNaN(bottommostContainerBottom))
            ? bottommostContainerBottom
            : height; // Fallback to screen bottom
        
        // Debug logging with detailed dimension comparison
        debug(`[ControlBarBackgroundService] Background dimensions:`, 'layout', {
            bottommostContainerBottom,
            barBottom,
            height,
            width,
            layoutWidth: layoutPositions?.screenWidth,
            layoutHeight: layoutPositions?.screenHeight,
            widthMatch: Math.abs((layoutPositions?.screenWidth || 0) - width) < 1,
            heightMatch: Math.abs((layoutPositions?.screenHeight || 0) - height) < 1,
            note: 'Background bottom is always at screen bottom. Bottom padding shifts content up instead.'
        });
        
        // Full screen width - extends from left edge (0) to right edge (width), ignoring padding
        // Graphics objects use absolute screen coordinates (top-left origin)
        const barX = 0; // Left edge of screen (ignoring padding)
        const barY = barTop; // Top edge of bar (adjusted for top padding - extends above content)
        let barWidth = width; // Full screen width, extends to right edge (ignoring padding)
        const barHeight = barBottom - barTop; // Height includes top and bottom padding
        
        // Create or update graphics object
        if (containerBar) {
            // Clear and reuse existing graphics object
            containerBar.clear();
        } else {
            // Create new graphics object - start hidden until we have valid layout
            containerBar = this.scene.add.graphics();
            containerBar.setVisible(false); // Start hidden
        }
        
        // Set depth to ensure it's behind control bar elements but above game background
        // Use depth 0 - buttons will be at depth 1 to appear above this
        // The background is added to the scene before buttons are positioned,
        // so even at the same depth it would render first, but we use depth 1 for buttons to be safe
        containerBar.setDepth(0);
        
        // Draw filled rectangle with config color and alpha
        // Graphics objects use absolute screen coordinates (top-left origin)
        // Convert color from hex string to number if needed
        let color = containerBarConfig.color;
        if (typeof color === 'string') {
            // Remove # if present and convert to number
            color = parseInt(color.replace('#', ''), 16);
        } else if (typeof color === 'number') {
            // Color is already a number, use as-is
            // Ensure it's a valid color value (0-0xFFFFFF)
            if (color < 0 || color > 0xFFFFFF) {
                warn(`[ControlBarBackgroundService] Invalid color value: ${color}, using black (0) as fallback`, 'layout');
                color = 0;
            }
        } else {
            // Invalid color type, use black as fallback
            warn(`[ControlBarBackgroundService] Invalid color type: ${typeof color}, using black (0) as fallback`, 'layout');
            color = 0;
        }
        
        // Double-check validation before drawing - prevent drawing if barTop is invalid
        // This is a safety check in case validation was bypassed somehow
        if (barTop === undefined || barTop === null || isNaN(barTop) || barTop === 0 || barTop < screenHeight * 0.1) {
            warn(`[ControlBarBackgroundService] Safety check: barTop is invalid (${barTop}) before drawing, hiding background`, 'layout');
            containerBar.setVisible(false);
            return containerBar;
        }
        
        // CRITICAL: Ensure barWidth uses the exact width value (no rounding or conversion)
        if (Math.abs(barWidth - width) > 0.001) {
            barWidth = width;
        }
        
        debug(`[ControlBarBackgroundService] Drawing background rectangle:`, 'layout', {
            barX,
            barY,
            barWidth,
            barHeight,
            barTop,
            barBottom,
            bottommostContainerBottom: layoutPositions?.bottommostContainerBottom,
            calculation: `barHeight = barBottom - barTop = ${barBottom} - ${barTop} = ${barHeight}`,
            widthUsed: width,
            heightUsed: height,
            currentWidthParam: currentWidth,
            currentHeightParam: currentHeight,
            widthString: String(width),
            barWidthString: String(barWidth)
        });
        
        // Draw rectangle using GraphicsUtils
        // Note: Graphics objects in Phaser use immediate mode rendering
        // The rectangle will be drawn on the next render cycle
        // CRITICAL: Use width directly (not barWidth) to ensure exact value
        GraphicsUtils.fillRect(containerBar, barX, barY, width, barHeight, color, containerBarConfig.alpha);
        
        // Force a render update by setting the graphics object's dirty flag
        // This ensures the graphics are redrawn on the next frame
        if (containerBar.setDirty) {
            containerBar.setDirty();
        }
        
        // Ensure graphics object is visible and in the scene
        containerBar.setVisible(true);
        containerBar.setActive(true);
        
        // Store reference
        this.containerBar = containerBar;
        
        return containerBar;
    }
}

