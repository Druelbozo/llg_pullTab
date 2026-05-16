/**
 * ButtonManager - Manages button interactions for ButtonFactory buttons
 * 
 * Provides hover, press, and disabled state management with robust hit detection
 * that works with nested containers. Uses tinting effects for visual feedback.
 */

import { debug, log, warn, error } from '../../utils/logger/LoggerUtils.js';
import ColorUtils from '../../utils/color/ColorUtils.js';
import HapticUtils from '../../utils/device/HapticUtils.js';
import { GameConfig } from '../../config/Global.js';

export default class ButtonManager {
    constructor(scene, defaultConfig = {}) {
        this.scene = scene;
        this.buttons = new Map(); // Track all managed buttons
        this.isMouseTracking = false;
        
        // Set default configuration for all buttons
        this.defaultConfig = {
            hoverBrightness: 0.2,
            pressDarkness: 0.2,
            hoverScale: 1.05,
            clickScale: 0.95,
            disabledOpacity: 0.4,
            hoverDuration: 200,
            clickDuration: 100,
            ...defaultConfig // Allow override of defaults
        };
        
        // Bind methods to preserve context
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
    }

    /**
     * Register a button created by ButtonFactory
     * @param {Object} buttonResult - Result from ButtonFactory.createButton()
     * @param {Object} config - Button configuration
     * @param {Function} config.onClick - Click callback
     * @param {number} [config.hoverBrightness=0.2] - Brightness increase on hover (0-1)
     * @param {number} [config.pressDarkness=0.2] - Darkness increase on press (0-1)
     * @param {number} [config.hoverScale=1.05] - Scale on hover
     * @param {number} [config.clickScale=0.95] - Scale on press
     * @param {number} [config.disabledOpacity=0.4] - Opacity when disabled
     * @param {number} [config.hoverDuration=200] - Hover animation duration (ms)
     * @param {number} [config.clickDuration=100] - Press animation duration (ms)
     * @param {string} [config.id] - Optional button ID (uses label if not provided)
     * @returns {string} Button ID
     */
    registerButton(buttonResult, config = {}) {
        debug('registerButton called with:', 'ui', {
            hasButtonResult: !!buttonResult,
            hasContainer: !!(buttonResult && buttonResult.container),
            hasNineslice: !!(buttonResult && buttonResult.nineslice),
            hasBackground: !!(buttonResult && buttonResult.background),
            config: config
        });
        
        if (!buttonResult || !buttonResult.container) {
            error('Invalid buttonResult provided:', 'ui', buttonResult);
            return null;
        }

        // Support both nineslice (9-slice) and background (programmatic) button types
        const nineslice = buttonResult.nineslice;
        const background = buttonResult.background;
        const bg = background || nineslice; // Fallback for validation and operations
        
        if (!bg) {
            error('ButtonResult must have either background (programmatic) or nineslice (9-slice):', 'ui', buttonResult);
            return null;
        }
        
        if (!this.scene) {
            error('Scene is not set', 'ui');
            return null;
        }
        
        if (!this.scene.input) {
            error('Scene.input is not available', 'ui');
            return null;
        }

        // Merge provided config with defaults
        const mergedConfig = Object.assign({}, this.defaultConfig, config);
        
        const {
            onClick,
            hoverBrightness,
            pressDarkness,
            hoverScale,
            clickScale,
            disabledOpacity,
            hoverDuration,
            clickDuration,
            id
        } = mergedConfig;

        const buttonId = id || buttonResult.label || `button_${Date.now()}`;
        const container = buttonResult.container;
        const content = buttonResult.content;

        // Get button dimensions from background (nineslice or sprite)
        const width = bg.width || 150;
        const height = bg.height || 150;

        // Get original tint values (if any)
        const originalBackgroundTint = bg.tint || 0xffffff;
        const originalContentTint = content ? (content.tint || 0xffffff) : null;

        // Capture initial scale (respects any scale set before registration)
        // Read scale directly from the container - ensure we get the actual current value
        // Phaser containers have scaleX and scaleY properties that default to 1.0
        let initialScaleX = 1.0;
        let initialScaleY = 1.0;
        
        if (container && typeof container.scaleX === 'number') {
            initialScaleX = container.scaleX;
        }
        if (container && typeof container.scaleY === 'number') {
            initialScaleY = container.scaleY;
        }
        
        // Debug logging to verify scale is captured correctly
        debug(`Registered button '${buttonId}' with initial scale: ${initialScaleX}, ${initialScaleY} (container.scaleX/Y: ${container.scaleX}, ${container.scaleY})`, 'ui');

        // Disable Phaser's built-in interactivity (we handle it ourselves)
        container.disableInteractive();
        if (background) {
            background.disableInteractive();
        }

        // Store button data
        const buttonData = {
            id: buttonId,
            container,
            nineslice,
            background,
            content,
            width,
            height,
            onClick: onClick || (() => {}),
            isHovered: false,
            isPressed: false,
            enabled: true,
            initialScaleX,
            initialScaleY,
            originalBackgroundTint,
            originalContentTint,
            currentBackgroundTint: originalBackgroundTint,
            currentContentTint: originalContentTint,
            animations: {
                hoverBrightness,
                pressDarkness,
                hoverScale,
                clickScale,
                hoverDuration,
                clickDuration
            },
            disabledOpacity
        };

        this.buttons.set(buttonId, buttonData);
        log(`Button '${buttonId}' registered successfully. Total buttons: ${this.buttons.size}`, 'ui');

        // Start mouse tracking if not already active
        if (!this.isMouseTracking) {
            debug('Starting mouse tracking', 'ui');
            this.startMouseTracking();
        } else {
            debug('Mouse tracking already active', 'ui');
        }

        return buttonId;
    }

