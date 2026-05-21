/**
 * "Open tabs to reveal" hint — mirrors scratch {@link Level} instructionsText (scale in/out, layout bands).
 */

import {
	getLayoutConfigs,
	getInstructionsTextConfig,
	getMessageTextLayoutFontSize,
} from '../../utils/layout/ConfigAccessUtils.js';
import { getScreenWidth } from '../../utils/viewport/ViewportUtils.js';
import {
	computeCenterInRightBandPlacement,
	isLandscapeMobileSidePaytablePanelVisible,
} from '../../utils/layout/MessageTextPositioningUtils.js';
import { applyInstructionsTextTheme } from '../../utils/ui/theme/ThemeApplicationUtils.js';

/** @type {string} */
export const PULL_TAB_INSTRUCTIONS_COPY = 'Open tabs to reveal';

/** @type {string} */
export const PULL_TAB_INSTRUCTIONS_BUY_COPY = 'Press buy to play';

/** @typedef {'hidden'|'buy'|'play'} PullTabInstructionsMode */

/** Same timing/easing as scratch Level / video-poker hold hint. */
const INSTRUCTIONS_TEXT_SCALE_IN_MS = 480;
const INSTRUCTIONS_TEXT_SCALE_OUT_MS = 580;
const INSTRUCTIONS_TEXT_OUTRO_DELAY_MS = 300;

/**
 * @param {Phaser.Scene} scene
 * @returns {number}
 */
function getInstructionsGameSpeed(scene) {
	const peel = scene.peelManager?.speed;
	if (typeof peel === 'number' && Number.isFinite(peel) && peel > 0) {
		return peel;
	}
	const reg = scene.registry?.get?.('GameSpeed');
	if (typeof reg === 'number' && Number.isFinite(reg) && reg > 0) {
		return reg;
	}
	return 1;
}

/**
 * @param {Phaser.Scene} scene
 * @returns {Phaser.GameObjects.Text}
 */
export function ensurePullTabInstructionsText(scene) {
	if (scene.instructionsText) {
		return scene.instructionsText;
	}
	const instructionsText = scene.add.text(0, 0, PULL_TAB_INSTRUCTIONS_COPY, {
		fontFamily: 'Lato-Bold',
	});
	instructionsText.setName('instructionsText');
	instructionsText.setOrigin(0.5, 0.5);
	instructionsText.setDepth(2);
	instructionsText.setVisible(false);
	instructionsText.setScale(1);
	scene.instructionsText = instructionsText;
	return instructionsText;
}

/**
 * @param {Phaser.Scene} scene
 */
export function setupPullTabInstructionsTextRoundEvents(scene) {
	ensurePullTabInstructionsText(scene);
	if (scene._pullTabInstructionsTextEventsReady) {
		return;
	}
	scene._pullTabInstructionsTextEventsReady = true;
	scene._instructionsTextRoundActive = false;
	/** @type {PullTabInstructionsMode} */
	scene._instructionsTextMode = 'hidden';

	scene.events.on('onCardBuy', () => {
		tweenInPullTabInstructionsTextAfterBuy(scene);
	});

	scene.events.on('onStateChanged', (/** @type {string} */ state) => {
		if (state === 'win' || state === 'lose') {
			scene.time.delayedCall(INSTRUCTIONS_TEXT_OUTRO_DELAY_MS, () => {
				tweenOutPullTabInstructionsTextForMainReveal(scene);
			});
			return;
		}
		if (state === 'ready' || state === 'reset') {
			_hidePullTabInstructionsTextImmediate(scene);
		}
	});
}

/**
 * @param {Phaser.Scene} scene
 */
function _hidePullTabInstructionsTextImmediate(scene) {
	if (!scene.instructionsText) {
		scene._instructionsTextRoundActive = false;
		scene._instructionsTextMode = 'hidden';
		return;
	}
	scene.tweens.killTweensOf(scene.instructionsText);
	scene.instructionsText.setVisible(false);
	scene.instructionsText.setScale(1);
	scene._instructionsTextRoundActive = false;
	scene._instructionsTextMode = 'hidden';
}

