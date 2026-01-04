
// You can write more code here

/* START OF COMPILED CODE */

import ScriptNode from "../../../phaserjs_editor_scripts_base/ScriptNode.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class AutoScroll extends ScriptNode {

	constructor(parent) {
		super(parent);

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/* START-USER-CODE */
	scrollSpeed = 0.5;

	// Write your code here.
	update()
	{	
		this.gameObject.tilePositionX += this.scrollSpeed;
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
