/**
 * Theme Access Utilities
 * 
 * Helper functions for accessing theme configuration in a consistent, traceable way.
 * These functions make theme field access explicit and improve code auditability.
 */

/**
 * Get text configuration for scratch, score, or scratch-poker winning-hand line
 * @param {Object} theme - Theme data object
 * @param {string} textType - "Scratch" | "Score" | "PokerWinningHand" (shape mirrors `score` + optional `uppercase`)
 * @returns {Object|null} Text configuration object or null if not found
 */
export function getTextConfig(theme, textType) {
    if (!theme || !theme.text) {
        return null;
    }
    
    switch(textType) {
        case "Scratch":
            return theme.text.scratch || null;
        case "Score":
            return theme.text.score || null;
        case "PokerWinningHand":
            return theme.text.pokerWinningHand || null;
        default:
            return null;
    }
}

/**
 * Get message text configuration
 * @param {Object} themeData - Theme data object
 * @returns {Object|null} Message text configuration object or null if not found
 */
export function getMessageTextConfig(themeData) {
    if (!themeData || !themeData.text) {
        return null;
    }
    
    return themeData.text.message || null;
}

