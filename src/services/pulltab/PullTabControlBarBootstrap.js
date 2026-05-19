/**
 * Scratch/Keno-style control bar + LayoutManager bootstrap for Pull-tab.
 */

import LayoutManager from '../layout/LayoutManager.js';
import ControlBarBackgroundService from '../ui/controlBar/ControlBarBackgroundService.js';
import ControlBarManager from '../ui/controlBar/ControlBarManager.js';
import ButtonManager from '../ui/ButtonManager.js';
import AutoPlayOptions from '../../dom/AutoPlayOptions.js';
import { GameConfig } from '../../config/Global.js';
import ViewportHelper from '../../utils/viewport/ViewportHelper.js';
import { openSoundOptionsModal } from '../../dom/soundOptions/soundOptionsModal.js';
import { openPullTabGameInfoModal } from '../../dom/modal/content/pullTabGameInfoContent.js';
import {
    calculateContainerPositions,
    calculateContainerDimensions,
    calculateControlBarBackgroundTop,
    calculateHeaderPositions,
} from '../../utils/layout/ControlBarLayoutUtils.js';
import {
    getLayoutConfigs,
    getContentHeightPercent,
    getHeaderConfig,
    getCardContainerConfig,
    getControlBarSpacingPercent,
    getMessageTextConfig,
    getMessageTextLayoutFontSize,
} from '../../utils/layout/ConfigAccessUtils.js';
import { getScreenWidth, getScreenHeight } from '../../utils/viewport/ViewportUtils.js';
import { warn, error } from '../../utils/logger/LoggerUtils.js';
import { drawControlBarBackgroundBounds } from '../../utils/layout/LayoutDebugUtils.js';
import { computeAreaPercentUniformScale } from '../../utils/layout/CardContainerUtils.js';
import {
    computeCenterInLeftBandPlacement,
    resolveMessageTextWordWrapWidth,
} from '../../utils/layout/MessageTextPositioningUtils.js';
import { applyMessageTextTheme } from '../../utils/ui/theme/ThemeApplicationUtils.js';

/**
 * Pull-tab bounds for background sizing (includes speed row).
 */
function getPullTabControlBarActualBounds(scene) {
    if (!scene.controlBarManager) return null;
    const cm = scene.controlBarManager;
    const containers = [
        cm.soundButton?.container,
        cm.infoButton?.container,
        cm.speedButton?.container,
        cm.playButton?.container,
        cm.autoButton?.container,
    ].filter(Boolean);
    let topmost = Infinity;
    let bottommost = -Infinity;
    let found = false;
    for (const c of containers) {
        if (!c?.getBounds) continue;
        const bounds = c.getBounds();
        if (!bounds) continue;
        const top = bounds.y;
        const bottom = bounds.y + bounds.height;
        topmost = Math.min(topmost, top);
        bottommost = Math.max(bottommost, bottom);
        found = true;
    }
    if (!found || topmost === Infinity) return null;
    return { top: topmost, bottom: bottommost };
}

function calculatePullTabContainerWidths(scene, currentUiConfig, currentBaseUIConfig, contentHeightPercent, availableHeight, height) {
    const containerWidths = scene.controlBarManager.getContainerWidths();
    const hasZero = Object.values(containerWidths).some((w) => !w || w === 0);
    if (!hasZero) return containerWidths;
    warn('[PullTab] Some container widths are 0 — applying fallbacks', 'layout');

    const dimensions = calculateContainerDimensions({
        contentHeightPercent,
        availableHeight,
        height,
    });
    const fh = dimensions.containerHeight || 100;

    if (!containerWidths.soundButton) containerWidths.soundButton = fh;
    if (!containerWidths.infoButton) containerWidths.infoButton = fh;
    if (!containerWidths.speedButton) containerWidths.speedButton = fh;
    if (!containerWidths.playButton) containerWidths.playButton = fh * 2;
    if (!containerWidths.autoButton) containerWidths.autoButton = fh;

    return containerWidths;
}

