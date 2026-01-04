
// You can write more code here

/* START OF COMPILED CODE */

import PopUpMenu from "../ui/PopUpMenu.js";
import ToggleSwitch from "../ui/ToggleSwitch.js";
import UI_Counter from "../ui/UI_Counter.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class AutoPlayMenu extends PopUpMenu {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		// blackBar
		const blackBar = scene.add.rectangle(0, -23, 600, 500);
		blackBar.setOrigin(0.5, 1);
		blackBar.alpha = 0.8;
		blackBar.isFilled = true;
		blackBar.fillColor = 0;
		this.add(blackBar);

		// toggleSwitch
		const toggleSwitch = new ToggleSwitch(scene, 0, -394);
		this.add(toggleSwitch);

		// uI_Counter
		const uI_Counter = new UI_Counter(scene, 0, -149);
		this.add(uI_Counter);

		// toggleSwitch (prefab fields)
		toggleSwitch.title = "AUTO PLAY";
		toggleSwitch.valueID = "AutoMode";
		toggleSwitch.activeState = "ready";

		// uI_Counter (prefab fields)
		uI_Counter.title = "AUTO ROUNDS";
		uI_Counter.activeState = "ready";

		this.toggleSwitch = toggleSwitch;
		this.uI_Counter = uI_Counter;

		/* START-USER-CTR-CODE */
		// Write your code here.
		this.init();
		this.scene.events.on("onAutoChanged", (auto) => this.onAutoChanged(auto));
		/* END-USER-CTR-CODE */
	}

	/** @type {ToggleSwitch} */
	toggleSwitch;
	/** @type {UI_Counter} */
	uI_Counter;

	/* START-USER-CODE */

	// Write your code here.

	init()
	{
		this.toggleSwitch.on("onVariableSet", (id, value) => this.setAuto(id, value),this)
		this.uI_Counter.on("onVariableSet", (id, value) => this.setRounds(id, value),this)			
	}

	setAuto(id, value)
	{
		const val = this.uI_Counter.value;
		this.scene.peelManager.setAuto(value, val);

	}

	setRounds(id, value)
	{
		this.scene.peelManager.setAuto(true, value);
		this.toggleSwitch.setValue("AutoMode" ,true);
	}

	onAutoChanged(auto)
	{
		this.toggleSwitch.setValue("AutoMode" , auto);		
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
