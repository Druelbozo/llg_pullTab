
// You can write more code here

/* START OF COMPILED CODE */

import ScriptNode from "../../phaserjs_editor_scripts_base/ScriptNode.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class PlayAudio extends ScriptNode {

	constructor(parent) {
		super(parent);

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @type {string} */
	audio = "Afro Beats Riddim Main";
	/** @type {boolean} */
	loop = false;
	/** @type {"music"|"sfx"} */
	channel = "sfx";
	/** @type {boolean} */
	playOnAwake = false;
	/** @type {boolean} */
	fadeIn = false;

	/* START-USER-CODE */
	awake()
	{
		if(this.playOnAwake){ this.execute()};
	}

	execute()
	{
		let soundObject = this.scene.musicManager.addSound(this.channel,this.audio);
		soundObject.setLoop(this.loop);

		if(this.fadeIn)
		{
			soundObject.setVolume(0);
			this.scene.musicManager.fadeSound(this.channel,this.audio)
		}		
		soundObject.play();
	}

	destroy()
	{
		if(this.soundObject != undefined){this.soundObject.stop();}
	}

	// Write your code here.

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
