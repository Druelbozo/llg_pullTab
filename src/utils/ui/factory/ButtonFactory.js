/**
 * Button Factory
 * 
 * Creates standardized button structures that work with both Phaser Editor
 * scene files and runtime code. Supports icon buttons and text buttons.
 * 
 * @example
 * // Create an icon button (square, aspectRatio 1.0)
 * const soundButton = ButtonFactory.createButton(scene, {
 *     label: 'soundButton',
 *     buttonType: 'icon',
 *     icon: 'icon_sound_on_128',
 *     iconLabel: 'soundIcon',
 *     aspectRatio: 1.0,
 *     position: {x: 0, y: -124}
 * });
 * 
 * @example
 * // Create a text button (rectangular, aspectRatio 2.0)
 * const customButton = ButtonFactory.createButton(scene, {
 *     label: 'customButton',
 *     buttonType: 'text',
 *     text: 'Click Me',
 *     aspectRatio: 2.0,
 *     position: {x: 0, y: -124}
 * });
 */

import OnAwake from '../../../ScriptNodes/OnAwake.js';
import OnEvent from '../../../ScriptNodes/OnEvent.js';
import setThemeColor from '../../../ScriptNodes/Theme/setThemeColor.js';
import FontUtils from '../../fonts/FontUtils.js';
import ColorUtils from '../../color/ColorUtils.js';
import GraphicsUtils from '../graphics/GraphicsUtils.js';
import { GameConfig } from '../../../config/Global.js';
import { error, warn, debug, log } from '../../logger/LoggerUtils.js';
import { getLayoutConfigs, getContentHeightPercent } from '../../layout/ConfigAccessUtils.js';
import { getScreenHeight } from '../../viewport/ViewportUtils.js';
import { getLayoutConfig as getCachedLayoutConfig } from '../../../services/layout/config/LayoutConfigLoader.js';

export default class ButtonFactory {
    // Prefab IDs for script nodes (used in scene file definitions)
    static ON_AWAKE_PREFAB_ID = "c0625a56-ee9d-4d1e-bd39-1293f2a0cadb";
    static ON_EVENT_PREFAB_ID = "7e57dc4b-3f41-476b-8431-f03ca75083fd";
    static SET_THEME_COLOR_PREFAB_ID = "959d638e-478d-449d-859a-6dfc5cb9288e";

    // Default configuration constants (can be overridden in createButton config)
    static DEFAULT_ORIGIN = { x: 0.5, y: 0.5 };  // Center origin (0.5, 0.5 = center, 0.5, 1.0 = bottom-center)
    static DEFAULT_ICON_SCALE = 0.75;  // Icon scale factor (relative to button size)
    static DEFAULT_TEXT_SCALE = 0.5;  // Text scale factor (relative to button height)
    static DEFAULT_POSITION = { x: 0, y: 0 };  // Default position (for LayoutGroupFactory use case)
    static DEFAULT_TEXT_PERCENT_Y = 0.5;  // Text vertical position (0 = top edge, 0.5 = center, 1 = bottom edge)
    static DEFAULT_ICON_PERCENT_Y = 0.5;  // Icon vertical position for icon-text buttons (0 = top edge, 0.5 = center, 1 = bottom edge)

    /**
     * Create a gradient button background using canvas
     * @private
     * @param {Phaser.Scene} scene - Phaser scene instance
     * @param {number} width - Button width
     * @param {number} height - Button height
     * @param {string} tintColor - Tint color in hex format (e.g., '#5700b9')
     * @param {number} cornerRadius - Corner radius (multiplier 0-1 or absolute >1)
     * @returns {Phaser.GameObjects.Sprite} Gradient button background sprite
     */
    static _createGradientButtonBackground(scene, width, height, tintColor, cornerRadius = 0.125) {
        // Internal gradient definition (always linear, vertical)
        const gradientStops = [
            { position: 0, color: "#c7c7c7" },  // Light gray
            { position: 1, color: "#FFFFFF" }   // White
        ];

        // Generate texture key (matching original format for consistency)
        const actualRadius = cornerRadius < 1 ? height * cornerRadius : cornerRadius;
        const roundedRadius = Math.round(actualRadius * 100) / 100;
        const tintColorStr = typeof tintColor === 'string' ? tintColor : String(tintColor || '#5700b9');
        const textureKey = `button_gradient_${Math.round(width)}_${Math.round(height)}_${tintColorStr.replace('#', '')}_${roundedRadius}`;

        // Use GraphicsUtils to create the rounded rectangle texture using Canvas 2D API
        // Note: Canvas 2D is more reliable for gradient textures than Phaser Graphics generateTexture
        const sprite = GraphicsUtils.createRoundedRectTexture(
            scene,
            width,
            height,
            cornerRadius,
            null, // No solid fill color (using gradient)
            gradientStops,
            textureKey,
            tintColor // Apply tint to gradient stops
        );

        if (sprite) {
            debug(`Created gradient sprite with texture key: ${textureKey}, tint cleared to 0xffffff`, 'ui');
        }
        
        return sprite;
    }

