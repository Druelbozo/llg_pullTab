
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
import gameConfig from '../../config/game-config.js';
/* END-USER-IMPORTS */

export default class Prefab_Results extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		// animContainer
		const animContainer = scene.add.container(0, 0);
		this.add(animContainer);

		// winImage
		const winImage = scene.add.image(0, 0, "DI_Win_Default");
		winImage.visible = false;
		animContainer.add(winImage);

		// loseImage
		const loseImage = scene.add.image(0, 0, "DI_Lose_Default");
		loseImage.visible = false;
		animContainer.add(loseImage);

		// winningsText
		const winningsText = scene.add.text(0, 131, "", {});
		winningsText.setOrigin(0.5, 0.5);
		winningsText.visible = false;
		winningsText.text = "$999.99";
		winningsText.setStyle({ "color": "#fe7a00ff", "fontFamily": "New Amsterdam", "fontSize": "94px", "stroke": "#f6f4ebff", "strokeThickness": 15, "shadow.offsetY": 6, "shadow.color": "#00000066", "shadow.stroke": true });
		animContainer.add(winningsText);

		this.winImage = winImage;
		this.loseImage = loseImage;
		this.winningsText = winningsText;
		this.animContainer = animContainer;

		/* START-USER-CTR-CODE */
		// Write your code here.
		this.scene.events.on("onStateChanged", this.showResults, this)
		this.scene.events.on("onThemeInitalized", this.init, this)
		this.scene.events.on("onGameSpeedChanged", (speed)=> this.speed = speed, this)

		/* END-USER-CTR-CODE */
	}

	/** @type {Phaser.GameObjects.Image} */
	winImage;
	/** @type {Phaser.GameObjects.Image} */
	loseImage;
	/** @type {Phaser.GameObjects.Text} */
	winningsText;
	/** @type {Phaser.GameObjects.Container} */
	animContainer;

	/* START-USER-CODE */
	speed = 1;

	// Write your code here.
	init(theme)
	{
		let style = theme.text.mainText;

		this.winningsText.setStyle
		({
			fontFamily: style.fontFamily,
			fontSize: style.fontSize +40,
			color: style.color,
			stroke: style.strokeColor,
			strokeThickness: style.strokeThickness,
		})	

			if(this.scene.textures.exists("WinImage"))
			{
				this.winImage.setTexture("WinImage"); 
			}

			if(this.scene.textures.exists("LoseImage"))
			{
				this.loseImage.setTexture("LoseImage");
			}	
	}

	showResults(state)
	{
		if(state == "win")
		{
			this.playAnim();
			this.winImage.visible = true;
			this.loseImage.visible = false;
			this.winningsText.visible = true;
			this.winningsText.text = "";
		}

		if(state  == "lose")
		{
			this.playAnim();
			this.winImage.visible = false;
			this.loseImage.visible = true;
			this.winningsText.visible = false;
		}
	}

	showWinnings()
	{
		let session = this.scene.serverManager.gameSession;

		let val = {value: 0}
		this.scene.tweens.add
		({
			targets: val,
			value: session.prize,
			duration: 1000 / this.speed,
			ease: 'Linear',
			onUpdate: () =>
			{

				this.winningsText.text = "$" + `${val.value.toFixed(2)}`;
    		}
		})
	}

	playAnim()
	{
		switch("ScaleIn")
		{
			case "ScaleIn":
			this.scaleIn();
			break;
			default:
			this.scaleIn();
			break
		}
	}

	scaleIn()
	{
		this.animContainer.x = 0;
		this.animContainer.y = 0;
		this.animContainer.scaleX = 0;
		this.animContainer.scaleY = 0;
		this.animContainer.alpha = 1;



		this.scene.tweens.add
		({
			targets: this.animContainer,
			scaleX: 1,
			scaleY: 1,
			duration: 500 / this.speed,
			ease: "Back.out",
			onComplete: () => 
			{
				this.showWinnings();
			}
		})

		this.scene.tweens.add
		({
			targets: this.animContainer,
			scaleX: 0,
			scaleY: 0,
			duration: 500 / this.speed,
			delay: 2500 / this.speed,
			ease: "Back.in",			
			onComplete: () => 
			{

			}
		})



	}



	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
