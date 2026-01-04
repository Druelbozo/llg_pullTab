
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class PeelIcons extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		// cross
		const cross = scene.add.rectangle(0, 50, 384, 16);
		cross.setOrigin(0, 0.5);
		cross.isFilled = true;
		cross.fillColor = 13434880;
		this.add(cross);

		// iconContainer
		const iconContainer = scene.add.container(0, 0);
		this.add(iconContainer);

		this.cross = cross;
		this.iconContainer = iconContainer;

		/* START-USER-CTR-CODE */
		// Write your code here.
		this.init();
		/* END-USER-CTR-CODE */
	}

	/** @type {Phaser.GameObjects.Rectangle} */
	cross;
	/** @type {Phaser.GameObjects.Container} */
	iconContainer;

	/* START-USER-CODE */
	isWin = false;

	offset = 60
	padding = 130;

	// Write your code here.
	init(icons)
	{
		if(icons === undefined) return;
		this.cross.width = 0;


		if(this.iconContainer.list.length == 0)
		{
			for (let i = 0; i < icons.length; i++)
			{
				//let rand = Phaser.Math.RND.between(0,8);
				const icon = this.scene.add.sprite(0, 0, "");
				icon.setOrigin(0.5, 0.5);
				this.iconContainer.add(icon);

				icon.x = i * this.padding + this.offset;
				icon.y = 50;

				if(this.scene.textures.exists("Icons"))
				{
					icon.setTexture("Icons", icons[i]);
				}
				else
				{
					icon.setTexture("DI_Icons_Default", icons[i]);
				}
			}
		}
		else
		{
			for (let i = 0; i < icons.length; i++)
			{
				console.log(icons[i], icons)
				let rand = Phaser.Math.RND.between(0,8);
				//rand = 1;
				const icon = this.iconContainer.list[i];

				if(this.scene.textures.exists("Icons"))
				{
					icon.setTexture("Icons", icons[i]);
				}
				else
				{
					icon.setTexture("DI_Icons_Default", icons[i]);
				}
			}			
		}





		this.isWin = this.iconContainer.list.every(i => i.frame.name === this.iconContainer.list[0].frame.name);

	}

	showWin()
	{
		if(!this.isWin) return;
		this.scene.tweens.add
		({
			targets: this.cross,
			width: 384,
			delay: 500,
			duration: 500,
			ease: "Sine.Out",
		})
		for (let i = 0; i < 3; i++) 
		{
			this.scene.tweens.add
				({
					targets: this.iconContainer.list[i],
					scaleX: 1.2,
					scaleY: 1.2,
					delay: 500 + i * 100,
					duration: 250,
					ease: "Sine.Out",
					yoyo: true,
				})
		}

	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
