
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
import PullTabsService from '../../services/api/PullTabsService.js';
import { GameConfig } from '../../config/Global.js';
import { normalizePullTabsBuy, resolvePullTabBuyWalletDebitMinor } from '../../utils/game/pullTabBuyDisplay.js';
import { maxPayoutMinorFromAwardTiers } from '../../utils/game/pullTabAwardTierUtils.js';
import { formatPullTabBannerMessage, economyMinorToWalletMinors, getDefaultCreditValueMinor } from '../../utils/formatting/FormattingUtils.js';
import { setLastPullTabBuyDebug } from '../../utils/game/pullTabLastBuyDebug.js';
import { warn, error as logErr } from '../../utils/logger/LoggerUtils.js';
/* END-USER-IMPORTS */

export default class ServerManager extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		/* START-USER-CTR-CODE */
		// Write your code here.
		this.scene.events.on("scene-awake", ()=> this.init(), this)
		/* END-USER-CTR-CODE */
	}

	/* START-USER-CODE */
	gameSession;
	gameConfig;
	/** Wallet minors (pennies) — canonical balance store. */
	balanceWalletMinors = 100000;

	/** @deprecated Use balanceWalletMinors. Kept for legacy callers. */
	get balance() {
		return this.balanceWalletMinors / 100;
	}

	set balance(value) {
		const n = Number(value);
		this.balanceWalletMinors = Number.isFinite(n) ? Math.round(n * 100) : 0;
	}

	/** @type {PullTabsService|null} */
	pullTabsApi = null;

	/** Prevents overlapping buy requests from rapid clicks. */
	_buyInFlight = false;

	/** Last buy failure for purchase-error modal detail. */
	lastBuyError = null;

	/** True when a concurrent buy was ignored (do not show purchase-failed modal). */
	lastBuySkippedInFlight = false;

	static DEFAULT_GAME_UI = {
		type: "Normal",
		prizes: ["$250", "$100", "$50", "$25", "$10", "$1"],
		message: "OPEN THE TABS FOR WINS UP TO $250"
	};

	// Write your code here.
	async init()
	{
		const registryCfg = this.scene.registry.get('preloadGameConfig')
			|| (typeof window !== 'undefined' && window.__selectedGameConfig)
			|| {};
		const d = ServerManager.DEFAULT_GAME_UI;
		this.gameConfig = {
			type: registryCfg.type ?? d.type,
			prizes: Array.isArray(registryCfg.prizes) ? registryCfg.prizes : d.prizes,
			message: registryCfg.message ?? d.message,
			paytableId: registryCfg.paytableId,
			creditValueMinor: registryCfg.creditValueMinor,
			rowCount: registryCfg.rowCount,
		};

		this.pullTabsApi = new PullTabsService();

		void this.refreshBannerFromPaytable();

		const useSession = this.scene.registry.get('preloadUseSessionConfig');
		const minor = this.scene.registry.get('preloadOperatorBalance');
		if (useSession && minor != null) {
			const m = Number(minor);
			this.balanceWalletMinors = Number.isFinite(m) ? Math.round(m) : GameConfig.game.TEST_BALANCE_MINOR;
		} else {
			this.balanceWalletMinors = GameConfig.game.TEST_BALANCE_MINOR;
		}

		//Remove Time Delay once logic is in
		this.scene.time.delayedCall(500, ()=> 
		{
			this.scene?.stateManager?.setState("reset", "ServerManager: Inital Set Up Complete Starting Game")
			this.scene.events.emit("server-awake", this);
		});
	}

	/**
	 * @param {boolean} animate
	 * @param {number|null|undefined} startingMinor
	 * @param {{ stopLoopingOnBalanceTweenComplete?: boolean }} [opts]
	 */
	_emitBalanceMinorUpdate(animate = false, startingMinor = null, opts = {}) {
		this.scene.balancePennies = this.balanceWalletMinors;
		this.scene.events.emit(
			"pulltab-balance-pennies-changed",
			animate,
			startingMinor != null ? startingMinor : null,
			opts.stopLoopingOnBalanceTweenComplete === true,
		);
	}

	async buy()
	{
		const stateMgr = this.scene?.stateManager;

		if (this._buyInFlight) {
			this.lastBuySkippedInFlight = true;
			warn('[ServerManager] Buy ignored — request already in flight', 'api');
			return false;
		}

		this._buyInFlight = true;
		this.lastBuySkippedInFlight = false;
		this.lastBuyError = null;

		try {
		const gc = typeof window !== "undefined" ? window.__selectedGameConfig || {} : {};
		const sid = typeof window !== "undefined" && window.__sessionId ? String(window.__sessionId).trim() : "";
		const isSession = sid !== "";

		const paytableId = String(gc.paytableId ?? this.gameConfig.paytableId ?? "").trim();
		const creditMinor = Math.round(
			Number(
				gc.creditValueMinor ??
					this.gameConfig.creditValueMinor ??
					getDefaultCreditValueMinor()
			)
		);
		const priceMinor = Number.isFinite(creditMinor) && creditMinor > 0 ? creditMinor : getDefaultCreditValueMinor();

		const walletDebitMinor = resolvePullTabBuyWalletDebitMinor(this.scene);

		if (!isSession && paytableId.length === 0) {
			logErr('[ServerManager] Non-session pull-tabs buy requires paytableId in game config.', 'api');
			this.lastBuyError = { message: 'Missing paytableId in game config', status: 0 };
			setLastPullTabBuyDebug({
				ok: false,
				paytableId: '',
				creditValueMinor: priceMinor,
				isSessionMode: false,
				error: 'Missing paytableId in game config',
			});
			stateMgr?.setState("ready", "ServerManager: missing paytableId");
			return false;
		}

		if (this.balanceWalletMinors < walletDebitMinor) {
			stateMgr?.setState("ready", "ServerManager: insufficient balance");
			return false;
		}

		stateMgr?.setState("wait", "ServerManager: awaiting pull-tabs buy");

		setLastPullTabBuyDebug({
			ok: null,
			paytableId: isSession ? '(session)' : paytableId,
			creditValueMinor: priceMinor,
			isSessionMode: isSession,
			status: 'pending',
		});

		if (!this.pullTabsApi) {
			this.pullTabsApi = new PullTabsService();
		}

		try {
			const resp = await this.pullTabsApi.buy(paytableId, priceMinor);
			const normalized = normalizePullTabsBuy(this.scene, resp);

			let tabsRow = [...normalized.tabs];
			if (tabsRow.length > normalized.rowCount) {
				tabsRow = tabsRow.slice(0, normalized.rowCount);
			}

			const isFreePlay = resp?.isFreePlay === true;

			const bobRaw = resp?.operatorBalanceAfterBet;
			const hasBob =
				bobRaw !== undefined &&
				bobRaw !== null &&
				bobRaw !== "" &&
				Number.isFinite(Number(bobRaw));

			const prevMinor = this.balanceWalletMinors;

			if (isSession && hasBob) {
				this.balanceWalletMinors = Math.round(Number(bobRaw));
				this._emitBalanceMinorUpdate(true, prevMinor);
			} else if (!isFreePlay) {
				this.balanceWalletMinors -= walletDebitMinor;
				this._emitBalanceMinorUpdate(true, prevMinor);
			}

			this.gameSession = {
				payoutMinor: normalized.payoutMinor,
				won: normalized.won,
				tabs: tabsRow,
				rows: normalized.rowsRaw,
				rowCount: normalized.rowCount,
				outcomeTierId: resp?.outcomeTierId ?? null,
				outcomeSymbol: resp?.outcomeSymbol ?? null,
				apiRound: resp,
			};

			setLastPullTabBuyDebug({
				ok: true,
				paytableId: isSession ? '(session)' : paytableId,
				creditValueMinor: priceMinor,
				isSessionMode: isSession,
				status: 200,
				payoutMinor: normalized.payoutMinor,
				outcomeTierId: resp?.outcomeTierId ?? null,
				ticketPoolIndex: resp?.ticketPoolIndex ?? null,
				won: normalized.won,
			});

			this.scene.registry.set(
				"pullTabResolvedRowCount",
				normalized.rowCount
			);

			this.scene.audioService?.playSfx('buy');
			this.scene.events.emit(
				"OnBalanceChanged",
				this.getBalance()
			);

			return true;
		} catch (err) {
			this.lastBuyError = err;
			setLastPullTabBuyDebug({
				ok: false,
				paytableId: isSession ? '(session)' : paytableId,
				creditValueMinor: priceMinor,
				isSessionMode: isSession,
				status: Number(/** @type {{ status?: number }} */ (err).status) || null,
				error: String(/** @type {{ message?: string }} */ (err).message || err),
			});
			warn(`[ServerManager] pull-tabs buy failed: ${err?.message ?? err}`, 'api', err);
			stateMgr?.setState(
				"ready",
				"ServerManager: buy failed"
			);
			return false;
		}
		} finally {
			this._buyInFlight = false;
		}
	}

	creditEconomyMinor(payoutMinorEconomy) {
		const payout = Math.round(Number(payoutMinorEconomy));
		if (!Number.isFinite(payout) || payout <= 0) {
			return false;
		}
		const walletCreditMinor = economyMinorToWalletMinors(payout);
		const startMinor = this.balanceWalletMinors;
		this.balanceWalletMinors += walletCreditMinor;
		this._emitBalanceMinorUpdate(true, startMinor, {
			stopLoopingOnBalanceTweenComplete: true,
		});
		return true;
	}

	async getBalance()
	{
		return this.balance;
	}

	/**
	 * Loads `get-paytable-info`, sets peel banner message to max tier payout using economy formatting (GC / SC / USD).
	 */
	refreshBannerFromPaytable() {
		const gc = typeof window !== "undefined" ? window.__selectedGameConfig || {} : {};

		const paytableId = String(gc.paytableId ?? this.gameConfig?.paytableId ?? "").trim();
		const creditMinor = Math.round(
			Number(
				gc.creditValueMinor ??
					this.gameConfig?.creditValueMinor ??
					getDefaultCreditValueMinor()
			)
		);
		const credit = Number.isFinite(creditMinor) && creditMinor > 0 ? creditMinor : getDefaultCreditValueMinor();

		if (!this.pullTabsApi) {
			this.pullTabsApi = new PullTabsService();
		}

		if (!paytableId) {
			return;
		}

		void this.pullTabsApi
			.getPaytableInfo(paytableId, credit)
			.then((info) => {
				const maxMinor = maxPayoutMinorFromAwardTiers(info?.awardTiers, credit);
				if (maxMinor == null) return;
				const text = formatPullTabBannerMessage(maxMinor);
				if (!text.trim()) return;
				this.gameConfig.message = text;
				this.scene.events.emit("pulltab-banner-update", text);
			})
			.catch(() => {
				/* keep registry / default banner */
			});
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
