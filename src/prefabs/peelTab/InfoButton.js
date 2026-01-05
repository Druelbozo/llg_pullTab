
// You can write more code here

/* START OF COMPILED CODE */

import Button from "../ui/Button.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class InfoButton extends Button {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		// visualContainer
		const visualContainer = scene.add.container(0, 0);
		this.add(visualContainer);

		// btn_Main
		const btn_Main = scene.add.nineslice(0, 0, "Btn_Main", undefined, 150, 150, 39, 37, 34, 36);
		btn_Main.scaleX = 0.75;
		btn_Main.scaleY = 0.75;
		btn_Main.tint = 16717077;
		visualContainer.add(btn_Main);

		// autoPlay
		const autoPlay = scene.add.image(0, 0, "Hud_InfoButton");
		autoPlay.scaleX = 0.5;
		autoPlay.scaleY = 0.5;
		visualContainer.add(autoPlay);

		this.autoPlay = autoPlay;
		this.visualContainer = visualContainer;

		/* START-USER-CTR-CODE */
		// Write your code here.
		this.animContainer.add(visualContainer);
		this.scene.events.on("onStateChanged", this.onStateChanged, this);
		/* END-USER-CTR-CODE */
	}

	/** @type {Phaser.GameObjects.Image} */
	autoPlay;
	/** @type {Phaser.GameObjects.Container} */
	visualContainer;

	/* START-USER-CODE */

	// Write your code here.
	onStateChanged(state)
	{

		switch(state)
		{
			case "ready":
				this.setEnabled(true);
			break;
			case "playing":
				this.setEnabled(false);
			break;
			case "clear":
				this.setEnabled(false);
			break;
			case "gameOver":
				this.setEnabled(false);
			break;
			case "win":
				this.setEnabled(false);
			break;
			case "lose":
				this.setEnabled(false);
			break;
		}
	}

	execute()
	{

	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
