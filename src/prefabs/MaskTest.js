
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class MaskTest extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x ?? -58, y ?? -8);

		// dino
		const dino = scene.add.image(0, 6, "dino");
		this.add(dino);

		// guapen
		const guapen = scene.add.image(116, -2, "guapen");
		this.add(guapen);

		this.dino = dino;
		this.guapen = guapen;

		/* START-USER-CTR-CODE */
		// Write your code here.
		this.scene.events.on("scene-awake", ()=> this.init(), this);
		/* END-USER-CTR-CODE */
	}

	/** @type {Phaser.GameObjects.Image} */
	dino;
	/** @type {Phaser.GameObjects.Image} */
	guapen;

	/* START-USER-CODE */

	// Write your code here.
	init()
	{
		const container_2 = this.scene.add.container(this.guapen.x, this.guapen.y);
		this.add(container_2);

		this.remove(this.guapen)
		let mask = this.guapen.createBitmapMask();


		//this.guapen.setVisible(false);
		mask.invertAlpha = true;

		this.dino.setMask(mask);

		let transform = container_2.getWorldTransformMatrix();

		this.guapen.setPosition(transform.tx, transform.ty);
		this.guapen.setScale(transform.scaleX, transform.scaleY);
		this.guapen.rotation =(transform.rotation);
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