    /**
     * Create a button container with standardized structure
     * @param {Phaser.Scene} scene - Phaser scene instance
     * @param {Object} config - Button configuration
     * @param {string} config.label - Button identifier/label
     * @param {"icon"|"text"|"icon-text"} config.buttonType - Type of button
     * @param {number} [config.aspectRatio=1.0] - Button aspect ratio (width/height). 1.0 = square, 2.0 = 2x wide, etc.
     * @param {boolean} [config.useNineSlice=false] - Use 9-slice system (legacy). If false, uses programmatic gradient buttons
     * @param {number} [config.startScale=1.0] - Initial scale multiplier for the button container (9-slice only, e.g., 0.8 = 80% of base size)
     * @param {number} [config.heightPercent] - Button height as percentage of screen height (programmatic only, defaults to controlBar.contentHeight.percent from defaults.json)
     * @param {number} [config.cornerRadius] - Corner radius (programmatic only: multiplier 0-1 or absolute >1, defaults to DEFAULT_CORNER_RADIUS = 0.3 = 30% of height)
     * @param {Object} [config.position] - Position {x, y} in parent (defaults to ButtonFactory.DEFAULT_POSITION = {x: 0, y: 0})
     * @param {Object} [config.origin] - Origin point {x, y} for positioning (defaults to ButtonFactory.DEFAULT_ORIGIN = {x: 0.5, y: 0.5} for center). e.g., {x: 0.5, y: 1.0} for bottom-center
     * @param {Object} [config.hitArea] - Custom hitArea override
     * @param {boolean} [config.themeSupport=true] - Whether to add theme color support (9-slice only, not used in programmatic)
     * @param {string} [config.icon] - Icon texture key (for icon buttons or icon-text buttons)
     * @param {number} [config.iconScale] - Icon scale factor (relative to button size, defaults to ButtonFactory.DEFAULT_ICON_SCALE = 0.75)
     * @param {string} [config.iconLabel] - Icon label for CLASS scope access
     * @param {number} [config.iconPercentY] - Icon vertical position for icon-text buttons (0 = top edge, 0.5 = center, 1 = bottom edge, defaults to ButtonFactory.DEFAULT_ICON_PERCENT_Y = 0.5)
     * @param {string} [config.text] - Text content (for text buttons or icon-text buttons, backward compatible)
     * @param {Array<Object>} [config.textLines] - Array of text line objects for multi-line text support. Each object: {text: string, percentY?: number, textScale?: number, textStyle?: object}. Defaults: percentY=0.5, textScale=0.5
     * @param {number} [config.textScale] - Text scale factor for single text (relative to button height, defaults to ButtonFactory.DEFAULT_TEXT_SCALE = 0.5, e.g., 0.4 = 40% of button height)
     * @param {number} [config.textPercentY] - Text vertical position for single text (0 = top edge, 0.5 = center, 1 = bottom edge, defaults to ButtonFactory.DEFAULT_TEXT_PERCENT_Y = 0.5)
     * @param {Object} [config.textStyle] - Text style options for single text
     * @param {string} [config.secondaryText] - Optional secondary text (deprecated, use textLines array instead)
     * @param {Object} [config.secondaryTextStyle] - Secondary text style options (deprecated)
     * @returns {Object} Object with {container, background|nineslice, content, label, textContent?} references. textContent is a single object for single text, or an array of objects for multi-line text
     */
    static createButton(scene, config) {
        if (!scene) {
            error('Scene is required', 'ui');
            return null;
        }

        // Log the config BEFORE destructuring to see what we're receiving
        debug('createButton: Received config BEFORE destructuring', 'ui');
        debug(`config.heightPercent: ${config.heightPercent}`, 'ui');
        debug(`config.hasOwnProperty("heightPercent"): ${config.hasOwnProperty('heightPercent')}`, 'ui');
        debug(`config keys: ${Object.keys(config).join(', ')}`, 'ui');
        debug(`JSON.stringify: ${JSON.stringify(config)}`, 'ui');

        // SAFETY CHECK: If heightPercent is missing for control bar buttons, calculate it from layout config
        // This is a workaround for browser caching issues preventing ControlBarManager changes from loading
        if (!config.hasOwnProperty('heightPercent') && config.label && 
            (config.label === 'soundButton' || config.label === 'infoButton' || 
             config.label === 'autoButton' || config.label === 'playButton')) {
            warn('CRITICAL: heightPercent missing for control bar button!', 'ui');
            warn('This indicates ControlBarManager.js is cached - browser needs hard refresh!', 'ui');
            warn('Attempting to calculate correct heightPercent from layout config...', 'ui');
            
            // Try to calculate the correct contentHeightPercent from layout config (same logic as Level.js)
            try {
                // Get layout manager from scene
                const layoutManager = scene.layoutManager;
                if (layoutManager) {
                    const layoutName = layoutManager.getCurrentLayoutName();
                    const { uiConfig, baseUIConfig } = getLayoutConfigs(layoutManager, layoutName);
                    const height = getScreenHeight(scene);
                    // Padding removed - set to 0.0
                    const verticalPaddingTop = 0.0;
                    const verticalPaddingBottom = 0.0;
                    const availableHeight = height - (verticalPaddingTop + verticalPaddingBottom);
                    
                    // Get contentHeightPercent from layout config
                    const contentHeightPercent = getContentHeightPercent(uiConfig, availableHeight, height) || 
                                                 getContentHeightPercent(baseUIConfig, availableHeight, height) || 
                                                 0.08;
                    
                    // Convert to buttonHeightPercent (relative to screen height, not availableHeight)
                    const buttonHeightPercent = height > 0 ? (availableHeight / height) * contentHeightPercent : contentHeightPercent;
                    
                    config.heightPercent = buttonHeightPercent;
                    warn(`Successfully calculated heightPercent from layout config: ${buttonHeightPercent}`, 'ui');
                } else {
                    // Fallback to default from defaults.json if layout manager not available
                    const defaultsConfig = getCachedLayoutConfig('defaults') || {};
                    const defaultHeightPercent = getContentHeightPercent(defaultsConfig, null, null) || 0.08;
                    config.heightPercent = defaultHeightPercent;
                    warn(`Layout manager not available, using default from defaults.json: ${defaultHeightPercent}`, 'ui');
                }
            } catch (calcError) {
                // Fallback to default from defaults.json if calculation fails
                const defaultsConfig = getCachedLayoutConfig('defaults') || {};
                const defaultHeightPercent = getContentHeightPercent(defaultsConfig, null, null) || 0.08;
                config.heightPercent = defaultHeightPercent;
                warn(`Failed to calculate heightPercent, using default from defaults.json: ${defaultHeightPercent}`, 'ui', calcError);
            }
        }

        const {
            label,
            buttonType,
            aspectRatio = 1.0,
            useNineSlice = false,
            startScale = 1.0,
            heightPercent = (() => {
                // Get default from defaults.json layout config
                const defaultsConfig = getCachedLayoutConfig('defaults') || {};
                return getContentHeightPercent(defaultsConfig, null, null) || 0.08;
            })(), // Default from controlBar.contentHeight.percent in defaults.json
            cornerRadius = GameConfig.ui.DEFAULT_CORNER_RADIUS,
            position = { ...ButtonFactory.DEFAULT_POSITION },
            origin = { ...ButtonFactory.DEFAULT_ORIGIN },
            hitArea,
            themeSupport = true,
            icon,
            iconScale = ButtonFactory.DEFAULT_ICON_SCALE,
            iconLabel,
            iconPercentY = ButtonFactory.DEFAULT_ICON_PERCENT_Y,
            text,
            textLines,
            textScale = ButtonFactory.DEFAULT_TEXT_SCALE,
            textPercentY = ButtonFactory.DEFAULT_TEXT_PERCENT_Y,
            textStyle,
            secondaryText,
            secondaryTextStyle
        } = config;

        if (!label) {
            error('label is required', 'ui');
            return null;
        }

        if (buttonType !== 'icon' && buttonType !== 'text' && buttonType !== 'icon-text') {
            error('buttonType must be "icon", "text", or "icon-text"', 'ui');
            return null;
        }

        // Validate required fields for each button type
        if (buttonType === 'icon' && !icon) {
            error('icon is required for icon button type', 'ui');
            return null;
        }

        // For text and icon-text buttons, either text or textLines must be provided
        if (buttonType === 'text' && !text && !textLines) {
            error('text or textLines is required for text button type', 'ui');
            return null;
        }

        if (buttonType === 'icon-text' && (!icon || (!text && !textLines))) {
            error('both icon and (text or textLines) are required for icon-text button type', 'ui');
            return null;
        }

        // Validate textLines structure if provided
        if (textLines && !Array.isArray(textLines)) {
            error('textLines must be an array', 'ui');
            return null;
        }

        if (textLines && textLines.length === 0) {
            error('textLines array cannot be empty', 'ui');
            return null;
        }

        if (textLines && textLines.some(line => !line || typeof line.text !== 'string')) {
            error('each textLines entry must be an object with a text property (string)', 'ui');
            return null;
        }

        // Branch based on button creation method
        if (useNineSlice) {
            return ButtonFactory._createNineSliceButton(scene, config);
        } else {
            return ButtonFactory._createProgrammaticButton(scene, config);
        }
    }

    /**
     * Normalize text input to array format
     * Converts single text string or textLines array to normalized array of text line objects
     * @private
     * @param {string|Array<Object>|undefined} text - Single text string (backward compatible)
     * @param {Array<Object>|undefined} textLines - Array of text line objects
     * @param {string|undefined} secondaryText - Secondary text (deprecated, converted to array)
     * @param {number} defaultTextPercentY - Default percentY for text lines
     * @param {number} defaultTextScale - Default textScale for text lines
     * @param {number} textPercentY - percentY for single text (if text is string)
     * @param {number} textScale - textScale for single text (if text is string)
     * @returns {Array<Object>} Normalized array of text line objects with defaults applied
     */
    static _normalizeTextLines(text, textLines, secondaryText, defaultTextPercentY, defaultTextScale, textPercentY, textScale) {
        const normalizedLines = [];

        // Priority: textLines > text + secondaryText > text
        if (textLines && Array.isArray(textLines)) {
            // Use textLines array, apply defaults for missing properties
            textLines.forEach(line => {
                normalizedLines.push({
                    text: line.text,
                    percentY: line.percentY !== undefined ? line.percentY : defaultTextPercentY,
                    textScale: line.textScale !== undefined ? line.textScale : defaultTextScale,
                    textStyle: line.textStyle || {}
                });
            });
        } else if (text) {
            // Single text string (backward compatible)
            normalizedLines.push({
                text: text,
                percentY: textPercentY,
                textScale: textScale,
                textStyle: {}
            });

            // Add secondaryText if provided (deprecated but supported)
            if (secondaryText) {
                // Secondary text typically uses smaller scale (60% of primary) and offset position
                normalizedLines.push({
                    text: secondaryText,
                    percentY: defaultTextPercentY + 0.1, // Slightly below center
                    textScale: textScale * 0.6,
                    textStyle: {}
                });
            }
        }

        return normalizedLines;
    }

