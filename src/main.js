import { installRuntimeErrorHandlers } from "./bootstrap/runtimeErrorHandlers.js";
import Level from "./scenes/Level.js";
import Preload from "./scenes/Preload.js";
import "./dom/debugOverlay/styles/debugOverlay.css";
import "./dom/modal/styles/modal.css";
import "./dom/soundOptions/styles/soundOptions.css";
import "./dom/autoplayOptions/styles/autoplayOptions.css";
import ResizeHandler from "./utils/game/ResizeHandler.js";
import ViewportHelper from "./utils/ui/ViewportHelper.js";
import ProviderAPIService from "./services/api/ProviderAPIService.js";
import { GameConfig } from "./config/Global.js";
import {
	normalizeBalance,
	resolveCreditValueMinor,
} from "./utils/formatting/FormattingUtils.js";
import { applyLoggingFromGameConfig, warn, error as logErr } from "./utils/logger/LoggerUtils.js";
import { showConfigErrorModal } from "./dom/modal/utils/ErrorModalUtils.js";
import { loadThemeWithOverride } from "./utils/theme/ThemeMergeUtils.js";
import { hydratePullTabIconsLayout } from "./utils/theme/ThemePreloadUtils.js";
import { initializeConsoleCapture } from "./utils/logger/ConsoleCapture.js";

applyLoggingFromGameConfig(GameConfig);
initializeConsoleCapture();
installRuntimeErrorHandlers();

const DEFAULT_UI_COPY = {
	type: "Normal",
	prizes: ["$250", "$100", "$50", "$25", "$10", "$1"],
	message: "OPEN THE TABS FOR WINS UP TO $250"
};

/**
 * Local theme files have one shared creditValueMinor. Stamp universal GC/SC buy-ins
 * when the file does not set them so demo play follows CURRENCY_CODE.
 * @param {object} config
 * @returns {object}
 */
function withLocalCurrencyBuyIns(config) {
	const source = config && typeof config === 'object' ? config : {};
	const gc = Math.round(Number(source.creditValueMinorGc));
	const sc = Math.round(Number(source.creditValueMinorSc));
	return {
		...source,
		creditValueMinorGc: Number.isFinite(gc) && gc > 0 ? gc : GameConfig.game.CREDIT_VALUE_MINOR_GC,
		creditValueMinorSc: Number.isFinite(sc) && sc > 0 ? sc : GameConfig.game.CREDIT_VALUE_MINOR_SC_USD,
	};
}

function hasExplicitStake(meta) {
	if (!meta || typeof meta !== 'object') {
		return false;
	}
	return ['creditValueMinor', 'credit_value_minor', 'creditValueMinorGc', 'creditValueMinorSc', 'credit_value_minor_gc', 'credit_value_minor_sc']
		.some((key) => meta[key] != null && meta[key] !== '');
}

function mergePullTabConfig(base = {}, meta = {}, currencyCode) {
	const currency = currencyCode ?? GameConfig.game.CURRENCY_CODE;
	const sourceBase = hasExplicitStake(meta) ? base : withLocalCurrencyBuyIns(base);
	const stakeSource = { ...sourceBase, ...(meta || {}) };
	return {
		theme: meta.theme ?? base.theme ?? "default",
		type: meta.type ?? base.type ?? DEFAULT_UI_COPY.type,
		prizes: Array.isArray(meta.prizes) ? meta.prizes : (base.prizes ?? DEFAULT_UI_COPY.prizes),
		message: meta.message ?? base.message ?? DEFAULT_UI_COPY.message,
		paytableId: meta.paytableId ?? base.paytableId,
		creditValueMinorGc: stakeSource.creditValueMinorGc,
		creditValueMinorSc: stakeSource.creditValueMinorSc,
		creditValueMinor: resolveCreditValueMinor(stakeSource, currency),
		rowCount: Number.isFinite(Number(meta.rowCount)) && Number(meta.rowCount) > 0
			? Math.round(Number(meta.rowCount))
			: (Number.isFinite(Number(base.rowCount)) && Number(base.rowCount) > 0
				? Math.round(Number(base.rowCount))
				: 7),
	};
}

