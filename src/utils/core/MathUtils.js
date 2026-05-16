/**
 * Math Utility Functions
 * Provides common mathematical utility functions
 */

/**
 * Clamp a value between a minimum and maximum
 * @param {number} value - The value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} The clamped value
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

