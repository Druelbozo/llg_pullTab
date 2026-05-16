/**
 * Color Utility Functions
 * Provides utility functions for color manipulation
 */

class ColorUtils {
    /**
     * Convert hex color strings to numeric values
     * @param {string|number} hexString - Hex color string or number
     * @returns {number} - Numeric color value
     */
    static hexToNumber(hexString) {
        if (typeof hexString === 'number') return hexString;
        if (typeof hexString === 'string' && hexString.startsWith('#')) {
            return parseInt(hexString.replace('#', ''), 16);
        }
        return hexString; // Return as-is if not a hex string
    }

    /**
     * Make a color darker by a specified percentage
     * @param {string} hexColor - Color in hex format (e.g., '#4a6b8a')
     * @param {number} amount - Amount to darken (0.45 = 55% darker)
     * @returns {string} - Darker color in hex format
     */
    static darkenColor(hexColor, amount = 0.45) {
        // Remove '#' if present
        const hex = hexColor.replace('#', '');
        
        // Convert to RGB
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        // Darken by specified amount (multiply by amount)
        const darkenedR = Math.floor(r * amount);
        const darkenedG = Math.floor(g * amount);
        const darkenedB = Math.floor(b * amount);
        
        // Convert back to hex
        return `#${darkenedR.toString(16).padStart(2, '0')}${darkenedG.toString(16).padStart(2, '0')}${darkenedB.toString(16).padStart(2, '0')}`;
    }

    /**
     * Make a color lighter by a specified percentage
     * @param {string} hexColor - Color in hex format (e.g., '#4a6b8a')
     * @param {number} amount - Amount to lighten (1.5 = 50% lighter)
     * @returns {string} - Lighter color in hex format
     */
    static lightenColor(hexColor, amount = 1.5) {
        // Remove '#' if present
        const hex = hexColor.replace('#', '');
        
        // Convert to RGB
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        // Lighten by specified amount and clamp to 255
        const lightenedR = Math.min(255, Math.floor(r * amount));
        const lightenedG = Math.min(255, Math.floor(g * amount));
        const lightenedB = Math.min(255, Math.floor(b * amount));
        
        // Convert back to hex
        return `#${lightenedR.toString(16).padStart(2, '0')}${lightenedG.toString(16).padStart(2, '0')}${lightenedB.toString(16).padStart(2, '0')}`;
    }

    /**
     * Convert numeric color value to hex string
     * @param {number} colorNumber - Numeric color value (e.g., 0x4a6b8a or 4885642)
     * @returns {string} - Hex color string with # prefix (e.g., '#4a6b8a')
     */
    static numberToHexString(colorNumber) {
        return '#' + colorNumber.toString(16).padStart(6, '0');
    }

    /**
     * Make a numeric color brighter by a specified factor
     * @param {number} colorNumber - Numeric color value (e.g., 0x4a6b8a)
     * @param {number} factor - Brightness factor (0.2 = 20% brighter)
     * @returns {number} - Brighter numeric color value
     */
    static brightenNumber(colorNumber, factor = 0.2) {
        // Extract RGB components
        const r = (colorNumber >> 16) & 0xFF;
        const g = (colorNumber >> 8) & 0xFF;
        const b = colorNumber & 0xFF;
        
        // Make brighter by factor
        const newR = Math.min(255, Math.round(r + (r * factor)));
        const newG = Math.min(255, Math.round(g + (g * factor)));
        const newB = Math.min(255, Math.round(b + (b * factor)));
        
        // Reconstruct color
        return (newR << 16) | (newG << 8) | newB;
    }

