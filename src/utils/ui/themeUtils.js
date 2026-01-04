/**
 * ThemeUtils
 * Stateless utility functions for applying theme styling
 */

/**
 * Apply theme styling to message text
 * Note: Positioning and fontSize are handled by LayoutManager, not this function.
 * This function only applies visual styling (fontFamily, color, stroke, etc.).
 * @param {Phaser.GameObjects.Text} messageText - The text object to style
 * @param {Object} themeData - Theme data object from prefab_ScratchManager
 */
export function applyMessageTextTheme(messageText, themeData) {
    if (!messageText) return;

    if (!themeData || !themeData.text || !themeData.text.messageText) return;

    const data = themeData.text.messageText;
    messageText.setStyle({
        fontFamily: data.fontFamily,
        // fontSize is now controlled by LayoutManager, not theme
        color: data.color,
        stroke: data.strokeColor,
        strokeThickness: data.strokeThickness,
        align: 'center'
    });
    
    // Note: data.offset is deprecated - positioning is now handled by LayoutManager
    // We ignore any offset values in theme data
    
    // Note: Origin and positioning are handled by LayoutManager
    // We only apply visual styling here (font, color, stroke, etc.)
}

