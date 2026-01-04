
// You can write more code here

/* START OF COMPILED CODE */

import ScriptNode from "../../../phaserjs_editor_scripts_base/ScriptNode.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class setThemeColor extends ScriptNode {

	constructor(parent) {
		super(parent);

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @type {"button"} */
	property = "button";
	/** @type {boolean} */
	onStart = false;
	/** @type {"Image"|"Text"|"Shape"} */
	objectType = "Image";

	/* START-USER-CODE */
	start()
	{
		if(this.onStart) {this.execute();}
	}

	execute()
	{
		const theme = this.scene.prefab_ScratchManager.themeData;


		let hex = theme.themeColors.buttonColor.replace("#", "").substring(0,6)
		let tint = parseInt(hex, 16);

		if(this.objectType == "Image") this.gameObject.setTint(tint);
		if(this.objectType == "Text") this.gameObject.setTint(tint);
		if(this.objectType == "Shape") this.gameObject.setFillStyle(tint);

		// Apply buttonContentColor to Image and Text children if it exists
		if (theme.themeColors && theme.themeColors.buttonContentColor) {
			// Try to find the container - first try parent, then try to find it in the scene
			let buttonContainer = this.gameObject.parent;

			// If parent is not a Container, try to find the container by searching the scene
			if (!buttonContainer || !(buttonContainer instanceof Phaser.GameObjects.Container)) {
				// Search through scene children recursively to find a container that contains this.gameObject
				const findContainer = (obj) => {
					if (obj instanceof Phaser.GameObjects.Container && obj.list && obj.list.includes(this.gameObject)) {
						return obj;
					}
					// Recursively search children
					if (obj.list) {
						for (let child of obj.list) {
							if (child instanceof Phaser.GameObjects.Container) {
								const found = findContainer(child);
								if (found) return found;
							}
						}
					}
					return null;
				};

				// Search all top-level containers in the scene
				for (let child of this.scene.children.list) {
					if (child instanceof Phaser.GameObjects.Container) {
						const found = findContainer(child);
						if (found) {
							buttonContainer = found;
							break;
						}
					}
				}
			}

			// Validate that parent is a Container
			if (buttonContainer && buttonContainer instanceof Phaser.GameObjects.Container) {
				// Check if this is the balance container - skip applying buttonContentColor to balance text
				const isBalanceContainer = this.scene.balanceContainer === buttonContainer ||
					(buttonContainer.list && buttonContainer.list.some(child => 
						child instanceof Phaser.GameObjects.Text && 
						child.text && 
						child.text.includes("Balance:")
					));

				// Only apply buttonContentColor if this is NOT the balance container
				if (!isBalanceContainer) {
					const contentColorHex = theme.themeColors.buttonContentColor.replace("#", "");
					const contentColorHex6 = contentColorHex.substring(0, 6);
					const contentColorTint = parseInt(contentColorHex6, 16);
					const contentColorHexString = `#${contentColorHex6}`;

					// Iterate through all children of the button container
					if (buttonContainer.list && buttonContainer.list.length > 0) {
						for (let i = 0; i < buttonContainer.list.length; i++) {
							const child = buttonContainer.list[i];

							// Skip the button backing itself (this.gameObject) - it already has buttonColor applied
							if (child === this.gameObject) {
								continue;
							}

							// Apply tint to Image children
							if (child instanceof Phaser.GameObjects.Image) {
								// Use setTintFill to replace the image color completely (for white images)
								child.setTintFill(contentColorTint);
							}
							// Update color style for Text children (preserving other styles)
							else if (child instanceof Phaser.GameObjects.Text) {
								// setStyle merges with existing styles, so other properties are preserved
								child.setStyle({
									color: contentColorHexString
								});
							}
						}
					}
				}
			}
		}
	}



	// Write your code here.

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
