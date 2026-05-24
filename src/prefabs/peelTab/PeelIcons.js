
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
import {
	extractOrderedIconsFrameNamesFromTexture,
	fitPullTabIconSpriteToMaxSize,
	getPullTabIconsFrameNames,
	resolvePullTabIconMaxDisplaySize,
	tierIndexToIconsFrameName,
} from '../../utils/theme/PullTabIconsAtlasUtils.js';
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
		return {
			iconLayout: 'even',
			iconSpacing: 130,
			iconOffsetX: 60,
			iconRowY: 50,
			crossY: 50,
			iconStripInsetPercent: 0.06,
		};
	}

	/**
	 * Peel row `back` image width (parent {@link Peel}).
	 * @returns {number}
	 */
	_getPeelStripWidth() {
		const peel = /** @type {{ back?: Phaser.GameObjects.Image }} */ (this.parent);
		const w = peel?.back?.displayWidth ?? 0;
		return Number.isFinite(w) && w > 0 ? w : 0;
	}

	/**
	 * Place row icons: `even` spreads across strip width; `fixed` uses iconSpacing/iconOffsetX.
	 *
	 * @param {Phaser.GameObjects.Sprite[]} icons
	 */
	_layoutIconPositions(icons) {
		const layout = {
			...this._defaultPullTabIconsLayout(),
			...(this.scene.registry.get('pullTabIconsLayout') || {}),
		};
		const mode = String(layout.iconLayout ?? 'even').toLowerCase();
		const n = icons?.length ?? 0;
		if (n === 0) {
			return;
		}

		const stripW = this._getPeelStripWidth();
		const useEven = mode !== 'fixed' && stripW > 0;

		if (useEven) {
			const insetPctRaw = Number(layout.iconStripInsetPercent);
			const insetPxRaw = Number(layout.iconStripInsetPx);
			const inset =
				Number.isFinite(insetPxRaw) && insetPxRaw >= 0
					? insetPxRaw
					: stripW *
						(Number.isFinite(insetPctRaw) && insetPctRaw >= 0 ? insetPctRaw : 0.06);
			const usable = Math.max(0, stripW - inset * 2);
			const step = n > 1 ? usable / (n - 1) : 0;
			for (let i = 0; i < n; i++) {
				icons[i].x = inset + i * step;
				icons[i].y = this.iconRowY;
			}
			if (this.cross) {
				this.cross.width = stripW;
			}
			return;
		}

		for (let i = 0; i < n; i++) {
			icons[i].x = i * this.padding + this.offset;
			icons[i].y = this.iconRowY;
		}
		if (this.cross && stripW > 0) {
			this.cross.width = stripW;
		}
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
		const names = getPullTabIconsFrameNames(this.scene);
		const slot =
			typeof raw === 'number' && Number.isFinite(raw)
				? Math.max(0, Math.floor(raw))
				: parseInt(String(raw), 10);
		if (Number.isFinite(slot)) {
			return tierIndexToIconsFrameName(names, slot);
		}
		const s = String(raw);
		return /^\d+\.png$/i.test(s) ? s : `${s}.png`;
	}

	_applyIconDisplaySize(icon)
	{
		this.scene.tweens.killTweensOf(icon);
		const layout = {
			...this._defaultPullTabIconsLayout(),
			...(this.scene.registry.get('pullTabIconsLayout') || {}),
		};
		const stripW = this._getPeelStripWidth();
		const iconCount = Math.max(1, this.iconContainer?.list?.length ?? 3);
		let sizingLayout = layout;
		if (String(layout.iconLayout ?? 'even').toLowerCase() !== 'fixed' && stripW > 0) {
			sizingLayout = { ...layout, iconSpacing: stripW / iconCount };
		}
		const { maxW, maxH, scaleMultiplier } = resolvePullTabIconMaxDisplaySize(
			this.scene,
			sizingLayout,
			icon,
		);
		fitPullTabIconSpriteToMaxSize(icon, maxW, maxH, scaleMultiplier);
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

				icon.setTexture(texKey, this._iconFrameName(icons[i]));
				this._applyIconDisplaySize(icon);
			}
			this._layoutIconPositions(this.iconContainer.list);
		}
		else
		{
			for (let i = 0; i < icons.length; i++)
			{
				const icon = this.iconContainer.list[i];
				icon.setTexture(texKey, this._iconFrameName(icons[i]));
				this._applyIconDisplaySize(icon);
			}
			this._layoutIconPositions(this.iconContainer.list);
		}

		const tex = this.scene.textures.get(texKey);
		const ordered = extractOrderedIconsFrameNamesFromTexture(tex);
		if (ordered.length > 0) {
			this.scene.registry.set('pullTabIconsFrameNames', ordered);
		}

		this.isWin = this.iconContainer.list.every(i => i.frame.name === this.iconContainer.list[0].frame.name);

	}

	showWin()
	{
		if(!this.isWin) return;
		const crossW = this._getPeelStripWidth() || this.cross?.width || 384;
		this.scene.tweens.killTweensOf(this.cross);
		this.scene.tweens.add
		({
			targets: this.cross,
			width: crossW,
			delay: 500,
			duration: 500,
			ease: "Sine.Out",
		})
		const pulse = 1.12;
		for (let i = 0; i < 3; i++) 
		{
			const icon = this.iconContainer.list[i];
			if (!icon) {
				continue;
			}
			this.scene.tweens.killTweensOf(icon);
			const stored = icon.getData('pullTabIconBaseScale');
			const baseScale =
				typeof stored === 'number' && stored > 0 ? stored : icon.scaleX;
			icon.setScale(baseScale);
			const peakScale = baseScale * pulse;
			this.scene.tweens.add
				({
					targets: icon,
					scaleX: peakScale,
					scaleY: peakScale,
					delay: 500 + i * 100,
					duration: 250,
					ease: "Sine.Out",
					yoyo: true,
					onStop: () => {
						icon.setScale(baseScale);
					},
					onComplete: () => {
						icon.setScale(baseScale);
					},
				})
		}

	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
