
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
import { mergeThemeWithDefault } from '../../utils/theme/ThemeMergeUtils.js';
import { defaultControlBarFontFamilyFromTheme } from '../../utils/theme/ThemeFontResolutionUtils.js';
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
		console.log('ThemeManager init:', selectedOptions);

		let optionsData = this.scene.registry.get('preloadThemeData');
		const cacheBuster = Date.now();

		if (!optionsData || typeof optionsData !== 'object' || Object.keys(optionsData).length === 0) {
			console.warn('ThemeManager: preloadThemeData missing, fetching default + theme');
			let def = {};
			let ov = {};
			try {
				const defRes = await fetch(`src/config/themes/default.json?t=${cacheBuster}`);
				if (defRes.ok) def = await defRes.json();
				const thRes = await fetch(`src/config/themes/${selectedOptions}.json?t=${cacheBuster}`);
				if (thRes.ok) ov = await thRes.json();
			} catch (e) {
				console.warn('ThemeManager fallback fetch failed', e);
			}
			optionsData = mergeThemeWithDefault(def, ov);
			this.scene.registry.set('preloadThemeData', optionsData);
		}

		if (optionsData && typeof optionsData === 'object')
		{

			this.theme = optionsData;

			this.scene.themeData = optionsData;
			if (!this.scene.themeData.controlBar) {
				this.scene.themeData.controlBar = {};
			}
			const cb = this.scene.themeData.controlBar;
			if (!cb.palette) {
				cb.palette = {
					primaryColor: '#c91a42',
					secondaryColor: '#ffffff',
				};
			}
			if (!cb.font && !cb.fontFamily) {
				const inferred = defaultControlBarFontFamilyFromTheme(optionsData);
				cb.font = inferred || { family: 'Lato' };
			}

			this.scene.events.emit("onThemeInitalized", this.theme);
			return;
		}

		console.log('Theme Failed');
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
