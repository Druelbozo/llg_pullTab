
// You can write more code here

/* START OF COMPILED CODE */

import ScriptNode from "../../../phaserjs_editor_scripts_base/ScriptNode.js";
/* START-USER-IMPORTS */
import ViewportHelper from "../../utils/ui/ViewportHelper.js";
/* END-USER-IMPORTS */

export default class ScreenFit extends ScriptNode {

	constructor(parent) {
		super(parent);

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @type {number} */
	xPadding = 0;
	/** @type {number} */
	yPadding = 0;
	/** @type {boolean} */
	overrideSize = false;
	/** @type {number} */
	overrideX = 0;
	/** @type {number} */
	overrideY = 0;

	/* START-USER-CODE */
	refWidth = 0;
	refHeight = 0;
	currentScreenWidth = 0;
	currentScreenHeight = 0;

	// Write your code here.

	awake()
	{

			const size = this.getLocalBound();

			this.refHeight = size.height;
			this.refWidth = size.width;

			if(this.overrideSize)
			{
				this.refWidth = this.overrideX
				this.refHeight = this.overrideY
			}

			//this.currentScreenWidth = this.scene.scale.width;
			//this.currentScreenHeight = this.scene.scale.height;

			// Listen to window resize events
			window.addEventListener('resize', () =>
			{
				// Check position/scale flags before calling onChangeScreen
				// This allows disabling after awake() has run

				this.onChangeScreen();

			});

			// Listen to visualViewport events (catches Safari iOS bottom bar changes)
			if (window.visualViewport) {
				window.visualViewport.addEventListener('resize', () => {
					if(this.position || this.scale) {
						this.onChangeScreen();
					}
				});
				window.visualViewport.addEventListener('scroll', () => {
					if(this.position || this.scale) {
						this.onChangeScreen();
					}
				});
			}	

			this.onChangeScreen()	
	}

	getLocalBound()
	{
		let scaleX = this.gameObject.scaleX;
		let scaleY = this.gameObject.scaleY;

		let parent = this.parentContainer;
		while (parent) {
			scaleX *= parent.scaleX;
			scaleY *= parent.scaleY;
			parent = parent.parentContainer;
		}

		// Get world bounds
		const bounds = this.gameObject.getBounds();

		// Convert to local size
		return {
			width: bounds.width / scaleX,
			height: bounds.height / scaleY
		};		
	}

	onChangeScreen()
	{
		if(this.currentScreenWidth == this.scene.scale.width && this.currentScreenHeight == this.scene.scale.height) { return;}

		this.currentScreenWidth = this.scene.scale.width - this.xPadding;
		this.currentScreenHeight = this.scene.scale.height - this.yPadding;

		let x = this.currentScreenWidth / this.refWidth;
		let y = this.currentScreenHeight / this.refHeight;

		let size = x <= y ? x : y;

		console.log(y , x);
		this.gameObject.scaleX = size;
		this.gameObject.scaleY = size;

	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
