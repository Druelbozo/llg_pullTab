// WebFontFile.js
import { log, warn, error as logErr } from '../logger/LoggerUtils.js';

export default class WebFontFile extends Phaser.Loader.File {
    constructor(loader, fontNames, service = 'google') {
        super(loader, { type: 'webfont', key: fontNames.toString() });
        this.fontNames = Array.isArray(fontNames) ? fontNames : [fontNames];
        this.service = service;
        this.success = false;
    }

    load() {
        log(`[WebFontFile] Starting load for: ${this.fontNames.join(', ')}`, 'assets');

        WebFont.load({
            [this.service]: { families: this.fontNames },

            // Fires when *any* font starts loading
            fontloading: (family, fvd) => {
                log(`[WebFontFile] Loading font: ${family} (${fvd})`, 'assets');
            },

            // Fires when a font finishes successfully
            fontactive: (family, fvd) => {
                log(`[WebFontFile] Font active: ${family} (${fvd})`, 'assets');
            },

            // Fires when a font fails (typo, network, missing weight, etc.)
            fontinactive: (family, fvd) => {
                warn(`[WebFontFile] Failed to load font: ${family} (${fvd})`, 'assets');
            },

            // Called when ALL requested fonts are loaded or failed
            active: () => {
                this.success = true;
                log(`[WebFontFile] All fonts ready: ${this.fontNames.join(', ')}`, 'assets');
                this.loader.nextFile(this, true);
            },

            inactive: () => {
                this.success = false;
                logErr(`[WebFontFile] One or more fonts failed: ${this.fontNames.join(', ')}`, 'assets');
                this.loader.nextFile(this, false);
            }
        });
    }
}