    /**
     * Create Phaser text objects from normalized text lines
     * @private
     * @param {Phaser.Scene} scene - Phaser scene instance
     * @param {Phaser.GameObjects.Container} container - Container to add text objects to
     * @param {Array<Object>} normalizedLines - Normalized array of text line objects
     * @param {number} buttonHeight - Button height for calculating font size and positioning
     * @param {boolean} isLarge - Whether button is large (aspectRatio >= 2.0)
     * @param {boolean} useNineSlice - Whether using 9-slice (affects startScale)
     * @param {number} startScale - Start scale for 9-slice buttons
     * @param {Object} [globalTextStyle] - Global text style to merge with per-line styles
     * @returns {Array<Phaser.GameObjects.Text>} Array of created text objects
     */
    static _createTextLines(scene, container, normalizedLines, buttonHeight, isLarge, useNineSlice = false, startScale = 1.0, globalTextStyle = {}) {
        // Get font from theme if available
        // Project-agnostic theme data access: prefer scene.themeData, fallback to prefab_ScratchManager for backward compatibility
        const theme = scene.themeData || (scene.prefab_ScratchManager && scene.prefab_ScratchManager.themeData);
        // Get font config from controlBar.font (new schema) or controlBar.fontFamily (old schema for backward compatibility)
        const fontConfig = theme?.controlBar?.font || theme?.controlBar?.fontFamily || "Lato-Bold";
        const { fontFamily, fontWeight } = FontUtils.getFontFamily(fontConfig, theme);
        const themeFontFamily = FontUtils.getSafeFontFamily(fontFamily);

        const textObjects = [];
        const effectiveButtonHeight = useNineSlice ? buttonHeight * startScale : buttonHeight;

        normalizedLines.forEach((line, index) => {
            // Calculate fontSize based on textScale
            const calculatedFontSize = Math.round(effectiveButtonHeight * line.textScale);
            const fontSize = `${calculatedFontSize}px`;

            // Default text style with theme font
            // Merge order: default < globalTextStyle < line.textStyle (line-specific overrides take precedence)
            const defaultTextStyle = {
                align: "center",
                color: "#ffffffff",
                fontFamily: themeFontFamily,
                fontSize: fontSize,
                fontStyle: "bold",
                stroke: "#000000ff",
                ...globalTextStyle,
                ...line.textStyle
            };

            // Add fontWeight if specified (for Google Fonts) - must be number
            if (fontWeight) {
                defaultTextStyle.fontWeight = parseInt(fontWeight) || null;
            }

            const textObj = scene.add.text(0, 0, line.text, {});
            textObj.setOrigin(0.5, 0.5);
            textObj.setStyle(defaultTextStyle);
            
            // Apply vertical positioning using percentY
            textObj.y = (line.percentY - 0.5) * effectiveButtonHeight;
            
            container.add(textObj);
            textObjects.push(textObj);

            // Apply contentColor if available
            // Project-agnostic theme data access: prefer scene.themeData, fallback to prefab_ScratchManager for backward compatibility
            const themeForColor = scene.themeData || (scene.prefab_ScratchManager && scene.prefab_ScratchManager.themeData);
            // Use controlBar.palette.secondaryColor with default fallback
            const contentColor = themeForColor?.controlBar?.palette?.secondaryColor || "#ffffff";
            const contentColorStr = typeof contentColor === 'string' ? contentColor : String(contentColor || '#ffffff');
            const contentColorHex = contentColorStr.replace("#", "").substring(0, 6);
            const contentColorHexString = `#${contentColorHex}`;
            textObj.setStyle({ color: contentColorHexString });
        });

        return textObjects;
    }