    /**
     * Start global mouse tracking
     */
    startMouseTracking() {
        if (this.isMouseTracking) {
            debug('Mouse tracking already active, skipping', 'ui');
            return;
        }
        
        if (!this.scene || !this.scene.input) {
            error('Cannot start mouse tracking - scene or scene.input not available', 'ui');
            return;
        }
        
        debug('Setting up pointer event listeners', 'ui');
        this.scene.input.on('pointermove', this.handlePointerMove);
        this.scene.input.on('pointerdown', this.handlePointerDown);
        this.scene.input.on('pointerup', this.handlePointerUp);
        
        this.isMouseTracking = true;
        log('Mouse tracking started successfully', 'ui');
    }

    /**
     * Stop global mouse tracking
     */
    stopMouseTracking() {
        if (!this.isMouseTracking) return;
        
        this.scene.input.off('pointermove', this.handlePointerMove);
        this.scene.input.off('pointerdown', this.handlePointerDown);
        this.scene.input.off('pointerup', this.handlePointerUp);
        
        this.isMouseTracking = false;
    }

    /**
     * Handle mouse movement
     */
    handlePointerMove(pointer) {
        const mouseX = pointer.x;
        const mouseY = pointer.y;
        
        // Debug: log first few moves to verify it's working
        if (!this._moveLogCount) this._moveLogCount = 0;
        if (this._moveLogCount < 3) {
            debug(`handlePointerMove called (${this._moveLogCount + 1}/3), mouse: ${mouseX}, ${mouseY}, buttons: ${this.buttons.size}`, 'ui');
            this._moveLogCount++;
        }
        
        this.buttons.forEach((buttonData) => {
            const { container, width, height, isHovered, isPressed, enabled } = buttonData;
            
            // Skip if button is disabled
            if (!enabled) return;
            
            // Skip if button is currently pressed down
            if (isPressed) return;
            
            // Get button's world position (accounts for parent container positions)
            const worldPosition = this._getWorldPosition(container);
            const x = worldPosition.x;
            const y = worldPosition.y;
            
            // Calculate button bounds
            const left = x - width / 2;
            const right = x + width / 2;
            const top = y - height / 2;
            const bottom = y + height / 2;
            
            // Check if mouse is within button bounds
            const isMouseOverButton = mouseX >= left && mouseX <= right && 
                                     mouseY >= top && mouseY <= bottom;
            
            if (isMouseOverButton && !isHovered) {
                this.handleHoverIn(buttonData);
            } else if (!isMouseOverButton && isHovered) {
                this.handleHoverOut(buttonData);
            }
        });
    }

