
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class PopUpMenu extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		/* START-USER-CTR-CODE */
		// Write your code here.
		scene.input.on('pointerdown', (pointer, currentlyOver) =>
		{
			// If this menu is visible and you didn't click on it
			if (this.visible && !this.getBounds().contains(pointer.x, pointer.y)) {
				this.close();
			}
		});
		/* END-USER-CTR-CODE */
	}

	/* START-USER-CODE */
	isOpen = false
	opening = false;

	// Write your code here.
	open()
	{
		if(this.isOpen || this.opening) return

		this.setScale(0,0);
		this.setVisible(true);
		this.opening = true;
		this.scene.tweens.add
		({
			targets: this,
			scaleX: 1,
			scaleY: 1,
			duration: 250,
			ease: "Back.out",
			onComplete: () =>
			{
				this.opening = false
				this.isOpen = true;
			}
			
		})
	}

	close()
	{
		if(!this.isOpen || this.opening) return

		this.setScale(1,1);
		this.setVisible(true);
		this.opening = true;
		this.scene.tweens.add
		({
			targets: this,
			scaleX: 0,
			scaleY: 0,
			duration: 250,
			ease: "Back.in",
			onComplete: () =>
			{
				this.opening = false
				this.isOpen = false;
				this.setVisible(false);
			}
			
		})
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
