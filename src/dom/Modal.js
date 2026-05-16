/**
 * DOM modal overlay (Scratch-style). Third arg: Phaser scene (legacy) or
 * { scene, onMount, showCloseButton, suppressPhaserInput, dismissOnBackdrop, dismissOnEscape }.
 */
export default class Modal {
    static _phaserInputSuppressDepth = 0;
    static _phaserInputSceneToRestore = null;
    static _phaserInputEnabledBeforeSuppress = true;

    /**
     * @param {string} id
     * @param {string|(() => string|Promise<string>)} contentHTMLOrFunction
     * @param {Phaser.Scene|null|Object} [sceneOrOptions]
     */
    constructor(id, contentHTMLOrFunction, sceneOrOptions = null) {
        this.id = id;
        this.contentHTMLOrFunction = contentHTMLOrFunction;
        this.modalElement = null;
        this._phaserInputSuppressionActive = false;
        /** @type {((e: KeyboardEvent) => void) | null} */
        this._onDocumentKeydown = null;
        /** @type {((e: MouseEvent) => void) | null} */
        this._onBackdropClick = null;

        const isPhaserScene =
            sceneOrOptions != null &&
            typeof sceneOrOptions === 'object' &&
            typeof sceneOrOptions.sys === 'object' &&
            sceneOrOptions.sys !== null;

        if (isPhaserScene) {
            this.scene = /** @type {Phaser.Scene} */ (sceneOrOptions);
            this.onMount = null;
            this.showCloseButton = true;
            this.suppressPhaserInput = true;
            this.dismissOnBackdrop = true;
            this.dismissOnEscape = true;
        } else if (sceneOrOptions != null && typeof sceneOrOptions === 'object') {
            const o = sceneOrOptions;
            this.scene = o.scene ?? null;
            this.onMount = typeof o.onMount === 'function' ? o.onMount : null;
            this.showCloseButton = o.showCloseButton !== false;
            this.suppressPhaserInput = o.suppressPhaserInput !== false;
            this.dismissOnBackdrop = o.dismissOnBackdrop !== false;
            this.dismissOnEscape = o.dismissOnEscape !== false;
        } else {
            this.scene = null;
            this.onMount = null;
            this.showCloseButton = true;
            this.suppressPhaserInput = true;
            this.dismissOnBackdrop = true;
            this.dismissOnEscape = true;
        }
    }

    _attachDismissListeners() {
        if (!this.modalElement) {
            return;
        }
        if (this.dismissOnBackdrop) {
            this._onBackdropClick = (e) => {
                if (e.target === this.modalElement) {
                    this.hide();
                }
            };
            this.modalElement.addEventListener('click', this._onBackdropClick);
        }
        if (this.dismissOnEscape) {
            this._onDocumentKeydown = (e) => {
                if (e.key === 'Escape' || e.keyCode === 27) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.hide();
                }
            };
            document.addEventListener('keydown', this._onDocumentKeydown, true);
        }
    }

    _tearDownDismissListeners() {
        if (this._onDocumentKeydown) {
            document.removeEventListener('keydown', this._onDocumentKeydown, true);
            this._onDocumentKeydown = null;
        }
        if (this._onBackdropClick && this.modalElement) {
            this.modalElement.removeEventListener('click', this._onBackdropClick);
            this._onBackdropClick = null;
        }
    }

    async show() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = `${this.id}-overlay`;

        const modal = document.createElement('div');
        modal.className = 'modal-container';
        modal.id = `${this.id}-modal`;

        const content = document.createElement('div');
        content.className = 'modal-content';

        let contentHTML;
        if (typeof this.contentHTMLOrFunction === 'function') {
            const result = this.contentHTMLOrFunction();
            if (result instanceof Promise) {
                content.innerHTML = '<p>Loading...</p>';
                contentHTML = await result;
            } else {
                contentHTML = result;
            }
        } else {
            contentHTML = this.contentHTMLOrFunction;
        }
        content.innerHTML = contentHTML;

        if (this.showCloseButton) {
            const closeButton = document.createElement('button');
            closeButton.className = 'modal-close';
            closeButton.textContent = '×';
            closeButton.setAttribute('aria-label', 'Close modal');
            closeButton.onclick = () => this.hide();
            modal.appendChild(closeButton);
        }
        modal.appendChild(content);
        overlay.appendChild(modal);

        document.body.appendChild(overlay);
        this.modalElement = overlay;
        this._attachDismissListeners();

        if (this.onMount) {
            this.onMount(overlay, this);
        }

        if (this.scene?.audioService) {
            this.scene.audioService.playSfx('popupOpen');
        }

        if (this.suppressPhaserInput && this.scene?.input) {
            if (Modal._phaserInputSuppressDepth === 0) {
                Modal._phaserInputSceneToRestore = this.scene;
                Modal._phaserInputEnabledBeforeSuppress = this.scene.input.enabled;
                this.scene.input.enabled = false;
            }
            Modal._phaserInputSuppressDepth++;
            this._phaserInputSuppressionActive = true;
        }

        requestAnimationFrame(() => {
            overlay.classList.add('show');
        });
    }

    hide() {
        this._tearDownDismissListeners();
        if (this.scene?.audioService) {
            this.scene.audioService.playSfx('popupClose');
        }
        if (this.modalElement) {
            this.modalElement.classList.remove('show');
            setTimeout(() => {
                if (this.modalElement) {
                    this.modalElement.remove();
                    this.modalElement = null;
                }
                if (this._phaserInputSuppressionActive) {
                    this._phaserInputSuppressionActive = false;
                    Modal._phaserInputSuppressDepth = Math.max(0, Modal._phaserInputSuppressDepth - 1);
                    if (
                        Modal._phaserInputSuppressDepth === 0 &&
                        Modal._phaserInputSceneToRestore?.input
                    ) {
                        Modal._phaserInputSceneToRestore.input.enabled =
                            Modal._phaserInputEnabledBeforeSuppress;
                        Modal._phaserInputSceneToRestore = null;
                    }
                }
            }, 200);
        }
    }
}
