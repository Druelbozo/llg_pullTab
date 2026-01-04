
// You can write more code here

/* START OF COMPILED CODE */

import ScriptNode from "../../phaserjs_editor_scripts_base/ScriptNode.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class ExecuteNode extends ScriptNode {

	constructor(parent) {
		super(parent);

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @type {Phaser.GameObjects.GameObject} */
	node;

	/* START-USER-CODE */

	// Write your code here.
	execute(){
		this.node.execute();
		this.executeChildren();
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