    /**
     * Create a 9-slice button (legacy method)
     * @private
     */
    static _createNineSliceButton(scene, config) {
        const {
            label,
            buttonType,
            aspectRatio = 1.0,
            startScale = 1.0,
            position = { x: 0, y: 0 },
            origin = { ...ButtonFactory.DEFAULT_ORIGIN },
            hitArea,
            themeSupport = true,
            icon,
            iconScale = ButtonFactory.DEFAULT_ICON_SCALE,
            iconLabel,
            iconPercentY = ButtonFactory.DEFAULT_ICON_PERCENT_Y,
            text,
            textLines,
            textScale = ButtonFactory.DEFAULT_TEXT_SCALE,
            textPercentY = ButtonFactory.DEFAULT_TEXT_PERCENT_Y,
            textStyle,
            secondaryText,
            secondaryTextStyle
        } = config;

        // Calculate button dimensions using aspectRatio
        // Base height: 150 (from square preset)
        const baseHeight = 150;
        const calculatedWidth = baseHeight * aspectRatio;
        
        // Calculate edge sizes based on aspectRatio
        // For aspectRatio = 1.0: leftWidth: 40, rightWidth: 42, topHeight: 35, bottomHeight: 35
        // For aspectRatio = 2.0: leftWidth: 53, rightWidth: 51, topHeight: 40, bottomHeight: 40
        // Interpolate for other values
        let leftWidth, rightWidth, topHeight, bottomHeight;
        if (aspectRatio === 1.0) {
            // Square preset values
            leftWidth = 40;
            rightWidth = 42;
            topHeight = 35;
            bottomHeight = 35;
        } else if (aspectRatio === 2.0) {
            // Rect preset values
            leftWidth = 53;
            rightWidth = 51;
            topHeight = 40;
            bottomHeight = 40;
        } else {
            // Interpolate between square and rect values
            // Linear interpolation: value = squareValue + (rectValue - squareValue) * (aspectRatio - 1.0)
            const t = (aspectRatio - 1.0) / (2.0 - 1.0); // Normalize between 1.0 and 2.0
            leftWidth = Math.round(40 + (53 - 40) * t);
            rightWidth = Math.round(42 + (51 - 42) * t);
            topHeight = Math.round(35 + (40 - 35) * t);
            bottomHeight = topHeight;
        }
        
        // Calculate hit areas (90% of button size, centered)
        const hitAreaWidth = calculatedWidth * 0.9;
        const hitAreaHeight = baseHeight * 0.9;
        const defaultContainerHitArea = {
            x: -hitAreaWidth / 2,
            y: -hitAreaHeight / 2,
            width: hitAreaWidth,
            height: hitAreaHeight
        };
        
        const preset = {
            containerHitArea: defaultContainerHitArea,
            nineslice: {
                width: calculatedWidth,
                height: baseHeight,
                leftWidth: leftWidth,
                rightWidth: rightWidth,
                topHeight: topHeight,
                bottomHeight: bottomHeight
            },
            ninesliceHitArea: {
                x: 0,
                y: 0,
                width: hitAreaWidth,
                height: hitAreaHeight
            }
        };

        // Get button dimensions for origin calculation
        const baseButtonWidth = preset.nineslice.width;
        const baseButtonHeight = preset.nineslice.height;
        // Account for startScale since the button will be scaled
        const buttonWidth = baseButtonWidth * startScale;
        const buttonHeight = baseButtonHeight * startScale;
        
        // Calculate origin offset
        // Since container position currently represents center (0.5, 0.5), we adjust based on desired origin
        // To move from center (0.5) to desired origin, we calculate: (currentOrigin - desiredOrigin) * dimension
        // For bottom-center (0.5, 1.0): offsetY = (0.5 - 1.0) * height = -0.5 * height (move up)
        // This moves the container up so its bottom-center aligns with the position
        const offsetX = (0.5 - origin.x) * buttonWidth;
        const offsetY = (0.5 - origin.y) * buttonHeight;
        
        // Debug logging
        debug('Origin calculation:', 'ui', {
            label,
            origin: { x: origin.x, y: origin.y },
            baseDimensions: { width: baseButtonWidth, height: baseButtonHeight },
            startScale,
            scaledDimensions: { width: buttonWidth, height: buttonHeight },
            offset: { x: offsetX, y: offsetY },
            originalPosition: position,
            finalPosition: { x: position.x + offsetX, y: position.y + offsetY }
        });
        
        // Create container with origin-adjusted position
        const container = scene.add.container(position.x + offsetX, position.y + offsetY);
        container.label = label; // Set label for finding buttons later
        
        const containerHitArea = hitArea || preset.containerHitArea;
        container.setInteractive(
            new Phaser.Geom.Rectangle(containerHitArea.x, containerHitArea.y, containerHitArea.width, containerHitArea.height),
            Phaser.Geom.Rectangle.Contains
        );

        // Create NineSlice background
        const ninesliceConfig = preset.nineslice;
        const ninesliceHitArea = preset.ninesliceHitArea;
        const nineslice = scene.add.nineslice(
            0, 0,
            "Btn_Main",
            undefined,
            ninesliceConfig.width,
            ninesliceConfig.height,
            ninesliceConfig.leftWidth,
            ninesliceConfig.rightWidth,
            ninesliceConfig.topHeight,
            ninesliceConfig.bottomHeight
        );
        nineslice.setInteractive(
            new Phaser.Geom.Rectangle(ninesliceHitArea.x, ninesliceHitArea.y, ninesliceHitArea.width, ninesliceHitArea.height),
            Phaser.Geom.Rectangle.Contains
        );
        // Set label for finding nineslice later (pattern: soundButton -> soundBtn_Main, infoButton -> infoBtn_Main)
        const ninesliceLabel = label.replace('Button', 'Btn') + '_Main';
        nineslice.label = ninesliceLabel;
        container.add(nineslice);

        // Add theme support if enabled
        let content = null;
        if (themeSupport) {
            // Create OnAwake → OnEvent → setThemeColor chain
            // Pattern: OnAwake(parent=nineslice) → OnEvent(parent=OnAwake) → setThemeColor(parent=OnEvent)
            const onAwake = new OnAwake(nineslice);
            const onEvent = new OnEvent(onAwake);
            onEvent.eventName = "onGameInitalized";
            onEvent.eventEmitter = "scene.events";
            new setThemeColor(onEvent);
            
            // Manually awaken the script node chain since buttons are created after scene-awake
            // OnAwake.awake() calls executeChildren() which calls execute() on children
            // But OnEvent needs awake() to be called to set up the event listener
            try {
                // Call awake() on OnEvent to set up the listener for "onGameInitalized"
                onEvent.awake();
                debug(`Manually awakened OnEvent script node for button: ${label}`, 'ui');
            } catch (e) {
                warn(`Failed to manually awaken OnEvent script node: ${e}`, 'ui');
            }
        }

        // Determine if button is "large" based on aspectRatio (for text sizing)
        // Consider large if aspectRatio >= 2.0 (equivalent to old 'rect' preset)
        const isLarge = aspectRatio >= 2.0;

        // Create content based on button type
        if (buttonType === 'icon') {
            const iconImage = scene.add.image(0, 0, icon);
            
            // Calculate icon scale relative to button dimensions
            // iconScale is now a multiplier of the button size (e.g., 1.0 = 100% of button, 0.75 = 75% of button)
            let calculatedScale = 0.75; // Default fallback
            
            if (typeof iconScale === 'number' && iconScale > 0) {
                // Get button dimensions from preset
                const buttonWidth = preset.nineslice.width;
                const buttonHeight = preset.nineslice.height;
                
                // Get icon texture dimensions
                if (scene.textures.exists(icon)) {
                    const iconTexture = scene.textures.get(icon);
                    const iconWidth = iconTexture.source[0].width || iconTexture.width || 128;
                    const iconHeight = iconTexture.source[0].height || iconTexture.height || 128;
                    
                    // Calculate target size (button size * iconScale)
                    const targetWidth = buttonWidth * iconScale;
                    const targetHeight = buttonHeight * iconScale;
                    
                    // Calculate scale needed to fit icon within target size (maintain aspect ratio)
                    const scaleX = targetWidth / iconWidth;
                    const scaleY = targetHeight / iconHeight;
                    // Use smaller scale to ensure icon fits within button
                    calculatedScale = Math.min(scaleX, scaleY);
                } else {
                    // Texture not found, use fallback
                    warn(`Icon texture '${icon}' not found, using default scale`, 'ui');
                    calculatedScale = iconScale;
                }
            }
            
            iconImage.scaleX = calculatedScale;
            iconImage.scaleY = calculatedScale;
            
            // Apply contentColor if available
            // Project-agnostic theme data access: prefer scene.themeData, fallback to prefab_ScratchManager for backward compatibility
            const theme = scene.themeData || (scene.prefab_ScratchManager && scene.prefab_ScratchManager.themeData);
            // Use controlBar.palette.secondaryColor with default fallback
            const contentColor = theme?.controlBar?.palette?.secondaryColor || "#ffffff";
            const contentColorStr = typeof contentColor === 'string' ? contentColor : String(contentColor || '#ffffff');
            const contentColorHex = contentColorStr.replace("#", "").substring(0, 6);
            const contentColorTint = parseInt(contentColorHex, 16);
            iconImage.setTintFill(contentColorTint);
            debug(`Applied contentColor to 9-slice icon: ${contentColor}, tint: ${contentColorTint}`, 'ui');
            
            container.add(iconImage);
            content = iconImage;
            
            // Store reference on scene if iconLabel provided
            if (iconLabel) {
                scene[iconLabel] = iconImage;
            }
        } else if (buttonType === 'text') {
            // Normalize text input to array format
            const normalizedLines = ButtonFactory._normalizeTextLines(
                text, textLines, secondaryText,
                ButtonFactory.DEFAULT_TEXT_PERCENT_Y,
                ButtonFactory.DEFAULT_TEXT_SCALE,
                textPercentY, textScale
            );

            // Create text lines using helper function
            const buttonHeight = baseHeight * startScale;
            const textObjects = ButtonFactory._createTextLines(
                scene, container, normalizedLines,
                baseHeight, isLarge, true, startScale, textStyle || {}
            );

            // Set content to first text object (for backward compatibility)
            content = textObjects[0];

            // Apply startScale to container if provided (after all content is added)
            if (startScale !== undefined && startScale !== 1.0) {
                container.setScale(startScale, startScale);
            }

            // Return textContent as single object or array based on number of lines
            const returnObj = {
                container,
                nineslice,
                content,
                label
            };

            if (textObjects.length === 1) {
                // Single text line - return as object for backward compatibility
                returnObj.textContent = textObjects[0];
            } else {
                // Multiple text lines - return as array
                returnObj.textContent = textObjects;
            }

            // Include secondaryContent for backward compatibility if secondaryText was used
            if (secondaryText && textObjects.length > 1) {
                returnObj.secondaryContent = textObjects[1];
            }

            return returnObj;
        } else if (buttonType === 'icon-text') {
            // Create icon
            const iconImage = scene.add.image(0, 0, icon);
            
            // Calculate icon scale relative to button dimensions
            let calculatedIconScale = 0.75; // Default fallback
            
            if (typeof iconScale === 'number' && iconScale > 0) {
                const buttonWidth = preset.nineslice.width;
                const buttonHeight = preset.nineslice.height;
                
                if (scene.textures.exists(icon)) {
                    const iconTexture = scene.textures.get(icon);
                    const iconWidth = iconTexture.source[0].width || iconTexture.width || 128;
                    const iconHeight = iconTexture.source[0].height || iconTexture.height || 128;
                    
                    const targetWidth = buttonWidth * iconScale;
                    const targetHeight = buttonHeight * iconScale;
                    
                    const scaleX = targetWidth / iconWidth;
                    const scaleY = targetHeight / iconHeight;
                    calculatedIconScale = Math.min(scaleX, scaleY);
                } else {
                    warn(`[ButtonFactory] Icon texture '${icon}' not found, using default scale`);
                    calculatedIconScale = iconScale;
                }
            }
            
            iconImage.scaleX = calculatedIconScale;
            iconImage.scaleY = calculatedIconScale;
            // Apply vertical positioning using iconPercentY
            const buttonHeight = baseHeight * startScale;
            iconImage.y = (iconPercentY - 0.5) * buttonHeight;
            container.add(iconImage);
            content = iconImage;
            
            // Store reference on scene if iconLabel provided
            if (iconLabel) {
                scene[iconLabel] = iconImage;
            }
            
            // Normalize text input to array format
            const normalizedLines = ButtonFactory._normalizeTextLines(
                text, textLines, secondaryText,
                ButtonFactory.DEFAULT_TEXT_PERCENT_Y,
                ButtonFactory.DEFAULT_TEXT_SCALE,
                textPercentY, textScale
            );

            // Create text lines using helper function
            const textObjects = ButtonFactory._createTextLines(
                scene, container, normalizedLines,
                baseHeight, isLarge, true, startScale, textStyle || {}
            );

            // Apply startScale to container if provided (after all content is added)
            if (startScale !== undefined && startScale !== 1.0) {
                container.setScale(startScale, startScale);
            }

            // Return textContent as single object or array based on number of lines
            const returnObj = {
                container,
                nineslice,
                content,
                label
            };

            if (textObjects.length === 1) {
                // Single text line - return as object for backward compatibility
                returnObj.textContent = textObjects[0];
            } else {
                // Multiple text lines - return as array
                returnObj.textContent = textObjects;
            }

            // Include secondaryContent for backward compatibility if secondaryText was used
            if (secondaryText && textObjects.length > 1) {
                returnObj.secondaryContent = textObjects[1];
            }

            return returnObj;
        }

        // Apply startScale to container if provided (after all content is added)
        if (startScale !== undefined && startScale !== 1.0) {
            container.setScale(startScale, startScale);
        }

        return {
            container,
            nineslice,
            content,
            label
        };
    }

