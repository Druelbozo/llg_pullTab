/**
 * ThemeUtils
 * Stateless utility functions for applying theme styling
 */

import { getMessageTextConfig } from './ThemeAccessUtils.js';
import { getMessageTextConfig as getLayoutMessageTextConfig } from '../../layout/ConfigAccessUtils.js';
import { isLandscapeMobileSidePaytablePanelVisible } from '../../layout/MessageTextPositioningUtils.js';
import FontUtils from '../../fonts/FontUtils.js';

/**
 * Apply theme styling to message text
 * Note: Positioning and fontSize are handled by LayoutManager, not this function.
 * This function only applies visual styling (fontFamily, color, stroke, etc.).
 * @param {Phaser.GameObjects.Text} messageText - The text object to style
 * @param {Object} themeData - Theme data object from prefab_ScratchManager
 * @param {Object} [layoutStrokeConfig=null] - Optional stroke object from layout config (messageText.stroke) to override theme values
 */
export function applyMessageTextTheme(messageText, themeData, layoutStrokeConfig = null) {
    if (!messageText) return;

    const messageTextConfig = getMessageTextConfig(themeData);
    
    // Get palette colors as defaults
    const palette = themeData.text?.palette || {};
    const defaultPrimaryColor = palette.primaryColor;
    const defaultSecondaryColor = palette.secondaryColor;
    
    // Get font family and weight from new schema (font: { family }) - weight comes from fonts declaration
    // Supports old schema (fontFamily: string) for backward compatibility
    const fontConfig = themeData.text?.font || themeData.text?.fontFamily;
    const { fontFamily: defaultFontFamily, fontWeight: defaultFontWeight } = FontUtils.getFontFamily(fontConfig, themeData);
    const safeFontFamily = FontUtils.getSafeFontFamily(defaultFontFamily);
    
    // Layout config can override theme stroke values
    // layoutStrokeConfig is the stroke object from layout config (messageText.stroke)
    // Priority: layoutStrokeConfig > explicit theme.stroke.color > palette.secondaryColor
    const strokeColor = layoutStrokeConfig?.color ?? messageTextConfig?.stroke?.color ?? defaultSecondaryColor;
    const strokeLineWidth = layoutStrokeConfig?.lineWidth ?? messageTextConfig?.stroke?.lineWidth;
    
    // Build style object with font weight as number (Phaser requires number for Google Fonts)
    const textStyle = {
        fontFamily: safeFontFamily,
        // fontSize is now controlled by LayoutManager, not theme
        // Priority: explicit font.color > palette.primaryColor
        color: messageTextConfig?.font?.color || defaultPrimaryColor,
        stroke: strokeColor,
        strokeThickness: strokeLineWidth,
        align: 'center'
    };
    
    // Apply fontWeight as number if available (required for Google Fonts)
    if (defaultFontWeight) {
        textStyle.fontWeight = parseInt(defaultFontWeight) || null;
    }
    
    messageText.setStyle(textStyle);
    
    // Note: messageTextConfig.offset is deprecated - positioning is now handled by LayoutManager
    // We ignore any offset values in theme data
    
    // Note: Origin and positioning are handled by LayoutManager
    // We only apply visual styling here (font, color, stroke, etc.)
}

/**
 * Style `instructionsText` like control bar header text, except **landscape-mobile 1-column** (side paytable hidden):
 * then it matches {@link applyMessageTextTheme} / `text.message` (score message line), with optional layout `messageText.stroke`.
 * Font size is applied by the scene after this call (layout `instructionsText.fontSize`, or message-derived in 1-col).
 * @param {Phaser.GameObjects.Text} instructionsText
 * @param {Object} themeData
 * @param {string|null|undefined} layoutName - e.g. 'landscape-mobile' (for color-mobile)
 * @param {Object|null|undefined} [uiConfig] - pass with `baseUIConfig` so layout stroke overrides apply in 1-col message mode
 * @param {Object|null|undefined} [baseUIConfig]
 */
export function applyInstructionsTextTheme(instructionsText, themeData, layoutName, uiConfig, baseUIConfig) {
    if (!instructionsText) {
        return;
    }
    const useMessageStyle =
        layoutName === 'landscape-mobile' && !isLandscapeMobileSidePaytablePanelVisible();
    if (useMessageStyle) {
        let layoutStroke = null;
        if (uiConfig != null && baseUIConfig != null) {
            const m = getLayoutMessageTextConfig(uiConfig, baseUIConfig);
            layoutStroke = m.stroke || null;
        }
        applyMessageTextTheme(instructionsText, themeData, layoutStroke);
        return;
    }

    const headerConfig = themeData?.controlBar?.header;
    const isMobileLayout = layoutName === 'portrait-mobile' || layoutName === 'landscape-mobile';
    let headerColor = '#ffffff';
    let strokeColor = '#000000';
    let strokeWidth = 0;
    if (headerConfig && typeof headerConfig === 'object') {
        if (isMobileLayout && headerConfig['color-mobile'] != null && headerConfig['color-mobile'] !== '') {
            headerColor = headerConfig['color-mobile'];
        } else if (headerConfig.color != null && headerConfig.color !== '') {
            headerColor = headerConfig.color;
        }
        strokeColor = headerConfig.stroke?.color || '#000000';
        strokeWidth = headerConfig.stroke?.lineWidth ?? 0;
    }

    const fontConfig = themeData?.controlBar?.font || themeData?.text?.font || themeData?.text?.fontFamily;
    const { fontFamily, fontWeight } = FontUtils.getFontFamily(fontConfig, themeData);
    let displayFamily = FontUtils.getSafeFontFamily(fontFamily);
    if (/^lato$/i.test(String(displayFamily).trim())) {
        displayFamily = 'Lato-Bold';
    }

    const style = {
        fontFamily: displayFamily,
        color: headerColor,
        align: 'center'
    };
    if (fontWeight) {
        const w = parseInt(String(fontWeight), 10);
        if (Number.isFinite(w)) {
            style.fontWeight = w;
        }
    }
    if (strokeWidth > 0) {
        style.stroke = strokeColor;
        style.strokeThickness = strokeWidth;
    } else {
        style.stroke = strokeColor;
        style.strokeThickness = 0;
    }
    instructionsText.setStyle(style);
}
