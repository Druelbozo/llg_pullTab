
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
import { resolvePeelBannerTextStyle } from '../../utils/theme/ScratchLikeTextResolutionUtils.js';
/* END-USER-IMPORTS */

export default class PeelMessageText extends Phaser.GameObjects.Text {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0, "", {});

		this.setOrigin(0.5, 0.5);
		this.text = "OPEN THE TAB FOR WINS UP TO 999$";
		this.setStyle({ "color": "#33b5d4ff", "fontFamily": "Lato-Bold", "fontSize": "50px", "stroke": "#e3e6c6ff", "strokeThickness": 14, "shadow.color": "#00000072" });

		/* START-USER-CTR-CODE */
		// Write your code here.
		this.scene.events.on("server-awake", () => this.init(), this)
		this.scene.events.on("onThemeInitalized", (themeManager) => this.initVisual(themeManager), this);
		/* END-USER-CTR-CODE */
	}

	/* START-USER-CODE */
	shown = false;

	// Write your code here.
	init()
	{
		/* Banner text comes from PeelCard (merged config); paytable refreshes emit `pulltab-banner-update`. */
	}

	initVisual(theme)
	{
		const style = resolvePeelBannerTextStyle(theme);
		const phaserStyle = {
			fontFamily: style.fontFamily,
			fontSize: style.fontSize,
			color: style.color,
			stroke: style.stroke,
			strokeThickness: style.strokeThickness,
		};
		if (style.fontWeight != null) {
			phaserStyle.fontWeight = style.fontWeight;
		}
		this.setStyle(phaserStyle);
	}

	show()
	{
		if(this.shown) return;
		this.setScale(0,0);
		this.scene.tweens.add
		({
			targets: this,
			scaleY: 1,
			scaleX: 1,
			duration: 500,
			ease: "Back.out"
		})

		this.shown = true;
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
