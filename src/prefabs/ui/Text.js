
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class Text extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		// regularText
		const regularText = scene.add.text(0, 0, "", {});
		regularText.setOrigin(0.5, 0.5);
		regularText.text = "Text";
		regularText.setStyle({ "color": "#ffffffff", "fontFamily": "Lato-Regular", "fontSize": "25px", "fontStyle": "bold", "stroke": "#000000ff", "shadow.offsetY": 4, "shadow.stroke": true });
		this.add(regularText);

		this.regularText = regularText;

		/* START-USER-CTR-CODE */
		// Write your code here.
		this.scene.events.once("scene-awake",() => {this.init()}, this);
        scene.events.on('update', this.update, this);
		/* END-USER-CTR-CODE */
	}

	/** @type {Phaser.GameObjects.Text} */
	regularText;
	/** @type {string} */
	textValue = "";
	/** @type {number} */
	textSize = 24;
	/** @type {string} */
	font = "Lato-Bold";
	/** @type {"center"|"left"|"right"} */
	alignment = "center";
	/** @type {string} */
	color = "#ffffffff";
	/** @type {boolean} */
	debug = false;
	/** @type {"regular"|"DOM"} */
	textType = "regular";

	/* START-USER-CODE */
	/** @type {Phaser.GameObjects.GameObjectFactory.dom} */
	domText;
	visable;

	/** @type {string} */

	get text()
	{
		return this.textValue;
	}

	set text(value)
	{
		this.textValue = value;

		this.clear();
		this.init();
	}	

	// Write your code here.
	init()
	{
		switch(this.textType)
		{
			case "regular":
				this.initalizeRegularText()
			break;

			case "DOM":
				this.initalizeDOMText();
			break;
		}


	}

	initalizeRegularText()
	{

		this.regularText.visible = (true);
		this.regularText.text = this.textValue;
	}

	initalizeDOMText()
	{

		if(this.debug) console.log(this.domText);
		this.regularText.visible = (false);
		if(this.domText !== undefined) {return;}

		this.domText = this.scene.add.dom(400, 300, 'div',
		{
			fontFamily: this.font,
			fontSize: this.textSize + 'px',
    		fontWeight: '700',  
			color: this.color,


			display: 'flex',           
			justifyContent: this.alignment,  
			alignItems: this.alignment, 
			textAlign: this.alignment,

			userSelect: 'none',            
			WebkitUserSelect: 'none',      
			MozUserSelect: 'none',          
			msUserSelect: 'none',           
			pointerEvents: 'none'
		} 
		, this.textValue);
		this.add(this.domText);

		switch(this.alignment)
		{
			case "center":
			this.domText.setOrigin(0.5, 0.5);
			break;
			case "left":
			this.domText.setOrigin(0, 0.5);
			break;
			case "right":
			this.domText.setOrigin(1, 0.5);
			break;
		}

        this.domText.setPosition(0, 0);
	}

	clear()
	{
		if(!this.domText) {return;}

		this.domText.destroy();
		this.domText = undefined;
	}

	update(time, delta)
	{
		if(this.textType != "DOM") return;
		let isVisible = true;
		let current = this;

		while (current)
		{
			if(!current.visible)
			{
				isVisible = false;
				break;
			}

			current = current.parentContainer;
		}

		if(this.visable != isVisible)
		{
			if(this.debug) console.log("Is Visable", isVisible)
			if(isVisible)
			{
				this.init();
			}
			else if (!isVisible)
			{
				this.clear();
			}
		}
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
