
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
import gameConfig from '../../config/game-config.js';
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
		const selectedOptions = gameConfig.theme || 'default';
		console.log('Loading theme:', selectedOptions, 'from gameConfig.theme:', gameConfig.theme);
		console.log('Full gameConfig:', gameConfig);
		// Add cache-busting parameter to ensure we get the latest theme file
		const cacheBuster = Date.now();
		const optionsResponse = await fetch(`Themes/${selectedOptions}.json?t=${cacheBuster}`);

		if (optionsResponse.ok)
		{
			const optionsData = await optionsResponse.json();

			this.theme = optionsData;

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
