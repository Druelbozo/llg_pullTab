
// You can write more code here

/* START OF COMPILED CODE */

import ScreenAnchor from "../scriptNodes/basics/ScreenAnchor.js";
import PeelCard from "../prefabs/peelTab/PeelCard.js";
import ScreenFit from "../scriptNodes/basics/ScreenFit.js";
import PeelManager from "../prefabs/peelTab/PeelManager.js";
import MusicManager from "../prefabs/audio/MusicManager.js";
import StateManager from "../prefabs/game/StateManager.js";
import PeelTabUI from "../prefabs/peelTab/PeelTabUI.js";
import ServerManager from "../prefabs/game/ServerManager.js";
import ThemeManager from "../prefabs/game/ThemeManager.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class Level extends Phaser.Scene {

	constructor() {
		super("Level");

		/* START-USER-CTR-CODE */
		// Write your code here.



		/* END-USER-CTR-CODE */
	}

	/** @returns {void} */
	editorCreate() {

		// bg_Container_1
		const bg_Container_1 = this.add.container(540, 960);

		// dI_Background_banana_1
		const dI_Background_banana_1 = this.add.tileSprite(0, 0, 1920, 1080, "DI_Background_banana");
		dI_Background_banana_1.scaleX = 2;
		dI_Background_banana_1.scaleY = 2;
		bg_Container_1.add(dI_Background_banana_1);

		// screenAnchor_2
		new ScreenAnchor(bg_Container_1);

		// peelCard
		const peelCard = new PeelCard(this, 540, 869);
		this.add.existing(peelCard);

		// screenAnchor_1
		const screenAnchor_1 = new ScreenAnchor(peelCard);

		// screenFit
		const screenFit = new ScreenFit(peelCard);

		// peelManager
		const peelManager = new PeelManager(this, 1745, 1079);
		this.add.existing(peelManager);

		// musicManager
		const musicManager = new MusicManager(this, 0, 0);
		this.add.existing(musicManager);

		// stateManager
		const stateManager = new StateManager(this, 0, 0);
		this.add.existing(stateManager);

		// peelTabUI
		const peelTabUI = new PeelTabUI(this, 0, 0);
		this.add.existing(peelTabUI);

		// serverManager
		const serverManager = new ServerManager(this, 0, 0);
		this.add.existing(serverManager);

		// themeManager
		const themeManager = new ThemeManager(this, 540, 960);
		this.add.existing(themeManager);

		// screenAnchor_1 (prefab fields)
		screenAnchor_1.scale = false;
		screenAnchor_1.match = 0.35;
		screenAnchor_1.debug = true;
		screenAnchor_1.maxScale = 1.25;
		screenAnchor_1.minScale = 0.01;

		// screenFit (prefab fields)
		screenFit.yPadding = 100;

		this.peelManager = peelManager;
		this.musicManager = musicManager;
		this.stateManager = stateManager;
		this.serverManager = serverManager;
		this.themeManager = themeManager;

		this.events.emit("scene-awake");
	}

	/** @type {PeelManager} */
	peelManager;
	/** @type {MusicManager} */
	musicManager;
	/** @type {StateManager} */
	stateManager;
	/** @type {ServerManager} */
	serverManager;
	/** @type {ThemeManager} */
	themeManager;

	/* START-USER-CODE */

	// Write more your code here

	create() {
		this.editorCreate();
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