/**
 * @param {Phaser.Scene} scene
 * @returns {string}
 */
function resolvePullTabInstructionsCopy(scene) {
	return scene._instructionsTextMode === 'buy'
		? PULL_TAB_INSTRUCTIONS_BUY_COPY
		: PULL_TAB_INSTRUCTIONS_COPY;
}

/**
 * @param {Phaser.Scene} scene
 * @param {PullTabInstructionsMode} mode
 */
function tweenInPullTabInstructionsText(scene, mode) {
	ensurePullTabInstructionsText(scene);
	const instructionsText = scene.instructionsText;
	if (!instructionsText) {
		return;
	}
	if (scene._instructionsTextRoundActive && scene._instructionsTextMode === mode) {
		refreshPullTabInstructionsTextLayout(scene);
		return;
	}
	scene.tweens.killTweensOf(instructionsText);
	scene._instructionsTextMode = mode;
	scene._instructionsTextRoundActive = true;
	instructionsText.setVisible(true);
	instructionsText.setScale(0);
	refreshPullTabInstructionsTextLayout(scene);
	const gameSpeed = getInstructionsGameSpeed(scene);
	const duration = Math.max(1, INSTRUCTIONS_TEXT_SCALE_IN_MS / gameSpeed);
	scene.tweens.add({
		targets: instructionsText,
		scaleX: 1,
		scaleY: 1,
		duration,
		ease: 'Back.easeOut',
	});
}

/**
 * Pre-buy: player tapped a peel strip while play button is BUY.
 *
 * @param {Phaser.Scene} scene
 */
export function tweenInPullTabInstructionsBuyHint(scene) {
	if (scene.stateManager?.state !== 'ready') {
		return;
	}
	if (scene._instructionsTextRoundActive && scene._instructionsTextMode === 'play') {
		return;
	}
	tweenInPullTabInstructionsText(scene, 'buy');
}

/**
 * @param {Phaser.Scene} scene
 */
export function tweenInPullTabInstructionsTextAfterBuy(scene) {
	tweenInPullTabInstructionsText(scene, 'play');
}

/**
 * Scale 1→0 after win/lose presentation starts (scratch `tweenOutInstructionsTextForMainReveal`).
 *
 * @param {Phaser.Scene} scene
 */
export function tweenOutPullTabInstructionsTextForMainReveal(scene) {
	const instructionsText = scene.instructionsText;
	if (!instructionsText || !scene._instructionsTextRoundActive) {
		return;
	}
	if (!instructionsText.visible) {
		return;
	}
	scene.tweens.killTweensOf(instructionsText);
	const gameSpeed = getInstructionsGameSpeed(scene);
	const duration = Math.max(1, INSTRUCTIONS_TEXT_SCALE_OUT_MS / gameSpeed);
	scene.tweens.add({
		targets: instructionsText,
		scaleX: 0,
		scaleY: 0,
		duration,
		ease: 'Back.easeIn',
		onComplete: () => {
			if (scene.instructionsText) {
				scene.instructionsText.setVisible(false);
				scene.instructionsText.setScale(1);
			}
			scene._instructionsTextRoundActive = false;
		},
	});
}

/**
 * @param {Phaser.Scene} scene
 */
