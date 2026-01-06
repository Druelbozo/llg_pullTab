
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class PeelMessageText extends Phaser.GameObjects.Text {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0, "", {});

		this.setOrigin(0.5, 0.5);
		this.text = "OPEN THE TAB FOR WINS UP TO 999$";
		this.setStyle({ "color": "#33b5d4ff", "fontFamily": "Lato-Bold", "fontSize": "50px", "stroke": "#e3e6c6ff", "strokeThickness": 14, "shadow.color": "#00000072" });

		/* START-USER-CTR-CODE */
		// Write your code here.
		this.scene.events.on("server-awake", (server) => this.init(server), this)
		this.scene.events.on("onThemeInitalized", (themeManager) => this.initVisual(themeManager), this);
		/* END-USER-CTR-CODE */
	}

	/* START-USER-CODE */
	shown = false;

	// Write your code here.
	init(server)
	{
		this.text = "OPEN THE TAB FOR WINS UP TO $999"
	}

	initVisual(theme)
	{
		let style = theme.text.mainText;
		console.log("!!!!!", style);

		this.setStyle
		({
			fontFamily: style.fontFamily,
			fontSize: style.fontSize,
			color: style.color,
			stroke: style.strokeColor,
			strokeThickness: style.strokeThickness,
		})

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
