
// You can write more code here

/* START OF COMPILED CODE */

import ScriptNode from "../../phaserjs_editor_scripts_base/ScriptNode.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class OnEvent extends ScriptNode {

	constructor(parent) {
		super(parent);

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @type {string} */
	eventName = "";
	/** @type {"game.events"|"scene.events"|"scene.loader"|"scene.input"|"scene.input.keyboard"|"scene.anims"|"scene.physics.world"|"gameObject"} */
	eventEmitter = "gameObject";
	/** @type {boolean} */
	once = false;

	/* START-USER-CODE */

	// Write your code here.
		awake() {

		let emitter = Phaser.Events.EventEmitter;

		switch (this.eventEmitter) {
			case "game.events":

				emitter = this.scene.game.events;
				break;

			case "scene.events":

				emitter = this.scene.events;
				break;

			case "scene.loader":

				emitter = this.scene.load;
				break;

			case "scene.input":

				emitter = this.scene.input;
				break;

			case "scene.input.keyboard":

				emitter = this.scene.input.keyboard;
				break;

			case "scene.anims":

				emitter = this.scene.anims;
				break;

			case "scene.physics.world":

				emitter = this.scene.physics.world;
				break;

			case "gameObject":

				emitter = this.gameObject;
				break;
		}

		if (emitter) {

			if (this.once) {

				emitter.once(this.eventName, this.executeChildren, this);

			} else {

				emitter.on(this.eventName, this.executeChildren, this);
			}

			switch (this.eventEmitter) {
				case "scene.anims":
				case "scene.events":
				case "scene.input":
				case "scene.input.keyboard":
				case "scene.loader":
				case "scene.physics.world":

					this.scene.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {

						emitter?.off(this.eventName, this.executeChildren, this);
					});
					break;
			}

			// If it is attached to a game object
			// and the emitter isn't the game object
			// then remove the listener
			if (this.gameObject && this.eventEmitter !== "gameObject") {

				this.gameObject.once(Phaser.GameObjects.Events.DESTROY, () => {

					emitter?.off(this.eventName, this.executeChildren, this);
				});
			}
		}
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
