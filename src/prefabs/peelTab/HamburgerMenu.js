
// You can write more code here

/* START OF COMPILED CODE */

import PopUpMenu from "../ui/PopUpMenu.js";
import SoundButton from "./SoundButton.js";
import InfoButton from "./InfoButton.js";
import SpeedButton from "./SpeedButton.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class HamburgerMenu extends PopUpMenu {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		// rectangle_1
		const rectangle_1 = scene.add.rectangle(0, 0, 175, 510);
		rectangle_1.setOrigin(0.5, 1);
		rectangle_1.alpha = 0.8;
		rectangle_1.isFilled = true;
		rectangle_1.fillColor = 0;
		this.add(rectangle_1);

		// openMenuButton
		const openMenuButton = new SoundButton(scene, 0, -85);
		this.add(openMenuButton);

		// openMenuButton_1
		const openMenuButton_1 = new InfoButton(scene, 0, -255);
		this.add(openMenuButton_1);

		// openMenuButton_2
		const openMenuButton_2 = new SpeedButton(scene, 0, -421);
		this.add(openMenuButton_2);

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/* START-USER-CODE */

	// Write your code here.

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
