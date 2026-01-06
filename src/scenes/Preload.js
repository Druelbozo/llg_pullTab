
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
import gameConfig from '../config/game-config.js';
import WebFontFile from '../utils/ui/WebFontFile.js';
/* END-USER-IMPORTS */

export default class Preload extends Phaser.Scene {

	constructor() {
		super("Preload");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @returns {void} */
	editorPreload() {

		this.load.pack("asset-pack", "assets/asset-pack.json");
	}

	/** @returns {void} */
	editorCreate() {

		this.events.emit("scene-awake");
	}

	/* START-USER-CODE */
	progressBar;

	// Write your code here

	customEditorCreate()
	{
		const width = this.scale.width;
		const height = this.scale.height;
		const centerX = width / 2;
		const centerY = height / 2;

		const progressBarWidth = 256;
		const progressBarHeight = 20;
		const progressBarRadius = 6; // Corner radius for rounded corners
		const progressBarX = centerX - (progressBarWidth / 2); // Center the bar
		const progressBarY = centerY + 20; // Position below center

		const llg_newlogo_lite = this.add.image(progressBarX + 128,  progressBarY - 58, "llg-newlogo-lite");
		llg_newlogo_lite.scaleX = 0.5;
		llg_newlogo_lite.scaleY = 0.5;

		const progressBarBg = this.add.graphics();
		progressBarBg.fillGradientStyle(0x000000, 0x000000, 0x1a1a1a, 0x1a1a1a, 1); // Black to dark gray gradient
		progressBarBg.fillRoundedRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight, progressBarRadius);

		// Create progress bar fill with purple gradient
		const progressBar = this.add.graphics();
		progressBar.fillGradientStyle(0x7C3AED, 0x7C3AED, 0xC084FC, 0xC084FC, 1); // Lighter purple gradient
		progressBar.fillRoundedRect(progressBarX, progressBarY, 0, progressBarHeight, progressBarRadius); // Start with 0 width
		this.progressBar = progressBar;

		// Create gold stroke border on top of everything
		const progressBarStroke = this.add.graphics();
		progressBarStroke.lineStyle(2, 0xc78e0f, 1); // Gold border
		progressBarStroke.strokeRoundedRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight, progressBarRadius);
	}

	_themeImageKeys = new Set(); // Track which theme image keys we're loading
	_themeImagesLoaded = 0; // Count of theme images that have completed loading (verified ready)
	_themeImagesTotal = 0; // Total number of theme images to load
	_themeImagesLoading = false; // Flag indicating if theme images are being loaded
	_themeImagesQueued = false; // Flag indicating if theme images have been queued
	_themeImagesVerified = new Set(); // Track which theme images have been verified as ready

	async preload() {

		this.editorCreate();
		this.customEditorCreate();

		this.editorPreload();

		const width =  this.progressBar.width;

		// Initialize theme image tracking
		this._themeImageKeys.clear();
		this._themeImagesLoaded = 0;
		this._themeImagesTotal = 0;
		this._themeImagesLoading = false;
		this._themeImagesQueued = false;


		this._themeImagesVerified = new Set();
		this._themeImagesEventFired = new Set();
		this._themeImagesFailed = new Set();

		this._LOADER_MAX_PROGRESS = 0.85;

		await this.loadTheme();

		this.load.on("progress", (progress) => {

			const cappedProgress = Math.min(progress, this._LOADER_MAX_PROGRESS);
			this.updateProgressBar(cappedProgress);
		});
	}

	updateProgressBar(progress)
	{
		if (!this.progressBar || this._progressBarX === undefined) {
			// Progress bar dimensions not initialized yet, skip update
			return;
		}
		
		const clampedProgress = Math.max(0, Math.min(1, progress));
		//this.progressBar.clear();
		//this.progressBar.fillGradientStyle(0x7C3AED, 0x7C3AED, 0xC084FC, 0xC084FC, 1);
		this.progressBar.fillRoundedRect
		(
			this._progressBarX, 
			this._progressBarY, 
			clampedProgress * this._progressBarWidth, 
			this._progressBarHeight, 
			this._progressBarRadius
		);
	}

	async loadTheme()
	{
		let selectedTheme = gameConfig.theme || 'default';
		console.log(`Loading theme: Themes/${selectedTheme}.json`);

		const cacheBuster = Date.now();
		try 
		{
			const themeResponse = await fetch(`themes/${selectedTheme}.json?t=${cacheBuster}`);	
			console.log(`Theme loaded: themes/${selectedTheme}.json`);
			if (themeResponse.ok)
			{
				console.log(`Theme loaded: themes/${selectedTheme}.json`);

				const themeData = await themeResponse.json();
				this._themeImagesLoading = true;
				this.checkType(themeData);
				this._themeImagesQueued = true;

				if (themeData.fontLoader)
				{
					this.load.addFile(new WebFontFile(this.load, themeData.fontLoader.fonts));
				}

				// Log theme image loading summary
				if (this._themeImagesTotal > 0)
				{
					const allKeys = Array.from(this._themeImageKeys);
					console.log(`[Preload] ✅ Queued ${this._themeImagesTotal} theme image(s) for loading`);
					console.log(`[Preload] 📋 Theme image keys: [${allKeys.join(', ')}]`);

					if (!this.load.isLoading() && this.load.list.size > 0)
					{
						console.log('[Preload] Loader was idle, starting it to load theme images...');
						this.load.start();
					}
				}
				else 
				{
					console.log(`[Preload] No theme images found in theme data`);
				}
			} 
			else
			{
				console.warn(`[Preload] Failed to load theme: Themes/${selectedTheme}.json (status: ${themeResponse.status})`);
				// Continue without theme - game will use defaults
				this._themeImagesQueued = true; // Mark as done even if failed
			}
			
						
		}
		catch (error)
		{
			console.error(`[Preload] Error loading theme: Themes/${selectedTheme}.json`, error);
			this._themeImagesQueued = true;
		}
	
	}

	checkType(themeData)
	{
		//IMAGES
		if (themeData.images && typeof themeData.images === 'object') {
			for (const value of Object.values(themeData.images))
			{
				if (value && typeof value === 'object' && value.type === "image")
				{
					this.loadImage(value, themeData);
				}
			}
		}
		//AUDIO
		for (const value of Object.values(themeData))
		{
			if (value && typeof value === 'object' && value.type === "audio") {
				this.loadAudio(value, themeData);
			}
		}
		//VIDEO
		for (const value of Object.values(themeData.videos))
		{
			if (value && typeof value === 'object' && value.type === "video") {
				this.loadVideo(value, themeData);
			}
		}
	}

	loadImage(value, themeData)
	{
		if (!value.imageKey || value.imageKey === "")
		{
			console.log(`Skipping load for ${value.key}: imageKey is empty`);
			return;
		}

		this._themeImageKeys.add(value.key);
		this._themeImagesTotal++;
		console.log(`[Preload] 📦 Queued theme image: "${value.key}" (Total: ${this._themeImagesTotal})`);

		let imageKey = "";

		if (value.imageKey.startsWith('http')) 
		{
			imageKey = value.imageKey
		}
		else 
		{	
			//Loading Locally - add cache-busting parameter to ensure we get the latest image
			const cacheBuster = Date.now();
			imageKey = `assets/Images/${value.key}/${value.imageKey}.png?t=${cacheBuster}`;
		}

		//Is SpriteSheet?
		if (value.imageWidth || value.imageHeight) 
		{
			this.load.spritesheet(value.key, imageKey,
			{
				frameWidth: value.imageWidth,
				frameHeight: value.imageHeight
			});
		}
		else
		{
			this.load.image(value.key, imageKey);
		}		
	}

	loadVideo(value, themeData)
	{


		if (!value.videoKey || value.videoKey === "") {
			console.log(`Skipping load for ${value.videoKey}: videoKey is empty`);
			return;
		}

		let path = "";

		console.log(`Loading video: key="${value.videoKey}", videoKey="${value.videoKey}"`);

		if (value.key.startsWith('http')) 
		{
			path = value.videoKey;
		}
		else 
		{	
			// Loading Locally - add cache-busting parameter to ensure we get the latest audio
			const cacheBuster = Date.now();
			path = `assets/Videos/${value.key}/${value.videoKey}.mp4`;
		}
		console.log(path, "!!!!!!!!!!!!!!");
		this.load.video(value.key, path, "loadeddata", true);
	}	

	loadAudio(value, themeData)
	{
		if (!value.audioKey || value.audioKey === "") {
			console.log(`Skipping load for ${value.key}: audioKey is empty`);
			return;
		}

		let audioPath = "";

		console.log(`Loading audio: key="${value.key}", audioKey="${value.audioKey}"`);

		if (value.audioKey.startsWith('http')) 
		{
			audioPath = value.audioKey;
		}
		else 
		{	
			// Loading Locally - add cache-busting parameter to ensure we get the latest audio
			const cacheBuster = Date.now();
			audioPath = `assets/audio/music/${value.audioKey}?t=${cacheBuster}`;
		}

		this.load.audio(value.key, audioPath);
	}

	create() {

		this.scene.start("Level");
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
