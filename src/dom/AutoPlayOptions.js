/**
 * DOM-based autoplay configuration (scratch parity — PeelManager-backed).
 */
import { autoplayOptionsContent } from './autoplayOptions/content/autoplayOptionsContent.js';
import { GameConfig } from '../config/Global.js';
import { debug } from '../utils/logger/LoggerUtils.js';

export default class AutoPlayOptions {
    constructor(scene) {
        this.scene = scene;
        this.modalElement = null;
        this.overlayElement = null;
        this.containerElement = null;
        /** @type {((e: KeyboardEvent) => void) | null} */
        this._onEscapeKey = null;

        this.availableAmounts = GameConfig.game.AUTOPLAY_AMOUNTS || [10, 25, 50, 75, 100, 500];
        const configAmount = GameConfig.game.AUTOPLAY_AMOUNT;

        if (this.availableAmounts.includes(configAmount)) {
            this.selectedAmount = configAmount;
        } else {
            this.selectedAmount = this.availableAmounts[0];
            debug(
                `[AutoPlayOptions] AUTOPLAY_AMOUNT ${configAmount} not in AUTOPLAY_AMOUNTS, defaulting to ${this.selectedAmount}`,
                'ui'
            );
        }

        this.selectColor = '#fd36ff';
        this.defaultColor = '#929292';
        this.themeColors = this.getThemeColors();

        this.autoPlay = GameConfig.game.AUTOPLAY_ENABLED;

        this.initializePeelManagerState();
    }

    getThemeColors() {
        if (!this.scene) return { primaryColor: this.selectColor, secondaryColor: '#fff' };

        const themeData = this.scene.themeData;

        if (themeData && themeData.controlBar && themeData.controlBar.palette) {
            return {
                primaryColor: themeData.controlBar.palette.primaryColor || this.selectColor,
                secondaryColor: themeData.controlBar.palette.secondaryColor || '#fff'
            };
        }

        return { primaryColor: this.selectColor, secondaryColor: '#fff' };
    }

    initializePeelManagerState() {
        const peel = this.scene?.peelManager;
        if (peel && typeof peel.setAuto === 'function') {
            peel.setAuto(this.autoPlay, this.selectedAmount);
            debug(`[AutoPlayOptions] PeelManager autoplay rounds=${this.selectedAmount}, autoMode=${this.autoPlay}`, 'ui');
        }
    }

    show() {
        if (this.modalElement && document.body.contains(this.modalElement)) {
            return;
        }

        this.scene?.audioService?.playSfx('popupOpen');

        this.initializePeelManagerState();

        const overlay = document.createElement('div');
        overlay.className = 'autoplay-options-overlay';
        overlay.id = 'autoplay-options-overlay';

        const container = document.createElement('div');
        container.className = 'autoplay-options-container';
        container.id = 'autoplay-options-container';

        const themeColors = this.getThemeColors();
        container.style.setProperty('--selected-button-bg', themeColors.primaryColor);
        container.style.setProperty('--selected-button-text', themeColors.secondaryColor);

        const closeButton = document.createElement('button');
        closeButton.className = 'autoplay-options-close';
        closeButton.innerHTML = '×';
        closeButton.setAttribute('aria-label', 'Close autoplay options');
        closeButton.onclick = (e) => {
            e.stopPropagation();
            this.hide();
        };

        const contentHTML = autoplayOptionsContent(this.autoPlay, this.selectedAmount, this.availableAmounts);

        const contentWrapper = document.createElement('div');
        contentWrapper.innerHTML = contentHTML;

        container.appendChild(closeButton);
        const contentEl = contentWrapper.firstElementChild;
        container.appendChild(contentEl);
        overlay.appendChild(container);

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                this.hide();
            }
        };

        this._onEscapeKey = (e) => {
            if (e.key === 'Escape' || e.keyCode === 27) {
                e.preventDefault();
                e.stopPropagation();
                this.hide();
            }
        };
        document.addEventListener('keydown', this._onEscapeKey, true);

        document.body.appendChild(overlay);

        this.modalElement = overlay;
        this.overlayElement = overlay;
        this.containerElement = container;

        this.setupEventListeners(contentEl);

        requestAnimationFrame(() => {
            overlay.classList.add('show');
        });

        debug(`[AutoPlayOptions] Popup shown`, 'ui');
    }

    setupEventListeners(content) {
        const toggleButton = content.querySelector('[data-toggle="autoplay"]');
        if (toggleButton) {
            toggleButton.onclick = (e) => {
                e.stopPropagation();
                this.scene?.audioService?.playSfx('buttonClick');
                this.toggleAutoPlay();
            };
        }

        const amountButtons = content.querySelectorAll('.autoplay-options-amount-button');
        amountButtons.forEach((button) => {
            button.onclick = (e) => {
                e.stopPropagation();
                this.scene?.audioService?.playSfx('buttonClick');
                const amount = parseInt(button.getAttribute('data-amount'), 10);
                this.setAmountAndEnable(amount);
            };
        });
    }

    hide() {
        if (this._onEscapeKey) {
            document.removeEventListener('keydown', this._onEscapeKey, true);
            this._onEscapeKey = null;
        }
        this.scene?.audioService?.playSfx('popupClose');
        if (this.modalElement) {
            this.modalElement.classList.remove('show');
            setTimeout(() => {
                if (this.modalElement && document.body.contains(this.modalElement)) {
                    this.modalElement.remove();
                }
                this.modalElement = null;
                this.overlayElement = null;
                this.containerElement = null;
            }, 200);
        }
        debug(`[AutoPlayOptions] Popup hidden`, 'ui');
    }

    setAmountAndEnable(value) {
        this.selectedAmount = value;

        const peel = this.scene?.peelManager;
        if (peel) peel.autoRounds = value;

        this.setAutoPlay(true);
        this.updateUI();

        debug(`[AutoPlayOptions] Amount set to ${value}`, 'ui');
    }

    toggleAutoPlay() {
        this.setAutoPlay(!this.autoPlay);
    }

    setAutoPlay(value) {
        this.autoPlay = value;

        const peel = this.scene?.peelManager;
        if (peel && typeof peel.setAuto === 'function') {
            peel.setAuto(value, peel.autoRounds || this.selectedAmount);
        }

        this.updateUI();

        debug(`[AutoPlayOptions] Autoplay ${value ? 'enabled' : 'disabled'}`, 'ui');
    }

    updateUI() {
        if (!this.containerElement) return;

        const content = this.containerElement.querySelector('.autoplay-options-content');
        if (!content) return;

        const toggleButton = content.querySelector('[data-toggle="autoplay"]');
        if (toggleButton) {
            toggleButton.textContent = this.autoPlay ? 'ON' : 'OFF';
            toggleButton.classList.toggle('selected', !!this.autoPlay);
        }

        const amountButtons = content.querySelectorAll('.autoplay-options-amount-button');
        amountButtons.forEach((button) => {
            const amount = parseInt(button.getAttribute('data-amount'), 10);
            button.classList.toggle('selected', amount === this.selectedAmount);
        });
    }
}
