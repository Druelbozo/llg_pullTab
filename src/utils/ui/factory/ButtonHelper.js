/**
 * ButtonHelper - Utility functions for creating and managing buttons
 * 
 * Provides helper methods to simplify button creation, layout, and registration
 * with ButtonFactory and ButtonManager.
 */

import ButtonFactory from './ButtonFactory.js';
import { error, warn } from '../../logger/LoggerUtils.js';

export default class ButtonHelper {
    /**
     * Find an existing button in the scene or create a new one
     * @param {Phaser.Scene} scene - Phaser scene instance
     * @param {string} label - Button label/identifier
     * @param {Object} config - Button configuration for ButtonFactory.createButton()
     * @param {number} [defaultStartScale=1.0] - Default startScale if button exists from scene file
     * @returns {Object|null} Button result object {container, nineslice|background, content, label} or null
     */
    static findOrCreateButton(scene, label, config, defaultStartScale = 1.0) {
        if (!scene || !label) {
            error('Scene and label are required', 'ui');
            return null;
        }

        // Check if button exists as class property (from scene file)
        let existingButton = scene[label];
        
        // If not found, try to find in children list
        if (!existingButton) {
            existingButton = scene.children.list.find(
                child => child.label === label && child.type === 'Container'
            );
        }

        if (existingButton) {
            // Button exists from scene file, construct result object
            const useNineSlice = config.useNineSlice !== undefined ? config.useNineSlice : false;
            
            let background = null;
            let nineslice = null;
            
            if (useNineSlice) {
                // Look for NineSlice background
                const ninesliceLabel = label.replace('Button', 'Btn') + '_Main';
                nineslice = existingButton.list.find(
                    child => child.label === ninesliceLabel && child.type === 'NineSlice'
                );
            } else {
                // Look for Sprite background (programmatic)
                background = existingButton.list.find(
                    child => child.type === 'Sprite' && child.texture && child.texture.key && child.texture.key.startsWith('button_gradient_')
                );
            }
            
            // Find content (Image for icon buttons, Text for text buttons)
            let content = null;
            if (config.buttonType === 'icon' && config.icon) {
                content = existingButton.list.find(
                    child => (child.label === config.iconLabel || child.texture?.key === config.icon) && child.type === 'Image'
                );
            } else if (config.buttonType === 'text') {
                content = existingButton.list.find(child => child.type === 'Text');
            }

            // Apply startScale if needed (9-slice buttons from scene file)
            if (useNineSlice && existingButton.scaleX === 1 && existingButton.scaleY === 1 && defaultStartScale !== 1.0) {
                existingButton.setScale(defaultStartScale, defaultStartScale);
            }

            // Store icon reference if iconLabel provided
            if (content && config.iconLabel) {
                scene[config.iconLabel] = content;
            }

            // Construct button result object
            const result = {
                container: existingButton,
                content: content,
                label: label
            };
            
            if (useNineSlice) {
                result.nineslice = nineslice;
            } else {
                result.background = background;
            }
            
            return result;
        } else {
            // Button doesn't exist, create it using ButtonFactory
            const useNineSlice = config.useNineSlice !== undefined ? config.useNineSlice : false;
            
            // Verify required textures exist (only for 9-slice)
            if (useNineSlice) {
                const requiredTextures = ['Btn_Main'];
                if (config.buttonType === 'icon' && config.icon) {
                    requiredTextures.push(config.icon);
                }

                const missingTextures = requiredTextures.filter(texture => !scene.textures.exists(texture));
                if (missingTextures.length > 0) {
                    error(`Required textures not found for button '${label}':`, 'ui', missingTextures);
                    return null;
                }
            } else {
                // For programmatic buttons, only check icon texture if needed
                if (config.buttonType === 'icon' && config.icon && !scene.textures.exists(config.icon)) {
                    error(`Icon texture '${config.icon}' not found for button '${label}'`, 'ui');
                    return null;
                }
            }

            // Create button using ButtonFactory
            const buttonResult = ButtonFactory.createButton(scene, config);
            
            if (buttonResult) {
                // Store icon reference if iconLabel provided
                if (buttonResult.content && config.iconLabel) {
                    scene[config.iconLabel] = buttonResult.content;
                }
                
                // Ensure button is added to scene
                scene.add.existing(buttonResult.container);
            } else {
                error(`ButtonFactory.createButton returned null/undefined for '${label}'`, 'ui');
            }

            return buttonResult;
        }
    }