    /**
     * Create a programmatic gradient button
     * @private
     */
    static _createProgrammaticButton(scene, config) {
        debug('_createProgrammaticButton: Received config object:', 'ui', config);
        debug(`_createProgrammaticButton: config.heightPercent value: ${config.heightPercent}, type: ${typeof config.heightPercent}`, 'ui');
        debug(`_createProgrammaticButton: config.hasOwnProperty("heightPercent"): ${config.hasOwnProperty('heightPercent')}`, 'ui');
        debug(`_createProgrammaticButton: config keys: ${Object.keys(config).join(', ')}`, 'ui');
        
        const {
            label,
            buttonType,
            aspectRatio = 1.0,
            heightPercent = (() => {
                // Get default from defaults.json layout config
                const defaultsConfig = getCachedLayoutConfig('defaults') || {};
                return getContentHeightPercent(defaultsConfig, null, null) || 0.08;
            })(), // Default from controlBar.contentHeight.percent in defaults.json
            cornerRadius = GameConfig.ui.DEFAULT_CORNER_RADIUS,
            position = { ...ButtonFactory.DEFAULT_POSITION },
            origin = { ...ButtonFactory.DEFAULT_ORIGIN },
            hitArea,
            icon,
            iconScale = ButtonFactory.DEFAULT_ICON_SCALE,
            iconLabel,
            iconPercentY = ButtonFactory.DEFAULT_ICON_PERCENT_Y,
            text,
            textLines,
            textScale = ButtonFactory.DEFAULT_TEXT_SCALE,
            textPercentY = ButtonFactory.DEFAULT_TEXT_PERCENT_Y,
            textStyle,
            secondaryText,
            secondaryTextStyle
        } = config;

        // Log heightPercent value received
        debug(`[ButtonFactory] _createProgrammaticButton for label "${label}":`, 'ui');
        debug(`  - heightPercent from config: ${heightPercent}`, 'ui');
        debug(`  - scene.scale.height: ${scene.scale.height}`, 'ui');
        debug(`  - aspectRatio: ${aspectRatio}`, 'ui');

        // Calculate button dimensions from heightPercent
        const buttonHeight = scene.scale.height * heightPercent;
        const buttonWidth = buttonHeight * aspectRatio;
        
        debug(`  - calculated buttonHeight: ${buttonHeight}`, 'ui');
        debug(`  - calculated buttonWidth: ${buttonWidth}`, 'ui');
        debug(`  - calculation: ${scene.scale.height} * ${heightPercent} = ${buttonHeight}`, 'ui');

        // Calculate origin offset (no startScale for programmatic buttons)
        const offsetX = (0.5 - origin.x) * buttonWidth;
        const offsetY = (0.5 - origin.y) * buttonHeight;

        // Create container with origin-adjusted position
        const container = scene.add.container(position.x + offsetX, position.y + offsetY);
        container.label = label;

        // Calculate hit area (90% of button size, centered)
        const hitAreaWidth = buttonWidth * 0.9;
        const hitAreaHeight = buttonHeight * 0.9;
        const containerHitArea = hitArea || {
            x: -hitAreaWidth / 2,
            y: -hitAreaHeight / 2,
            width: hitAreaWidth,
            height: hitAreaHeight
        };
        container.setInteractive(
            new Phaser.Geom.Rectangle(containerHitArea.x, containerHitArea.y, containerHitArea.width, containerHitArea.height),
            Phaser.Geom.Rectangle.Contains
        );

        // Get tint color from theme
        // Project-agnostic theme data access: prefer scene.themeData, fallback to prefab_ScratchManager for backward compatibility
        const theme = scene.themeData || (scene.prefab_ScratchManager && scene.prefab_ScratchManager.themeData);
        // Use controlBar.palette.primaryColor with default fallback
        const tintColor = theme?.controlBar?.palette?.primaryColor || "#5700b9";
        debug('Programmatic button color access:', 'ui', {
            context: 'programmatic button tintColor',
            hasSceneThemeData: !!scene.themeData,
            hasPrefabThemeData: !!(scene.prefab_ScratchManager && scene.prefab_ScratchManager.themeData),
            source: theme === scene.themeData ? 'scene.themeData' : 'prefab_ScratchManager.themeData',
            hasTheme: !!theme,
            palettePrimaryColor: theme?.controlBar?.palette?.primaryColor || 'NOT FOUND',
            finalColor: tintColor
        });
        debug(`Using button color: ${tintColor}`, 'ui');

        // Create gradient background
        const background = ButtonFactory._createGradientButtonBackground(scene, buttonWidth, buttonHeight, tintColor, cornerRadius);
        background.disableInteractive();
        container.add(background);
        // Store reference to background for later updates
        container.bg = background;

        // Determine if button is "large" based on aspectRatio (for text sizing)
        const isLarge = aspectRatio >= 2.0;

        // Create content based on button type
        let content = null;
        if (buttonType === 'icon') {
            const iconImage = scene.add.image(0, 0, icon);
            
            // Calculate icon scale relative to button dimensions
            let calculatedScale = 0.75; // Default fallback
            
            if (typeof iconScale === 'number' && iconScale > 0) {
                // Get icon texture dimensions
                if (scene.textures.exists(icon)) {
                    const iconTexture = scene.textures.get(icon);
                    const iconWidth = iconTexture.source[0].width || iconTexture.width || 128;
                    const iconHeight = iconTexture.source[0].height || iconTexture.height || 128;
                    
                    // Calculate target size (button size * iconScale)
                    const targetWidth = buttonWidth * iconScale;
                    const targetHeight = buttonHeight * iconScale;
                    
                    // Calculate scale needed to fit icon within target size (maintain aspect ratio)
                    const scaleX = targetWidth / iconWidth;
                    const scaleY = targetHeight / iconHeight;
                    // Use smaller scale to ensure icon fits within button
                    calculatedScale = Math.min(scaleX, scaleY);
                } else {
                    warn(`[ButtonFactory] Icon texture '${icon}' not found, using default scale`);
                    calculatedScale = iconScale;
                }
            }
            
            iconImage.scaleX = calculatedScale;
            iconImage.scaleY = calculatedScale;
            
            // Apply contentColor if available (using theme variable already declared above)
            // Use controlBar.palette.secondaryColor with default fallback
            const contentColor = theme?.controlBar?.palette?.secondaryColor || "#ffffff";
            const contentColorStr = typeof contentColor === 'string' ? contentColor : String(contentColor || '#ffffff');
            const contentColorHex = contentColorStr.replace("#", "").substring(0, 6);
            const contentColorTint = parseInt(contentColorHex, 16);
            iconImage.setTintFill(contentColorTint);
            debug(`Applied contentColor to icon: ${contentColor}, tint: ${contentColorTint}`, 'ui');
            
            container.add(iconImage);
            content = iconImage;
            
            // Store reference on scene if iconLabel provided
            if (iconLabel) {
                scene[iconLabel] = iconImage;
            }
        } else if (buttonType === 'text') {
            // Normalize text input to array format
            const normalizedLines = ButtonFactory._normalizeTextLines(
                text, textLines, secondaryText,
                ButtonFactory.DEFAULT_TEXT_PERCENT_Y,
                ButtonFactory.DEFAULT_TEXT_SCALE,
                textPercentY, textScale
            );

            // Create text lines using helper function
            const textObjects = ButtonFactory._createTextLines(
                scene, container, normalizedLines,
                buttonHeight, isLarge, false, 1.0, textStyle || {}
            );

            // Set content to first text object (for backward compatibility)
            content = textObjects[0];

            // Return textContent as single object or array based on number of lines
            const returnObj = {
                container,
                background,
                content,
                label
            };

            if (textObjects.length === 1) {
                // Single text line - return as object for backward compatibility
                returnObj.textContent = textObjects[0];
            } else {
                // Multiple text lines - return as array
                returnObj.textContent = textObjects;
            }

            // Include secondaryContent for backward compatibility if secondaryText was used
            if (secondaryText && textObjects.length > 1) {
                returnObj.secondaryContent = textObjects[1];
            }

            return returnObj;
        } else if (buttonType === 'icon-text') {
            // Create icon
            const iconImage = scene.add.image(0, 0, icon);
            
            // Calculate icon scale relative to button dimensions
            let calculatedIconScale = 0.75; // Default fallback
            
            if (typeof iconScale === 'number' && iconScale > 0) {
                if (scene.textures.exists(icon)) {
                    const iconTexture = scene.textures.get(icon);
                    const iconWidth = iconTexture.source[0].width || iconTexture.width || 128;
                    const iconHeight = iconTexture.source[0].height || iconTexture.height || 128;
                    
                    const targetWidth = buttonWidth * iconScale;
                    const targetHeight = buttonHeight * iconScale;
                    
                    const scaleX = targetWidth / iconWidth;
                    const scaleY = targetHeight / iconHeight;
                    calculatedIconScale = Math.min(scaleX, scaleY);
                } else {
                    warn(`[ButtonFactory] Icon texture '${icon}' not found, using default scale`);
                    calculatedIconScale = iconScale;
                }
            }
            
            iconImage.scaleX = calculatedIconScale;
            iconImage.scaleY = calculatedIconScale;
            // Apply vertical positioning using iconPercentY
            iconImage.y = (iconPercentY - 0.5) * buttonHeight;
            container.add(iconImage);
            content = iconImage;
            
            // Store reference on scene if iconLabel provided
            if (iconLabel) {
                scene[iconLabel] = iconImage;
            }
            
            // Normalize text input to array format
            const normalizedLines = ButtonFactory._normalizeTextLines(
                text, textLines, secondaryText,
                ButtonFactory.DEFAULT_TEXT_PERCENT_Y,
                ButtonFactory.DEFAULT_TEXT_SCALE,
                textPercentY, textScale
            );

            // Create text lines using helper function
            const textObjects = ButtonFactory._createTextLines(
                scene, container, normalizedLines,
                buttonHeight, isLarge, false, 1.0, textStyle || {}
            );

            // Return textContent as single object or array based on number of lines
            const returnObj = {
                container,
                background,
                content,
                label
            };

            if (textObjects.length === 1) {
                // Single text line - return as object for backward compatibility
                returnObj.textContent = textObjects[0];
            } else {
                // Multiple text lines - return as array
                returnObj.textContent = textObjects;
            }

            // Include secondaryContent for backward compatibility if secondaryText was used
            if (secondaryText && textObjects.length > 1) {
                returnObj.secondaryContent = textObjects[1];
            }

            return returnObj;
        }

        return {
            container,
            background,
            content,
            label
        };
    }