function calculateAndApplyPullTabLayout(scene, layoutPositions, uiConfig, baseUIConfig, containerWidths, width, height, contentHeightPercent, availableHeight, verticalPaddingBottom) {
    const containers = uiConfig?.controlBar?.layoutGroups || baseUIConfig?.controlBar?.layoutGroups;
    if (!containers?.length) return false;

    const dimensions = calculateContainerDimensions({ contentHeightPercent, availableHeight, height });
    const containerHeight = dimensions.containerHeight;
    const baseContainerHeight = dimensions.baseContainerHeight;
    const spacingPercent = getControlBarSpacingPercent(uiConfig, baseUIConfig);
    const horizontalPaddingLeft = 0;
    const horizontalPaddingRight = 0;
    const availableWidth = width - (horizontalPaddingLeft + horizontalPaddingRight);
    const centerX = width / 2;

    const positionResult = calculateContainerPositions({
        containers,
        containerHeight,
        width,
        height,
        horizontalPaddingLeft,
        verticalPaddingBottom,
        availableWidth,
        centerX,
        containerWidths,
        spacingPercent,
        baseContainerHeight,
        uiConfig,
        baseUIConfig,
    });

    const recalculatedControlBarBackgroundTop = calculateControlBarBackgroundTop(
        positionResult.topmostContainerTop,
        uiConfig,
        baseUIConfig,
        height
    );

    layoutPositions.containerPositions = positionResult.containerPositions;
    layoutPositions.controlBarBackgroundTop = recalculatedControlBarBackgroundTop;
    layoutPositions.bottommostContainerBottom = height;
    layoutPositions.screenWidth = width;
    layoutPositions.screenHeight = height;

    const headerConfig = getHeaderConfig(uiConfig, baseUIConfig);
    if (headerConfig) {
        const headerResult = calculateHeaderPositions({
            items: headerConfig.items,
            controlBarBackgroundTop: recalculatedControlBarBackgroundTop,
            width,
            height,
            verticalOffset: headerConfig.verticalOffset,
            centerX,
            uiConfig,
            baseUIConfig,
        });
        layoutPositions.headerPositions = headerResult.headerPositions;
    }

    if (scene.controlBarManager) {
        scene.controlBarManager.layoutControlBar(layoutPositions, width, height);

        const actualBounds = getPullTabControlBarActualBounds(scene);
        if (actualBounds) {
            const actualControlBarBackgroundTop = calculateControlBarBackgroundTop(
                actualBounds.top,
                uiConfig,
                baseUIConfig,
                height
            );
            layoutPositions.controlBarBackgroundTop = actualControlBarBackgroundTop;

            if (headerConfig) {
                const headerResult = calculateHeaderPositions({
                    items: headerConfig.items,
                    controlBarBackgroundTop: actualControlBarBackgroundTop,
                    width,
                    height,
                    verticalOffset: headerConfig.verticalOffset,
                    centerX,
                    uiConfig,
                    baseUIConfig,
                });
                layoutPositions.headerPositions = headerResult.headerPositions;
            }
        }

        if (layoutPositions.headerPositions) {
            scene.controlBarManager.createHeaderTextFields(layoutPositions);
            scene.controlBarManager.updateHeaderBetText();
        }
    }

    const cardContainerConfig = getCardContainerConfig(uiConfig, baseUIConfig);
    layoutPositions.cardContainerConfig = cardContainerConfig;
    layoutPositions.cardContainerX = width / 2;

    const offsetYPercent = cardContainerConfig.offsetYPercent ?? 0;
    const offsetY = height * offsetYPercent;

    if (
        layoutPositions.controlBarBackgroundTop != null &&
        !Number.isNaN(layoutPositions.controlBarBackgroundTop) &&
        layoutPositions.controlBarBackgroundTop > 0 &&
        layoutPositions.controlBarBackgroundTop < height
    ) {
        const baseCardContainerY = (0 + layoutPositions.controlBarBackgroundTop) / 2;
        layoutPositions.cardContainerY = baseCardContainerY + offsetY;
    }

    applyPeelCardLayout(scene, layoutPositions);
    layoutPullTabPeelMessageText(scene, layoutPositions, uiConfig, baseUIConfig);

    return true;
}

