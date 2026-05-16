/**
 * Local Storage Utilities
 * Centralized localStorage operations with consistent error handling
 */

import { error } from '../logger/LoggerUtils.js';

/**
 * @param {string} key
 * @returns {any|null}
 */
export function getLocalStorageItem(key) {
    try {
        const item = localStorage.getItem(key);
        if (item === null) return null;

        try {
            return JSON.parse(item);
        } catch (_parseError) {
            return item;
        }
    } catch (storageError) {
        error(`Error getting localStorage key "${key}":`, 'game', storageError);
        return null;
    }
}

/**
 * @param {string} key
 * @param {any} value
 * @returns {boolean}
 */
export function setLocalStorageItem(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (storageError) {
        error(`Error setting localStorage key "${key}":`, 'game', storageError);
        return false;
    }
}

/**
 * @param {string} key
 * @returns {boolean}
 */
export function removeLocalStorageItem(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (storageError) {
        error(`Error removing localStorage key "${key}":`, 'game', storageError);
        return false;
    }
}
