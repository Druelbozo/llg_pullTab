
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class ThemeManager extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		/* START-USER-CTR-CODE */
		// Write your code here.
		this.scene.events.on("scene-awake", ()=> this.init(), this)
		/* END-USER-CTR-CODE */
	}

	/* START-USER-CODE */

	// Write your code here.
	theme

	async init()
	{
		const cfg = this.scene.registry.get('preloadGameConfig') || (typeof window !== 'undefined' && window.__selectedGameConfig) || {};
		const selectedOptions = cfg.theme || 'default';
		console.log('Loading theme:', selectedOptions, 'from preloadGameConfig / window.__selectedGameConfig');
		// Add cache-busting parameter to ensure we get the latest theme file
		const cacheBuster = Date.now();
		const optionsResponse = await fetch(`src/config/themes/${selectedOptions}.json?t=${cacheBuster}`);

		if (optionsResponse.ok)
		{
			const optionsData = await optionsResponse.json();

			this.theme = optionsData;

			this.scene.themeData = optionsData;
			if (!this.scene.themeData.controlBar) {
				this.scene.themeData.controlBar = {};
			}
			const cb = this.scene.themeData.controlBar;
			if (!cb.palette) {
				const btn =
					optionsData.themeColors?.buttonColor && optionsData.themeColors.buttonColor !== '#0'
						? optionsData.themeColors.buttonColor
						: '#c91a42';
				const txt =
					optionsData.themeColors?.textMainColor &&
					optionsData.themeColors.textMainColor !== '#0'
						? optionsData.themeColors.textMainColor
						: '#ffffff';
				cb.palette = { primaryColor: btn, secondaryColor: txt };
			}
			cb.font =
				cb.font ||
				cb.fontFamily ||
				(optionsData.fontLoader?.fonts && optionsData.fontLoader.fonts[0]) ||
				'Lato-Bold';

			this.scene.events.emit("onThemeInitalized", this.theme);
		}
		else
		{
			console.log("Theme Failed");
		}
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
