
// You can write more code here

/* START OF COMPILED CODE */

import SetImage from "../scriptNodes/visual/SetImage.js";
import ScreenAnchor from "../scriptNodes/basics/ScreenAnchor.js";
import PeelCard from "../prefabs/peelTab/PeelCard.js";
import ScreenFit from "../scriptNodes/basics/ScreenFit.js";
import PeelManager from "../prefabs/peelTab/PeelManager.js";
import MusicManager from "../prefabs/audio/MusicManager.js";
import StateManager from "../prefabs/game/StateManager.js";
import ServerManager from "../prefabs/game/ServerManager.js";
import ThemeManager from "../prefabs/game/ThemeManager.js";
/* START-USER-IMPORTS */
import {
	bootstrapPullTabControlBar,
	applyPullTabControlBarLayoutFromScene,
} from "../services/pulltab/PullTabControlBarBootstrap.js";
import { setupPullTabDebugOverlay } from "../services/pulltab/PullTabDebugOverlayBootstrap.js";
import AudioService from "../services/game/AudioService.js";
import InputManager from "../services/system/InputManager.js";
import { GameConfig } from "../config/Global.js";
import { log } from "../utils/logger/LoggerUtils.js";
import { drawPeelCardElementBounds } from "../utils/layout/LayoutDebugUtils.js";
import {
	calculateCoverScale,
	getSpriteNaturalTextureSize,
} from "../utils/ui/graphics/BackgroundScaler.js";
/* END-USER-IMPORTS */

export default class Level extends Phaser.Scene {

	constructor() {
		super("Level");

		/* START-USER-CTR-CODE */
		// Gameplay API: PullTabsService / ProviderAPIService use GameConfig.api + resolveApiBaseUrl().

		// Initialize game services
		//this.gameStateService = new GameStateService(this);
		//this.balanceService = new BalanceService(this, 100000, gameConfig.creditValueMinor);
		//this.paytableService = new PaytableService(this.scratchCardsService);
		//this.audioService = new AudioService(this);
		/* END-USER-CTR-CODE */
	}

	/** @returns {void} */
	editorCreate() {

		// bg_Container_1
		const bg_Container_1 = this.add.container(540, 960);

		// dI_Background_banana_1 (1:1 scale - ScreenAnchor cover mode scales container to fill viewport)
		const dI_Background_banana_1 = this.add.image(0, 0, "DI_Background_Default");
		bg_Container_1.add(dI_Background_banana_1);

		// setImage
		const setImage = new SetImage(dI_Background_banana_1);

		// screenAnchor_2 (cover mode fills viewport on wide screens)
		const screenAnchor_2 = new ScreenAnchor(bg_Container_1);
		// Scratch-style fill: scale from texture aspect (BackgroundScalingService), not design ref ratios.
		screenAnchor_2.scaleMode = 'cover';
		screenAnchor_2.scale = false;
		screenAnchor_2.position = false;

		// peelCard — depth above scene-level banner text (scratch cardContainer=10 vs messageText=1)
		const peelCard = new PeelCard(this, 540, 910);
		this.add.existing(peelCard);
		peelCard.setDepth(10);

		// screenAnchor_1
		const screenAnchor_1 = new ScreenAnchor(peelCard);

		// screenFit
		const screenFit = new ScreenFit(peelCard);
		screenFit.layoutManagedScale = true;

		// peelManager
		const peelManager = new PeelManager(this, 1745, 1079);
		this.add.existing(peelManager);

		// musicManager
		const musicManager = new MusicManager(this, 0, 0);
		this.add.existing(musicManager);

		// stateManager
		const stateManager = new StateManager(this, 0, 0);
		this.add.existing(stateManager);

		// serverManager
		const serverManager = new ServerManager(this, 0, 0);
		this.add.existing(serverManager);

		// themeManager
		const themeManager = new ThemeManager(this, 540, 960);
		this.add.existing(themeManager);

		// setImage (prefab fields)
		setImage.imageKey = {"key":"background"};
		setImage.hideOnFail = false;

		// screenAnchor_1 (prefab fields)
		screenAnchor_1.scale = false;
		screenAnchor_1.match = 0.35;
		screenAnchor_1.debug = true;
		screenAnchor_1.maxScale = 1.25;
		screenAnchor_1.minScale = 0.01;

		// screenFit (prefab fields)
		screenFit.xPadding = 25;
		screenFit.yPadding = 220;

		this.peelCard = peelCard;
		this.peelCardScreenFit = screenFit;

		this.bgBackdropContainer = bg_Container_1;
		this.bgBackdropScreenAnchor = screenAnchor_2;
		bg_Container_1.setDepth(-10000);

		this.dI_Background_banana_1 = dI_Background_banana_1;
		this.peelManager = peelManager;
		this.musicManager = musicManager;
		this.stateManager = stateManager;
		this.serverManager = serverManager;
		this.themeManager = themeManager;
	}

	/** @type {Phaser.GameObjects.Image} */
	dI_Background_banana_1;
	/** @type {Phaser.GameObjects.Container} */
	bgBackdropContainer;
	/** @type {ScreenAnchor} */
	bgBackdropScreenAnchor;
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

	/** @type {Phaser.GameObjects.Container} */
	peelCard;

	/** @type {import('../services/system/InputManager.js').default|null} */
	inputManager;

	/* START-USER-CODE */

	_backdropCoverRetryCount = 0;

	// Write more your code here

