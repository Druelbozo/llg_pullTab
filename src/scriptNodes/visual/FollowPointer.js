
// You can write more code here

/* START OF COMPILED CODE */

import ScriptNode from "../../phaserjs_editor_scripts_base/ScriptNode.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class Node_FollowPointer extends ScriptNode {

	constructor(parent) {
		super(parent);

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @type {boolean} */
	follow = false;

	/* START-USER-CODE */

	// Write your code here.
	toggle(value){
		this.follow = value;
	}

	execute(){
		this.follow = !this.follow;
	}

	update(){

		if(!this.follow) return;

		const pointer = this.scene.input.activePointer;
        this.gameObject.setPosition(pointer.worldX, pointer.worldY);
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
