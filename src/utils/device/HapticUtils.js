/**
 * HapticUtils - Stateless utility for haptic feedback via the Web Vibration API
 *
 * Provides tactile feedback for mobile browsers when users interact with the game.
 * Uses navigator.vibrate() - supported on Chrome, Edge, Samsung Internet, Android browsers.
 * Safari on iOS does not support the Vibration API; calls no-op gracefully.
 *
 * Requires user activation (click/tap) before vibration works - satisfied by button
 * presses and scratch gestures.
 *
 * @example
 * import HapticUtils from './utils/device/HapticUtils.js';
 * HapticUtils.light();      // Button press
 * HapticUtils.medium();     // Scratch start
 * HapticUtils.win();        // Win result
 * HapticUtils.lose();       // Lose result
 */

/**
 * Check if the Vibration API is supported
 * @returns {boolean}
 */
export function isSupported() {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/**
 * Trigger a raw vibration pattern
 * @param {number|number[]} pattern - Duration in ms, or [vibrate, pause, vibrate, ...]
 */
export function vibrate(pattern) {
    if (!isSupported()) return;
    try {
        navigator.vibrate(pattern);
    } catch (_) {
        // Ignore errors (e.g. unsupported, permission denied)
    }
}

/**
 * Cancel any ongoing vibration
 */
export function cancel() {
    if (!isSupported()) return;
    try {
        navigator.vibrate(0);
    } catch (_) {}
}

/**
 * Light tap - for button presses
 * Short, subtle feedback
 */
export function light() {
    vibrate(12);
}

/**
 * Medium tap - for scratch start
 * Slightly longer than light for distinct feel
 */
export function medium() {
    vibrate(22);
}

/**
 * Strong pattern - generic emphasis
 * [vibrate, pause, vibrate]
 */
export function strong() {
    vibrate([50, 30, 50]);
}

/**
 * Win result - celebratory pattern
 * Upbeat triple pulse
 */
export function win() {
    vibrate([80, 60, 80, 60, 80]);
}

/**
 * Lose result - downbeat pattern
 * Single short bump, distinct from win
 */
export function lose() {
    vibrate([40, 80, 40]);
}

export default {
    isSupported,
    vibrate,
    cancel,
    light,
    medium,
    strong,
    win,
    lose
};