/**
 * Full control-bar + peel-card layout pass (same steps as initial bootstrap after buttons exist).
 * Mirror scratch `Level._recalculateControlBarLayout`: clear cache, resize buttons, reposition groups, refresh bar background.
 *
 * @param {Phaser.Scene} scene
 * @returns {boolean}
 */
export function applyPullTabControlBarLayoutFromScene(scene) {
    if (!scene.controlBarManager || !scene.layoutManager) {
        return false;
    }
    // Async bootstrap builds buttons inside layoutConfigsPromise; skip until HUD exists.
    if (!scene.controlBarManager.soundButton) {
        return false;
    }

    scene.layoutManager.clearLayoutCache?.();

    const currentLayoutName = scene.layoutManager.getCurrentLayoutName();
    const { uiConfig, baseUIConfig } = getLayoutConfigs(scene.layoutManager, currentLayoutName);

    const width = getScreenWidth(scene);
    const height = getScreenHeight(scene);
    const verticalPaddingBottom = 0;
    const availableHeight = height;

    const contentHeightPercent =
        getContentHeightPercent(uiConfig, availableHeight, height) ||
        getContentHeightPercent(baseUIConfig, availableHeight, height) ||
        0.08;

    const cm = scene.controlBarManager;
    cm._resizeButtonsSynchronously?.();

    const containerWidths = calculatePullTabContainerWidths(
        scene,
        uiConfig,
        baseUIConfig,
        contentHeightPercent,
        availableHeight,
        height
    );

    const layoutPositions = scene.layoutManager.getLayoutPositions();

    calculateAndApplyPullTabLayout(
        scene,
        layoutPositions,
        uiConfig,
        baseUIConfig,
        containerWidths,
        width,
        height,
        contentHeightPercent,
        availableHeight,
        verticalPaddingBottom
    );

    updatePullTabControlBarBackground(scene, layoutPositions, width, height);

    cm.updateThemeColors?.();

    // Keep ControlBarManager resize debounce in sync (avoids redundant partial refreshes)
    cm._lastScreenWidth = width;
    cm._lastScreenHeight = height;

    return true;
}

function updatePullTabControlBarBackground(scene, layoutPositions, width, height) {
    if (
        layoutPositions.controlBarBackgroundTop == null ||
        Number.isNaN(layoutPositions.controlBarBackgroundTop) ||
        layoutPositions.controlBarBackgroundTop === 0
    ) {
        return;
    }
    if (!scene.controlBarBackgroundService) return;

    layoutPositions.screenWidth = width ?? getScreenWidth(scene);
    layoutPositions.screenHeight = height ?? getScreenHeight(scene);

    scene.controlBarBackground = scene.controlBarBackgroundService.createOrUpdateContainerBar(
        scene.controlBarBackground,
        layoutPositions,
        layoutPositions.screenWidth,
        layoutPositions.screenHeight
    );
    drawControlBarBackgroundBounds({ scene, layoutPositions });
}

function getPullTabCardBackBaseDisplaySize(peelCard) {
    const cb = peelCard?.cardBack;
    const gc = peelCard?.gameContainer;
    if (!cb) {
        return { width: 1, height: 1 };
    }
    const gcsx = Math.abs(gc?.scaleX ?? 1);
    const gcsy = Math.abs(gc?.scaleY ?? 1);
    const baseW = cb.displayWidth ?? cb.width ?? 0;
    const baseH = cb.displayHeight ?? cb.height ?? 0;
    const bw = Math.abs(baseW * (cb.scaleX ?? 1) * gcsx);
    const bh = Math.abs(baseH * (cb.scaleY ?? 1) * gcsy);
    return {
        width: Math.max(1, bw),
        height: Math.max(1, bh),
    };
}