export function refreshPullTabInstructionsTextLayout(scene) {
	const peel = scene.peelCard;
	const instructionsText = scene.instructionsText;
	if (!instructionsText || !peel || !scene.layoutManager) {
		return;
	}

	const layoutName = scene.layoutManager.getCurrentLayoutName();
	const { uiConfig, baseUIConfig } = getLayoutConfigs(scene.layoutManager, layoutName);
	const layoutPositions = scene.layoutManager.getLayoutPositions();
	if (layoutPositions?.cardContainerY == null) {
		return;
	}

	const INSTRUCTIONS_BELOW_CARD_GAP_FRAC = 0.04;
	const RIGHT_BAND_INSET_FRAC = 0.06;

	const instCfg = getInstructionsTextConfig(uiConfig, baseUIConfig);
	instructionsText.setText(resolvePullTabInstructionsCopy(scene));

	const isLandscapeMobile = layoutName === 'landscape-mobile';
	const sidePaytableOpen = isLandscapeMobileSidePaytablePanelVisible();
	const useLmOneColMessageStyle = isLandscapeMobile && !sidePaytableOpen;

	let cardW = layoutPositions.cardBackDisplay?.width;
	let cardH = layoutPositions.cardBackDisplay?.height;
	if (!cardW || !cardH) {
		const bb = peel.cardBack?.getBounds?.();
		if (bb && bb.width > 1 && bb.height > 1) {
			cardW = bb.width;
			cardH = bb.height;
		} else {
			cardW = Math.max(1, layoutPositions.cardContainerWidth || 320);
			cardH = Math.max(1, layoutPositions.cardContainerHeight || 240);
		}
	}

	const cardSize = { width: cardW, height: cardH };
	const cardDisplayHeight = Math.max(1, cardSize.height);
	const effectiveFontSize = useLmOneColMessageStyle
		? getMessageTextLayoutFontSize(cardDisplayHeight, uiConfig, baseUIConfig)
		: instCfg.fontSize;
	const lineHalf = effectiveFontSize * 0.5;

	const themeData = scene.themeData || scene.registry?.get?.('preloadThemeData');
	if (themeData) {
		applyInstructionsTextTheme(instructionsText, themeData, layoutName, uiConfig, baseUIConfig);
	}

	instructionsText.setFontSize(effectiveFontSize);
	instructionsText.setOrigin(0.5, 0.5);

	const screenWidth = getScreenWidth(scene);
	const cardContainerX = screenWidth / 2;
	const cardContainerY = layoutPositions.cardContainerY ?? peel.y ?? 815;
	const cardBottomY = cardContainerY + cardDisplayHeight / 2;
	const cardCenterX =
		typeof peel.x === 'number' && Number.isFinite(peel.x)
			? peel.x
			: layoutPositions.cardContainerX ?? cardContainerX;

	const useRightBand =
		isLandscapeMobile && instCfg.useRightBandWhenAvailable && !sidePaytableOpen;

	let centerX = cardContainerX;
	let centerY;
	let maxTextW = screenWidth * 0.9;

	const placeBelowCard = () => {
		centerX = cardContainerX;
		const gap = cardDisplayHeight * INSTRUCTIONS_BELOW_CARD_GAP_FRAC;
		centerY = cardBottomY + gap + lineHalf;
	};

	if (useRightBand) {
		const placement = computeCenterInRightBandPlacement(
			layoutPositions,
			cardSize,
			cardCenterX,
			scene,
			RIGHT_BAND_INSET_FRAC,
		);
		if (placement.innerWidth >= 48) {
			centerX = placement.centerX;
			centerY = placement.centerY;
			maxTextW = placement.maxTextWidth;
		} else {
			placeBelowCard();
		}
	} else {
		placeBelowCard();
	}

	instructionsText.setPosition(centerX, centerY);
	instructionsText.setWordWrapWidth(maxTextW);

	if (scene._instructionsTextRoundActive) {
		instructionsText.setVisible(true);
	} else {
		scene.tweens.killTweensOf(instructionsText);
		instructionsText.setVisible(false);
		instructionsText.setScale(1);
	}
}

/**
 * @param {Phaser.Scene} scene
 * @param {object} layoutPositions
 * @param {object} uiConfig
 * @param {object} baseUIConfig
 */
export function layoutPullTabInstructionsText(scene, layoutPositions, uiConfig, baseUIConfig) {
	void layoutPositions;
	void uiConfig;
	void baseUIConfig;
	refreshPullTabInstructionsTextLayout(scene);
}
