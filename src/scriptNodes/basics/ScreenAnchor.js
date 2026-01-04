
// You can write more code here

/* START OF COMPILED CODE */

import ScriptNode from "../../../phaserjs_editor_scripts_base/ScriptNode.js";
/* START-USER-IMPORTS */
import ViewportHelper from "../../utils/ui/ViewportHelper.js";
/* END-USER-IMPORTS */

export default class ScreenAnchor extends ScriptNode {

	constructor(parent) {
		super(parent);

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @type {number} */
	referenceScreenWidth = 1080;
	/** @type {number} */
	referenceScreenHeight = 1920;
	/** @type {boolean} */
	position = true;
	/** @type {boolean} */
	scale = true;
	/** @type {boolean} */
	stretchX = false;
	/** @type {boolean} */
	stretchY = false;
	/** @type {number} */
	widthPos = 0;
	/** @type {number} */
	heightPos = 0;
	/** @type {number} */
	match = 1;
	/** @type {boolean} */
	debug = false;
	/** @type {number} */
	maxScale = 999;
	/** @type {number} */
	minScale = 0.01;

	/* START-USER-CODE */
	refWidth = 0
	refHeight = 0
	matchWidth = 0;
	matchHeight = 0
	startSizeX = 0;
	startSizeY = 0;

	bodyRadius = 0;

	currentScreenWidth = 0;
	currentScreenHeight = 0;


	// Write your code here.
	awake()
	{
		this.refWidth = this.referenceScreenWidth; 
		this.refHeight = this.referenceScreenHeight;

		this.matchWidth = 1 - this.match;
		this.matchHeight = this.match

		this.widthPos = this.gameObject.x / this.refWidth
		this.heightPos = this.gameObject.y / this.refHeight

		// Debug: Log if this is rectangle_3 or gameBar
		if(this.gameObject.name === 'rectangle_3' || (this.gameObject.parent && this.gameObject.parent.name === 'gameBar')) {
			console.log('[ScreenAnchor.awake] Initializing:', {
				element: this.gameObject.name || 'unnamed',
				originalX: this.gameObject.x,
				originalY: this.gameObject.y,
				refWidth: this.refWidth,
				refHeight: this.refHeight,
				widthPos: this.widthPos,
				heightPos: this.heightPos,
				position: this.position,
				scale: this.scale
			});
		}

		this.startSizeX = this.gameObject.width;
		this.startSizeY = this.gameObject.height;

		if(this.gameObject.body)
		{
			this.bodyRadius = this.gameObject.body.radius;
			console.log(this.bodyRadius);
		}

		// Only set up event listeners if position or scale is enabled
		// This prevents unnecessary event listeners when ScreenAnchor is disabled
		if(this.position || this.scale)
		{
			// Listen to window resize events
			window.addEventListener('resize', () =>
			{
				// Check position/scale flags before calling onChangeScreen
				// This allows disabling after awake() has run
				if(this.position || this.scale) {
					this.onChangeScreen();
				}
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
		}

		// Only call onChangeScreen if position or scale is enabled
		if(this.position || this.scale) {
			this.onChangeScreen();
		}
	}

	onChangeScreen()
	{
		if(this.currentScreenWidth == this.scene.scale.width && this.currentScreenHeight == this.scene.scale.height) { return;}

		this.currentScreenWidth = this.scene.scale.width;
		this.currentScreenHeight = this.scene.scale.height;

		if(this.position)
		{
			// Only position if position is enabled
			this.gameObject.x = this.scene.scale.width * this.widthPos;

			// Calculate base Y position
			let yPosition = this.scene.scale.height * this.heightPos;

			// Apply bottom safe area offset for elements positioned at bottom of screen
			// heightPos >= 0.90 indicates bottom 10% of screen (bottom-anchored elements)
			// This catches buttonContainer (heightPos = 1.0) and leftCornerAnchor (heightPos = 1.0)
			if(this.heightPos >= 0.90)
			{
				const bottomOffset = ViewportHelper.getBottomSafeAreaInset();
				// Subtract offset to move element up, preventing overlap with browser UI
				// The offset is in browser pixels, same as scene.scale.height (visual viewport height)
				yPosition -= bottomOffset;
			}

			this.gameObject.y = yPosition;

			// Debug: Log if this is rectangle_3 or gameBar being positioned
			if(this.gameObject.name === 'rectangle_3' || (this.gameObject.parent && this.gameObject.parent.name === 'gameBar')) {
				console.log('[ScreenAnchor.onChangeScreen] Positioning element:', {
					element: this.gameObject.name || 'unnamed',
					position: this.position,
					heightPos: this.heightPos,
					yPosition,
					gameObjectY: this.gameObject.y,
					scaleHeight: this.scene.scale.height
				});
			}
		}


		if(this.scale)
		{
			let scaleX = this.scene.scale.width / this.refWidth;
			let scaleY = this.scene.scale.height / this.refHeight;
			scaleX = Phaser.Math.Clamp(scaleX, this.minScale, this.maxScale);
			scaleY = Phaser.Math.Clamp(scaleY, this.minScale, this.maxScale);

			let s = (scaleX * this.matchWidth ) + (scaleY * this.matchHeight);
			//s = Phaser.Math.Clamp(s,0,this.maxScale)


			if(this.stretchX || this.stretchY)
			{
				if(this.stretchX) this.gameObject.width = this.startSizeX * (this.scene.scale.width / this.refWidth);
				else this.gameObject.scaleX = s;
				if(this.stretchY) this.gameObject.height = this.startSizeY * (this.scene.scale.height / this.refHeight);
				else this.gameObject.scaleY = s;
			}
			else
			{
				this.gameObject.scaleX = s
				this.gameObject.scaleY = s

				if(this.gameObject.body)
				{
					let size = this.bodyRadius * s;

					this.gameObject.body.setCircle(size, -size, -size);
				}
			}

		}

		if(this.debug){console.log(this.name, "Position: ", this.gameObject.x, this.gameObject.y)}
		if(this.debug){console.log(this.name, "Scale: ",this.gameObject.scaleX, this.gameObject.scaleY)}
		// Removed debug log for width/height to reduce console noise
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
