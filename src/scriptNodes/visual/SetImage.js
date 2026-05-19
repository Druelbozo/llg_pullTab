
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
		if (this.target === undefined) {
			this.target = this.gameObject;
		}

		this._applyThemeTexture();

		this.executeChildren();
	}

	_applyThemeTexture() {
		const key = this.imageKey?.key;
		const target = this.target;
		if (!key || !target) {
			return;
		}

		if (this.scene.textures.exists(key)) {
			target.setTexture(key);
			if (this.hideOnFail) {
				target.visible = true;
			}
			return;
		}

		if (this.hideOnFail) {
			this.gameObject.visible = false;
		}

		const onTextureReady = () => {
			if (this.scene.textures.exists(key)) {
				target.setTexture(key);
				target.visible = true;
			}
		};

		this.scene.textures.once('add', (addedKey) => {
			if (addedKey === key) {
				onTextureReady();
			}
		});
		this.scene.events.once('onThemeInitalized', onTextureReady);
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
