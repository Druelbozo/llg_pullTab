/**
 * TextArea Factory
 * 
 * Creates reusable text areas with two text fields (title and value)
 * Styled by the theme system with dynamic width calculation
 * 
 * @example
 * const textArea = TextAreaFactory.createTextArea(scene, {
 *     titleText: 'Bet:',
 *     valueText: '5.00',
 *     heightPercent: 0.1,
 *     titleFontSizePercent: 0.2,
 *     valueFontSizePercent: 0.5,
 *     titleFieldPercentY: 0.2,  // 20% from top (or use TextAreaFactory.TITLE_FIELD_PERCENT_Y)
 *     valueFieldPercentY: 0.7,  // 70% from top (or use TextAreaFactory.VALUE_FIELD_PERCENT_Y)
 * });
 */

import FontUtils from '../../fonts/FontUtils.js';
import { GameConfig } from '../../../config/Global.js';
import { debug, error as logError, warn } from '../../logger/LoggerUtils.js';
import { getContentHeightPercent } from '../../layout/ConfigAccessUtils.js';
import { getLayoutConfig as getCachedLayoutConfig } from '../../../services/layout/config/LayoutConfigLoader.js';

export default class TextAreaFactory {
    // Vertical positioning constants (0 = top edge, 0.5 = center, 1 = bottom edge)
    static TITLE_FIELD_PERCENT_Y = 0.27;  // Title field vertical position (20% from top)
    static VALUE_FIELD_PERCENT_Y = 0.62  // Value field vertical position (60% from top)
    
    // Font size percentage constants (as % of textArea height)
    static TITLE_FONT_SIZE_PERCENT = 0.22;  // Title font size as % of textArea height (20%)
    static VALUE_FONT_SIZE_PERCENT = 0.27;  // Value font size as % of textArea height (50%)
    
