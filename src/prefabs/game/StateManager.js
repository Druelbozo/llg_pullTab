
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
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
		console.log("StateManager: Changing State To: -" + state + "- from: -" + this.state + "- Context: " + ctx);
		this.state = state;
		this.scene.events.emit("onStateChanged", this.state); 
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