function assertDemoPaytableConfig(config, contextLabel) {
	if (window.__sessionId) {
		return;
	}
	const paytableId = String(config?.paytableId ?? '').trim();
	if (!paytableId) {
		const theme = config?.theme ?? 'unknown';
		showConfigErrorModal(
			null,
			`Game config "${theme}" is missing paytableId (${contextLabel}). Demo buys cannot run. Use ?config=beverly-hillbilly or reload after a fresh build.`
		);
	}
}

function getSessionIdFromUrl() {
	const read = (win) => {
		try {
			return new URLSearchParams(win.location.search).get("sessionId");
		} catch (_) {
			return null;
		}
	};
	return read(window) || read(window.parent) || read(window.top);
}

window.addEventListener('load', async function () {

	const sessionId = getSessionIdFromUrl();
	if (sessionId) {
		window.__sessionId = sessionId;
		window.__selectedGameConfig = mergePullTabConfig({}, {});
	} else {
		try {
			const { loadSelectedConfig, getSelectedConfigName, DEFAULT_CONFIG } = await import('./config/game/game-config.js');
			let config = await loadSelectedConfig();
			if (!config) {
				const name = getSelectedConfigName() || DEFAULT_CONFIG;
				config = mergePullTabConfig({ theme: name }, {});
				warn(`Game config failed to load, using fallback theme: ${name}`, 'game');
			} else {
				config = mergePullTabConfig(config, {});
			}
			window.__selectedGameConfig = config;
			assertDemoPaytableConfig(config, 'after theme load');
		} catch (err) {
			logErr(`Failed to load game config: ${err?.message ?? err}`, 'game', err);
			window.__selectedGameConfig = mergePullTabConfig({ theme: 'mega-monster' }, {});
			assertDemoPaytableConfig(window.__selectedGameConfig, 'fallback theme');
		}
	}

	let initialWidth = ViewportHelper.getWidth();
	let initialHeight = ViewportHelper.getHeight();

	if (initialWidth < 100 || initialHeight < 100)
	{
		initialWidth = window.innerWidth;
		initialHeight = window.innerHeight;
	}

	var game = new Phaser.Game
	({
		width: initialWidth,
		height: initialHeight,
		type: Phaser.AUTO,
        backgroundColor: "#242424",
		parent: 'game-container',
		scale: {
			mode: Phaser.Scale.RESIZE,
			autoCenter: Phaser.Scale.CENTER_BOTH
		},
		physics: {
			default: 'arcade',
			arcade: {
				debug: false,
				gravity: {
					x: 0, y: 0
				}
			}
		},
		dom:{
    			createContainer: true,
			}
	});

	game.global =
	{
		referenceScreenWidth: 1920,
		referenceScreenHeight: 1080
	};

	const ensureCorrectSize = () =>
	{
		const viewportWidth = ViewportHelper.getWidth();
		const viewportHeight = ViewportHelper.getHeight();
		if (game.scale.width !== viewportWidth || game.scale.height !== viewportHeight) {
			game.scale.resize(viewportWidth, viewportHeight);
			game.scale.refresh();
		}
	};

	ensureCorrectSize();
	setTimeout(ensureCorrectSize, 50);
	setTimeout(ensureCorrectSize, 200);

	const onChangeScreen = () =>
	{
		// Registered order is Boot → Preload → Level — never use scenes[0] here (that's Preload once added).
		if (!game.scene || typeof game.scene.getScene !== 'function') return;
		if (typeof game.scene.isActive === 'function' && game.scene.isActive('Level'))
		{
			const levelScene = game.scene.getScene('Level');
			if (levelScene && typeof levelScene.resize === 'function')
			{
				levelScene.resize();
			}
		}
	}

	const resizeHandler = new ResizeHandler(game, {
		enableLogging: false,
		pollingInterval: 250,
		focusDelay: 100
	});

	game.scale.on('resize', onChangeScreen);

	game.scene.add("Preload", Preload);
	game.scene.add("Level", Level);
	game.scene.add("Boot", Boot, true);
});

