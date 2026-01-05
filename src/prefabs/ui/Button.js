
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class Button extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		// animContainer
		const animContainer = scene.add.container(0, 0);
		this.add(animContainer);

		this.animContainer = animContainer;

		/* START-USER-CTR-CODE */
		// Write your code here.

		scene.time.delayedCall(0, () => this.onStart());
		/* END-USER-CTR-CODE */
	}

	/** @type {Phaser.GameObjects.Container} */
	animContainer;
	/** @type {boolean} */
	enableOverAnim = true;
	/** @type {boolean} */
	enablePressAnim = true;

	/* START-USER-CODE */
	pointerDownTween;
	pointerUpTween;
	pointerOverTween;
	enabledTween;

	buttonTimeOut = 200;
	timeOut = false

	enabled;

	// Write your code here.
	onStart()
	{

		const size = this.getLocalBound();
		this.setInteractive(new Phaser.Geom.Rectangle(-size.width/2, -size.height/2, size.width, size.height), Phaser.Geom.Rectangle.Contains);

		this.on("pointerdown", () => this.onPointerDown(), this);
		this.on("pointerup", () => this.onPointerUp(), this);
		this.on("pointerover", () => this.onPointerOver(), this);
		this.setEnabled(false);
	}

	getLocalBound()
	{
		let scaleX = this.scaleX;
		let scaleY = this.scaleY;

		let parent = this.parentContainer;
		while (parent) {
			scaleX *= parent.scaleX;
			scaleY *= parent.scaleY;
			parent = parent.parentContainer;
		}

		// Get world bounds
		const bounds = this.getBounds();

		// Convert to local size
		return {
			width: bounds.width / scaleX,
			height: bounds.height / scaleY
		};		
	}


	onPointerDown()
	{
		if(!this.enabled) return;
		if(this.timeOut) return;
		if(!this.enablePressAnim) return;

		if(this.pointerDownTween !== undefined) {this.pointerDownTween.complete();}

		this.animContainer.scaleX = 1
		this.animContainer.scaleY = 1

		this.pointerDownTween = this.scene.add.tween
		({
			targets: this.animContainer,
			scaleX: 0.8,
			scaleY: 0.8,
			duration: 150,
			ease: "Back.easeIn",
			yoyo: true
		})


	}

	onPointerUp()
	{
		if(!this.enabled) return;
		if(this.timeOut) return;
		this.timeOut = true;
		this.scene.time.delayedCall(this.buttonTimeOut, ()=> this.timeOut = false, this);
		this.execute();
	}

	onPointerOver()
	{
		if(!this.enabled) return;
		if(this.timeOut) return;
		if(!this.enableOverAnim) return;

		if(this.pointerOverTween !== undefined) {this.pointerOverTween.complete();}
		this.animContainer.y = 0;

		this.pointerOverTween = this.scene.add.tween
		({
			targets: this.animContainer,
			y: -10,
			duration: 50,
			ease: "Linear",
			yoyo: true
		})
	}

	setEnabled(value)
	{
		if(this.enabled == value) return;
		this.enabled = value;

		if(this.enabledTween !== undefined) {this.enabledTween.complete();}
		if(this.pointerOverTween !== undefined) {this.pointerOverTween.complete();}
		if(this.pointerDownTween !== undefined) {this.pointerDownTween.complete();}

		if(!this.enabled)
		{
			this.animContainer.scaleX = 1
			this.animContainer.scaleY = 1
			this.animContainer.alpha = 1;

			this.enabledTween = this.scene.tweens.add
			({
				targets: this.animContainer,
				scaleX: 0.9,
				scaleY: 0.9,
				alpha: 0.75,
				duration: 150,				
			})
		}
		else
		{
			this.animContainer.scaleX = 0.9
			this.animContainer.scaleY = 0.9
			this.animContainer.alpha = 0.75;

			this.enabledTween = this.scene.tweens.add
			({
				targets: this.animContainer,
				scaleX: 1,
				scaleY: 1,
				alpha: 1,
				duration: 150,				
			})
		}
	}

	execute()
	{

	}



	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
