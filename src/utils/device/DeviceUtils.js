/**
 * Device Utility Functions
 * Provides utilities for device characteristics
 */

import { clamp } from '../core/MathUtils.js';

/**
 * Get device pixel ratio
 * @returns {number} Device pixel ratio (clamped between 1 and 3)
 */
export function getDPR() {
    return clamp(Math.round(window.devicePixelRatio || 1), 1, 3);
}

/**
 * Check if touch is supported
 * @returns {boolean} True if touch is supported
 */
export function isTouchSupported() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