/**
 * Position pull-tab banner text like scratch {@link CardContainerService.positionMessageText}:
 * world/canvas coordinates with {@link Phaser.GameObjects.Text#setPosition}. The banner is a scene-level
 * object ({@link PeelCard} registers it via {@link Phaser.Scene#add}) so it is not scaled with the peel card,
 * matching scratch’s `messageText` living outside `cardContainer`.
 *
 * @param {Phaser.Scene} scene
 * @param {object} layoutPositions
 * @param {object} uiConfig
 * @param {object} baseUIConfig
 */
function layoutPullTabPeelMessageText(scene, layoutPositions, uiConfig, baseUIConfig) {
    const peel = scene.peelCard;
    const messageText = peel?.messageText;
    if (!peel || !messageText || layoutPositions.cardContainerY == null) {
        return;
    }

    const messageTextConfig = getMessageTextConfig(uiConfig, baseUIConfig);

    const themeData = scene.themeData || scene.registry?.get?.('preloadThemeData');
    if (themeData) {
        applyMessageTextTheme(messageText, themeData, messageTextConfig.stroke || null);
    }

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

    const cardTopY = layoutPositions.cardContainerY - cardDisplayHeight / 2;
    const cardBottomY = layoutPositions.cardContainerY + cardDisplayHeight / 2;

    const screenWidth =
        typeof layoutPositions.screenWidth === 'number' && layoutPositions.screenWidth > 0
            ? layoutPositions.screenWidth
            : getScreenWidth(scene);
    const cardCenterX =
        typeof peel.x === 'number' && Number.isFinite(peel.x)
            ? peel.x
            : typeof layoutPositions.cardContainerX === 'number'
              ? layoutPositions.cardContainerX
              : screenWidth / 2;

    let messageTextCenterWorldX = cardCenterX;
    /** @type {number|undefined} */
    let messageTextCenterWorldY;

    let maxTextWidth = resolveMessageTextWordWrapWidth(
        messageTextConfig,
        layoutPositions,
        cardSize,
        cardCenterX,
        scene,
        screenWidth
    );

    if (messageTextConfig.centerInLeftBand === true) {
        const placement = computeCenterInLeftBandPlacement(
            layoutPositions,
            cardSize,
            cardCenterX,
            scene,
            messageTextConfig.insetPercentHorizontal ?? 0
        );
        messageTextCenterWorldX = placement.centerX;
        messageTextCenterWorldY = placement.centerY;
        maxTextWidth = placement.maxTextWidth;
    } else if (messageTextConfig.centerVertically === true) {
        const screenTop = 0;
        messageTextCenterWorldY = (screenTop + cardTopY) / 2;
    } else {
        const percentY = messageTextConfig.percentY ?? 0;
        messageTextCenterWorldY = cardTopY + percentY * (cardBottomY - cardTopY);
    }

    messageText.setOrigin(0.5, 0.5);

    const fontSize = getMessageTextLayoutFontSize(cardDisplayHeight, uiConfig, baseUIConfig);
    messageText.setFontSize(fontSize);
    messageText.setWordWrapWidth(maxTextWidth);

    if (
        messageTextCenterWorldY == null ||
        !Number.isFinite(messageTextCenterWorldX) ||
        !Number.isFinite(messageTextCenterWorldY)
    ) {
        return;
    }

    messageText.setPosition(messageTextCenterWorldX, messageTextCenterWorldY);
}

/**
 * Re-apply peel scale/position from cached layout (e.g. after PeelCard intros).
 *
 * @param {Phaser.Scene} scene
 */
export function syncPullTabPeelCardLayout(scene) {
    if (!scene.layoutManager) return;
    const layoutName = scene.layoutManager.getCurrentLayoutName();
    const { uiConfig, baseUIConfig } = getLayoutConfigs(scene.layoutManager, layoutName);
    const layoutPositions = scene.layoutManager.getLayoutPositions();
    applyPeelCardLayout(scene, layoutPositions);
    layoutPullTabPeelMessageText(scene, layoutPositions, uiConfig, baseUIConfig);
}

