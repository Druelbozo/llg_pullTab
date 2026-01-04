
// You can write more code here

/* START OF COMPILED CODE */

import Text from "../ui/Text.js";
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class AccountBalanceDisplay extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		// title
		const title = new Text(scene, 0, -30);
		this.add(title);

		// balance
		const balance = new Text(scene, 0, 30);
		this.add(balance);

		// title (prefab fields)
		title.textValue = "Balance:";
		title.textSize = 40;
		title.color = "#ffb220ff";
		title.textType = "DOM";

		// balance (prefab fields)
		balance.textValue = "$0.00";
		balance.textSize = 40;
		balance.textType = "DOM";

		this.title = title;
		this.balance = balance;

		/* START-USER-CTR-CODE */
		// Write your code here.
		this.scene.events.on("server-awake", this.onBalanceUpdate, this)
		/* END-USER-CTR-CODE */
	}

	/** @type {Text} */
	title;
	/** @type {Text} */
	balance;

	/* START-USER-CODE */

	// Write your code here.
	onBalanceUpdate()
	{
		const balance = this.scene.serverManager.balance

		let val = {value: 0}
		this.scene.tweens.add
		({
			targets: val,
			value: balance,
			duration: 1000,
			ease: 'Linear',
			onUpdate: () =>
			{

				this.balance.text = "$" + `${val.value.toFixed(2)}`;
    		}
		})
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