    /**
     * Create a text area with title and value fields
     * @param {Phaser.Scene} scene - Phaser scene instance
     * @param {Object} config - TextArea configuration
     * @param {string} config.titleText - Title text (e.g., 'Bet:')
     * @param {string} config.valueText - Value text (e.g., '5.00')
     * @param {number} [config.heightPercent] - Height as percentage of screen height (defaults to controlBar.contentHeight.percent from defaults.json)
     * @param {number} [config.titleFontSizePercent] - Title font size as % of textArea height (default: TextAreaFactory.TITLE_FONT_SIZE_PERCENT = 0.2 = 20%)
     * @param {number} [config.valueFontSizePercent] - Value font size as % of textArea height (default: TextAreaFactory.VALUE_FONT_SIZE_PERCENT = 0.5 = 50%)
     * @param {number} [config.titleFieldPercentY] - Title field Y position (0 = top, 0.5 = center, 1 = bottom). Default: TextAreaFactory.TITLE_FIELD_PERCENT_Y
     * @param {number} [config.valueFieldPercentY] - Value field Y position (0 = top, 0.5 = center, 1 = bottom). Default: TextAreaFactory.VALUE_FIELD_PERCENT_Y
     * @returns {Object} Object with {container, titleField, valueField, width, height}
     */
    static createTextArea(scene, config) {
        if (!scene) {
            logError('[TextAreaFactory] Scene is required');
            return null;
        }

        // Get default heightPercent from defaults.json layout config
        const defaultsConfig = getCachedLayoutConfig('defaults') || {};
        const defaultHeightPercent = getContentHeightPercent(defaultsConfig, null, null) || 0.08;
        
        const {
            titleText = '',
            valueText = '',
            heightPercent = defaultHeightPercent, // Default from controlBar.contentHeight.percent in defaults.json
            titleFontSizePercent = TextAreaFactory.TITLE_FONT_SIZE_PERCENT,
            valueFontSizePercent = TextAreaFactory.VALUE_FONT_SIZE_PERCENT,
            titleFieldPercentY = TextAreaFactory.TITLE_FIELD_PERCENT_Y,
            valueFieldPercentY = TextAreaFactory.VALUE_FIELD_PERCENT_Y
        } = config;

        // Log heightPercent value received
        debug(`[TextAreaFactory] createTextArea called:`, 'ui');
        debug(`  - heightPercent from config: ${heightPercent}`, 'ui');
        debug(`  - scene.scale.height: ${scene.scale.height}`, 'ui');

        // Access themeData from scene (consistent with ButtonFactory)
        // Project-agnostic theme data access: prefer scene.themeData, fallback to prefab_ScratchManager for backward compatibility
        const themeData = scene.themeData || (scene.prefab_ScratchManager && scene.prefab_ScratchManager.themeData);

        // Calculate textArea height
        const textAreaHeight = scene.scale.height * heightPercent;
        
        debug(`  - calculated textAreaHeight: ${textAreaHeight}`, 'ui');
        debug(`  - calculation: ${scene.scale.height} * ${heightPercent} = ${textAreaHeight}`, 'ui');

        // Get theme styling for title and value (from controlBar.textAreas, consistent with ButtonFactory pattern)
        const titleTheme = themeData?.controlBar?.textAreas?.title || {};
        const valueTheme = themeData?.controlBar?.textAreas?.value || {};

        // Get font config from controlBar.font (new schema) or controlBar.fontFamily (old schema for backward compatibility)
        const fontConfig = themeData?.controlBar?.font || themeData?.controlBar?.fontFamily || 'Lato-Bold';
        const { fontFamily, fontWeight } = FontUtils.getFontFamily(fontConfig, themeData);
        const safeFontFamily = FontUtils.getSafeFontFamily(fontFamily);
        const titleFontFamily = safeFontFamily;
        const valueFontFamily = safeFontFamily;

        // Get colors (convert hex to Phaser color format if needed)
        const titleColor = titleTheme.color || '#b2d5ff';
        const valueColor = valueTheme.color || '#ffffff';

        // Calculate font sizes based on textArea height
        const titleFontSize = Math.round(textAreaHeight * titleFontSizePercent);
        const valueFontSize = Math.round(textAreaHeight * valueFontSizePercent);

        debug(`Creating textArea:`, 'ui', {
            textAreaHeight,
            titleFontSizePercent,
            valueFontSizePercent,
            titleFontSize,
            valueFontSize,
            titleText,
            valueText
        });

        // Create container for text area
        // Keep origin at (0, 0) for layout system compatibility (layout uses getBounds() which depends on origin)
        const container = scene.add.container(0, 0);
        container.label = 'textArea';
        
        // Flag to prevent container position from being adjusted based on text field bounds
        // Container position should be set ONCE and NEVER changed based on text field positioning
        container._positionLocked = false; // Will be set to true after initial positioning

        // Create title field
        const titleStyle = {
            fontFamily: titleFontFamily,
            fontSize: `${titleFontSize}px`,
            color: titleColor,
            align: 'center'
        };
        if (fontWeight) {
            titleStyle.fontWeight = parseInt(fontWeight) || null;
        }
        const titleField = scene.add.text(0, 0, titleText, titleStyle);
        titleField.setOrigin(0.5, 0.5);
        debug(`Title field created:`, 'ui', {
            fontSize: titleField.style?.fontSize,
            fontSizeProperty: titleField.fontSize,
            style: titleField.style
        });

        // Create value field
        const valueStyle = {
            fontFamily: valueFontFamily,
            fontSize: `${valueFontSize}px`,
            color: valueColor,
            align: 'center'
        };
        if (fontWeight) {
            valueStyle.fontWeight = fontWeight;
        }
        const valueField = scene.add.text(0, 0, valueText, valueStyle);
        valueField.setOrigin(0.5, 0.5);
        debug(`Value field created:`, 'ui', {
            fontSize: valueField.style?.fontSize,
            fontSizeProperty: valueField.fontSize,
            style: valueField.style
        });

        // Calculate width - use fixed small width since we mainly need container for height
        // Width is set to 10px as requested - container is primarily for height
        const textAreaWidth = 10;

        // Create transparent background rectangle for container bounds
        // Use Rectangle instead of Graphics so it contributes to container bounds
        // Positioned at container origin (0, 0) which is top-left
        // Container height matches button height (textAreaHeight)
        // Transparent (alpha = 0) but still contributes to bounds
        const background = scene.add.rectangle(0, 0, textAreaWidth, textAreaHeight, 0x000000, 0);
        background.setOrigin(0, 0); // Top-left origin to match container
        container.add(background);

        // Add text fields to container first (before positioning, so they're children)
        container.add(titleField);
        container.add(valueField);

        // Set container dimensions - this ensures the container has the correct height
        container.width = textAreaWidth;
        container.height = textAreaHeight;
        container.setSize(textAreaWidth, textAreaHeight);
        
        // Store fixed height in custom property to ensure it's always available
        // This height should NEVER change based on text field positioning
        container._fixedHeight = textAreaHeight;

        // Position fields independently based on percentage (0 = top, 0.5 = center, 1 = bottom)
        // Use the red background's height (which matches textAreaHeight) for positioning
        // Container origin is (0, 0) at top-left, children use local coordinates
        // Text fields have origin (0.5, 0.5), so their center is at their y position
        // Formula: y = percentY * containerHeight
        // This directly maps percentY (0-1) to y position where the text center will be
        // - percentY = 0.0: y = 0 (text center at top edge of container)
        // - percentY = 0.5: y = containerHeight/2 (text center at container center)
        // - percentY = 1.0: y = containerHeight (text center at bottom edge of container)
        // Use the red background height as the reference (same as textAreaHeight)
        const containerHeight = textAreaHeight; // Red box height = container height
        titleField.y = titleFieldPercentY * containerHeight;
        valueField.y = valueFieldPercentY * containerHeight;
        
        debug(`[TextAreaFactory] Positioned text fields:`, 'ui', {
            containerHeight,
            textAreaHeight,
            titleFieldPercentY,
            valueFieldPercentY,
            titleFieldY: titleField.y,
            valueFieldY: valueField.y,
            titleFieldIsChild: container.list.includes(titleField),
            valueFieldIsChild: container.list.includes(valueField)
        });

        return {
            container,
            titleField,
            valueField,
            width: textAreaWidth,
            height: textAreaHeight
        };
    }