function applyPeelCardLayout(scene, layoutPositions) {
    const peel = scene.peelCard;
    if (!peel || layoutPositions.cardContainerY == null) return;

    const x = layoutPositions.cardContainerX ?? getScreenWidth(scene) / 2;
    peel.setPosition(x, layoutPositions.cardContainerY);

    const peelCardScreenFit = scene.peelCardScreenFit;
    const releaseLayoutManagedScale = () => {
        if (peelCardScreenFit && typeof peelCardScreenFit === 'object') {
            peelCardScreenFit.layoutManagedScale = false;
        }
    };

    const vpW = layoutPositions.screenWidth ?? getScreenWidth(scene);
    const cbTop = layoutPositions.controlBarBackgroundTop;
    const cardCfg = layoutPositions.cardContainerConfig;
    const ap = cardCfg?.areaPercent ?? cardCfg?.heightPercent ?? 0.65;

    if (
        cbTop == null ||
        Number.isNaN(cbTop) ||
        cbTop <= 0 ||
        cbTop >= getScreenHeight(scene) ||
        !Number.isFinite(vpW) ||
        vpW <= 0
    ) {
        layoutPositions.cardArea = null;
        layoutPositions.cardBackDisplay = null;
        layoutPositions.peelCardScale = undefined;
        releaseLayoutManagedScale();
        return;
    }

    const Aw = vpW;
    const Ah = cbTop;
    const { width: bw, height: bh } = getPullTabCardBackBaseDisplaySize(peel);

    const s = computeAreaPercentUniformScale({
        cardAreaWidth: Aw,
        cardAreaHeight: Ah,
        areaPercent: ap,
        baseCardWidth: bw,
        baseCardHeight: bh,
    });

    layoutPositions.cardArea = { width: Aw, height: Ah };
    layoutPositions.cardContainerAreaPercent = ap;
    layoutPositions.peelCardScale = s;
    layoutPositions.cardBackDisplay = { width: bw * s, height: bh * s };
    layoutPositions.cardContainerWidth = layoutPositions.cardBackDisplay.width;
    layoutPositions.cardContainerHeight = layoutPositions.cardBackDisplay.height;

    if (!Number.isFinite(s) || s <= 0) {
        layoutPositions.cardArea = null;
        layoutPositions.cardBackDisplay = null;
        layoutPositions.peelCardScale = undefined;
        releaseLayoutManagedScale();
        return;
    }

    if (peelCardScreenFit && typeof peelCardScreenFit === 'object') {
        peelCardScreenFit.layoutManagedScale = true;
    }
    peel.setScale(s, s);
    scene.events.emit('pulltab-peel-layout-changed');
}

/**
 * Scratch-style play / auto labels from Peel game state (see legacy InteractButton).
 */
export function attachPullTabPlayButtonAndHudSync(scene) {
    scene.handlePlayButtonClick = () => {
        scene.peelManager?.interact();
    };

    const syncAutoPlayOptionsToggle = () => {
        const ap = scene.autoPlayOptions;
        const pm = scene.peelManager;
        if (!ap || !pm) return;
        ap.autoPlay = pm.autoMode;
        if (typeof ap.updateUI === 'function') {
            ap.updateUI();
        }
    };

    scene.events.on('onStateChanged', (state) => {
        const cm = scene.controlBarManager;
        const mgr = scene.peelManager;
        if (!cm || !mgr) return;

        const speed = mgr.speed || 1;

        if (state === 'wait') {
            cm.setPlayButtonDisabled(true);
            cm.setAutoButtonDisabled(true);
            return;
        }

        if (mgr.autoMode && state !== 'ready') {
            cm.updatePlayButtonText(`AUTO ${mgr.autoRoundsLeft}`);
            cm.setPlayButtonDisabled(false);
            cm.setAutoButtonDisabled(false);
            return;
        }

        switch (state) {
            case 'ready':
                cm.updatePlayButtonText('BUY');
                cm.updateHeaderWinText(0);
                cm.setPlayButtonDisabled(false);
                cm.setAutoButtonDisabled(false);
                break;
            case 'playing':
                cm.updatePlayButtonText('OPEN');
                cm.setPlayButtonDisabled(false);
                cm.setAutoButtonDisabled(false);
                break;
            case 'clear':
                cm.setPlayButtonDisabled(true);
                cm.setAutoButtonDisabled(true);
                break;
            case 'gameOver':
                cm.setPlayButtonDisabled(true);
                cm.setAutoButtonDisabled(true);
                break;
            case 'win':
            case 'lose':
                cm.setPlayButtonDisabled(true);
                cm.setAutoButtonDisabled(false);
                break;
            default:
                break;
        }
    });

    scene.events.on('onAutoChanged', syncAutoPlayOptionsToggle);

    syncAutoPlayOptionsToggle();

    scene.events.on('pulltab-balance-pennies-changed', (animate, startMinor, stopLoopingOnComplete) => {
        const cm = scene.controlBarManager;
        if (!cm) return;
        cm.updateHeaderBalanceText(
            scene.balancePennies ?? 0,
            !!animate,
            startMinor ?? null,
            stopLoopingOnComplete === true
        );
        cm.updateHeaderBetText();
    });

    scene.events.on('pulltab-win-minor-changed', (winMinor) => {
        scene.controlBarManager?.updateHeaderWinText(winMinor ?? 0);
    });
}