    /**
     * Find a button in a parent container by label
     * @param {Phaser.GameObjects.Container} parentContainer - Parent container to search
     * @param {string} label - Button label to find
     * @returns {Phaser.GameObjects.Container|null} Button container or null if not found
     */
    static findButtonInContainer(parentContainer, label) {
        if (!parentContainer || !parentContainer.list) {
            return null;
        }
        return parentContainer.list.find(child => child.label === label && child.type === 'Container') || null;
    }

    /**
     * Generate scene file JSON definition for a button
     * This can be used to manually add button definitions to scene files
     * @param {Object} config - Button configuration (same as createButton)
     * @param {string} [buttonId] - Optional UUID for button (generated if not provided)
     * @param {string} [ninesliceId] - Optional UUID for nineslice (generated if not provided)
     * @param {string} [contentId] - Optional UUID for content (generated if not provided)
     * @param {string} [onAwakeId] - Optional UUID for OnAwake script node (generated if not provided)
     * @param {string} [onEventId] - Optional UUID for OnEvent script node (generated if not provided)
     * @param {string} [setThemeColorId] - Optional UUID for setThemeColor script node (generated if not provided)
     * @returns {Object} Scene file JSON definition
     */
    static createSceneDefinition(config, buttonId, ninesliceId, contentId, onAwakeId, onEventId, setThemeColorId) {
        // Generate UUIDs if not provided
        const generateUUID = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };

