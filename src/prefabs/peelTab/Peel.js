// You can write more code here

/* START OF COMPILED CODE */

import PeelIcons from "./PeelIcons.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class Peel extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		// back
		const back = scene.add.image(0, 0, "DI_PeelBack_Default");
		back.setInteractive(new Phaser.Geom.Rectangle(0, 0, 300, 100), Phaser.Geom.Rectangle.Contains);
		back.setOrigin(0, 0);
		this.add(back);

		// peelIcons
		const peelIcons = new PeelIcons(scene, 0, 0);
		this.add(peelIcons);

		// front
		const front = scene.add.image(0, 0, "DI_Peel_Default");
		front.setOrigin(0, 0);
		this.add(front);

		// peel
		const peel = scene.add.image(0, 0, "DI_Peel_Default");
		peel.setOrigin(1, 0);
		peel.flipX = true;
		peel.tintTopLeft = 14474460;
		peel.tintTopRight = 14474460;
		peel.tintBottomLeft = 10461087;
		peel.tintBottomRight = 10461087;
		this.add(peel);

		// peelMask
		const peelMask = scene.add.image(0, 0, "DI_Peel_Default");
		peelMask.setOrigin(1, 0);
		peelMask.flipX = true;
		peelMask.tintTopLeft = 10197915;
		peelMask.tintTopRight = 10197915;
		peelMask.tintBottomLeft = 10197915;
		peelMask.tintBottomRight = 10197915;
		this.add(peelMask);

		// shade
		const shade = scene.add.image(0, 0, "alpha_mask");
		shade.scaleX = 15;
		shade.setOrigin(0.5, 0);
		shade.alpha = 0.25;
		shade.alphaTopLeft = 0.25;
		shade.alphaTopRight = 0.25;
		shade.alphaBottomLeft = 0.25;
		shade.alphaBottomRight = 0.25;
		this.add(shade);

		// maskZone
		const maskZone = scene.add.rectangle(0, 0, 1000, 1000);
		maskZone.setOrigin(0.5, 0);
		maskZone.alpha = 0.2;
		maskZone.isFilled = true;
		this.add(maskZone);

		this.back = back;
		this.peelIcons = peelIcons;
		this.front = front;
		this.peel = peel;
		this.peelMask = peelMask;
		this.shade = shade;
		this.maskZone = maskZone;

		/* START-USER-CTR-CODE */
		// Write your code here.
		//this.scene.events.on("scene-awake", ()=> this.init(), this);
		this.scene.events.on("update", this.update, this);

		back.on("pointerdown", ()=> this.startPeel(), this)
		this.scene.input.on("pointerup", ()=> this.endPeel(), this)

		/* END-USER-CTR-CODE */
	}

	/** @type {Phaser.GameObjects.Image} */
	back;
	/** @type {PeelIcons} */
	peelIcons;
	/** @type {Phaser.GameObjects.Image} */
	front;
	/** @type {Phaser.GameObjects.Image} */
	peel;
	/** @type {Phaser.GameObjects.Image} */
	peelMask;
	/** @type {Phaser.GameObjects.Image} */
	shade;
	/** @type {Phaser.GameObjects.Rectangle} */
	maskZone;

	/* START-USER-CODE */
	pullpoint;
	cursorPoint
	enabled = false;
	peeling = false;
	peeled = false;

	cursorPos = new Phaser.Math.Vector2()
	pullPos = new Phaser.Math.Vector2()

	// Write your code here.
	init(values)
	{
		const pullpoint = this.scene.add.container(this.maskZone.x, this.maskZone.y);
		pullpoint.rotation = this.maskZone.rotation;
		this.add(pullpoint);
		this.pullpoint = pullpoint;

		const cursorPoint = this.scene.add.container(0, 0);
		this.add(cursorPoint);
		this.cursorPoint = cursorPoint;

		this.remove(this.maskZone)
		let innerMask = this.maskZone.createGeometryMask();
		let outerMask = this.maskZone.createGeometryMask();

		this.remove(this.peelMask);
		let peelMask = this.maskZone.createBitmapMask(this.peelMask);		

		this.peelMask.setVisible(false);
		this.maskZone.setVisible(false);
		this.shade.setVisible(false);
		this.peel.setVisible(false);
		innerMask.invertAlpha = true;
		peelMask.invertAlpha = false;

		this.shade.setMask(peelMask)
		this.front.setMask(outerMask);
		this.peel.setMask(outerMask);

		let transform = pullpoint.getWorldTransformMatrix();

		this.maskZone.setPosition(transform.tx, transform.ty);
		this.maskZone.setScale(transform.scaleX, transform.scaleY);
		this.maskZone.rotation = (transform.rotation);

		transform = this.peel.getWorldTransformMatrix();

		this.peelMask.setPosition(transform.tx, transform.ty);
		this.peelMask.setScale(transform.scaleX, transform.scaleY);			
		this.peelMask.rotation = (transform.rotation);

		this.peelIcons.init(values);

		this.scene.textures.exists("Peel")
		{
			this.front.setTexture("Peel")
			this.peel.setTexture("Peel")
		}

		this.scene.textures.exists("PeelBack")
		{
			this.back.setTexture("PeelBack")
		}
	}

	update(time, delta)
	{
		if(this.pullpoint === undefined) return;

		if(this.peeling && !this.peeled)
		{
			const pointer = this.scene.input.activePointer;
			let out = new Phaser.Math.Vector2();
			this.peel.parentContainer.getLocalPoint(pointer.worldX, pointer.worldY, out);

			let theta = Math.atan2(this.peel.y, this.peel.x) * 180 / Math.PI;
			let deg = -(90 - theta) * 2

			out.x = Phaser.Math.Clamp(out.x, 100, 10000);
			out.y = Phaser.Math.Clamp(out.y , 0, 200);

			this.cursorPos.x = out.x;
			this.cursorPos.y = out.y;
			this.pullPos.x = (this.cursorPos.x + this.front.x) * 0.5
			this.pullPos.y = (this.cursorPos.y  + this.front.y) * 0.5

			this.peel.angle = deg - 180;
			this.pullpoint.angle = deg * 0.5;
			this.shade.angle = this.pullpoint.angle

			const t = 0.01 * delta;
			this.peel.x = Phaser.Math.Linear(this.peel.x, this.cursorPos.x, t);
			this.peel.y = Phaser.Math.Linear(this.peel.y, this.cursorPos.y, t);

			this.pullpoint.x = Phaser.Math.Linear(this.pullpoint.x, this.pullPos.x, t);
			this.pullpoint.y = Phaser.Math.Linear(this.pullpoint.y, this.pullPos.y, t);
			this.shade.x = this.pullpoint.x;
			this.shade.y = this.pullpoint.y;


			if(out.x > 600)
			{
				this.endPeel();
			}

			this.peel.setVisible(true);
			this.shade.setVisible(true);
		}

		let transform = this.pullpoint.getWorldTransformMatrix();

		this.maskZone.setPosition(transform.tx, transform.ty);
		this.maskZone.setScale(transform.scaleX, transform.scaleY);
		this.maskZone.rotation = (transform.rotation);

		transform = this.peel.getWorldTransformMatrix();

		this.peelMask.setPosition(transform.tx, transform.ty);
		this.peelMask.setScale(transform.scaleX, transform.scaleY);	
		this.peelMask.rotation = (Math.abs(transform.rotation));
	}

	startPeel()
	{
		if(!this.enabled) return;
		if(this.peeled) return;
		this.peeling = true;
	}

	endPeel()
	{
		if(!this.peeling) return;
		if(this.peeled) {this.reset(); return};

		this.peeling = false
		this.peeled = true;



		this.cursorPos.x = 950;
		this.cursorPos.y = 200;
		this.pullPos.x = (this.cursorPos.x + this.front.x) * 0.5
		this.pullPos.y = (this.cursorPos.y  + this.front.y) * 0.5

		let dur = 500;

		this.scene.add.tween
		({
			targets: this.peel,
			x: this.cursorPos.x,
			y: this.cursorPos.y,
			alpha: 0,
			duration: dur,
			ease: "Sine.Out",
			onUpdate: () => 
			{
				let theta = Math.atan2(this.peel.y, this.peel.x) * 180 / Math.PI;
				let deg = -(90 - theta) * 2
				this.peel.angle = deg - 180;
				this.pullpoint.angle = deg * 0.5;
			}
		})

		this.scene.add.tween
		({
			targets: [this.pullpoint,this.shade],
			x: this.pullPos.x,
			y: this.pullPos.y,
			alpha: 0,
			duration: dur,
			ease: "Sine.Out"
		})

		this.peel.visible = true;
		this.enabled = false;
		this.emit("peeled");
		this.peelIcons.showWin();

	}

	reset()
	{
		this.peel.alpha = 1;
		this.peel.x = 0;
		this.peel.y = 0;
		this.peel.angle = 0;
		this.peel.visible = false;

		this.shade.alpha = 0.25;
		this.shade.visible = false;

		this.pullpoint.x = 0;
		this.pullpoint.y = 0;
		this.pullpoint.angle = 0;

		this.maskZone.setPosition(0, 0);
		this.maskZone.rotation = (0);	

		this.peeled = false;
		this.peeling = false;
	}

	autoPeel()
	{
		if(this.peeled) return;
		this.peel.setPosition(100,50);
		this.peel.angle = 50;

		this.pullpoint.setPosition(50,50);
		this.pullpoint.angle = -50;

		this.startPeel();
		this.scene.time.delayedCall(0, ()=> this.endPeel(),this);
	}

	getSize()
	{
		let size = new Phaser.Math.Vector2();
		size.x = this.peel.displayWidth;
		size.y = this.peel.displayHeight;
		return size;
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
