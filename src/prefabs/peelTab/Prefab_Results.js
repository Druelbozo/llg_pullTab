
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
import { resolvePrizeAmountTextStyle } from '../../utils/theme/ScratchLikeTextResolutionUtils.js';
import { peelResultVideoOverridesImageAnimation, themeUsesFlatCardBackImage } from '../../utils/theme/PeelCardThemeUtils.js';
import { getPullTabGameSpeed } from '../../utils/game/PullTabGameSpeedUtils.js';
import { enablePullTabResultsResetButton } from '../../services/pulltab/PullTabControlBarBootstrap.js';
import {
	applyResultGraphicScale,
	layoutResultsOnPeelCard,
} from '../../utils/results/ResultsLayoutUtils.js';
import {
	formatBalanceMinorForDisplayWithSymbol,
	economyMinorToWalletMinors,
} from '../../utils/formatting/FormattingUtils.js';
/* END-USER-IMPORTS */

/** Scratch-aligned count-up duration before enabling RESET (ms, wall time at speed 1). */
const WIN_COUNT_UP_MS = 800;

export default class Prefab_Results extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		// animContainer
		const animContainer = scene.add.container(0, 0);
		this.add(animContainer);

		// starburst (scratch Icon_SpinWheel_BonusLight)
		const starburst = scene.add.image(0, 0, 'Icon_SpinWheel_BonusLight');
		starburst.visible = false;
		animContainer.add(starburst);

		// loseImage
		const loseImage = scene.add.image(0, 0, 'DI_LoseImage_Default');
		loseImage.visible = false;
		animContainer.add(loseImage);

		// winImage
		const winImage = scene.add.image(0, 0, 'DI_WinImage_Default');
		winImage.visible = false;
		animContainer.add(winImage);

		// winningsText
		const winningsText = scene.add.text(0, 131, '', {});
		winningsText.setOrigin(0.5, 0.5);
		winningsText.visible = false;
		winningsText.setStyle({
			color: '#fe7a00ff',
			fontFamily: 'New Amsterdam',
			fontSize: '94px',
			stroke: '#f6f4ebff',
			strokeThickness: 15,
			shadow: { offsetY: 6, color: '#00000066', stroke: true },
		});
		animContainer.add(winningsText);

		this.starburst = starburst;
		this.loseImage = loseImage;
		this.winImage = winImage;
		this.winningsText = winningsText;
		this.animContainer = animContainer;

		/* START-USER-CTR-CODE */
		this.scene.events.on('onStateChanged', this.showResults, this);
		this.scene.events.on('onThemeInitalized', this.init, this);
		this.scene.events.on('onGameSpeedChanged', (speed) => {
			this.speed = speed;
		}, this);
		this.scene.events.on('pulltab-peel-layout-changed', this.applyGraphicScales, this);
		/* END-USER-CTR-CODE */
	}

	/** @type {Phaser.GameObjects.Image} */
	starburst;
	/** @type {Phaser.GameObjects.Image} */
	loseImage;
	/** @type {Phaser.GameObjects.Image} */
	winImage;
	/** @type {Phaser.GameObjects.Text} */
	winningsText;
	/** @type {Phaser.GameObjects.Container} */
	animContainer;

	/* START-USER-CODE */
	speed = 1;

	/** @type {Phaser.Tweens.Tween[]} */
	_activeResultTweens = [];

	/** @type {Phaser.Tweens.Tween|null} */
	_starburstSpinTween = null;

	/** @type {Phaser.Time.TimerEvent|null} */
	_resetEnableTimer = null;

	_effectiveSpeed() {
		return getPullTabGameSpeed(this.scene);
	}

	_cancelResetEnableTimer() {
		if (this._resetEnableTimer) {
			this._resetEnableTimer.remove(false);
			this._resetEnableTimer = null;
		}
	}

	/** Wall-time delay before enabling RESET (independent of result tweens). */
	_scheduleEnableResetButton(delayMs) {
		this._cancelResetEnableTimer();
		const delay = Math.max(0, Number(delayMs) || 0);
		this._resetEnableTimer = this.scene.time.delayedCall(delay, () => {
			this._resetEnableTimer = null;
			this._enableResetButton();
		});
	}

	_getTheme() {
		return this.scene.themeData || this.scene.registry?.get?.('preloadThemeData');
	}

	_killResultAnimations() {
		this._cancelResetEnableTimer();
		for (const tw of this._activeResultTweens) {
			try {
				tw?.stop?.();
				tw?.remove?.();
			} catch {
				/* ignore */
			}
		}
		this._activeResultTweens = [];
		this.scene?.tweens?.killTweensOf?.(this.animContainer);
		this._stopStarburstSpin();
	}

	_trackTween(tween) {
		if (tween) {
			this._activeResultTweens.push(tween);
		}
		return tween;
	}

	_startStarburstSpin() {
		this._stopStarburstSpin();
		this.starburst.angle = 0;
		this._starburstSpinTween = this.scene.tweens.add({
			targets: this.starburst,
			angle: 360,
			duration: 3000,
			repeat: -1,
			ease: 'Linear',
		});
	}

	_stopStarburstSpin() {
		if (this._starburstSpinTween) {
			try {
				this._starburstSpinTween.stop();
				this._starburstSpinTween.remove();
			} catch {
				/* ignore */
			}
			this._starburstSpinTween = null;
		}
	}

	_enableResetButton() {
		enablePullTabResultsResetButton(this.scene);
	}

	_refreshResultTextures() {
		if (this.scene.textures.exists('win')) {
			this.winImage.setTexture('win');
		}
		if (this.scene.textures.exists('lose')) {
			this.loseImage.setTexture('lose');
		}
		this.applyGraphicScales();
	}

	init(theme) {
		const td = theme || this._getTheme();
		const style = resolvePrizeAmountTextStyle(td);
		const s = {
			fontFamily: style.fontFamily,
			fontSize: style.fontSize,
			color: style.color,
			stroke: style.stroke,
			strokeThickness: style.strokeThickness,
		};
		if (style.fontWeight != null) {
			s.fontWeight = style.fontWeight;
		}
		this.winningsText.setStyle(s);

		const scoreCfg = td?.text?.score;
		const yOffset = scoreCfg?.position?.y ?? 117;
		this.winningsText.y = yOffset;

		this._refreshResultTextures();
	}

	applyGraphicScales() {
		layoutResultsOnPeelCard(this.scene);
		applyResultGraphicScale(this.scene, this.winImage, 'win', this);
		applyResultGraphicScale(this.scene, this.loseImage, 'lose', this);
	}

	showResults(state) {
		if (state === 'reset' || state === 'ready' || state === 'playing') {
			this._killResultAnimations();
			this.visible = false;
			this.winningsText.visible = false;
			this.winImage.visible = false;
			this.loseImage.visible = false;
			this.starburst.visible = false;
			this.animContainer.setScale(1, 1);
			this.animContainer.setPosition(0, 0);
			return;
		}

		if (state !== 'win' && state !== 'lose') {
			return;
		}

		const td = this._getTheme();
		if (peelResultVideoOverridesImageAnimation(this.scene, td, state)) {
			return;
		}

		this._killResultAnimations();
		this._refreshResultTextures();
		this.setDepth(25);
		this.visible = true;
		this.winningsText.visible = false;
		this.winningsText.text = '$0.00';
		this.starburst.visible = false;

		if (state === 'win') {
			this.winImage.visible = true;
			this.loseImage.visible = false;
			if (themeUsesFlatCardBackImage(td)) {
				this._playWinScaleAnimation();
			} else {
				this.starBurstAnim();
			}
			return;
		}

		this.winImage.visible = false;
		this.loseImage.visible = true;
		this.dropInAnim();
	}

	_countUpWinnings() {
		const session = this.scene.serverManager?.gameSession;
		const payoutMinor = session?.payoutMinor ?? session?.apiRound?.payoutMinor;
		const walletCredit = economyMinorToWalletMinors(Math.floor(Number(payoutMinor)));
		const targetMinor = Number.isFinite(walletCredit) && walletCredit > 0
			? walletCredit
			: Math.round(Number(session?.prize) * 100) || 0;

		const val = { value: 0 };
		this.winningsText.visible = true;
		this._trackTween(
			this.scene.tweens.add({
				targets: val,
				value: targetMinor,
				duration: WIN_COUNT_UP_MS / this._effectiveSpeed(),
				ease: 'Linear',
				onUpdate: () => {
					this.winningsText.text = formatBalanceMinorForDisplayWithSymbol(Math.floor(val.value));
				},
				onComplete: () => {
					this.scene.audioService?.stopLoopingSfx?.();
				},
			}),
		);
	}

	starBurstAnim() {
		this.starburst.visible = true;
		this._startStarburstSpin();
		this.animContainer.setPosition(0, 0);
		this.animContainer.setScale(0, 0);

		const speed = this._effectiveSpeed();
		const scaleInDuration = 500 / speed;
		const countUpSpeed = WIN_COUNT_UP_MS / speed;
		this._scheduleEnableResetButton(scaleInDuration + countUpSpeed);

		this._trackTween(
			this.scene.tweens.add({
				targets: this.animContainer,
				scaleX: 1,
				scaleY: 1,
				duration: scaleInDuration,
				ease: 'Back.Out',
				onComplete: () => {
					this._countUpWinnings();
				},
			}),
		);

		this._trackTween(
			this.scene.tweens.add({
				targets: this.animContainer,
				scaleX: 0,
				scaleY: 0,
				delay: 2000 / speed,
				duration: 1000 / speed,
				ease: 'Back.In',
				onComplete: () => {
					this.starburst.visible = false;
					this._stopStarburstSpin();
				},
			}),
		);
	}

	_playWinScaleAnimation() {
		const speed = this._effectiveSpeed();
		const scaleInDuration = 350 / speed;
		const countUpSpeed = WIN_COUNT_UP_MS / speed;
		this._scheduleEnableResetButton(scaleInDuration + countUpSpeed);

		this.starburst.visible = false;
		this.animContainer.setPosition(0, 0);
		this.animContainer.setScale(0, 0);

		this._trackTween(
			this.scene.tweens.add({
				targets: this.animContainer,
				scaleX: 1,
				scaleY: 1,
				duration: scaleInDuration,
				ease: 'Back.Out',
				onComplete: () => {
					this._countUpWinnings();
				},
			}),
		);

		this._trackTween(
			this.scene.tweens.add({
				targets: this.animContainer,
				scaleX: 0,
				scaleY: 0,
				delay: 1500 / speed,
				duration: 700 / speed,
				ease: 'Back.In',
			}),
		);
	}

	dropInAnim() {
		const theme = this._getTheme();
		const animationStyle = theme?.cardConfig?.lose?.animationStyle || 'scale';
		if (animationStyle === 'dropIn') {
			this._playDropInAnimation();
		} else {
			this._playLoseScaleAnimation();
		}
	}

	_playDropInAnimation() {
		const speed = this._effectiveSpeed();
		this._scheduleEnableResetButton(2000 / speed);

		this.animContainer.setPosition(0, -2000);
		this.animContainer.setScale(1, 1);

		this._trackTween(
			this.scene.tweens.add({
				targets: this.animContainer,
				y: 0,
				duration: 1000 / speed,
				ease: 'Back.Out',
			}),
		);

		this._trackTween(
			this.scene.tweens.add({
				targets: this.animContainer,
				y: 2000,
				delay: 2000 / speed,
				duration: 1000 / speed,
				ease: 'Back.In',
				onComplete: () => {
					this.starburst.visible = false;
				},
			}),
		);
	}

	_playLoseScaleAnimation() {
		const speed = this._effectiveSpeed();
		const scaleInDuration = 350 / speed;
		this._scheduleEnableResetButton(scaleInDuration);

		this.animContainer.setPosition(0, 0);
		this.animContainer.setScale(0, 0);

		this._trackTween(
			this.scene.tweens.add({
				targets: this.animContainer,
				scaleX: 1,
				scaleY: 1,
				duration: scaleInDuration,
				ease: 'Back.Out',
			}),
		);

		this._trackTween(
			this.scene.tweens.add({
				targets: this.animContainer,
				scaleX: 0,
				scaleY: 0,
				delay: 1500 / speed,
				duration: 700 / speed,
				ease: 'Back.In',
				onComplete: () => {
					this.starburst.visible = false;
				},
			}),
		);
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */
