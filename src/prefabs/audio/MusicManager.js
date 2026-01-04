
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class MusicManager extends Phaser.GameObjects.Container {

	constructor(scene, x, y) {
		super(scene, x ?? 0, y ?? 0);

		/* START-USER-CTR-CODE */
		// Write your code here.
		this.scene.events.on("OnVariableSet", (id, value) => {this.muteEvents(id, value);})


		this.awake()
		/* END-USER-CTR-CODE */
	}

	/** @type {number} */
	masterVolume = 0.5;
	/** @type {number} */
	musicVolume = 0.5;
	/** @type {number} */
	sfxVolume = 0.5;

	/* START-USER-CODE */
	volume = {};
	mute = {};
	music = {};
	sfx = {};

	awake()
	{
		this.volume["master"] = this.masterVolume;
		this.volume["music"] = this.musicVolume;
		this.volume["sfx"] = this.sfxVolume;
		this.mute["master"] = true;		
		this.mute["music"] = true;
		this.mute["sfx"] = true;
	}

	muteEvents(id, value)
	{
		switch(id)
		{
			case "muteAll":
			this.muteVolume("music", value);
			this.muteVolume("sfx", value);
			break;
			case "muteMusic":
			this.muteVolume("music", value);
			break;
			case "muteSFX":
			this.muteVolume("sfx", value);
			break;
		}

		this.scene.events.emit("onVariableChanged", id, value);
	}

	// Write your code here.
	addSound(channel, key)
	{
		const volume = this.volume[channel] * this.volume["master"] * this.mute[channel]; 

		switch(channel)
		{
			case "music":
				if(!this.music[key])
				{
					console.log("Music Manager: Adding " + channel + " : " + key)
					let audio = this.scene.sound.add(key)
					this.music[key] = audio;
					this.music[key].setVolume(volume)
					return this.music[key];
				}
				else
				{
					return this.music[key];
				}
				break;
			case "sfx":

				if(!this.sfx[key])
				{
					console.log("Music Manager: Adding " + channel + " : " + key)
					let audio = this.scene.sound.add(key)
					this.sfx[key] = audio;
					this.sfx[key].setVolume(volume)
					return this.sfx[key];
				}
				else
				{
					return this.sfx[key];
				}			
				break;
		}
	}

	setVolume(channel, value)
	{

		switch(channel)
		{
			case "master":

				this.volume["master"] = value;

				for (let key in this.music)
				{
					this.music[key].setVolume(this.volume["music"] * this.volume["master"] * this.mute[channel])

				}
				for (let key in this.sfx)
				{
					this.music[key].setVolume(this.volume["sfx"] * this.volume["master"] * this.mute[channel])
				}

				break;

			case "music":
				this.volume["music"] = value;
				for (let key in this.music)
				{
					this.music[key].setVolume(value * this.volume["master"] * this.mute[channel])
				}
				break;

			case "sfx":
				this.volume["sfx"] = value;
				for (let key in this.sfx)
				{
					this.sfx[key].setVolume(value * this.volume["master"] * this.mute[channel])
					this.volume["sfx"] = value;
				}
				break;
		}
	}

	muteVolume(channel, value)
	{
		this.mute[channel] = value;
		this.setVolume(channel, this.volume[channel])
	}

	fadeSound(channel, key)
	{
		let sound = this.getChannel(channel)[key];
		sound.volume = (0);
		if(sound)
		{
			this.scene.add.tween
			({
				targets: sound,
				delay: 1000,
				volume: this.volume[channel],
				duration: 2000
			})
		}
	}

	getChannel(channel)
	{
		switch(channel)
		{
			case "music":
				return this.music;
				break;
			case "sfx":
				return this.sfx;	
				break;
		}	
	}


	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
