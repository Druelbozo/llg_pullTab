
// You can write more code here

/* START OF COMPILED CODE */

import ScriptNode from "../../../phaserjs_editor_scripts_base/ScriptNode.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class setThemeText extends ScriptNode {

	constructor(parent) {
		super(parent);

		/* START-USER-CTR-CODE */
		// Write your code here.

		/* END-USER-CTR-CODE */
	}

	/** @type {"score"|"results"|"description"} */
	id = "score";
	/** @type {boolean} */
	setTextContent = false;

	/* START-USER-CODE */
	awake()
	{
				this.scene.events.on("onGameInitalized",  () => this.setTheme());
	}

	// Write your code here.
	setTheme()
	{
		const theme = this.scene.prefab_ScratchManager.themeData
		let data;



		switch(this.id)
		{
			case "score":
			data = theme.text?.scoreText;
			break;
		}

		let text = this.gameObject;
		text.setStyle
		({
			fontFamily: data.fontFamily,
			fontSize: data.fontSize,

			color: data.color,            
			stroke: data.strokeColor,           
			strokeThickness: data.strokeThickness,
		});

		switch(data.fx)
		{
			case "none":
			break;
			case "glow":
			break;
			default:
			break;
		}

		if(this.setTextContent) {text.text = data.content;}
	}


	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