    /**
     * Update text area colors after theme loads
     * @param {Phaser.Scene} scene - Phaser scene instance
     * @param {Object} textAreaResult - TextArea result object from createTextArea (must have titleField and valueField)
     */
    static updateTextAreaColors(scene, textAreaResult) {
        if (!textAreaResult || !textAreaResult.titleField || !textAreaResult.valueField) {
            warn('[TextAreaFactory] updateTextAreaColors: Invalid textArea result, missing titleField or valueField');
            return;
        }

        // Get theme data
        // Project-agnostic theme data access: prefer scene.themeData, fallback to prefab_ScratchManager for backward compatibility
        const theme = scene.themeData || (scene.prefab_ScratchManager && scene.prefab_ScratchManager.themeData);
        if (!theme) {
            warn('[TextAreaFactory] updateTextAreaColors: Theme data not available');
            return; // Don't update if theme not available
        }

        // Get theme styling for title and value (from controlBar.textAreas)
        const titleTheme = theme?.controlBar?.textAreas?.title || {};
        const valueTheme = theme?.controlBar?.textAreas?.value || {};

        // Update title field color
        if (titleTheme.color) {
            const titleColor = titleTheme.color;
            const titleColorHex = titleColor.replace("#", "").substring(0, 6);
            const titleColorHexString = `#${titleColorHex}`;
            textAreaResult.titleField.setStyle({ color: titleColorHexString });
        }

        // Update value field color
        if (valueTheme.color) {
            const valueColor = valueTheme.color;
            const valueColorHex = valueColor.replace("#", "").substring(0, 6);
            const valueColorHexString = `#${valueColorHex}`;
            textAreaResult.valueField.setStyle({ color: valueColorHexString });
        }

        // Update font families from controlBar.font (new schema) or controlBar.fontFamily (old schema for backward compatibility)
        const fontConfig = theme?.controlBar?.font || theme?.controlBar?.fontFamily;
        if (fontConfig) {
            const { fontFamily, fontWeight } = FontUtils.getFontFamily(fontConfig, theme);
            const safeFontFamily = FontUtils.getSafeFontFamily(fontFamily);
            const styleUpdate = { fontFamily: safeFontFamily };
            if (fontWeight) {
                styleUpdate.fontWeight = parseInt(fontWeight) || null;
            }
            textAreaResult.titleField.setStyle(styleUpdate);
            textAreaResult.valueField.setStyle(styleUpdate);
        }
    }
}

