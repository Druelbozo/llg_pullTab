
// You can write more code here

/* START OF COMPILED CODE */

import Button from "../ui/Button.js";
import Text from "../ui/Text.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class InteractButton extends Button {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		// visualContainer
		const visualContainer = scene.add.container(0, 0);
		this.add(visualContainer);

		// btn_Main
		const btn_Main = scene.add.nineslice(0, 0, "Btn_Main", undefined, 300, 150, 39, 39, 39, 39);
		btn_Main.tint = 16717077;
		visualContainer.add(btn_Main);

		// text
		const text = new Text(scene, 0, 0);
		visualContainer.add(text);

		// text (prefab fields)
		text.textValue = "BUY";
		text.textSize = 60;
		text.textType = "DOM";

		this.text = text;

		/* START-USER-CTR-CODE */
		// Write your code here.
		this.animContainer.add(visualContainer);
		this.scene.events.on("onStateChanged", this.onStateChanged, this);
		/* END-USER-CTR-CODE */
	}

	/** @type {Text} */
	text;

	/* START-USER-CODE */

	// Write your code here.
	execute()
	{	
		this.scene.events.emit("interact");
	}

	onStateChanged(state)
	{
		if(state == "wait")
		{
			this.setEnabled(false);
			return;
		}		

		if(this.scene.peelManager.autoMode && state != "ready")
		{
			this.text.text = "AUTO " + this.scene.peelManager.autoRoundsLeft;
			this.setEnabled(true);
			return;
		}

		switch(state)
		{
			case "ready":
				this.text.text = "BUY"
				this.setEnabled(true);
			break;
			case "playing":
				this.text.text = "CLEAR"
				this.setEnabled(true);
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

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
