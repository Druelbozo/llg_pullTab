
// You can write more code here

/* START OF COMPILED CODE */

import ScriptNode from "../../phaserjs_editor_scripts_base/ScriptNode.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class OnEventEmit extends ScriptNode {

	constructor(parent) {
		super(parent);

		/* START-USER-CTR-CODE */
		// Write your code here.

		/* END-USER-CTR-CODE */
	}

	/** @type {string} */
	eventName = "MyCoolEvent";
	/** @type {"game.events"|"scene.events"|"scene.loader"|"scene.input"|"scene.input.keyboard"|"scene.anims"|"gameObject"} */
	eventEmitter = "gameObject";

	/* START-USER-CODE */


	// Write your code here.
	    	execute(...args)
		{

			let emitter = Phaser.Events.EventEmitter;

			switch (this.eventEmitter)
			{
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

				case "gameObject":

					emitter = this.gameObject;
					break;
			}

			if (emitter)
			{

				emitter.emit(this.eventName);
			}
		}
	}
	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