    /**
     * Handle mouse down
     */
    handlePointerDown(pointer) {
        const mouseX = pointer.x;
        const mouseY = pointer.y;
        
        this.buttons.forEach((buttonData) => {
            const { container, width, height, enabled } = buttonData;
            
            // Skip if button is disabled
            if (!enabled) return;
            
            // Get button's world position (accounts for parent container positions)
            const worldPosition = this._getWorldPosition(container);
            const x = worldPosition.x;
            const y = worldPosition.y;
            
            // Calculate button bounds
            const left = x - width / 2;
            const right = x + width / 2;
            const top = y - height / 2;
            const bottom = y + height / 2;
            
            // Check if mouse is within button bounds
            const isMouseOverButton = mouseX >= left && mouseX <= right && 
                                     mouseY >= top && mouseY <= bottom;
            
            if (isMouseOverButton) {
                this.handlePressDown(buttonData);
            }
        });
    }

    /**
     * Handle mouse up - execute click callback if button was pressed and mouse is still over it
     */
    handlePointerUp(pointer) {
        const mouseX = pointer.x;
        const mouseY = pointer.y;
        
        this.buttons.forEach((buttonData) => {
            const { container, width, height, isHovered, isPressed, animations, onClick, enabled } = buttonData;
            
            // Skip if button is disabled
            if (!enabled) return;
            
            // Only process if button was pressed
            if (!isPressed) return;
            
            // Get button's world position (accounts for parent container positions)
            const worldPosition = this._getWorldPosition(container);
            const x = worldPosition.x;
            const y = worldPosition.y;
            
            // Calculate button bounds
            const left = x - width / 2;
            const right = x + width / 2;
            const top = y - height / 2;
            const bottom = y + height / 2;
            
            // Check if mouse is still within button bounds
            const isMouseOverButton = mouseX >= left && mouseX <= right && 
                                     mouseY >= top && mouseY <= bottom;
            
            // Mark button as no longer pressed
            buttonData.isPressed = false;
            
            // Kill existing tweens
            this.scene.tweens.killTweensOf(container);
            
            // Execute click callback only if mouse is still over the button (proper click/tap)
            if (isMouseOverButton && onClick) {
                // Haptic feedback (mobile browsers - play, buy, speed, etc.)
                if (GameConfig?.ui?.enableHapticFeedback !== false) {
                    HapticUtils.light();
                }
                onClick();
            }
            
            // Restore visual state
            const { initialScaleX, initialScaleY } = buttonData;
            const currentScaleX = container.scaleX;
            const currentScaleY = container.scaleY;
            
            if (isMouseOverButton && isHovered) {
                // Mouse is still hovering - return to hover state (relative to initial scale)
                const targetScaleX = initialScaleX * animations.hoverScale;
                const targetScaleY = initialScaleY * animations.hoverScale;
                log(`[ButtonManager] handlePointerUp for ${buttonData.id}: returning to hover state. currentScale=(${currentScaleX.toFixed(3)}, ${currentScaleY.toFixed(3)}), initialScale=(${initialScaleX.toFixed(3)}, ${initialScaleY.toFixed(3)}), targetHoverScale=(${targetScaleX.toFixed(3)}, ${targetScaleY.toFixed(3)})`, 'ui');
                this.scene.tweens.add({
                    targets: container,
                    scaleX: targetScaleX,
                    scaleY: targetScaleY,
                    duration: animations.clickDuration,
                    ease: 'Power2.easeOut'
                });
                // Restore hover effects
                this.applyPressEffects(buttonData, false);
                this.applyHoverEffects(buttonData, true);
            } else {
                // Mouse is no longer hovering - return to initial scale (not hardcoded 1.0)
                log(`[ButtonManager] handlePointerUp for ${buttonData.id}: returning to initial scale. currentScale=(${currentScaleX.toFixed(3)}, ${currentScaleY.toFixed(3)}), initialScale=(${initialScaleX.toFixed(3)}, ${initialScaleY.toFixed(3)})`, 'ui');
                this.scene.tweens.add({
                    targets: container,
                    scaleX: initialScaleX,
                    scaleY: initialScaleY,
                    duration: animations.clickDuration,
                    ease: 'Power2.easeOut'
                });
                // Restore original colors
                this.applyPressEffects(buttonData, false);
            }
        });
    }

