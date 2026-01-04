// WebFontFile.js
export default class WebFontFile extends Phaser.Loader.File {
    constructor(loader, fontNames, service = 'google') {
        super(loader, { type: 'webfont', key: fontNames.toString() });
        this.fontNames = Array.isArray(fontNames) ? fontNames : [fontNames];
        this.service = service;
        this.success = false;
    }

    load() {
        console.log(`[WebFontFile] Starting load for: ${this.fontNames.join(', ')}`);

        WebFont.load({
            [this.service]: { families: this.fontNames },

            // Fires when *any* font starts loading
            fontloading: (family, fvd) => {
                console.log(`[WebFontFile] Loading font: ${family} (${fvd})`);
            },

            // Fires when a font finishes successfully
            fontactive: (family, fvd) => {
                console.log(`[WebFontFile] Font active: ${family} (${fvd})`);
            },

            // Fires when a font fails (typo, network, missing weight, etc.)
            fontinactive: (family, fvd) => {
                console.warn(`[WebFontFile] Failed to load font: ${family} (${fvd})`);
            },

            // Called when ALL requested fonts are loaded or failed
            active: () => {
                this.success = true;
                console.log(`[WebFontFile] All fonts ready: ${this.fontNames.join(', ')}`);
                this.loader.nextFile(this, true);
            },

            inactive: () => {
                this.success = false;
                console.error(`[WebFontFile] One or more fonts failed: ${this.fontNames.join(', ')}`);
                this.loader.nextFile(this, false);
            }
        });
    }
}
