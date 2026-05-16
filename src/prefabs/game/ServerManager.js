
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
import { GameConfig } from '../../config/Global.js';
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
	balance = 1000;

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
			message: registryCfg.message ?? d.message
		};

		const useSession = this.scene.registry.get('preloadUseSessionConfig');
		const minor = this.scene.registry.get('preloadOperatorBalance');
		if (useSession && minor != null) {
			const m = Number(minor);
			this.balance = Number.isFinite(m) ? m / 100 : GameConfig.game.TEST_BALANCE_MINOR / 100;
		} else {
			this.balance = GameConfig.game.TEST_BALANCE_MINOR / 100;
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
		const penn = Math.round(this.balance * 100);
		this.scene.balancePennies = penn;
		this.scene.events.emit(
			"pulltab-balance-pennies-changed",
			animate,
			startingMinor != null ? startingMinor : null,
			opts.stopLoopingOnBalanceTweenComplete === true,
		);
	}

	async buy()
	{
		this.scene?.stateManager?.setState("wait", "ServerManager: Awaiting Responce From Server ensuring no input")

		const priceMinorRaw = typeof window !== "undefined"
			? window.__selectedGameConfig?.creditValueMinor
			: null;
		const priceMinor = Number.isFinite(Number(priceMinorRaw)) && Number(priceMinorRaw) > 0
			? Math.round(Number(priceMinorRaw))
			: 100;

		const balancePennies = Math.round(this.balance * 100);
		if (balancePennies < priceMinor) {
			this.scene?.stateManager?.setState("ready", "ServerManager: insufficient balance");
			return Promise.resolve(false);
		}

		const startMinor = balancePennies;

		let balance = this.getBalance();

		this.gameSession = 
		{
			result: "win",
			prize: 25,
			tabs:
			[
				[1,5,0],
				[0,0,8],
				[2,6,4],
				[7,7,7],
				[5,3,1],
				[7,8,6]
			],
		};

		this.balance -= priceMinor / 100;
		this._emitBalanceMinorUpdate(true, startMinor);
		this.scene.audioService?.playSfx('buy');

		this.scene.events.emit("OnBalanceChanged", balance);

		return Promise.resolve(true);
	}

	creditPrizeUsd(prizeUsd) {
		const p = Number(prizeUsd);
		if (!Number.isFinite(p) || p <= 0) return false;
		const startMinor = Math.round(this.balance * 100);
		this.balance += p;
		this._emitBalanceMinorUpdate(true, startMinor, {
			stopLoopingOnBalanceTweenComplete: true,
		});
		return true;
	}

	async getBalance()
	{
		return this.balance;
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
