
// You can write more code here

/* START OF COMPILED CODE */

import ScriptNode from "../../../phaserjs_editor_scripts_base/ScriptNode.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class SetImage extends ScriptNode {

	constructor(parent) {
		super(parent);

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @type {{key:string,frame?:string|number}} */
	imageKey;
	/** @type {Phaser.GameObjects.GameObject} */
	target;
	/** @type {boolean} */
	hideOnFail = false;

	/* START-USER-CODE */

	// Write your code here.
	awake()
	{
		if(this.target === undefined){this.target = this.gameObject}

		if(this.scene.textures.exists(this.imageKey.key))
		{
			this.target.setTexture(this.imageKey.key);
		}
		else
		{
			if(this.hideOnFail) this.gameObject.visible = false;
		}

		this.executeChildren();
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