    /**
     * Handle hover in
     */
    handleHoverIn(buttonData) {
        // Skip if button is disabled
        if (!buttonData.enabled) return;
        
        const { container, animations, initialScaleX, initialScaleY } = buttonData;
        buttonData.isHovered = true;
        
        // Kill existing tweens
        this.scene.tweens.killTweensOf(container);
        
        // Apply scale animation if hoverScale is not 1.0
        // Calculate target scale relative to initial scale
        const currentScaleX = container.scaleX;
        const currentScaleY = container.scaleY;
        if (animations.hoverScale !== 1.0) {
            const targetScaleX = initialScaleX * animations.hoverScale;
            const targetScaleY = initialScaleY * animations.hoverScale;
            this.scene.tweens.add({
                targets: container,
                scaleX: targetScaleX,
                scaleY: targetScaleY,
                duration: animations.hoverDuration,
                ease: 'Power2.easeOut'
            });
        }
        
        // Apply hover effects (brighten tint)
        this.applyHoverEffects(buttonData, true);
    }

    /**
     * Handle hover out
     */
    handleHoverOut(buttonData) {
        // Skip if button is disabled
        if (!buttonData.enabled) return;
        
        const { container, animations, initialScaleX, initialScaleY } = buttonData;
        
        // Prevent duplicate calls if already processing hover out
        if (!buttonData.isHovered) {
            return;
        }
        
        buttonData.isHovered = false;
        
        // Kill existing tweens
        this.scene.tweens.killTweensOf(container);
        
        // Return scale to initial scale (not hardcoded 1.0)
        const currentScaleX = container.scaleX;
        const currentScaleY = container.scaleY;
        if (container.scaleX !== initialScaleX || container.scaleY !== initialScaleY) {
            this.scene.tweens.add({
                targets: container,
                scaleX: initialScaleX,
                scaleY: initialScaleY,
                duration: animations.hoverDuration,
                ease: 'Power2.easeOut'
            });
        }
        
        // Reset hover effects (restore original tint)
        this.applyHoverEffects(buttonData, false);
    }

    /**
     * Apply hover effects (brighten tint)
     * @param {Object} buttonData - Button data object
     * @param {boolean} isHover - True for hover in, false for hover out
     */
    applyHoverEffects(buttonData, isHover) {
        const { nineslice, background, content, originalBackgroundTint, originalContentTint, animations } = buttonData;
        const bg = background || nineslice; // Support both types
        
        if (isHover) {
            // Brighten tints
            const brighterBackgroundTint = ColorUtils.brightenNumber(originalBackgroundTint, animations.hoverBrightness);
            if (bg) {
                bg.setTint(brighterBackgroundTint);
            }
            buttonData.currentBackgroundTint = brighterBackgroundTint;
            
            if (content && originalContentTint) {
                const brighterContentTint = ColorUtils.brightenNumber(originalContentTint, animations.hoverBrightness);
                content.setTint(brighterContentTint);
                buttonData.currentContentTint = brighterContentTint;
            }
        } else {
            // Restore original tints
            if (bg) {
                bg.setTint(originalBackgroundTint);
            }
            buttonData.currentBackgroundTint = originalBackgroundTint;
            
            if (content && originalContentTint) {
                content.setTint(originalContentTint);
                buttonData.currentContentTint = originalContentTint;
            }
        }
    }