        const {
            label,
            buttonType,
            aspectRatio = 1.0,
            position = { x: 0, y: 0 },
            hitArea,
            themeSupport = true,
            icon,
            iconScale = 0.75,
            iconLabel,
            text,
            textLines,
            textStyle
        } = config;

        // Calculate preset using same logic as createButton
        const baseHeight = 150;
        const calculatedWidth = baseHeight * aspectRatio;
        let leftWidth, rightWidth, topHeight, bottomHeight;
        if (aspectRatio === 1.0) {
            leftWidth = 40;
            rightWidth = 42;
            topHeight = 35;
            bottomHeight = 35;
        } else if (aspectRatio === 2.0) {
            leftWidth = 53;
            rightWidth = 51;
            topHeight = 40;
            bottomHeight = 40;
        } else {
            const t = (aspectRatio - 1.0) / (2.0 - 1.0);
            leftWidth = Math.round(40 + (53 - 40) * t);
            rightWidth = Math.round(42 + (51 - 42) * t);
            topHeight = Math.round(35 + (40 - 35) * t);
            bottomHeight = topHeight;
        }
        const hitAreaWidth = calculatedWidth * 0.9;
        const hitAreaHeight = baseHeight * 0.9;
        const containerHitArea = hitArea || {
            x: -hitAreaWidth / 2,
            y: -hitAreaHeight / 2,
            width: hitAreaWidth,
            height: hitAreaHeight
        };
        
        const preset = {
            containerHitArea: containerHitArea,
            nineslice: {
                width: calculatedWidth,
                height: baseHeight,
                leftWidth: leftWidth,
                rightWidth: rightWidth,
                topHeight: topHeight,
                bottomHeight: bottomHeight
            },
            ninesliceHitArea: {
                x: 0,
                y: 0,
                width: hitAreaWidth,
                height: hitAreaHeight
            }
        };

        const definition = {
            type: "Container",
            id: buttonId || generateUUID(),
            label: label,
            "hitArea.shape": "RECTANGLE",
            "hitArea.x": containerHitArea.x,
            "hitArea.y": containerHitArea.y,
            "hitArea.width": containerHitArea.width,
            "hitArea.height": containerHitArea.height,
            x: position.x,
            y: position.y,
            list: []
        };

        // Add NineSlice background
        const ninesliceConfig = preset.nineslice;
        const ninesliceHitArea = preset.ninesliceHitArea;
        const ninesliceDef = {
            type: "NineSlice",
            id: ninesliceId || generateUUID(),
            label: `${label}_Main`,
            "hitArea.shape": "RECTANGLE",
            "hitArea.width": ninesliceHitArea.width,
            "hitArea.height": ninesliceHitArea.height,
            texture: {
                key: "Btn_Main"
            },
            leftWidth: ninesliceConfig.leftWidth,
            rightWidth: ninesliceConfig.rightWidth,
            topHeight: ninesliceConfig.topHeight,
            bottomHeight: ninesliceConfig.bottomHeight,
            width: ninesliceConfig.width,
            height: ninesliceConfig.height,
            list: []
        };

        // Add theme support script nodes if enabled
        if (themeSupport) {
            const setThemeColorDef = {
                prefabId: ButtonFactory.SET_THEME_COLOR_PREFAB_ID,
                id: setThemeColorId || generateUUID(),
                label: "setThemeColor"
            };

            // Scene file structure: OnAwake prefab with OnEvent properties, containing setThemeColor
            // Note: Phaser Editor uses OnAwake prefab ID but with OnEvent configuration
            const onEventDef = {
                prefabId: ButtonFactory.ON_AWAKE_PREFAB_ID,
                id: onEventId || generateUUID(),
                label: `onEvent_${label}`,
                unlock: ["eventName", "eventEmitter"],
                eventName: "onGameInitalized",
                eventEmitter: "scene.events",
                list: [setThemeColorDef]
            };

            ninesliceDef.list.push(onEventDef);
        }

        definition.list.push(ninesliceDef);

        // Add content based on button type
        if (buttonType === 'icon' && icon) {
            const iconDef = {
                type: "Image",
                id: contentId || generateUUID(),
                texture: {
                    key: icon
                },
                scaleX: iconScale,
                scaleY: iconScale
            };
            if (iconLabel) {
                iconDef.label = iconLabel;
                iconDef.scope = "CLASS";
            }
            definition.list.push(iconDef);
        } else if (buttonType === 'icon-text' && icon && (text || textLines)) {
            // Add icon
            const iconDef = {
                type: "Image",
                id: contentId || generateUUID(),
                texture: {
                    key: icon
                },
                scaleX: iconScale,
                scaleY: iconScale
            };
            if (iconLabel) {
                iconDef.label = iconLabel;
                iconDef.scope = "CLASS";
            }
            definition.list.push(iconDef);
            
            // Add text lines
            const isLarge = aspectRatio >= 2.0;
            const normalizedLines = ButtonFactory._normalizeTextLines(
                text, textLines, undefined,
                ButtonFactory.DEFAULT_TEXT_PERCENT_Y,
                ButtonFactory.DEFAULT_TEXT_SCALE,
                ButtonFactory.DEFAULT_TEXT_PERCENT_Y,
                ButtonFactory.DEFAULT_TEXT_SCALE
            );

            normalizedLines.forEach((line, index) => {
                const defaultTextStyle = {
                    align: "center",
                    color: "#ffffffff",
                    fontFamily: "Lato-Bold",
                    fontSize: isLarge ? "60px" : "40px",
                    fontStyle: "bold",
                    stroke: "#000000ff",
                    ...line.textStyle,
                    ...textStyle
                };

                const textDef = {
                    type: "Text",
                    id: index === 0 ? (contentId || generateUUID()) : generateUUID(),
                    label: index === 0 ? `${label}Text` : `${label}Text${index + 1}`,
                    originX: 0.5,
                    originY: 0.5,
                    text: line.text,
                    ...defaultTextStyle
                };
                definition.list.push(textDef);
            });
        } else if (buttonType === 'text' && (text || textLines)) {
            const isLarge = aspectRatio >= 2.0;
            const normalizedLines = ButtonFactory._normalizeTextLines(
                text, textLines, undefined,
                ButtonFactory.DEFAULT_TEXT_PERCENT_Y,
                ButtonFactory.DEFAULT_TEXT_SCALE,
                ButtonFactory.DEFAULT_TEXT_PERCENT_Y,
                ButtonFactory.DEFAULT_TEXT_SCALE
            );

            normalizedLines.forEach((line, index) => {
                const defaultTextStyle = {
                    align: "center",
                    color: "#ffffffff",
                    fontFamily: "Lato-Bold",
                    fontSize: isLarge ? "60px" : "40px",
                    fontStyle: "bold",
                    stroke: "#000000ff",
                    ...line.textStyle,
                    ...textStyle
                };

                const textDef = {
                    type: "Text",
                    id: index === 0 ? (contentId || generateUUID()) : generateUUID(),
                    label: index === 0 ? `${label}Text` : `${label}Text${index + 1}`,
                    originX: 0.5,
                    originY: 0.5,
                    text: line.text,
                    ...defaultTextStyle
                };
                definition.list.push(textDef);
            });
        }

