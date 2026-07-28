
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
	shouldUsePeelResultVideo,
	themeDefinesPeelVideoSlot,
	themeUsesFlatCardBackImage,
	PEEL_RESULT_VIDEO_PLAYBACK_MS_AT_SPEED_1,
	layoutPeelRowStack,
	resolvePeelRowGap,
} from "../../utils/theme/PeelCardThemeUtils.js";
import {
	enablePullTabResultsResetButton,
	syncPullTabPeelCardLayout,
} from "../../services/pulltab/PullTabControlBarBootstrap.js";
import { warn } from "../../utils/logger/LoggerUtils.js";
import { GameConfig } from "../../config/Global.js";
import {
	getPullTabGameSpeed,
	msAtSpeed1ToGameSpeed,
} from "../../utils/game/PullTabGameSpeedUtils.js";
import { resolvePullTabPeelRowCount } from "../../utils/game/pullTabBuyDisplay.js";
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
		// Below peel card depth so cardBack occludes the banner where they overlap (scratch messageText=1, cardContainer=10).
		messageText.setDepth(1);
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

		this.scene.events.on("onGameSpeedChanged", (value) => {
			this.speed = value;
		}, this);
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
		if (this.peelContainer?.list?.length > 0) {
			syncPullTabPeelCardLayout(this.scene);
		}
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
		let config = this.scene.serverManager.gameConfig
		const preloadCfg = this.scene.registry.get('preloadGameConfig') || {};
		const td = this.scene.themeData || this.scene.registry.get('preloadThemeData');
		const showPeelPrizeLabels = shouldShowPeelPrizeLabels(td);
		const showCover = shouldShowPeelCardCover(td);
		const peelRows = resolvePullTabPeelRowCount(this.scene, config, preloadCfg);

		this.messageText.text = config.message;

		const rowGap = resolvePeelRowGap(td);
		this.padding = rowGap;

		const tabs = [];
		for (let i = 0; i < peelRows; i++) {
			const tab = this.group.get(0, 0);
			this.peelContainer.add(tab);
			tab.prepareIdleAppearance();
			tabs.push(tab);
		}
		layoutPeelRowStack(tabs, rowGap);

		this.peelContainer.list.reverse();

		layoutPeelCardHorizontalContentInset(this, td);

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

		this._ensurePeelResultVideos(td);

		this._applyPeelCardThemeVisuals();
		syncPullTabPeelCardLayout(this.scene);
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
		const desiredRows = Number(session?.rowCount) > 0
			? Math.round(Number(session.rowCount))
			: resolvePullTabPeelRowCount(
				this.scene,
				this.scene.serverManager?.gameConfig,
				this.scene.registry.get('preloadGameConfig') || {},
			);
		this._ensurePeelTabRows(desiredRows);

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

	_ensurePeelTabRows(desiredRows) {
		const td = this.scene.themeData || this.scene.registry.get('preloadThemeData');
		const rowGap = resolvePeelRowGap(td);
		const target = Math.round(Math.max(3, Math.min(20, Number(desiredRows) || 6)));

		while (this.peelContainer.list.length > target) {
			const tab = this.peelContainer.list[this.peelContainer.list.length - 1];
			this.peelContainer.remove(tab);
			if (typeof tab.reset === 'function') {
				tab.reset();
			}
			this.group.add(tab);
		}
		while (this.peelContainer.list.length < target) {
			const tab = this.group.get(0, 0);
			this.peelContainer.add(tab);
			if (typeof tab.prepareIdleAppearance === 'function') {
				tab.prepareIdleAppearance();
			}
		}

		if (this.peelContainer.list.length > 0) {
			layoutPeelRowStack(this.peelContainer.list, rowGap);
			this.peelContainer.list.reverse();
		}
	}

	reset()
	{
		this.scene.time.delayedCall(1000, ()=> this.peelCardEnterAnim.enter(this.ready.bind(this)));
	}

	peelAll()
	{
		this.speed = getPullTabGameSpeed(this.scene);
		const list = this.peelContainer.list;
		const n = list.length;
		const rowDelayRaw = Number(GameConfig.game.AUTO_PEEL_ROW_DELAY_MS);
		const rowDelayAtSpeed1 =
			Number.isFinite(rowDelayRaw) && rowDelayRaw >= 0 ? rowDelayRaw : 200;
		// list[0] is bottom row after init reverse — peel top-to-bottom (high index first).
		for (let step = 0; step < n; step++) {
			const tab = list[n - 1 - step];
			const delayMs = msAtSpeed1ToGameSpeed(this.scene, rowDelayAtSpeed1 * step);
			this.scene.time.delayedCall(delayMs, () => tab.autoPeel(), this);
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
			this.playLoseVideo();
			break;
			case "win":
			this.playWinVideo();
			break;
			case "close":
			break;
		}
	}

	onTabPeeled()
	{
		if (this.activeTabs <= 0) {
			return;
		}
		this.activeTabs--;
		if (this.activeTabs <= 0) {
			this.activeTabs = 0;
			const sm = this.scene.stateManager;
			if (sm && sm.state !== 'gameOver' && sm.state !== 'win' && sm.state !== 'lose') {
				sm.setState("gameOver", "PeelCard - All Tabs Peeled Ending Game");
			}
		}
	}

	_ensurePeelResultVideos(themeData) {
		if (themeUsesFlatCardBackImage(themeData)) {
			return;
		}
		const flat = !shouldShowPeelCardCover(themeData);
		const x = flat ? 0 : -80;
		const y = flat ? 0 : -300;
		const originX = flat ? 0.5 : 1;
		const originY = flat ? 0.5 : 0;

		if (themeDefinesPeelVideoSlot(themeData, 'win') && this.scene.cache.video.exists('win') && !this.win_Video) {
			const win_Video = this.scene.add.video(x, y, 'win');
			this.win_Video = win_Video;
			win_Video.setOrigin(originX, originY);
			win_Video.visible = false;
			this.videoContainer.add(win_Video);
		}
		if (themeDefinesPeelVideoSlot(themeData, 'lose') && this.scene.cache.video.exists('lose') && !this.lose_Video) {
			const lose_Video = this.scene.add.video(x, y, 'lose');
			this.lose_Video = lose_Video;
			lose_Video.setOrigin(originX, originY);
			lose_Video.visible = false;
			this.videoContainer.add(lose_Video);
		}
	}

	_playPeelResultVideo(video, slot) {
		const td = this.scene.themeData || this.scene.registry.get('preloadThemeData');
		if (!video || !shouldUsePeelResultVideo(this.scene, td, slot)) {
			return;
		}

		const fadeDelay = (PEEL_RESULT_VIDEO_PLAYBACK_MS_AT_SPEED_1 - 250) / this.speed;
		const fadeDuration = 250 / this.speed;

		video.alpha = 1;
		video.visible = true;
		video.setPlaybackRate(this.speed);
		video.play(false);
		this.scene.tweens.add({
			targets: video,
			alpha: 0,
			delay: fadeDelay,
			duration: fadeDuration,
			onComplete: () => {
				video.visible = false;
				enablePullTabResultsResetButton(this.scene);
			},
		});
	}

	playWinVideo() {
		this._playPeelResultVideo(this.win_Video, 'win');
	}

	playLoseVideo() {
		this._playPeelResultVideo(this.lose_Video, 'lose');
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
