
// You can write more code here

/* START OF COMPILED CODE */

import ScreenAnchor from "../../scriptNodes/basics/ScreenAnchor.js";
import InteractButton from "./InteractButton.js";
import OpenMenuButton from "./OpenMenuButton.js";
import AutoPlayMenu from "./AutoPlayMenu.js";
import AccountBalanceDisplay from "./AccountBalanceDisplay.js";
import HamburgerMenu from "./HamburgerMenu.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class PeelTabUI extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		// blackBar
		const blackBar = scene.add.rectangle(0, 1920, 1080, 175);
		blackBar.setOrigin(0, 1);
		blackBar.alpha = 0.8;
		blackBar.isFilled = true;
		blackBar.fillColor = 0;
		this.add(blackBar);

		// screenAnchor
		const screenAnchor = new ScreenAnchor(blackBar);

		// BottomCenter
		const bottomCenter = scene.add.container(540, 1920);
		this.add(bottomCenter);

		// interactButton
		const interactButton = new InteractButton(scene, -82, -90);
		bottomCenter.add(interactButton);

		// autoOptionsButton
		const autoOptionsButton = new OpenMenuButton(scene, 147, -90);
		bottomCenter.add(autoOptionsButton);

		// autoPlayMenu
		const autoPlayMenu = new AutoPlayMenu(scene, 0, -191);
		autoPlayMenu.visible = false;
		bottomCenter.add(autoPlayMenu);

		// screenAnchor_3
		const screenAnchor_3 = new ScreenAnchor(bottomCenter);

		// BottomRight
		const bottomRight = scene.add.container(1080, 1920);
		this.add(bottomRight);

		// accountBalanceDisplay
		const accountBalanceDisplay = new AccountBalanceDisplay(scene, -152, -90);
		bottomRight.add(accountBalanceDisplay);

		// screenAnchor_1
		const screenAnchor_1 = new ScreenAnchor(bottomRight);

		// BottomLeft
		const bottomLeft = scene.add.container(0, 1920);
		this.add(bottomLeft);

		// autoOptionsButton_1
		const autoOptionsButton_1 = new OpenMenuButton(scene, 92, -90);
		bottomLeft.add(autoOptionsButton_1);

		// hamburgerMenu
		const hamburgerMenu = new HamburgerMenu(scene, 91, -183);
		bottomLeft.add(hamburgerMenu);

		// screenAnchor_2
		const screenAnchor_2 = new ScreenAnchor(bottomLeft);

		// screenAnchor (prefab fields)
		screenAnchor.scale = true;
		screenAnchor.stretchX = true;
		screenAnchor.match = 0.5;
		screenAnchor.maxScale = 1.5;

		// autoOptionsButton (prefab fields)
		autoOptionsButton.target = autoPlayMenu;
		autoOptionsButton.icon = {"key":"AutoPlay"};

		// screenAnchor_3 (prefab fields)
		screenAnchor_3.stretchX = false;
		screenAnchor_3.match = 0.5;
		screenAnchor_3.maxScale = 1.5;

		// screenAnchor_1 (prefab fields)
		screenAnchor_1.stretchX = false;
		screenAnchor_1.match = 0.5;
		screenAnchor_1.maxScale = 1.75;

		// autoOptionsButton_1 (prefab fields)
		autoOptionsButton_1.target = hamburgerMenu;
		autoOptionsButton_1.icon = {"key":"Hud_InfoButton"};

		// screenAnchor_2 (prefab fields)
		screenAnchor_2.stretchX = false;
		screenAnchor_2.match = 0.5;
		screenAnchor_2.maxScale = 1.5;

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