    /**
     * Handle button press down - set visual pressed state without executing callback
     */
    handlePressDown(buttonData) {
        // Skip if button is disabled
        if (!buttonData.enabled) return;
        
        const { container, animations, initialScaleX, initialScaleY } = buttonData;
        buttonData.isPressed = true;
        
        // Kill existing tweens
        this.scene.tweens.killTweensOf(container);
        
        // Apply press scale animation
        const currentScaleX = container.scaleX;
        const currentScaleY = container.scaleY;
        const pressScaleX = initialScaleX * animations.clickScale;
        const pressScaleY = initialScaleY * animations.clickScale;
        log(`[ButtonManager] handlePressDown for ${buttonData.id}: currentScale=(${currentScaleX.toFixed(3)}, ${currentScaleY.toFixed(3)}), initialScale=(${initialScaleX.toFixed(3)}, ${initialScaleY.toFixed(3)}), targetPressScale=(${pressScaleX.toFixed(3)}, ${pressScaleY.toFixed(3)})`, 'ui');
        this.scene.tweens.add({
            targets: container,
            scaleX: pressScaleX,
            scaleY: pressScaleY,
            duration: animations.clickDuration,
            ease: 'Power2.easeIn'
        });
        
        // Apply press effects (darken tint)
        this.applyPressEffects(buttonData, true);
    }

    /**
     * Apply press effects (darken tint)
     * @param {Object} buttonData - Button data object
     * @param {boolean} isPressed - True for pressed, false to restore
     */
    applyPressEffects(buttonData, isPressed) {
        const { nineslice, background, content, originalBackgroundTint, originalContentTint, animations, currentBackgroundTint, currentContentTint } = buttonData;
        const bg = background || nineslice; // Support both types
        
        // Use current tint (which may be hovered) as base for press effects
        const baseBackgroundTint = currentBackgroundTint || originalBackgroundTint;
        const baseContentTint = currentContentTint || originalContentTint;
        
        if (isPressed) {
            // Darken tints from current state
            const darkerBackgroundTint = ColorUtils.darkenNumber(baseBackgroundTint, animations.pressDarkness);
            if (bg) {
                bg.setTint(darkerBackgroundTint);
            }
            
            if (content && baseContentTint) {
                const darkerContentTint = ColorUtils.darkenNumber(baseContentTint, animations.pressDarkness);
                content.setTint(darkerContentTint);
            }
        } else {
            // Restore to current state (hover or original)
            if (bg) {
                bg.setTint(baseBackgroundTint);
            }
            
            if (content && baseContentTint) {
                content.setTint(baseContentTint);
            }
        }
    }

    /**
     * Enable/disable button
     * @param {string} buttonId - Button ID
     * @param {boolean} enabled - Enable or disable
     */
    setButtonEnabled(buttonId, enabled) {
        const buttonData = this.buttons.get(buttonId);
        if (!buttonData) {
            warn(`Button '${buttonId}' not found`, 'ui');
            return;
        }
        
        const { container, background, nineslice, disabledOpacity, originalBackgroundTint, originalContentTint, animations } = buttonData;
        const bg = background || nineslice; // Support both types
        
        buttonData.enabled = enabled;
        
        // Kill any active tweens
        this.scene.tweens.killTweensOf(container);
        
        // Set opacity
        const opacity = enabled ? 1.0 : disabledOpacity;
        container.setAlpha(opacity);
        
        // If button is being enabled, restore original tints and scale
        if (enabled) {
            // Reset hover/pressed states
            buttonData.isHovered = false;
            buttonData.isPressed = false;
            
            // Restore original tints
            if (bg) {
                bg.setTint(originalBackgroundTint);
            }
            buttonData.currentBackgroundTint = originalBackgroundTint;
            
            if (buttonData.content && originalContentTint) {
                buttonData.content.setTint(originalContentTint);
                buttonData.currentContentTint = originalContentTint;
            }
            
            // Reset scale to initial scale (not hardcoded 1.0)
            container.setScale(buttonData.initialScaleX, buttonData.initialScaleY);
        }
    }

