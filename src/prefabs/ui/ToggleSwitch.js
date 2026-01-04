
// You can write more code here

/* START OF COMPILED CODE */

import Text from "./Text.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class ToggleSwitch extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		this.setInteractive(new Phaser.Geom.Rectangle(-278.5, -98, 557, 196), Phaser.Geom.Rectangle.Contains);

		// uI_CounterPanel
		const uI_CounterPanel = scene.add.image(0, 0, "UI_CounterPanel");
		this.add(uI_CounterPanel);

		// text
		const text = new Text(scene, -245, -50);
		this.add(text);

		// switchContainer
		const switchContainer = scene.add.container(-155, 30);
		this.add(switchContainer);

		// Backing
		const backing = scene.add.nineslice(0, 0, "Btn_Main", undefined, 200, 95, 35, 35, 40, 40);
		backing.tint = 0;
		switchContainer.add(backing);

		// switchButton
		const switchButton = scene.add.ellipse(-53, 0, 80, 80);
		switchButton.isFilled = true;
		switchContainer.add(switchButton);

		// text (prefab fields)
		text.textSize = 43;
		text.font = "Lato-Bold";
		text.alignment = "left";
		text.textType = "DOM";

		this.text = text;
		this.backing = backing;
		this.switchButton = switchButton;

		/* START-USER-CTR-CODE */
		// Write your code here.
		//this.scene.events.on("onVariableChanged", (id, value) => {this.setValue(id, value)});
		this.scene.events.on("scene-awake", () => {this.onDisable()});
		this.scene.events.on("onStateChanged", (state) => {this.onStateChanged(state)});
		this.startingPos = this.switchButton.x;

		/* END-USER-CTR-CODE */
	}

	/** @type {Text} */
	text;
	/** @type {Phaser.GameObjects.NineSlice} */
	backing;
	/** @type {Phaser.GameObjects.Ellipse} */
	switchButton;
	/** @type {string} */
	title = "";
	/** @type {string} */
	valueID = "";
	/** @type {string} */
	activeState = "Idle";

	/* START-USER-CODE */
	toggle = false;
	startingPos = 0;
	offColor = 0;
	onColor = 5294047;
	// Write your code here.

	onStateChanged(state)
	{
		if(state == this.activeState)
		{
			this.onEnable();
		}
		else
		{
			this.onDisable();
		}
	}

	onEnable()
	{
		this.text.text = this.title;
		this.on("pointerdown", () => {this.onInteract()})	
		this.switchButton.alpha = 1;
	}

	onDisable()
	{
		this.text.text = this.title;
		this.off("pointerdown");
		this.switchButton.alpha = 0.5;
	}


	onInteract()
	{
		this.toggle = !this.toggle;
		this.setVisual();
		this.emit("onVariableSet", this.valueID, this.toggle);
	}

	setValue(id, value)
	{
		this.toggle = value;
		this.setVisual();
	}

	setVisual()
	{

		//Move Knob
		if(this.toggle)
		{
			this.scene.add.tween
			({
				targets: this.switchButton,
				x: -this.startingPos,
				duration: 250,
				ease: 'Back.easeIn',
			})
		}
		else
		{
			this.scene.add.tween
			({
				targets: this.switchButton,
				x: this.startingPos,
				duration: 250,
				ease: 'Back.easeIn',
			})			
		}

		//Set Color
		if(!this.toggle)
		{
			this.backing.tint = (this.offColor);
		}
		else
		{
			this.backing.tint = (this.onColor);
		}

	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