    /**
     * Make a numeric color darker by a specified factor
     * @param {number} colorNumber - Numeric color value (e.g., 0x4a6b8a)
     * @param {number} factor - Darkness factor (0.2 = 20% darker)
     * @returns {number} - Darker numeric color value
     */
    static darkenNumber(colorNumber, factor = 0.2) {
        // Extract RGB components
        const r = (colorNumber >> 16) & 0xFF;
        const g = (colorNumber >> 8) & 0xFF;
        const b = colorNumber & 0xFF;
        
        // Make darker by factor
        const newR = Math.max(0, Math.round(r - (r * factor)));
        const newG = Math.max(0, Math.round(g - (g * factor)));
        const newB = Math.max(0, Math.round(b - (b * factor)));
        
        // Reconstruct color
        return (newR << 16) | (newG << 8) | newB;
    }

    /**
     * Interpolate between two numeric color values
     * @param {number} color1 - Start color (numeric)
     * @param {number} color2 - End color (numeric)
     * @param {number} t - Interpolation factor (0.0 to 1.0)
     * @returns {number} - Interpolated color value
     */
    static interpolateColor(color1, color2, t) {
        // Clamp t between 0 and 1
        t = Math.max(0, Math.min(1, t));
        
        // Extract RGB components from color1
        const r1 = (color1 >> 16) & 0xFF;
        const g1 = (color1 >> 8) & 0xFF;
        const b1 = color1 & 0xFF;
        
        // Extract RGB components from color2
        const r2 = (color2 >> 16) & 0xFF;
        const g2 = (color2 >> 8) & 0xFF;
        const b2 = color2 & 0xFF;
        
        // Interpolate each component
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        
        // Reconstruct color
        return (r << 16) | (g << 8) | b;
    }

    /**
     * Apply a tint color to another color, preserving relative brightness
     * This is useful for tinting grayscale gradients with a color hue
     * For grayscale colors, this will tint them while preserving the brightness level
     * @param {string} originalColor - Original color in hex format (e.g., '#c7c7c7')
     * @param {string} tintColor - Tint color in hex format (e.g., '#4a009c')
     * @returns {string} - Tinted color in hex format
     */
    static tintColor(originalColor, tintColor) {
        // Remove '#' if present
        const origHex = originalColor.replace('#', '');
        const tintHex = tintColor.replace('#', '');
        
        // Convert to RGB
        const origR = parseInt(origHex.substr(0, 2), 16);
        const origG = parseInt(origHex.substr(2, 2), 16);
        const origB = parseInt(origHex.substr(4, 2), 16);
        
        const tintR = parseInt(tintHex.substr(0, 2), 16);
        const tintG = parseInt(tintHex.substr(2, 2), 16);
        const tintB = parseInt(tintHex.substr(4, 2), 16);
        
        // Special case: if original is white (#FFFFFF), return tintColor directly
        if (origR === 255 && origG === 255 && origB === 255) {
            return tintColor.startsWith('#') ? tintColor : `#${tintColor}`;
        }
        
        // Calculate brightness/luminance of original color (grayscale value)
        // Using standard luminance formula for better perception
        const luminance = (origR * 0.299 + origG * 0.587 + origB * 0.114) / 255;
        
        // For tinting grayscale colors: scale the tint color by the original's luminance
        // - White (luminance=1.0) → tintColor (handled by special case above)
        // - Black (luminance=0.0) → black (#000000)
        // - Gray (luminance=0.78) → tintColor scaled to 78% brightness
        // This preserves the hue while matching the brightness of the original grayscale
        
        // Scale the tint color's RGB components by the luminance
        const tintedR = Math.round(tintR * luminance);
        const tintedG = Math.round(tintG * luminance);
        const tintedB = Math.round(tintB * luminance);
        
        // Clamp to valid range
        const finalR = Math.max(0, Math.min(255, tintedR));
        const finalG = Math.max(0, Math.min(255, tintedG));
        const finalB = Math.max(0, Math.min(255, tintedB));
        
        // Convert back to hex
        return `#${finalR.toString(16).padStart(2, '0')}${finalG.toString(16).padStart(2, '0')}${finalB.toString(16).padStart(2, '0')}`;
    }
}

export default ColorUtils;