    /**
     * Update stored initial scale values after button resize
     * This is necessary when buttons are resized during layout changes - the hover states
     * need to use the new initial scale, not the old one from when the button was first registered
     * @param {string} buttonId - Button ID
     * @param {number} newInitialScaleX - New initial scale X value
     * @param {number} newInitialScaleY - New initial scale Y value
     */
    updateInitialScale(buttonId, newInitialScaleX, newInitialScaleY) {
        const buttonData = this.buttons.get(buttonId);
        if (!buttonData) {
            warn(`[ButtonManager] updateInitialScale: Button ${buttonId} not found`, 'ui');
            return;
        }
        
        const oldInitialScaleX = buttonData.initialScaleX;
        const oldInitialScaleY = buttonData.initialScaleY;
        
        // Update stored initial scale values
        buttonData.initialScaleX = newInitialScaleX;
        buttonData.initialScaleY = newInitialScaleY;
        
        debug(`[ButtonManager] Updated initial scale for ${buttonId}: (${oldInitialScaleX.toFixed(3)}, ${oldInitialScaleY.toFixed(3)}) -> (${newInitialScaleX.toFixed(3)}, ${newInitialScaleY.toFixed(3)})`, 'ui');
        
        // If button is currently in a hover or press state, update the scale to match the new initial scale
        // This ensures visual state immediately reflects the new scale
        const { container, animations, isHovered, isPressed } = buttonData;
        
        if (isPressed) {
            // Button is pressed - update to press scale based on new initial scale
            const targetScaleX = newInitialScaleX * animations.clickScale;
            const targetScaleY = newInitialScaleY * animations.clickScale;
            
            // Kill existing tweens and apply new press scale
            this.scene.tweens.killTweensOf(container);
            this.scene.tweens.add({
                targets: container,
                scaleX: targetScaleX,
                scaleY: targetScaleY,
                duration: animations.clickDuration,
                ease: 'Power2.easeIn'
            });
        } else if (isHovered) {
            // Button is hovered - update to hover scale based on new initial scale
            const targetScaleX = newInitialScaleX * animations.hoverScale;
            const targetScaleY = newInitialScaleY * animations.hoverScale;
            
            // Kill existing tweens and apply new hover scale
            this.scene.tweens.killTweensOf(container);
            this.scene.tweens.add({
                targets: container,
                scaleX: targetScaleX,
                scaleY: targetScaleY,
                duration: animations.hoverDuration,
                ease: 'Power2.easeOut'
            });
        }
    }

