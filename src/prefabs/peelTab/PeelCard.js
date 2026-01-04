
// You can write more code here

/* START OF COMPILED CODE */

import PeelMessageText from "./PeelMessageText.js";
import Prefab_Results from "./Prefab_Results.js";
import PeelCardEnterAnim from "./PeelCardEnterAnim.js";
/* START-USER-IMPORTS */
import PeelTab from "./peelTab.js";
/* END-USER-IMPORTS */

export default class PeelCard extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		// gameContainer
		const gameContainer = scene.add.container(0, 0);
		this.add(gameContainer);

		// cardBack
		const cardBack = scene.add.nineslice(0, 0, "CardBack", undefined, 1000, 650, 10, 10, 10, 10);
		gameContainer.add(cardBack);

		// prizeContainer
		const prizeContainer = scene.add.container(0, -300);
		gameContainer.add(prizeContainer);

		// peelContainer
		const peelContainer = scene.add.container(80, -300);
		gameContainer.add(peelContainer);

		// dI_CardCover_Default
		const dI_CardCover_Default = scene.add.image(-80, -300, "DI_CardCover_Default");
		dI_CardCover_Default.setOrigin(1, 0);
		gameContainer.add(dI_CardCover_Default);

		// win_Video
		const win_Video = scene.add.video(-80, -300, "DV_WinVideo_Default");
		win_Video.setOrigin(1, 0);
		gameContainer.add(win_Video);

		// lose_Video
		const lose_Video = scene.add.video(-80, -300, "DV_LoseVideo_Default");
		lose_Video.setOrigin(1, 0);
		gameContainer.add(lose_Video);

		// MessageText
		const messageText = new PeelMessageText(scene, 0, -381);
		messageText.setStyle({  });
		gameContainer.add(messageText);

		// prefab_Results
		const prefab_Results = new Prefab_Results(scene, 0, -344);
		gameContainer.add(prefab_Results);

		// peelCardEnterAnim
		const peelCardEnterAnim = new PeelCardEnterAnim(scene, 0, 0);
		peelCardEnterAnim.visible = false;
		this.add(peelCardEnterAnim);

		this.prizeContainer = prizeContainer;
		this.peelContainer = peelContainer;
		this.win_Video = win_Video;
		this.lose_Video = lose_Video;
		this.messageText = messageText;
		this.gameContainer = gameContainer;
		this.peelCardEnterAnim = peelCardEnterAnim;

		/* START-USER-CTR-CODE */
		// Write your code here.
		this.group = scene.add.group({
			classType: PeelTab
		});

		this.scene.events.on("onGameSpeedChanged", (value) => {this.speed = value;}, this)
		this.scene.events.on("scene-awake", ()=> this.awake(), this);
		this.scene.events.on("server-awake", ()=> this.init(), this);

		this.scene.events.on("onStateChanged", this.onStateChanged, this)
		//this.scene.input.keyboard.on("keydown-SPACE", ()=> this.reset(), this)
		/* END-USER-CTR-CODE */
	}

	/** @type {Phaser.GameObjects.Container} */
	prizeContainer;
	/** @type {Phaser.GameObjects.Container} */
	peelContainer;
	/** @type {Phaser.GameObjects.Video} */
	win_Video;
	/** @type {Phaser.GameObjects.Video} */
	lose_Video;
	/** @type {PeelMessageText} */
	messageText;
	/** @type {Phaser.GameObjects.Container} */
	gameContainer;
	/** @type {PeelCardEnterAnim} */
	peelCardEnterAnim;

	/* START-USER-CODE */
	group;
	padding = 0;
	textPadding = 10;
	speed = 1;

	activeTabs

	// Write your code here.
	awake()
	{
		this.gameContainer.visible = false;
	}

	init()
	{

		let tabSize = 0

		let config = this.scene.serverManager.gameConfig

		this.messageText.text = config.message;

		for (let i = 0; i < 6; i++)
		{
			let tab = this.group.get(0, 0);
			this.peelContainer.add(tab);

			tab.init();

			tab.y = tabSize + this.padding * i;
			tab.x = 0;
			tabSize += tab.getSize().y;
		}

		this.peelContainer.list.reverse();

		for (let i = 0; i < config.prizes.length; i++)
		{
			let prizeText = this.scene.add.text(0, 0, "", {});
			prizeText.setOrigin(0.5, 0);
			prizeText.text = config.prizes[i];
			prizeText.setStyle({ "align": "center", "color": "#252525ff", "fontFamily": "Anton-Regular", "fontSize": "60px", "resolution": 2 });
			this.prizeContainer.add(prizeText);
			prizeText.y = 100 * i + this.textPadding;
		}


		this.messageText.setScale(0,0)
		this.scene.tweens.add
		({
			targets: this.messageText,
			scaleY: 1,
			scaleX: 1,
			duration: 500/ this.speed,
			delay: 1400/ this.speed,
			ease: "Back.out"			
		})
	}

	ready()
	{
		this.gameContainer.visible = true;
		this.messageText.show();
	 	for (let i = 0; i < this.peelContainer.list.length; i++)
		{
			let tab = this.peelContainer.list[i];
			tab.reset();
		}	

		this.scene.stateManager.setState("ready", "PeelCard - Card Anims complete ready to play again")		
	}

	start()
	{
		let session = this.scene.serverManager.gameSession;

		this.activeTabs = this.peelContainer.list.length;
	 	for (let i = 0; i < this.peelContainer.list.length; i++)
		{
			let tab = this.peelContainer.list[i];
			tab.reset();
			tab.init(session.tabs[i]);
			tab.enabled = true;
			tab.once("peeled", () => this.onTabPeeled(), this);
		}		
	}

	reset()
	{
		this.scene.time.delayedCall(1000, ()=> this.peelCardEnterAnim.enter(this.ready.bind(this)));
	}

	peelAll()
	{
	 	for (let i = 0; i < this.peelContainer.list.length; i++)
		{
			this.scene.time.delayedCall((100 * i)/this.speed, ()=> this.peelContainer.list[i].autoPeel(), this) ;
		}
	}

	onStateChanged(state)
	{
		switch(state)
		{
			case "ready":
			break;
			case "playing":
			this.start();
			break;
			case "reset":
			this.reset();
			break;
			case "clear":
			this.peelAll();
			break;
			case "lose":
			this.playLoseVideo();
			break;
			case "win":
			this.playWinVideo();
			break;
			case "close":
			//this.playLoseVideo();
			break;
		}
	}

	onTabPeeled()
	{
		this.activeTabs--;
		if(this.activeTabs == 0)
		{
			this.scene.stateManager.setState("gameOver", "PeelCard - All Tabs Peeled Ending Game")
		}
	}

	playWinVideo()
	{
		this.win_Video.alpha = 1;
		this.win_Video.visible = true;
		this.win_Video.setPlaybackRate(this.speed)

		this.win_Video.play(false);
		this.scene.tweens.add({
			targets: this.win_Video,
			alpha: 0,
			delay: 5000 / this.speed,
			duration: 1000 / this.speed,
			onComplete: ()=>{this.win_Video.visible = false;}
		})
	}

	playLoseVideo()
	{
		this.lose_Video.alpha = 1;
		this.lose_Video.visible = true;
		this.lose_Video.setPlaybackRate(this.speed)

		this.lose_Video.play(false);
		this.scene.tweens.add({
			targets: this.lose_Video,
			alpha: 0,
			delay: 5000 / this.speed,
			duration: 1000 / this.speed,
			onComplete: ()=>{this.lose_Video.visible = false;}
		})
	}
	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
