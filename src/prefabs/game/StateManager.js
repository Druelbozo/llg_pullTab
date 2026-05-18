
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
import { log } from '../../utils/logger/LoggerUtils.js';
/* END-USER-IMPORTS */

export default class StateManager extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/* START-USER-CODE */
	state = "unset"

	// Write your code here.
	setState(state, ctx)
	{
		log(`StateManager: ${this.state} → ${state} (${ctx})`, 'game');
		this.state = state;
		this.scene.events.emit("onStateChanged", this.state); 
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
