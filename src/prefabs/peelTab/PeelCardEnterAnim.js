
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
import { GameConfig } from "../../config/Global.js";
import {
	applyPeelCardBackTintFromTheme,
	refreshPeelCardHorizontalLayoutSurface,
} from "../../utils/theme/PeelCardThemeUtils.js";
/* END-USER-IMPORTS */

export default class PeelCardEnterAnim extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		// cardBack
		const cardBack = scene.add.nineslice(0, 0, "CardBack", undefined, 1000, 650, 10, 10, 10, 10);
		this.add(cardBack);
		this.cardBack = cardBack;

		// CardCover
		const cardCover = scene.add.image(-80, -300, "DI_CardCover_Default");
		cardCover.setOrigin(1, 0);
		this.add(cardCover);

		// prizeContainer
		const prizeContainer = scene.add.container(0, -300);
		this.add(prizeContainer);

		// peelContainer
		const peelContainer = scene.add.container(80, -300);
		this.add(peelContainer);

		this.cardCover = cardCover;
		this.prizeContainer = prizeContainer;
		this.peelContainer = peelContainer;

		/* START-USER-CTR-CODE */
		// Write your code here.
		this.scene.events.on("server-awake", ()=> this.init(), this);
		/* END-USER-CTR-CODE */
	}

	/** @type {Phaser.GameObjects.Image} */
	cardCover;
	/** @type {Phaser.GameObjects.NineSlice|Phaser.GameObjects.Image} */
	cardBack;
	/** @type {Phaser.GameObjects.Container} */
	prizeContainer;
	/** @type {Phaser.GameObjects.Container} */
	peelContainer;

	/* START-USER-CODE */
	enterAnim = "Slam"
	callBack = undefined;
	ctx = undefined;
	speed = 1;

	/** @type {Phaser.Time.TimerEvent[]} */
	_introTimers = [];

	// Write your code here.

	_cancelIntroAnimations()
	{
		this.scene?.tweens?.killTweensOf(this);
		if (!Array.isArray(this._introTimers)) return;
		for (const ev of this._introTimers) {
			try {
				ev?.remove(false);
			} catch {
				/* ignore */
			}
		}
		this._introTimers = [];
	}
	init()
	{
		let config = this.scene.serverManager.gameConfig;
		const preloadCfg = this.scene.registry.get('preloadGameConfig') || {};
		const peelRows = Math.round(
			Math.max(
				3,
				Math.min(
					20,
					Number(config.rowCount) || Number(preloadCfg.rowCount) || 7
				)
			)
		);
		const showPeelPrizeLabels = GameConfig.game.SHOW_PEEL_PRIZE_LABELS !== false;
		for (let i = 0; i < peelRows; i++) {
			const peel = this.scene.add.image(0, 0, "DI_Peel_Default");
			if (this.scene.textures.exists("peel")) {
				peel.setTexture("peel");
			} else {
				peel.setTexture("DI_Peel_Default");
			}

			if (this.scene.textures.exists("card")) {
				this.cardCover.setTexture("card");
			}

			peel.setOrigin(0, 0);
			this.peelContainer.add(peel);

			peel.y = 100 * i;
			peel.x = 0;

			if (showPeelPrizeLabels) {
				const prizeText = this.scene.add.text(0, 0, "", {});
				prizeText.setOrigin(0.5, 0);
				prizeText.text = config.prizes[i % (config.prizes.length || 1)];
				prizeText.setStyle({
					align: "center",
					color: "#252525ff",
					fontFamily: "Anton-Regular",
					fontSize: "60px",
					resolution: 2,
				});
				this.prizeContainer.add(prizeText);
				prizeText.y = 100 * i + 10;
			}
		}

		const td = this.scene.themeData || this.scene.registry.get('preloadThemeData');

		applyPeelCardBackTintFromTheme(this.cardBack, td);
		refreshPeelCardHorizontalLayoutSurface(
			{
				cardBack: this.cardBack,
				peelContainer: this.peelContainer,
				cardCoverImage: this.cardCover,
			},
			td,
		);
	}

	enter(callBack, ctx)
	{
		this._cancelIntroAnimations();

		this.callBack = callBack;
		this.ctx = ctx;

		this.speed = this.scene.registry.get("GameSpeed") ?? 1;
		switch(this.enterAnim)
		{
			case "Slam":
			this.slam();
			break;
		}
	}

	slam()
	{
		// Mirrors scratch cover intro (Level.js moveTween_2 + scaleTween_1/2 timing); no bloom/postFX.
		// DROP: y -2000 → 0, 500ms Back.easeOut | SCALE: delay 300 → 0.9×0.8→1.2 (200ms Quad.out),
		// delay 200 → 1×1 (200ms Quad.in). Total motion ~900ms before callback.

		const spd = Math.max(0.01, Number(this.speed) || 1);

		this.visible = true;
		this.alpha = 1;
		this.x = 0;
		this.y = -2000;
		this.setScale(0.9, 0.8);

		const audio = this.scene.audioService;
		if (audio?.isAudioUnlocked()) {
			audio.playSfx('whoosh');
		}

		const DROP_MS = Math.max(1, 500 / spd);
		const DELAY_BEFORE_OVERSHOOT_MS = Math.max(0, 300 / spd);
		const OVERSHOOT_MS = Math.max(1, 200 / spd);
		const DELAY_BEFORE_SETTLE_MS = Math.max(0, 200 / spd);
		const SETTLE_MS = Math.max(1, 200 / spd);

		const finishIntro = () => {
			this.visible = false;
			if (this.callBack !== undefined) {
				this.callBack();
			}
		};

		this.scene.tweens.add({
			targets: this,
			y: 0,
			duration: DROP_MS,
			ease: 'Back.easeOut',
		});

		const queueScaleUp = this.scene.time.delayedCall(DELAY_BEFORE_OVERSHOOT_MS, () => {
			this.scene.tweens.add({
				targets: this,
				scaleX: 1.2,
				scaleY: 1.2,
				duration: OVERSHOOT_MS,
				ease: 'Quad.easeOut',
				onComplete: () => {
					const queueScaleDown = this.scene.time.delayedCall(DELAY_BEFORE_SETTLE_MS, () => {
						this.scene.tweens.add({
							targets: this,
							scaleX: 1,
							scaleY: 1,
							duration: SETTLE_MS,
							ease: 'Quad.easeIn',
							onComplete: finishIntro,
						});
					});
					this._introTimers.push(queueScaleDown);
				},
			});
		});
		this._introTimers.push(queueScaleUp);
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
