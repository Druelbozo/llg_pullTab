
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
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
			this.stateManager.setState("playing", "PeelManager -  Player has enough currency, starting game")
				console.log(this.autoMode);

			if(this.autoMode)
			{
				this.scene.time.delayedCall(500 / this.speed, ()=> {this.stateManager.setState("clear", "PeelManager -  AutoPlay Clear")})
			}
		}
		else
		{
			console.log("Not Enough Funds")
		}

	}

	checkResults()
	{
		//Contact ServerManager
		//Get Result
		let session = this.scene.serverManager.gameSession; // GET RESULTS FROM SERVERMANAGER;
		console.log("Checking Results...");

		if(session.result == "win")
		{
			this.scene.time.delayedCall(1000, ()=> this.stateManager.setState("win", "PeelManager -  Player has won"));			
		}
		else
		{
			this.scene.time.delayedCall(1000, ()=> this.stateManager.setState("lose", "PeelManager -  Player has lost"));					
		}

		if(this.autoMode)
		{
			this.autoRoundsLeft--
			console.log("Auto Rounds Left: " + this.autoRoundsLeft)
			this.scene.time.delayedCall(3000 / this.speed, () => this.stateManager.setState("reset", "PeelManager -  Resetting Game"))
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

		console.log("AUTOMODE: " + this.autoMode + ", ROUNDS: " + rounds);
		this.scene.events.emit("onAutoChanged", this.autoMode);
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