    /**
     * Update stored original tint values after theme colors are applied
     * This is necessary because programmatic buttons (gradient sprites) don't use Phaser's tint property
     * - the color is baked into the texture, so we need to extract it from theme data
     * @param {string} buttonId - Button ID
     * @param {Object} buttonResult - Button result object from ButtonFactory
     */
    updateButtonOriginalTint(buttonId, buttonResult) {
        const buttonData = this.buttons.get(buttonId);
        if (!buttonData || !buttonResult) {
            warn(`[ButtonManager] updateButtonOriginalTint: Button ${buttonId} not found or invalid buttonResult`, 'ui');
            return;
        }
        
        const { background, nineslice, content } = buttonResult;
        const bg = background || nineslice;
        
        if (!bg) {
            warn(`[ButtonManager] updateButtonOriginalTint: No background or nineslice found for ${buttonId}`, 'ui');
            return;
        }
        
        let newOriginalBackgroundTint;
        let newOriginalContentTint;
        
        // Detect if button is programmatic (has background but no nineslice)
        const isProgrammatic = background && !nineslice;
        
        if (isProgrammatic) {
            // For programmatic buttons (gradient sprites), extract color from theme data
            // The color is baked into the texture, not stored in sprite.tint
            const theme = this.scene.themeData || (this.scene.prefab_ScratchManager && this.scene.prefab_ScratchManager.themeData);
            
            if (!theme) {
                warn(`[ButtonManager] updateButtonOriginalTint: Theme data not available for ${buttonId}`, 'ui');
                return;
            }
            
            // Extract button color from theme (same priority as ButtonFactory.updateButtonBackgroundColor)
            const colorHex = theme?.controlBar?.palette?.primaryColor || 
                           "#5700b9"; // Default fallback
            
            const colorHexStr = typeof colorHex === 'string' ? colorHex : String(colorHex || '#5700b9');
            const colorHexClean = colorHexStr.replace('#', '').substring(0, 6);
            newOriginalBackgroundTint = parseInt(colorHexClean, 16);
            
            debug(`[ButtonManager] updateButtonOriginalTint: Programmatic button ${buttonId}, extracted color from theme: ${colorHexStr} -> ${newOriginalBackgroundTint.toString(16)}`, 'ui');
        } else {
            // For 9-slice buttons, read from sprite tint property
            newOriginalBackgroundTint = bg.tint || 0xffffff;
            debug(`[ButtonManager] updateButtonOriginalTint: 9-slice button ${buttonId}, read tint from sprite: ${newOriginalBackgroundTint.toString(16)}`, 'ui');
        }
        
        // Extract content tint if content exists
        if (content) {
            // For content, check if it's an Image (uses tint) or Text (uses style.color)
            if (content instanceof Phaser.GameObjects.Image) {
                newOriginalContentTint = content.tint || 0xffffff;
            } else if (content instanceof Phaser.GameObjects.Text) {
                // For Text, extract color from style and convert to numeric
                const textColor = content.style?.color || '#ffffff';
                const textColorHex = typeof textColor === 'string' ? textColor : String(textColor || '#ffffff');
                const textColorClean = textColorHex.replace('#', '').substring(0, 6);
                newOriginalContentTint = parseInt(textColorClean, 16);
            } else {
                // Fallback for other content types
                newOriginalContentTint = content.tint || 0xffffff;
            }
        } else {
            newOriginalContentTint = null;
        }
        
        // Update stored values
        const oldBackgroundTint = buttonData.originalBackgroundTint;
        const oldContentTint = buttonData.originalContentTint;
        
        buttonData.originalBackgroundTint = newOriginalBackgroundTint;
        buttonData.originalContentTint = newOriginalContentTint;
        
        // Reset current tints to match original (clears any hover/press effects)
        buttonData.currentBackgroundTint = newOriginalBackgroundTint;
        buttonData.currentContentTint = newOriginalContentTint;
        
        // Apply the original tint to ensure visual consistency
        if (bg) {
            // For programmatic buttons, the color is already baked in, but we store it for hover/click calculations
            // For 9-slice buttons, we can set the tint directly
            if (!isProgrammatic && bg.setTint) {
                bg.setTint(newOriginalBackgroundTint);
            }
        }
        
        if (content && newOriginalContentTint) {
            if (content instanceof Phaser.GameObjects.Image && content.setTint) {
                content.setTint(newOriginalContentTint);
            }
            // Text color is already set via style, no need to update
        }
        
        log(`[ButtonManager] Updated originalBackgroundTint for ${buttonId}: ${oldBackgroundTint.toString(16)} -> ${newOriginalBackgroundTint.toString(16)}${oldContentTint !== null ? `, contentTint: ${oldContentTint?.toString(16) || 'null'} -> ${newOriginalContentTint?.toString(16) || 'null'}` : ''}`, 'ui');
    }

    /**
     * Remove a button
     * @param {string} buttonId - Button ID
     */
    removeButton(buttonId) {
        const buttonData = this.buttons.get(buttonId);
        if (buttonData) {
            // Kill any active tweens
            this.scene.tweens.killTweensOf(buttonData.container);
            
            this.buttons.delete(buttonId);
            
            // Stop tracking if no buttons left
            if (this.buttons.size === 0) {
                this.stopMouseTracking();
            }
        }
    }

    /**
     * Remove all buttons
     */
    removeAllButtons() {
        this.buttons.forEach((buttonData) => {
            this.scene.tweens.killTweensOf(buttonData.container);
        });
        this.buttons.clear();
        this.stopMouseTracking();
    }

    /**
     * Get world position of a game object (accounts for parent container positions)
     * @private
     */
    _getWorldPosition(gameObject) {
        let x = gameObject.x || 0;
        let y = gameObject.y || 0;
        let parent = gameObject.parentContainer;
        
        // Traverse up the parent chain to accumulate world position
        while (parent) {
            x += parent.x || 0;
            y += parent.y || 0;
            parent = parent.parentContainer;
        }
        
        return { x, y };
    }

    /**
     * Clean up service (call when scene is destroyed)
     */
    destroy() {
        this.removeAllButtons();
        this.scene = null;
    }
}

