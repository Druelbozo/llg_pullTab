
// You can write more code here

/* START OF COMPILED CODE */

import ScriptNode from "../../phaserjs_editor_scripts_base/ScriptNode.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class MessageDisplay extends ScriptNode {

	constructor(parent) {
		super(parent);

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @type {Phaser.GameObjects.Text} */
	textObject;
	/** @type {string} */
	messageEvent = "";

	/* START-USER-CODE */
	execute(message)
	{
		this.textObject.text = message;
		this.executeChildren();
	}

	destroy()
	{
		this.scene.events.off(this.messageEvent);
	}

	// Write your code here.

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
