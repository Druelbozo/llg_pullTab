
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class PeelCardEnterAnim extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		// cardBack
		const cardBack = scene.add.nineslice(0, 0, "CardBack", undefined, 1000, 650, 10, 10, 10, 10);
		this.add(cardBack);

		// CardCover
		const cardCover = scene.add.image(-80, -300, "DI_CardCover_Default");
		cardCover.setOrigin(1, 0);
		this.add(cardCover);

		// prizeContainer
		const prizeContainer = scene.add.container(0, -300);
		this.add(prizeContainer);

		// peelContainer
		const peelContainer = scene.add.container(80, -300);
		this.add(peelContainer);

		this.cardCover = cardCover;
		this.prizeContainer = prizeContainer;
		this.peelContainer = peelContainer;

		/* START-USER-CTR-CODE */
		// Write your code here.
		this.scene.events.on("server-awake", ()=> this.init(), this);
		/* END-USER-CTR-CODE */
	}

	/** @type {Phaser.GameObjects.Image} */
	cardCover;
	/** @type {Phaser.GameObjects.Container} */
	prizeContainer;
	/** @type {Phaser.GameObjects.Container} */
	peelContainer;

	/* START-USER-CODE */
	enterAnim = "Slam"
	callBack = undefined;
	ctx = undefined;
	speed = 1;

	// Write your code here.
	init()
	{
		let config = this.scene.serverManager.gameConfig
		console.log("!!!!",config.prizes.length);
		let tabSize;
		for (let i = 0; i < config.prizes.length; i++)
		{
					console.log("!!!!",config.prizes[i]);
			const peel = this.scene.add.image(0, 0, "DI_Peel_Default");
			if(this.scene.textures.exists("Peel"))
			{
				peel.setTexture("Peel");
			}
			else
			{
				peel.setTexture("DI_Peel_Default");
			}

			if(this.scene.textures.exists("CardCover"))
			{
				this.cardCover.setTexture("CardCover");
			}

			peel.setOrigin(0, 0);
			this.peelContainer.add(peel);

			peel.y = 100 * i;
			peel.x = 0;	

			let prizeText = this.scene.add.text(0, 0, "", {});
			prizeText.setOrigin(0.5, 0);
			prizeText.text = config.prizes[i];
			prizeText.setStyle({ "align": "center", "color": "#252525ff", "fontFamily": "Anton-Regular", "fontSize": "60px", "resolution": 2 });
			this.prizeContainer.add(prizeText);
			prizeText.y = 100 * i + 10;
		}

	}

	enter(callBack, ctx)
	{
		this.callBack = callBack;
		this.ctx = ctx;

		this.speed = this.scene.registry.get("GameSpeed");
		switch(this.enterAnim)
		{
			case "Slam":
			this.slam();
			break;
		}
	}

	slam()
	{
		this.visible = true;
		this.x = 0;
		this.y = -1000;
		this.alpha = 1;
		this.setScale(1.15, 1.15);

		this.scene.add.tween
		({
			targets: this,
			y: 0,
			duration: 800 / this.speed,
			ease: "Back.out"
		})

		this.scene.add.tween
		({
			targets: this,
			scaleY: 1,
			scaleX: 1,
			duration: 750 / this.speed,
			delay: 550 / this.speed,
			ease: "Back.in",
			onComplete: ()=>
			{
				this.visible = false;
				if(this.callBack !== undefined) this.callBack();
			}			
		})
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
