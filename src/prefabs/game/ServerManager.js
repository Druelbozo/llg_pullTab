
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
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

	// Write your code here.
	async init()
	{
		//Inital ServerSetUp

		//this.balance = this.getBalance();

		this.gameConfig = 
		{
			type: "Normal",
			prizes: ["$250", "$100", "$50", "$25", "$10", "$1"],
			message: "OPEN THE TABS FOR WINS UP TO $250"
		};

		//Remove Time Delay once logic is in
		this.scene.time.delayedCall(500, ()=> 
		{
			this.scene?.stateManager?.setState("reset", "ServerManager: Inital Set Up Complete Starting Game")
			this.scene.events.emit("server-awake", this);
		});
	}

	async buy()
	{
		this.scene?.stateManager?.setState("wait", "ServerManager: Awaiting Responce From Server ensuring no input")
		//Check Balance
		let balance = this.getBalance();
		//If Balance is high enough generate game session
		//This contains the win/loss, what icons show and anything else that should come from the server
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

		//Emit Balance event for objects to read it
		this.scene.events.emit("OnBalanceChanged", balance);

		//Return true is everything worked false if anything failed
		return new Promise((resolve, reject) => {resolve(true)});
	}

	async getBalance()
	{
		return 100000;
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