        return definition;
    }

    /**
     * Update button background color after theme loads
     * @param {Phaser.Scene} scene - Phaser scene instance
     * @param {Object} buttonResult - Button result object from createButton (must have background and container)
     * @param {number} [cornerRadius] - Corner radius (defaults to DEFAULT_CORNER_RADIUS = 0.3)
     */
    static updateButtonBackgroundColor(scene, buttonResult, cornerRadius = null) {
        if (!buttonResult || !buttonResult.background || !buttonResult.container) {
            warn('[ButtonFactory] updateButtonBackgroundColor: Invalid button result, missing background or container');
            return;
        }

        // Get theme data
        const theme = scene.themeData || (scene.prefab_ScratchManager && scene.prefab_ScratchManager.themeData);
        if (!theme) {
            warn('[ButtonFactory] updateButtonBackgroundColor: Theme data not available');
            return; // Don't update if theme not available
        }
        
        // Use controlBar.palette.primaryColor with default fallback
        const tintColor = theme?.controlBar?.palette?.primaryColor || "#5700b9";
        debug('updateButtonBackgroundColor:', 'ui', {
            palettePrimaryColor: theme?.controlBar?.palette?.primaryColor || 'NOT FOUND',
            finalColor: tintColor
        });

        // Get button dimensions from background
        const buttonWidth = buttonResult.background.width;
        const buttonHeight = buttonResult.background.height;
        
        // Get background position in container
        const backgroundX = buttonResult.background.x;
        const backgroundY = buttonResult.background.y;
        
        // Store reference to old background and check its tint
        const oldBackground = buttonResult.background;
        const oldTint = oldBackground.tint || 0xffffff;
        debug(`updateButtonBackgroundColor: Old background tint: ${oldTint.toString(16)}`, 'ui');
        
        // Use consistent cornerRadius - default to GameConfig.ui.DEFAULT_CORNER_RADIUS if not provided
        // This ensures consistency with _createProgrammaticButton()
        const finalCornerRadius = cornerRadius !== null ? cornerRadius : GameConfig.ui.DEFAULT_CORNER_RADIUS;
        debug(`updateButtonBackgroundColor: Using cornerRadius: ${finalCornerRadius}`, 'ui');
        
        // Remove old background from container
        if (oldBackground && oldBackground.parentContainer === buttonResult.container) {
            buttonResult.container.remove(oldBackground, true);
        }
        
        // Create new background with theme color
        const newBackground = ButtonFactory._createGradientButtonBackground(scene, buttonWidth, buttonHeight, tintColor, finalCornerRadius);
        if (!newBackground) {
            warn('[ButtonFactory] updateButtonBackgroundColor: Failed to create new background');
            return;
        }
        
        // Explicitly ensure no tint is applied (gradient has color baked in)
        // Phaser's setTint() multiplies with texture colors, which would darken the already-tinted gradient
        newBackground.setTint(0xffffff);
        const newTint = newBackground.tint;
        debug(`updateButtonBackgroundColor: New background created, tint set to: ${newTint.toString(16)}, cornerRadius: ${finalCornerRadius}`, 'ui');
        
        newBackground.setPosition(backgroundX, backgroundY);
        newBackground.disableInteractive();
        
        // Add new background at the same index (should be first child, before content)
        buttonResult.container.addAt(newBackground, 0);
        
        // Update buttonResult reference
        buttonResult.background = newBackground;
        
        debug('updateButtonBackgroundColor: Button background updated successfully', 'ui');
    }

    /**
     * Update button content color after theme loads
     * @param {Phaser.Scene} scene - Phaser scene instance
     * @param {Object} buttonResult - Button result object from createButton (must have content and container)
     */
    static updateButtonContentColor(scene, buttonResult) {
        if (!buttonResult) {
            warn('[ButtonFactory] updateButtonContentColor: Invalid button result');
            return;
        }
        
        // Container is required for the update
        if (!buttonResult.container) {
            warn('[ButtonFactory] updateButtonContentColor: Missing container in button result');
            return;
        }
        
        // Content or textContent should be present
        if (!buttonResult.content && !buttonResult.textContent) {
            warn('[ButtonFactory] updateButtonContentColor: Missing content or textContent in button result');
            return;
        }

        // Get theme data
        const theme = scene.themeData || (scene.prefab_ScratchManager && scene.prefab_ScratchManager.themeData);
        if (!theme) {
            warn('[ButtonFactory] updateButtonContentColor: Theme data not available');
            return; // Don't update if theme not available
        }
        
        // Use controlBar.palette.secondaryColor with default fallback
        const contentColor = theme?.controlBar?.palette?.secondaryColor || "#ffffff";
        debug('updateButtonContentColor:', 'ui', {
            paletteSecondaryColor: theme?.controlBar?.palette?.secondaryColor || 'NOT FOUND',
            finalContentColor: contentColor
        });

        // Apply contentColor based on content type
        // Handle textContent array (for multiline text) first, then fall back to content
        const contentColorHex = contentColor.replace("#", "");
        const contentColorHex6 = contentColorHex.substring(0, 6);
        const contentColorHexString = `#${contentColorHex6}`;
        
        // Check if textContent is an array (multiline text)
        if (buttonResult.textContent && Array.isArray(buttonResult.textContent)) {
            // Update all text objects in the array
            buttonResult.textContent.forEach((textObj, index) => {
                // Validate text object before updating
                if (!textObj || !(textObj instanceof Phaser.GameObjects.Text)) {
                    return;
                }
                // Check if text object is still valid and in a scene
                if (!textObj.scene || textObj.active === false) {
                    return;
                }
                try {
                    textObj.setStyle({ color: contentColorHexString });
                    debug(`updateButtonContentColor: Applied to textContent[${index}], color: ${contentColorHexString}`, 'ui');
                } catch (e) {
                    warn(`updateButtonContentColor: Failed to update textContent[${index}]: ${e.message || e}`, 'ui');
                }
            });
        } else if (buttonResult.textContent && buttonResult.textContent instanceof Phaser.GameObjects.Text) {
            // Single textContent object
            const textObj = buttonResult.textContent;
            // Validate text object before updating
            if (textObj && textObj.scene && textObj.active !== false) {
                try {
                    textObj.setStyle({ color: contentColorHexString });
                    debug(`updateButtonContentColor: Applied to textContent, color: ${contentColorHexString}`, 'ui');
                } catch (e) {
                    warn(`updateButtonContentColor: Failed to update textContent: ${e.message || e}`, 'ui');
                }
            }
        }
        
        // Handle content (for backward compatibility and icon buttons)
        const content = buttonResult.content;
        if (content && content.scene && content.active !== false) {
            try {
                if (content instanceof Phaser.GameObjects.Image) {
                    // For Image: use setTintFill()
                    const contentColorHexForTint = contentColor.replace("#", "").substring(0, 6);
                    const contentColorTint = parseInt(contentColorHexForTint, 16);
                    content.setTintFill(contentColorTint);
                    debug(`updateButtonContentColor: Applied to Image, tint: ${contentColorTint}`, 'ui');
                } else if (content instanceof Phaser.GameObjects.Text) {
                    // For Text: use setStyle({ color: ... })
                    content.setStyle({ color: contentColorHexString });
                    debug(`updateButtonContentColor: Applied to Text, color: ${contentColorHexString}`, 'ui');
                }
            } catch (e) {
                warn(`updateButtonContentColor: Failed to update content: ${e.message || e}`, 'ui');
            }
        }

        // Also handle secondaryContent if present (deprecated, but kept for backward compatibility)
        if (buttonResult.secondaryContent) {
            const secondaryContent = buttonResult.secondaryContent;
            if (secondaryContent && secondaryContent instanceof Phaser.GameObjects.Text && 
                secondaryContent.scene && secondaryContent.active !== false) {
                try {
                    secondaryContent.setStyle({ color: contentColorHexString });
                    debug(`updateButtonContentColor: Applied to secondary Text, color: ${contentColorHexString}`, 'ui');
                } catch (e) {
                    warn(`updateButtonContentColor: Failed to update secondaryContent: ${e.message || e}`, 'ui');
                }
            }
        }
        
        debug('updateButtonContentColor: Button content color updated successfully', 'ui');
    }
}
