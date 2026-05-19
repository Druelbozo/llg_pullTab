
// You can write more code here

/* START OF COMPILED CODE */

import PeelMessageText from "./PeelMessageText.js";
import Prefab_Results from "./Prefab_Results.js";
import PeelCardEnterAnim from "./PeelCardEnterAnim.js";
/* START-USER-IMPORTS */
import Peel from "./Peel.js";
import {
	applyPeelCardBackTintFromTheme,
	ensurePeelCardBackGameObject,
	layoutPeelCardHorizontalContentInset,
	shouldShowPeelCardCover,
	shouldShowPeelPrizeLabels,
} from "../../utils/theme/PeelCardThemeUtils.js";
import { syncPullTabPeelCardLayout } from "../../services/pulltab/PullTabControlBarBootstrap.js";
import { warn } from "../../utils/logger/LoggerUtils.js";
/* END-USER-IMPORTS */

export default class PeelCard extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		// gameContainer
		const gameContainer = scene.add.container(0, 0);
		this.add(gameContainer);

		// cardBack
		const cardBack = scene.add.nineslice(0, 0, "CardBack", undefined, 1000, 650, 10, 10, 10, 10);
		gameContainer.add(cardBack);
		this.cardBack = cardBack;

		// prizeContainer
		const prizeContainer = scene.add.container(0, -300);
		gameContainer.add(prizeContainer);

		// peelContainer
		const peelContainer = scene.add.container(80, -300);
		gameContainer.add(peelContainer);

		// dI_CardCover_Default
		const dI_CardCover_Default = scene.add.image(-80, -300, "DI_CardCover_Default");
		dI_CardCover_Default.setOrigin(1, 0);
		gameContainer.add(dI_CardCover_Default);

		// videoContainer
		const videoContainer = scene.add.container(0, 0);
		gameContainer.add(videoContainer);

		// Banner line: scene-level object (scratch `messageText` pattern) — positioned in world space by layout, not scaled with the peel card.
		const messageText = new PeelMessageText(scene, 0, 0);
		messageText.setStyle({});
		scene.add.existing(messageText);
		messageText.setDepth(50);
		scene.pullTabBannerMessageText = messageText;

		// prefab_Results — centered on cardBack (scratch cardContainer pattern)
		const prefab_Results = new Prefab_Results(scene, 0, 0);
		gameContainer.add(prefab_Results);
		this.prefab_Results = prefab_Results;

		// peelCardEnterAnim
		const peelCardEnterAnim = new PeelCardEnterAnim(scene, 0, 0);
		peelCardEnterAnim.visible = false;
		this.add(peelCardEnterAnim);

		this.prizeContainer = prizeContainer;
		this.peelContainer = peelContainer;
		this.dI_CardCover_Default = dI_CardCover_Default;
		this.videoContainer = videoContainer;
		this.messageText = messageText;
		this.gameContainer = gameContainer;
		this.peelCardEnterAnim = peelCardEnterAnim;

		/* START-USER-CTR-CODE */
		// Write your code here.
		this.group = scene.add.group({
			classType: Peel
		});

		this.scene.events.on("onGameSpeedChanged", (value) => {this.speed = value;}, this)
		this.scene.events.on("pulltab-banner-update", (/** @type {string} */ text) => {
			if (typeof text === 'string' && text.trim().length > 0 && this.messageText) {
				this.messageText.text = text.trim();
			}
		});
		this.scene.events.on("scene-awake", ()=> this.awake(), this);
		this.scene.events.on("server-awake", ()=> this.init(), this);

		this.scene.events.on("onStateChanged", this.onStateChanged, this)
		//this.scene.input.keyboard.on("keydown-SPACE", ()=> this.reset(), this)
		/* END-USER-CTR-CODE */
	}

	/** @type {Phaser.GameObjects.Container} */
	prizeContainer;
	/** @type {Phaser.GameObjects.Container} */
	peelContainer;
	/** @type {Phaser.GameObjects.Image} */
	dI_CardCover_Default;
	/** @type {Phaser.GameObjects.Container} */
	videoContainer;
	/** @type {PeelMessageText} */
	messageText;
	/** @type {Phaser.GameObjects.Container} */
	gameContainer;
	/** @type {Phaser.GameObjects.NineSlice|Phaser.GameObjects.Image} */
	cardBack;
	/** @type {PeelCardEnterAnim} */
	peelCardEnterAnim;

	/* START-USER-CODE */
	group;
	padding = 0;
	textPadding = 10;
	speed = 1;

	activeTabs

	// Write your code here.

	_peelThemeListenerBound = false;

	_applyPeelCardThemeVisuals()
	{
		const td =
			this.scene.themeData ||
			this.scene.registry.get('preloadThemeData');
		this.cardBack = ensurePeelCardBackGameObject(this.scene, this.gameContainer, this.cardBack, td);
		if (this.peelCardEnterAnim) {
			this.peelCardEnterAnim.cardBack = ensurePeelCardBackGameObject(
				this.scene,
				this.peelCardEnterAnim,
				this.peelCardEnterAnim.cardBack,
				td
			);
		}
		applyPeelCardBackTintFromTheme(this.cardBack, td);
		applyPeelCardBackTintFromTheme(this.peelCardEnterAnim?.cardBack || null, td);
		layoutPeelCardHorizontalContentInset(this, td);
	}

	awake()
	{
		this.gameContainer.visible = false;
		if (this.messageText) {
			this.messageText.setVisible(false);
		}
		if (!this._peelThemeListenerBound) {
			this._peelThemeListenerBound = true;
			this.scene.events.on('onThemeInitalized', this._applyPeelCardThemeVisuals, this);
		}
		this._applyPeelCardThemeVisuals();
	}

	init()
	{
		let tabSize = 0

		let config = this.scene.serverManager.gameConfig
		const preloadCfg = this.scene.registry.get('preloadGameConfig') || {};
		const td = this.scene.themeData || this.scene.registry.get('preloadThemeData');
		const showPeelPrizeLabels = shouldShowPeelPrizeLabels(td);
		const showCover = shouldShowPeelCardCover(td);
		const peelRows = Math.round(
			Math.max(
				3,
				Math.min(
					20,
					Number(config.rowCount) ||
						Number(preloadCfg.rowCount) ||
						7
				)
			)
		);

		this.messageText.text = config.message;

		for (let i = 0; i < peelRows; i++)
		{
			let tab = this.group.get(0, 0);
			this.peelContainer.add(tab);

			tab.prepareIdleAppearance();

			tab.y = tabSize + this.padding * i;
			tab.x = 0;
			tabSize += tab.getSize().y;
		}

		this.peelContainer.list.reverse();

		if (showPeelPrizeLabels) {
			for (let i = 0; i < peelRows; i++) {
				const prizeText = this.scene.add.text(0, 0, "", {});
				prizeText.setOrigin(0.5, 0);
				const plen = config.prizes?.length || 1;
				prizeText.text = config.prizes[i % plen];
				prizeText.setStyle({
					align: "center",
					color: "#252525ff",
					fontFamily: "Anton-Regular",
					fontSize: "60px",
					resolution: 2,
				});
				this.prizeContainer.add(prizeText);
				prizeText.y = 100 * i + this.textPadding;
			}
		}


		this.messageText.setScale(0,0)
		this.scene.tweens.add
		({
			targets: this.messageText,
			scaleY: 1,
			scaleX: 1,
			duration: 500/ this.speed,
			delay: 1400/ this.speed,
			ease: "Back.out"			
		})

		if (showCover && this.scene.textures.exists("card"))
		{
			this.dI_CardCover_Default.setTexture("card")
		}

		this._applyPeelCardThemeVisuals();
	}

	ready()
	{
		const audio = this.scene.audioService;
		if (audio?.isAudioUnlocked()) {
			audio.playSfx('thud');
		}

		this.gameContainer.visible = true;
		if (this.messageText) {
			this.messageText.setVisible(true);
			this.messageText.show();
		}
		syncPullTabPeelCardLayout(this.scene);

	 	for (let i = 0; i < this.peelContainer.list.length; i++)
		{
			let tab = this.peelContainer.list[i];
			tab.reset();
		}	

		this.scene.stateManager.setState("ready", "PeelCard - Card Anims complete ready to play again")		
	}

	start()
	{
		let session = this.scene.serverManager.gameSession;
		const tabs = Array.isArray(session?.tabs) ? session.tabs : [];

		this.activeTabs = this.peelContainer.list.length;
	 	for (let i = 0; i < this.peelContainer.list.length; i++)
		{
			let tab = this.peelContainer.list[i];
			tab.reset();
			const triple = tabs[i];
			if (!triple || triple.length < 3) {
				warn('[PeelCard] Missing tab triple for row', 'game', i, session);
			}
			tab.init(Array.isArray(triple) ? triple : undefined);
			tab.enabled = true;
			tab.once("peeled", () => this.onTabPeeled(), this);
		}		
	}

	reset()
	{
		this.scene.time.delayedCall(1000, ()=> this.peelCardEnterAnim.enter(this.ready.bind(this)));
	}

	peelAll()
	{
	 	for (let i = 0; i < this.peelContainer.list.length; i++)
		{
			this.scene.time.delayedCall((100 * i)/this.speed, ()=> this.peelContainer.list[i].autoPeel(), this) ;
		}
	}

	onStateChanged(state)
	{
		switch(state)
		{
			case "ready":
			break;
			case "playing":
			this.start();
			break;
			case "reset":
			this.reset();
			break;
			case "clear":
			this.peelAll();
			break;
			case "lose":
			case "win":
			break;
			case "close":
			break;
		}
	}

	onTabPeeled()
	{
		this.activeTabs--;
		if(this.activeTabs == 0)
		{
			this.scene.stateManager.setState("gameOver", "PeelCard - All Tabs Peeled Ending Game")
		}
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
