/**
 * InputManager — keyboard shortcuts via document keydown (scratch-style).
 */

import { log } from '../../utils/logger/LoggerUtils.js';

export default class InputManager {
    /**
     * @param {Phaser.Scene} scene
     * @param {{ preventDefault?: boolean }} [config]
     */
    constructor(scene, config = {}) {
        if (!scene) {
            throw new Error('InputManager requires a Phaser scene');
        }

        this.scene = scene;
        this.config = {
            preventDefault: config.preventDefault !== undefined ? config.preventDefault : true,
        };

        this.shortcuts = new Map();
        /** @type {((e: KeyboardEvent) => void) | null} */
        this.handleKeyDown = null;

        this.setupEventListener();

        this.scene.events.once('destroy', () => {
            this.destroy();
        });

        log('InputManager created', 'game');
    }

    setupEventListener() {
        this.handleKeyDown = (event) => {
            this.processKeyEvent(event);
        };
        document.addEventListener('keydown', this.handleKeyDown);
    }

    /**
     * @param {KeyboardEvent} event
     */
    processKeyEvent(event) {
        const key = event.key.toLowerCase();

        /** @type {string[]} */
        const possibleShortcuts = [];

        if (event.ctrlKey || event.metaKey) {
            const otherModifiers = [];
            if (event.altKey) otherModifiers.push('alt');
            if (event.shiftKey) otherModifiers.push('shift');

            if (otherModifiers.length > 0) {
                possibleShortcuts.push(`ctrl+${otherModifiers.join('+')}+${key}`);
                possibleShortcuts.push(`cmd+${otherModifiers.join('+')}+${key}`);
            } else {
                possibleShortcuts.push(`ctrl+${key}`);
                possibleShortcuts.push(`cmd+${key}`);
            }
        } else {
            const modifiers = [];
            if (event.altKey) modifiers.push('alt');
            if (event.shiftKey) modifiers.push('shift');

            if (modifiers.length > 0) {
                possibleShortcuts.push(`${modifiers.join('+')}+${key}`);
            } else {
                possibleShortcuts.push(key);
            }
        }

        for (const shortcutKey of possibleShortcuts) {
            if (this.shortcuts.has(shortcutKey)) {
                const callback = this.shortcuts.get(shortcutKey);
                callback(event);
                return;
            }
        }
    }

    /**
     * @param {string} shortcut
     * @param {(e: KeyboardEvent) => void} callback
     * @param {{ preventDefault?: boolean }} [options]
     */
    registerShortcut(shortcut, callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('InputManager.registerShortcut: callback must be a function');
        }

        const normalizedShortcut = shortcut.toLowerCase().trim();

        const callbackWrapper = (event) => {
            if (options.preventDefault !== undefined ? options.preventDefault : this.config.preventDefault) {
                event.preventDefault();
            }
            callback(event);
        };

        this.shortcuts.set(normalizedShortcut, callbackWrapper);

        if (normalizedShortcut.startsWith('ctrl+')) {
            const cmdShortcut = normalizedShortcut.replace(/^ctrl\+/, 'cmd+');
            this.shortcuts.set(cmdShortcut, callbackWrapper);
        } else if (normalizedShortcut.startsWith('cmd+')) {
            const ctrlShortcut = normalizedShortcut.replace(/^cmd\+/, 'ctrl+');
            this.shortcuts.set(ctrlShortcut, callbackWrapper);
        }
    }

    destroy() {
        if (this.handleKeyDown) {
            document.removeEventListener('keydown', this.handleKeyDown);
            this.handleKeyDown = null;
        }
        this.shortcuts.clear();
        log('InputManager destroyed', 'game');
    }
}