	/**
	 * Full-screen theme backdrop using texture-native cover math (mirror scratch BackgroundScalingService).
	 */
	_syncPullTabBackdropCover() {
		const sprite = this.dI_Background_banana_1;
		const container = this.bgBackdropContainer;
		if (!sprite?.active || !container?.scene) return;

		const vw = this.scale.width;
		const vh = this.scale.height;
		if (!vw || !vh || vw <= 0 || vh <= 0) return;

		const texKey = sprite.texture?.key;
		if (!texKey || !this.textures.exists(texKey) || texKey === '_MISSING') return;

		const { width: iw, height: ih } = getSpriteNaturalTextureSize(sprite);
		if (!iw || !ih) {
			if (this._backdropCoverRetryCount < 40) {
				this._backdropCoverRetryCount++;
				this.time.delayedCall(48, () => this._syncPullTabBackdropCover());
			}
			return;
		}

		const cover = calculateCoverScale(iw, ih, vw, vh);
		if (!Number.isFinite(cover) || cover <= 0) return;
		this._backdropCoverRetryCount = 0;

		container.setPosition(vw / 2, vh / 2);
		container.setVisible(true);

		sprite.setOrigin(0.5, 0.5);
		sprite.setPosition(0, 0);
		sprite.setScale(cover);
		sprite.setVisible(true);
	}
	create() {
		this.editorCreate();

		this.audioService = new AudioService(this);
		if (GameConfig.game.START_MUTED) {
			this.audioService.setMuted(true);
		}

		const unlockAudioOnce = () => {
			if (this.audioService && !this.audioService.isAudioUnlocked()) {
				this.audioService.unlockAudio();
			}
			this.input.off('pointerdown', unlockAudioOnce);
			this.input.off('pointerup', unlockAudioOnce);
		};
		this.input.once('pointerdown', unlockAudioOnce);
		this.input.once('pointerup', unlockAudioOnce);

		this.events.once('onThemeInitalized', () => {
			const key = this.themeData?.music?.audioKey;
			if (key && typeof key === 'string') {
				const trimmed = key.trim();
				if (trimmed !== '' && trimmed.toLowerCase() !== 'null') {
					this.audioService.playThemeMusic(trimmed);
				}
			}
			this._updateSoundIcon();
			this._syncPullTabBackdropCover();
		});

		bootstrapPullTabControlBar(this);
		setupPullTabDebugOverlay(this);
		this._setupVisualDebugShortcuts();
		this.events.emit("scene-awake");

		this.time.delayedCall(0, () => this._syncPullTabBackdropCover());
	}

	/**
	 * Phaser/game `scale.resize` → `main.js` calls this so control bar reposition matches scratch-card flow.
	 */
	resize() {
		this._syncPullTabBackdropCover();
		applyPullTabControlBarLayoutFromScene(this);
		if (GameConfig.debug.SHOW_PEEL_CARD_VISUAL_DEBUGGING) {
			drawPeelCardElementBounds({ scene: this, peelCard: this.peelCard });
		}
	}

	/**
	 * Scratch-style dev shortcuts when `ENABLE_VISUAL_DEBUG_SHORTCUTS` is true (non-production):
	 * Ctrl+I toggles Phaser `debugInfo` if defined; **1–7** open debug overlay panels / **Esc** closes (see `DebugOverlay`).
	 * **Q** control bar bounds, **W** peel card bounds.
	 */
	_setupVisualDebugShortcuts() {
		if (!GameConfig.debug.ENABLE_VISUAL_DEBUG_SHORTCUTS) {
			return;
		}
		this.inputManager = new InputManager(this);

		/** @param {KeyboardEvent} e */
		const allowShortcut = (e) => {
			const t = /** @type {HTMLElement|null} */ (e.target);
			return !(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'));
		};

		this.inputManager.registerShortcut('ctrl+i', (e) => {
			if (!allowShortcut(e)) return;
			if (this.debugInfo) {
				this.debugInfo.visible = !this.debugInfo.visible;
			}
		});

		this.inputManager.registerShortcut('q', (e) => {
			if (!allowShortcut(e)) return;
			GameConfig.debug.SHOW_CONTROL_BAR_VISUAL_DEBUGGING = !GameConfig.debug.SHOW_CONTROL_BAR_VISUAL_DEBUGGING;
			log(
				`Control bar visual debugging: ${GameConfig.debug.SHOW_CONTROL_BAR_VISUAL_DEBUGGING ? 'ON' : 'OFF'}`,
				'layout',
			);
			applyPullTabControlBarLayoutFromScene(this);
		});

		this.inputManager.registerShortcut('w', (e) => {
			if (!allowShortcut(e)) return;
			GameConfig.debug.SHOW_PEEL_CARD_VISUAL_DEBUGGING = !GameConfig.debug.SHOW_PEEL_CARD_VISUAL_DEBUGGING;
			log(
				`Peel card visual debugging: ${GameConfig.debug.SHOW_PEEL_CARD_VISUAL_DEBUGGING ? 'ON' : 'OFF'}`,
				'layout',
			);
			drawPeelCardElementBounds({ scene: this, peelCard: this.peelCard });
		});
	}

	/**
	 * Control-bar speaker texture (muted = both channels effectively silent).
	 */
	_updateSoundIcon() {
		if (!this.soundIcon?.setTexture) {
			return;
		}
		const muted = !!(this.audioService && this.audioService.isMuted());
		this.soundIcon.setTexture(muted ? 'icon_sound_off_128' : 'icon_sound_on_128');
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
