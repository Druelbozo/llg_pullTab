
// You can write more code here

/* START OF COMPILED CODE */

import ScriptNode from "../../phaserjs_editor_scripts_base/ScriptNode.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class TweenAlpha extends ScriptNode {

	constructor(parent) {
		super(parent);

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @type {number} */
	from = 1;
	/** @type {number} */
	to = 1;
	/** @type {number} */
	duration = 1000;
	/** @type {"Linear"|"Quad.easeIn"|"Quad.easeOut"|"Quad.easeInOut"|"Cubic.easeIn"|"Cubic.easeOut"|"Cubic.easeInOut"|"Quart.easeIn"|"Quart.easeOut"|"Quart.easeInOut"|"Quint.easeIn"|"Quint.easeOut"|"Quint.easeInOut"|"Elastic.easeIn"|"Elastic.easeOut"|"Elastic.easeInOut"|"Bounce.easeIn"|"Bounce.easeOut"|"Bounce.easeInOut"|"Back.easeIn"|"Back.easeOut"|"Back.easeInOut"|"Sine.easeIn"|"Sine.easeOut"|"Sine.easeInOut"} */
	ease = "";
	/** @type {boolean} */
	yoyo = false;

	/* START-USER-CODE */

	// Write your code here.
		execute(...args)
	{
		if(this.tween != undefined){this.tween.destroy();}
		const obj = this.gameObject;

		obj.alpha = this.from;

		this.scene.add.tween
		({
			targets: obj,
			alpha: this.to,
			duration: this.duration,
			ease: this.ease,
			yoyo: this.yoyo,
			onComplete: () => {this.executeChildren(args)}
		})
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
