
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
import { GameConfig } from '../../config/Global.js';
import HapticUtils from '../../utils/device/HapticUtils.js';
import { log, warn } from '../../utils/logger/LoggerUtils.js';
/* END-USER-IMPORTS */

export default class PeelManager extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		/* START-USER-CTR-CODE */
		// Write your code here.
		this.scene.events.on("scene-awake", ()=> this.init(), this);
		this.scene.events.on("interact", ()=> this.interact(), this);
		this.scene.events.on("onStateChanged", this.updateState, this);
		/* END-USER-CTR-CODE */
	}

	/* START-USER-CODE */
	stateManager
	state

	autoMode = false;
	autoRounds = 0;
	autoRoundsLeft = 0;

	speed = 1;

	// Write your code here.
	init()
	{
		this.stateManager = this.scene.stateManager;
		this.state = this.stateManager.state;

		this.setGameSpeed(1);
	}

	updateState(state)
	{
		this.state = state;

		switch(this.state)
		{

			case "ready":
				if(this.autoMode && this.autoRoundsLeft > 0)
				{
					this.scene.time.delayedCall(500 /this.speed, ()=> this.checkBalanace());
				}
				else if(this.autoMode)
				{
					this.autoRoundsLeft = this.autoRounds;
				}
			break;
			case "playing":
			break;
			case "clear":
			break;
			case "gameOver":
				this.checkResults();
			break;
		}
	}

	interact()
	{
		if(this.state != "ready" && this.autoMode)
		{			
			this.setAuto(false, this.autoRounds);
		}

		switch(this.state)
		{
			case "ready":
				this.checkBalanace();
			break;
			case "playing":
				this.stateManager.setState("clear", "PeelManager -  Player set board to clear")
			break;
			case "clear":
			break;
			case "gameOver":
			break;
			case "win":
				this.stateManager.setState("reset", "PeelManager -  Resetting Game")
			break;
			case "lose":
				this.stateManager.setState("reset", "PeelManager -  Resetting Game")
			break;
		}		
	}

	async checkBalanace()
	{
		let success = await this.scene.serverManager.buy();

		if(success)
		{
			this.stateManager.setState("playing", "PeelManager -  Player has enough currency, starting game");
			this.scene.events.emit("onCardBuy");
			log(`PeelManager buy ok autoMode=${this.autoMode}`, 'game');

			if(this.autoMode)
			{
				this.scene.time.delayedCall(500 / this.speed, ()=> {this.stateManager.setState("clear", "PeelManager -  AutoPlay Clear")})
			}
		}
		else
		{
			// ServerManager.buy() returns false for insufficient balance *and* API/network failures — avoid implying funds only.
			warn('[PeelManager] Buy did not start (insufficient balance, validation error, or API failure — see ServerManager logs)', 'game');
			this.stateManager?.setState("ready", "PeelManager: buy did not complete");
		}

	}

	checkResults()
	{
		const session = this.scene.serverManager.gameSession;
		log('PeelManager checkResults', 'game', session?.rows ?? session);

		const payoutMinor = Math.round(Number(session?.payoutMinor ?? 0));
		const winMinor = payoutMinor;
		this.scene.events.emit("pulltab-win-minor-changed", winMinor);

		const won = payoutMinor > 0;

		if (won)
		{
			this.scene.time.delayedCall(1000 / this.speed, () => {
				this.scene.audioService?.playSfx('win');
				const credited = this.scene.serverManager?.creditEconomyMinor(payoutMinor);
				if (credited) {
					this.scene.audioService?.playLoopingSfx('tally');
				}
				if (GameConfig?.ui?.enableHapticFeedback !== false) {
					HapticUtils.win();
				}
				this.stateManager.setState("win", "PeelManager -  Player has won");
			});			
		}
		else
		{
			this.scene.time.delayedCall(1000 / this.speed, () => {
				this.scene.audioService?.playSfx('lose');
				if (GameConfig?.ui?.enableHapticFeedback !== false) {
					HapticUtils.lose();
				}
				this.stateManager.setState("lose", "PeelManager -  Player has lost");
			});					
		}

		if (this.autoMode) {
			this.autoRoundsLeft--;
			log(`PeelManager auto rounds left=${this.autoRoundsLeft}`, 'game');
			this.scene.time.delayedCall(5000 / this.speed, () => {
				const s = this.stateManager?.state;
				if (s === 'win' || s === 'lose') {
					this.stateManager.setState('reset', 'PeelManager - autoplay reset after results');
				}
			});
		}
	}

	setGameSpeed(value)
	{
		this.scene.registry.set("GameSpeed", value);
		this.speed = value;
		this.scene.events.emit("onGameSpeedChanged", value);
	}

	setAuto(auto, rounds)
	{
		this.autoMode = auto;		
		this.autoRounds = rounds;
		this.autoRoundsLeft = this.autoRounds;

		log(`PeelManager setAuto autoMode=${this.autoMode} rounds=${rounds}`, 'game');
		this.scene.events.emit("onAutoChanged", this.autoMode);
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
