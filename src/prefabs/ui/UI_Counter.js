
// You can write more code here

/* START OF COMPILED CODE */

import Text from "./Text.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class UI_Counter extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		// uI_CounterPanel
		const uI_CounterPanel = scene.add.image(0, 0, "UI_CounterPanel");
		this.add(uI_CounterPanel);

		// nineslice_1
		const nineslice_1 = scene.add.nineslice(-80, 32, "Btn_OtherButton_Square08", undefined, 350, 80, 10, 10, 10, 10);
		nineslice_1.alpha = 0.5;
		nineslice_1.tint = 0;
		this.add(nineslice_1);

		// NumberContainer
		const numberContainer = scene.add.container(0, 0);
		this.add(numberContainer);

		// valueText
		const valueText = new Text(scene, -245, 31);
		numberContainer.add(valueText);

		// titleText
		const titleText = new Text(scene, -245, -49);
		numberContainer.add(titleText);

		// Up
		const up = scene.add.container(200, -45);
		up.setInteractive(new Phaser.Geom.Rectangle(-44, -20, 87.91161194283583, 39.648444567914524), Phaser.Geom.Rectangle.Contains);
		this.add(up);

		// uI_Arrow
		const uI_Arrow = scene.add.image(0, 0, "UI_Arrow");
		up.add(uI_Arrow);

		// Down
		const down = scene.add.container(200, 45);
		down.setInteractive(new Phaser.Geom.Rectangle(-43, -16, 86.44286005464967, 40.17737915724459), Phaser.Geom.Rectangle.Contains);
		this.add(down);

		// uI_Arrow_1
		const uI_Arrow_1 = scene.add.image(0, 3, "UI_Arrow");
		uI_Arrow_1.angle = -180;
		down.add(uI_Arrow_1);

		// valueText (prefab fields)
		valueText.textSize = 62;
		valueText.alignment = "left";
		valueText.textType = "DOM";

		// titleText (prefab fields)
		titleText.textValue = "BET AMOUNT";
		titleText.textSize = 42;
		titleText.alignment = "left";
		titleText.textType = "DOM";

		this.valueText = valueText;
		this.titleText = titleText;
		this.up = up;
		this.down = down;

		/* START-USER-CTR-CODE */
		// Write your code here.
		this.scene.events.on("scene-awake", () => {this.onDisable()});
		this.scene.events.on("onVariableChanged", (id, value) => {this.updateVariable(id, value)});
		this.scene.events.on("onStateChanged", (state) => {this.onStateChanged(state)});

		/* END-USER-CTR-CODE */
	}

	/** @type {Text} */
	valueText;
	/** @type {Text} */
	titleText;
	/** @type {Phaser.GameObjects.Container} */
	up;
	/** @type {Phaser.GameObjects.Container} */
	down;
	/** @type {string} */
	valueId = "";
	/** @type {string} */
	title = "hi";
	/** @type {{key:string,frame?:string|number}} */
	icon;
	/** @type {boolean} */
	displayAsCurrency = false;
	/** @type {boolean} */
	useArrowButtons = false;
	/** @type {string} */
	prefix = "";
	/** @type {string} */
	activeState = "Idle";

	/* START-USER-CODE */
	value = 1
	min = 1
	max = 100

	setDisplay(useArrowButtons,displayAsCurrency)
	{
		//if(useArrowButtons){this.downIcon.text = "<"}
		//if(useArrowButtons){this.upIcon.text = ">"}
		this.displayAsCurrency = displayAsCurrency;
		this.updateValueVisual()
	}

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

	// Write your code here.
	onEnable()
	{
		//if(this.useArrowButtons){this.downIcon.text = "<"}
		//if(this.useArrowButtons){this.downIcon.text = ">"}

		this.up.on("pointerdown", () => {this.incrementUp()})
		this.down.on("pointerdown", () => {this.incrementDown()})
		this.updateValueVisual()
		this.up.alpha = 1;
		this.down.alpha = 1;	
	}

	onDisable()
	{
		this.up.off("pointerdown");
		this.down.off("pointerdown");	
		this.updateValueVisual();
		this.up.alpha = 0.5;
		this.down.alpha = 0.5;	
	}

	updateVariable(id, value)
	{
		if(id == this.valueId)
		{
			this.value = value;
			this.updateValueVisual();
		}
	}

	setMinMax(min,max)
	{
		this.min = min;
		this.max = max;
	}

	incrementUp()
	{
		this.value++;
		this.value = Phaser.Math.Clamp(this.value, this.min, this.max);
		this.updateValueVisual();
		this.emit("onVariableSet", this.valueId, this.value);


	}

	incrementDown()
	{
		this.value--;
		this.value = Phaser.Math.Clamp(this.value, this.min, this.max);
		this.updateValueVisual();
		this.emit("onVariableSet", this.valueId, this.value);

	}

	setMin()
	{
		this.value = this.min;

		this.scene.events.emit("onVariableSet", this.valueId, this.value);
	}

	setMax()
	{
		this.value = this.max;

		this.scene.events.emit("onVariableSet", this.valueId, this.value);
	}

	double()
	{
		this.value = this.value * 2;
		this.value = Phaser.Math.RoundTo(this.value)
		this.value = Phaser.Math.Clamp(this.value, this.min, this.max);

		this.scene.events.emit("onVariableSet", this.valueId, this.value);
	}

	half()
	{
		this.value = this.value / 2;
		this.value = Phaser.Math.RoundTo(this.value)
		this.value = Phaser.Math.Clamp(this.value, this.min, this.max);

		this.scene.events.emit("onVariableSet", this.valueId, this.value);
	}

	updateValueVisual()
	{
		this.titleText.text = this.title;
		let num = this.value;
		if(this.displayAsCurrency){num = num.toFixed(2)}

		this.valueText.text = this.prefix + num;
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
