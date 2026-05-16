
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
		this.syncPullTabIconsLayoutFromRegistry();
		/* END-USER-CTR-CODE */
	}

	/** @type {Phaser.GameObjects.Rectangle} */
	cross;
	/** @type {Phaser.GameObjects.Container} */
	iconContainer;

	/* START-USER-CODE */
	isWin = false;

	iconRowY = 50;
	offset = 60;
	padding = 130;

	_defaultPullTabIconsLayout()
	{
		return { iconSpacing: 130, iconOffsetX: 60, iconRowY: 50, crossY: 50 };
	}

	syncPullTabIconsLayoutFromRegistry()
	{
		const layout = {
			...this._defaultPullTabIconsLayout(),
			...(this.scene.registry.get('pullTabIconsLayout') || {}),
		};
		const spacing = Number(layout.iconSpacing);
		const offset = Number(layout.iconOffsetX);
		const rowY = Number(layout.iconRowY);
		const crossYRaw = Number(layout.crossY);

		this.padding = Number.isFinite(spacing) ? spacing : this.padding;
		this.offset = Number.isFinite(offset) ? offset : this.offset;
		this.iconRowY = Number.isFinite(rowY) ? rowY : this.iconRowY;
		const crossY = Number.isFinite(crossYRaw) ? crossYRaw : this.iconRowY;
		if (this.cross)
		{
			this.cross.y = crossY;
		}
	}

	_iconFrameName(raw)
	{
		if (typeof raw === 'number' && Number.isFinite(raw)) return `${raw}.png`;
		const s = String(raw);
		return /^\d+$/.test(s) ? `${s}.png` : s;
	}

	_primaryIconsTextureKey()
	{
		if (this.scene.textures.exists("icons")) return "icons";
		return "DI_Icons_Default";
	}

	// Write your code here.
	init(icons)
	{
		this.syncPullTabIconsLayoutFromRegistry();
		if(icons === undefined) return;
		this.cross.width = 0;

		const texKey = this._primaryIconsTextureKey();

		if(this.iconContainer.list.length == 0)
		{
			for (let i = 0; i < icons.length; i++)
			{
				const icon = this.scene.add.sprite(0, 0, texKey);
				icon.setOrigin(0.5, 0.5);
				this.iconContainer.add(icon);

				icon.x = i * this.padding + this.offset;
				icon.y = this.iconRowY;

				icon.setTexture(texKey, this._iconFrameName(icons[i]));
			}
		}
		else
		{
			for (let i = 0; i < icons.length; i++)
			{
				const icon = this.iconContainer.list[i];
				icon.setTexture(texKey, this._iconFrameName(icons[i]));
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