export function bootstrapPullTabControlBar(scene) {
    scene.balanceService = scene.balanceService || {
        balancePennies: 0,
        get betAmountPennies() {
            const cfg = typeof window !== 'undefined' ? window.__selectedGameConfig?.creditValueMinor : null;
            const n = Number(cfg);
            if (Number.isFinite(n) && n > 0) return Math.round(n);
            return 100;
        },
        updateBalanceText() {},
    };

    Object.defineProperty(scene, 'balancePennies', {
        configurable: true,
        get() {
            return scene._balancePennies ?? scene.balanceService?.balancePennies ?? 0;
        },
        set(v) {
            const n = Math.round(Number(v) || 0);
            scene._balancePennies = n;
            if (scene.balanceService) scene.balanceService.balancePennies = n;
        },
    });

    scene._pullTabControlBarThemeApplied = true;

    scene.layoutReadyPromise = new Promise((resolve) => {
        scene._resolvePullTabLayoutReady = resolve;
    });

    scene.buttonManager = new ButtonManager(scene);
    scene.controlBarManager = new ControlBarManager(scene, scene.buttonManager);
    scene.layoutManager = new LayoutManager(scene);
    scene.controlBarBackgroundService = new ControlBarBackgroundService(scene);

    scene.events.on('onThemeInitalized', () => {
        scene.time.delayedCall(0, () => {
            scene.controlBarManager?.updateThemeColors?.();
        });
    });

    scene.events.once('server-awake', () => {
        scene.time.delayedCall(0, () => {
            if (scene.controlBarManager && scene.serverManager) {
                scene.balancePennies = Math.round(scene.serverManager.balance * 100);
                scene.controlBarManager.updateHeaderBalanceText(scene.balancePennies, false);
                scene.controlBarManager.updateHeaderBetText();
            }
            applyPullTabControlBarLayoutFromScene(scene);
        });
    });

    scene.layoutManager.layoutConfigsPromise
        .then(() => {
            const targetVp = ViewportHelper.getPhaserCanvasDimensions();
            if (
                targetVp.width > 0 &&
                targetVp.height > 0 &&
                (scene.scale.width !== targetVp.width || scene.scale.height !== targetVp.height)
            ) {
                scene.scale.resize(targetVp.width, targetVp.height);
                scene.scale.refresh();
            }

            const layoutName = scene.layoutManager.getCurrentLayoutName();
            const { uiConfig, baseUIConfig } = getLayoutConfigs(scene.layoutManager, layoutName);

            const width = getScreenWidth(scene);
            const height = getScreenHeight(scene);
            const verticalPaddingBottom = 0;
            const availableHeight = height;

            const contentHeightPercent =
                getContentHeightPercent(uiConfig, availableHeight, height) ||
                getContentHeightPercent(baseUIConfig, availableHeight, height) ||
                0.08;
            const buttonHeightPercent =
                height > 0 ? (availableHeight / height) * contentHeightPercent : contentHeightPercent;

            const cm = scene.controlBarManager;
            const soundButtonResult = cm.createSoundButton(buttonHeightPercent);
            const infoButtonResult = cm.createInfoButton(buttonHeightPercent);
            const playButtonResult = cm.createPlayButton();
            const autoButtonResult = cm.createAutoButton(buttonHeightPercent);
            const speedButtonResult = cm.createSpeedButton(buttonHeightPercent);

            scene.soundButtonResult = soundButtonResult;
            scene.soundIcon = soundButtonResult?.content;

            const showBar = scene._pullTabControlBarThemeApplied !== false;

            /** @type {Phaser.GameObjects.Container[]} */
            const containersToAdd = [
                soundButtonResult?.container,
                infoButtonResult?.container,
                autoButtonResult?.container,
                speedButtonResult?.container,
            ].filter(Boolean);

            containersToAdd.forEach((c) => {
                scene.add.existing(c);
                c.setVisible(showBar);
            });

            if (playButtonResult?.container && !playButtonResult.container.scene) {
                scene.add.existing(playButtonResult.container);
            }
            if (playButtonResult?.container) {
                playButtonResult.container.setVisible(showBar);
            }

            cm.setPlayButtonDisabled(false);

            /** @type {(s: typeof scene) => void} */
            const refreshSoundTex = () => {
                scene._updateSoundIcon?.();
            };

            refreshSoundTex();

            if (soundButtonResult && scene.buttonManager) {
                cm.soundButtonId = scene.buttonManager.registerButton(soundButtonResult, {
                    id: 'sound_button',
                    onClick: () => {
                        scene.audioService?.unlockAudio();
                        openSoundOptionsModal(scene);
                        refreshSoundTex();
                    },
                });
            }

            if (infoButtonResult && scene.buttonManager) {
                cm.infoButtonId = scene.buttonManager.registerButton(infoButtonResult, {
                    id: 'info_button',
                    onClick: () => {
                        scene.audioService?.unlockAudio();
                        openPullTabGameInfoModal(scene);
                    },
                });
            }

            if (autoButtonResult && scene.buttonManager) {
                cm.autoButtonId = scene.buttonManager.registerButton(autoButtonResult, {
                    id: 'auto_button',
                    onClick: () => {
                        if (
                            scene.autoPlayOptions?.modalElement &&
                            document.body.contains(scene.autoPlayOptions.modalElement)
                        ) {
                            scene.autoPlayOptions.hide();
                        } else {
                            if (!scene.autoPlayOptions) {
                                scene.autoPlayOptions = new AutoPlayOptions(scene);
                            }
                            scene.autoPlayOptions.show();
                        }
                    },
                });
            }

            attachPullTabPlayButtonAndHudSync(scene);

            applyPullTabControlBarLayoutFromScene(scene);

            cm.setControlBarVisible(true);
            cm.updateThemeColors?.();

            const useSessionBoot = scene.registry.get('preloadUseSessionConfig');
            const minorBoot = scene.registry.get('preloadOperatorBalance');
            scene.balancePennies =
                useSessionBoot && minorBoot != null
                    ? Math.round(Number(minorBoot))
                    : Math.round(Number(GameConfig.game.TEST_BALANCE_MINOR));

            cm.updateHeaderBetText();
            cm.updateHeaderBalanceText(scene.balancePennies, false);
            cm.updateHeaderWinText(0);

            if (typeof scene._resolvePullTabLayoutReady === 'function') {
                scene._resolvePullTabLayoutReady();
                scene._resolvePullTabLayoutReady = null;
            }
        })
        .catch((err) => {
            error(`[PullTab] layout bootstrap error: ${err?.message}`, 'layout');
            if (typeof scene._resolvePullTabLayoutReady === 'function') {
                scene._resolvePullTabLayoutReady();
                scene._resolvePullTabLayoutReady = null;
            }
        });
}