class Boot extends Phaser.Scene {

	preload() {
		
		this.load.pack("pack", "assets/preload-asset-pack.json");
	}

	async create() {

		let config = window.__selectedGameConfig || {};
		this.registry.set('preloadUseSessionConfig', false);

		if (window.__sessionId) {
			const providerAPI = new ProviderAPIService();
			if (!providerAPI.sessionId) {
				providerAPI.sessionId = window.__sessionId;
				providerAPI.isSessionMode = true;
			}
			try {
				const sessionInfo = await providerAPI.getSessionInfo();
				const meta = sessionInfo.gameMetadata || {};
				const balanceCurrency =
					sessionInfo.currency || sessionInfo.operatorCurrency || GameConfig.game.CURRENCY_CODE;
				if (balanceCurrency != null && String(balanceCurrency).trim() !== '') {
					GameConfig.game.DISPLAY_CURRENCY_CODE = String(balanceCurrency).trim();
				}
				config = mergePullTabConfig({}, meta, balanceCurrency);
				window.__selectedGameConfig = config;

				const mode = sessionInfo.mode || providerAPI.mode || 'demo';
				const operatorBalance = sessionInfo.operatorBalance;
				this.registry.set('preloadSessionId', window.__sessionId);
				this.registry.set('preloadSessionMode', mode);
				this.registry.set('preloadUseSessionConfig', true);
				// Match video-poker: use operator wallet whenever the session returns it (Novalink often uses mode=demo with a live operator balance).
				if (operatorBalance !== null && operatorBalance !== undefined && operatorBalance !== '') {
					this.registry.set(
						'preloadOperatorBalance',
						normalizeBalance(operatorBalance, balanceCurrency)
					);
				} else if (mode === 'real') {
					this.registry.set('preloadOperatorBalance', 0);
				} else {
					this.registry.set(
						'preloadOperatorBalance',
						normalizeBalance(GameConfig.game.SESSION_DEMO_BALANCE_MINOR, balanceCurrency)
					);
				}
			} catch (err) {
				logErr(`Boot: Failed to fetch session: ${err?.message ?? err}`, 'api', err);
				window.__sessionId = null;
				try {
					const { loadSelectedConfig } = await import('./config/game/game-config.js');
					const fileCfg = await loadSelectedConfig();
					config = mergePullTabConfig(fileCfg || {}, {});
				} catch {
					config = mergePullTabConfig({}, {});
				}
				window.__selectedGameConfig = config;
				this.registry.set('preloadSessionId', null);
				this.registry.set('preloadOperatorBalance', GameConfig.game.SESSION_DEMO_BALANCE_MINOR);
				this.registry.set('preloadSessionMode', 'demo');
				this.registry.set('preloadUseSessionConfig', false);
			}
		}

		this.registry.set('preloadGameConfig', config);
		assertDemoPaytableConfig(config, 'Boot create');

		const themeName = config.theme || 'default';
		try {
			const { themeData, themeOverride } = await loadThemeWithOverride(themeName);
			this.registry.set('preloadThemeData', themeData);
			this.registry.set('preloadThemeOverride', themeOverride);
			await hydratePullTabIconsLayout(this.registry, themeData);
		} catch (err) {
			logErr(`Boot: Failed to load theme: ${err?.message ?? err}`, 'theme', err);
			this.registry.set('preloadThemeData', {});
			this.registry.set('preloadThemeOverride', null);
		}

		this.scene.start("Preload");
	}
}