    /**
     * Create multiple buttons with relative positioning
     * @param {Phaser.Scene} scene - Phaser scene instance
     * @param {Array<Object>} buttonConfigs - Array of button configurations
     * @param {Object} layoutOptions - Layout configuration
     * @param {string} [layoutOptions.anchor='center'] - Horizontal alignment: 'center' | 'left' | 'right'
     * @param {string} [layoutOptions.verticalPosition='bottom'] - Vertical position: 'top' | 'center' | 'bottom'
     * @param {number} [layoutOptions.insetY=0] - Vertical inset from edge
     * @param {number} [layoutOptions.buttonSpacingPercent=0.1] - Horizontal spacing between buttons as percentage of button height (e.g., 0.1 = 10%)
     * @param {number} [layoutOptions.startScale=1.0] - Default scale for all buttons (9-slice only)
     * @param {number} [layoutOptions.heightPercent] - Button height as percentage of screen height (programmatic only, e.g., 0.1 = 10%)
     * @param {number} [layoutOptions.cornerRadius=0.125] - Corner radius for programmatic buttons (multiplier 0-1 or absolute >1)
     * @param {boolean} [layoutOptions.useNineSlice=false] - Use 9-slice system (legacy). If false, uses programmatic gradient buttons
     * @param {Object} [layoutOptions.origin={x: 0.5, y: 0.5}] - Default origin for all buttons
     * @param {number} [layoutOptions.iconScale=0.8] - Default icon scale for all icon buttons (relative to button size)
     * @param {number} [layoutOptions.textScale] - Default text scale for all text buttons (relative to button height, e.g., 0.4 = 40% of button height)
     * @returns {Array<Object>} Array of button result objects
     */
    static createButtonLayout(scene, buttonConfigs, layoutOptions = {}) {
        if (!scene || !Array.isArray(buttonConfigs) || buttonConfigs.length === 0) {
            error('Invalid parameters for createButtonLayout', 'ui');
            return [];
        }

        const {
            anchor = 'center',
            verticalPosition = 'bottom',
            insetY = 0,
            buttonSpacingPercent = 0.1,
            startScale = 1.0,
            heightPercent,
            cornerRadius = 0.125,
            useNineSlice = false,
            origin = { x: 0.5, y: 0.5 },
            iconScale = 0.8,
            textScale
        } = layoutOptions;

        const buttonResults = [];
        const baseHeight = 150; // Base button height from ButtonFactory (9-slice only)
        
        // Calculate button height for spacing calculation (all buttons have the same height)
        let buttonHeight;
        if (useNineSlice) {
            buttonHeight = baseHeight * startScale;
        } else {
            buttonHeight = heightPercent ? scene.scale.height * heightPercent : baseHeight;
        }
        
        // Calculate actual spacing based on button height and percentage
        const buttonSpacing = buttonHeight * buttonSpacingPercent;

        // Calculate vertical position
        let buttonY;
        if (verticalPosition === 'top') {
            buttonY = insetY;
        } else if (verticalPosition === 'center') {
            buttonY = scene.scale.height / 2;
        } else { // 'bottom'
            buttonY = scene.scale.height - insetY;
        }

        // Pre-calculate all button widths for group centering
        const buttonWidths = [];
        for (let i = 0; i < buttonConfigs.length; i++) {
            const buttonConfig = buttonConfigs[i];
            const aspectRatio = buttonConfig.aspectRatio || 1.0;
            const buttonUseNineSlice = buttonConfig.useNineSlice !== undefined ? buttonConfig.useNineSlice : useNineSlice;
            const buttonStartScale = buttonConfig.startScale !== undefined ? buttonConfig.startScale : startScale;
            const buttonHeightPercent = buttonConfig.heightPercent !== undefined ? buttonConfig.heightPercent : heightPercent;
            
            let buttonWidth;
            if (buttonUseNineSlice) {
                buttonWidth = baseHeight * aspectRatio * buttonStartScale;
            } else {
                const calcButtonHeight = buttonHeightPercent ? scene.scale.height * buttonHeightPercent : baseHeight;
                buttonWidth = calcButtonHeight * aspectRatio;
            }
            buttonWidths.push(buttonWidth);
        }

        // Calculate total group width (sum of all button widths + spacing between them)
        let totalGroupWidth = 0;
        for (let i = 0; i < buttonWidths.length; i++) {
            totalGroupWidth += buttonWidths[i];
            if (i < buttonWidths.length - 1) {
                // Add spacing between buttons (based on button height)
                totalGroupWidth += buttonSpacing;
            }
        }

        // Process each button config
        for (let i = 0; i < buttonConfigs.length; i++) {
            const buttonConfig = buttonConfigs[i];
            const label = buttonConfig.label;
            const aspectRatio = buttonConfig.aspectRatio || 1.0;
            const buttonUseNineSlice = buttonConfig.useNineSlice !== undefined ? buttonConfig.useNineSlice : useNineSlice;
            const buttonStartScale = buttonConfig.startScale !== undefined ? buttonConfig.startScale : startScale;
            const buttonHeightPercent = buttonConfig.heightPercent !== undefined ? buttonConfig.heightPercent : heightPercent;
            const buttonCornerRadius = buttonConfig.cornerRadius !== undefined ? buttonConfig.cornerRadius : cornerRadius;
            const buttonOrigin = buttonConfig.origin || origin;
            // Use iconScale from button config if provided, otherwise use layout default
            const buttonIconScale = buttonConfig.iconScale !== undefined ? buttonConfig.iconScale : iconScale;
            // Use textScale from button config if provided, otherwise use layout default
            const buttonTextScale = buttonConfig.textScale !== undefined ? buttonConfig.textScale : textScale;

            // Use pre-calculated button width
            const buttonWidth = buttonWidths[i];

            // Calculate horizontal position
            let buttonX;
            if (i === 0) {
                // First button: position based on anchor
                if (anchor === 'left') {
                    buttonX = buttonWidth / 2 + insetY; // Use insetY as horizontal inset too
                } else if (anchor === 'right') {
                    buttonX = scene.scale.width - (buttonWidth / 2) - insetY;
                } else { // 'center'
                    // Center the entire button group, not just the first button
                    // Group left edge = screen center - total group width / 2
                    // First button center = group left edge + first button width / 2
                    const groupLeftEdge = (scene.scale.width / 2) - (totalGroupWidth / 2);
                    buttonX = groupLeftEdge + (buttonWidth / 2);
                }
            } else {
                // Subsequent buttons: position relative to previous button
                const prevButtonResult = buttonResults[i - 1];
                if (prevButtonResult && prevButtonResult.container) {
                    const prevConfig = buttonConfigs[i - 1];
                    const prevAspectRatio = prevConfig.aspectRatio || 1.0;
                    const prevUseNineSlice = prevConfig.useNineSlice !== undefined ? prevConfig.useNineSlice : useNineSlice;
                    let prevButtonWidth;
                    // Calculate previous button's height for spacing (use same logic as current button)
                    let prevButtonHeight;
                    if (prevUseNineSlice) {
                        const prevStartScale = prevConfig.startScale !== undefined ? prevConfig.startScale : startScale;
                        prevButtonHeight = baseHeight * prevStartScale;
                        prevButtonWidth = prevButtonHeight * prevAspectRatio;
                    } else {
                        const prevHeightPercent = prevConfig.heightPercent !== undefined ? prevConfig.heightPercent : heightPercent;
                        prevButtonHeight = prevHeightPercent ? scene.scale.height * prevHeightPercent : baseHeight;
                        prevButtonWidth = prevButtonHeight * prevAspectRatio;
                    }
                    
                    // Calculate spacing based on previous button's height
                    const calculatedSpacing = prevButtonHeight * buttonSpacingPercent;
                    buttonX = prevButtonResult.container.x + (prevButtonWidth / 2) + calculatedSpacing + (buttonWidth / 2);
                } else {
                    // Fallback: position relative to center
                    buttonX = (scene.scale.width / 2) + buttonWidth / 2 + buttonSpacing;
                }
            }

            // Merge layout options into button config
            const fullConfig = {
                ...buttonConfig,
                useNineSlice: buttonUseNineSlice,
                position: { x: buttonX, y: buttonY },
                origin: buttonOrigin
            };

            // Add parameters based on button type
            if (buttonUseNineSlice) {
                fullConfig.startScale = buttonStartScale;
            } else {
                if (buttonHeightPercent !== undefined) {
                    fullConfig.heightPercent = buttonHeightPercent;
                }
                fullConfig.cornerRadius = buttonCornerRadius;
            }

            // Add iconScale for icon buttons (only if not already specified in buttonConfig)
            if (buttonConfig.buttonType === 'icon' && buttonConfig.iconScale === undefined) {
                fullConfig.iconScale = buttonIconScale;
            }

            // Add textScale for text buttons (only if not already specified in buttonConfig)
            if (buttonConfig.buttonType === 'text' && buttonConfig.textScale === undefined && buttonTextScale !== undefined) {
                fullConfig.textScale = buttonTextScale;
            }

            // Find or create button
            const defaultStartScale = buttonUseNineSlice ? buttonStartScale : 1.0;
            const buttonResult = ButtonHelper.findOrCreateButton(scene, label, fullConfig, defaultStartScale);
            
            if (buttonResult) {
                buttonResults.push(buttonResult);
            } else {
                warn(`Failed to create button '${label}'`, 'ui');
            }
        }

        return buttonResults;
    }

    /**
     * Register multiple buttons with ButtonManager using default config
     * @param {ButtonManager} buttonManager - ButtonManager instance
     * @param {Array<Object>} buttonResults - Array of button result objects
     * @param {Object} onClickCallbacks - Map of button labels to onClick callbacks { label: onClick }
     * @param {Object} [perButtonConfigs={}] - Optional per-button config overrides { label: { hoverScale: 1.1, ... } }
     */
    static registerButtonsWithDefaults(buttonManager, buttonResults, onClickCallbacks = {}, perButtonConfigs = {}) {
        if (!buttonManager || !Array.isArray(buttonResults)) {
            error('Invalid parameters for registerButtonsWithDefaults', 'ui');
            return;
        }

        buttonResults.forEach(buttonResult => {
            if (!buttonResult || !buttonResult.label) {
                return;
            }

            const label = buttonResult.label;
            const onClick = onClickCallbacks[label] || (() => {});
            const perButtonConfig = perButtonConfigs[label] || {};

            // Register with ButtonManager (default config is applied automatically)
            buttonManager.registerButton(buttonResult, {
                onClick,
                ...perButtonConfig // Allow per-button overrides
            });
        });
    }
}
