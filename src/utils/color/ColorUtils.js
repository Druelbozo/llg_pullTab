/**
 * Color Utility Functions
 * Provides utility functions for color manipulation
 */

class ColorUtils {
    /**
     * Extract RGB components from a numeric color value
     * @private
     * @param {number} colorNumber - Numeric color value (e.g., 0x4a6b8a)
     * @returns {Array<number>} - [r, g, b] array with values 0-255
     */
    static _numberToRgb(colorNumber) {
        return [
            (colorNumber >> 16) & 0xFF,
            (colorNumber >> 8) & 0xFF,
            colorNumber & 0xFF
        ];
    }

    /**
     * Extract RGB components from a hex color string
     * @private
     * @param {string} hexColor - Hex color string (e.g., '#4a6b8a')
     * @returns {Array<number>} - [r, g, b] array with values 0-255
     */
    static _hexToRgb(hexColor) {
        const hex = hexColor.replace('#', '');
        return [
            parseInt(hex.substr(0, 2), 16),
            parseInt(hex.substr(2, 2), 16),
            parseInt(hex.substr(4, 2), 16)
        ];
    }

    /**
     * Reconstruct numeric color from RGB components
     * @private
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @returns {number} - Numeric color value
     */
    static _rgbToNumber(r, g, b) {
        return (r << 16) | (g << 8) | b;
    }

    /**
     * Reconstruct hex color string from RGB components
     * @private
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @returns {string} - Hex color string with # prefix
     */
    static _rgbToHex(r, g, b) {
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    /**
     * Core brightness adjustment function (works with RGB array)
     * @private
     * @param {Array<number>} rgb - [r, g, b] array
     * @param {number} factor - Brightness factor (positive = brighter, negative = darker)
     * @returns {Array<number>} - Adjusted [r, g, b] array
     */
    static _adjustBrightness(rgb, factor) {
        const [r, g, b] = rgb;
        if (factor > 0) {
            // Brighten: add percentage of current value
            return [
                Math.min(255, Math.round(r + (r * factor))),
                Math.min(255, Math.round(g + (g * factor))),
                Math.min(255, Math.round(b + (b * factor)))
            ];
        } else {
            // Darken: subtract percentage of current value
            const absFactor = Math.abs(factor);
            return [
                Math.max(0, Math.round(r - (r * absFactor))),
                Math.max(0, Math.round(g - (g * absFactor))),
                Math.max(0, Math.round(b - (b * absFactor)))
            ];
        }
    }

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
        const rgb = this._numberToRgb(colorNumber);
        const adjusted = this._adjustBrightness(rgb, factor);
        return this._rgbToNumber(...adjusted);
    }

    /**
     * Make a numeric color darker by a specified factor
     * @param {number} colorNumber - Numeric color value (e.g., 0x4a6b8a)
     * @param {number} factor - Darkness factor (0.2 = 20% darker)
     * @returns {number} - Darker numeric color value
     */
    static darkenNumber(colorNumber, factor = 0.2) {
        const rgb = this._numberToRgb(colorNumber);
        const adjusted = this._adjustBrightness(rgb, -factor);
        return this._rgbToNumber(...adjusted);
    }

    /**
     * Make a hex color brighter by a specified factor
     * @param {string} hexColor - Color in hex format (e.g., '#4a6b8a')
     * @param {number} factor - Brightness factor (0.2 = 20% brighter)
     * @returns {string} - Brighter color in hex format
     */
    static brightenColor(hexColor, factor = 0.2) {
        const rgb = this._hexToRgb(hexColor);
        const adjusted = this._adjustBrightness(rgb, factor);
        return this._rgbToHex(...adjusted);
    }

    /**
     * Make a hex color darker by a specified factor
     * @param {string} hexColor - Color in hex format (e.g., '#4a6b8a')
     * @param {number} factor - Darkness factor (0.2 = 20% darker)
     * @returns {string} - Darker color in hex format
     */
    static darkenColor(hexColor, factor = 0.2) {
        const rgb = this._hexToRgb(hexColor);
        const adjusted = this._adjustBrightness(rgb, -factor);
        return this._rgbToHex(...adjusted);
    }

    /**
     * Make a color lighter by a specified percentage (legacy - uses multiplication)
     * @deprecated Use brightenColor() instead for consistent behavior
     * @param {string} hexColor - Color in hex format (e.g., '#4a6b8a')
     * @param {number} amount - Amount to lighten (1.5 = 50% lighter via multiplication)
     * @returns {string} - Lighter color in hex format
     */
    static lightenColor(hexColor, amount = 1.5) {
        const rgb = this._hexToRgb(hexColor);
        const [r, g, b] = rgb;
        return this._rgbToHex(
            Math.min(255, Math.floor(r * amount)),
            Math.min(255, Math.floor(g * amount)),
            Math.min(255, Math.floor(b * amount))
        );
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
        
        const rgb1 = this._numberToRgb(color1);
        const rgb2 = this._numberToRgb(color2);
        
        // Interpolate each component
        const r = Math.round(rgb1[0] + (rgb2[0] - rgb1[0]) * t);
        const g = Math.round(rgb1[1] + (rgb2[1] - rgb1[1]) * t);
        const b = Math.round(rgb1[2] + (rgb2[2] - rgb1[2]) * t);
        
        return this._rgbToNumber(r, g, b);
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
        const origRgb = this._hexToRgb(originalColor);
        const tintRgb = this._hexToRgb(tintColor);
        
        // Special case: if original is white (#FFFFFF), return tintColor directly
        if (origRgb[0] === 255 && origRgb[1] === 255 && origRgb[2] === 255) {
            return tintColor.startsWith('#') ? tintColor : `#${tintColor}`;
        }
        
        // Calculate brightness/luminance of original color (grayscale value)
        // Using standard luminance formula for better perception
        const luminance = (origRgb[0] * 0.299 + origRgb[1] * 0.587 + origRgb[2] * 0.114) / 255;
        
        // For tinting grayscale colors: scale the tint color by the original's luminance
        // - White (luminance=1.0) → tintColor (handled by special case above)
        // - Black (luminance=0.0) → black (#000000)
        // - Gray (luminance=0.78) → tintColor scaled to 78% brightness
        // This preserves the hue while matching the brightness of the original grayscale
        
        // Scale the tint color's RGB components by the luminance
        const tintedR = Math.round(tintRgb[0] * luminance);
        const tintedG = Math.round(tintRgb[1] * luminance);
        const tintedB = Math.round(tintRgb[2] * luminance);
        
        // Clamp to valid range
        const finalR = Math.max(0, Math.min(255, tintedR));
        const finalG = Math.max(0, Math.min(255, tintedG));
        const finalB = Math.max(0, Math.min(255, tintedB));
        
        return this._rgbToHex(finalR, finalG, finalB);
    }
}

export default ColorUtils;

