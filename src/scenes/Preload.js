
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
import WebFontFile from '../utils/ui/WebFontFile.js';
import BrowserDetector from '../utils/ui/BrowserDetector.js';
import ViewportHelper from '../utils/ui/ViewportHelper.js';
import { shouldPreloadPeelResultImageSlot } from '../utils/theme/ThemePreloadUtils.js';
import { googleFamilySpecsFromThemeFonts } from '../utils/theme/ThemeFontResolutionUtils.js';
import { GameConfig } from '../config/Global.js';
import { setEffectiveSfx } from '../utils/audio/SfxConfigUtils.js';
import { log, warn } from '../utils/logger/LoggerUtils.js';
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

		this._progressBarX = progressBarX;
		this._progressBarY = progressBarY;
		this._progressBarWidth = progressBarWidth;
		this._progressBarHeight = progressBarHeight;
		this._progressBarRadius = progressBarRadius;
	}

	_themeImageKeys = new Set(); // Track which theme image keys we're loading
	_themeImagesLoaded = 0; // Count of theme images that have completed loading (verified ready)
	_themeImagesTotal = 0; // Total number of theme images to load
	_themeImagesLoading = false; // Flag indicating if theme images are being loaded
	_themeImagesQueued = false; // Flag indicating if theme images have been queued
	_themeImagesVerified = new Set(); // Track which theme images have been verified as ready

	preload() {
		this.editorCreate();
		this.customEditorCreate();

		// Initialize theme image tracking
		this._themeImageKeys.clear();
		this._themeImagesLoaded = 0;
		this._themeImagesTotal = 0;
		this._themeImagesLoading = false;
		this._themeImagesQueued = false;
		this._themeImagesVerified = new Set();
		this._themeImagesEventFired = new Set();
		this._themeImagesFailed = new Set();
		this._hasTransitioned = false;

		// Set up filecomplete handlers to track theme image loading (prevents cold-start race)
		this.load.on('filecomplete', (key, type) => {
			if (!this._themeImageKeys.has(key)) return;
			if (this._themeImagesVerified.has(key)) return;
			if (!this._isThemeTextureReady(key)) {
				this._checkAssetsReady();
				return;
			}
			this._themeImagesLoaded++;
			this._themeImagesVerified.add(key);
			this._themeImagesEventFired.add(key);
			log(`[Preload] Theme asset loaded (${type}): "${key}" (${this._themeImagesLoaded}/${this._themeImagesTotal})`, 'assets');
			this._checkAssetsReady();
		});

		this.load.on('filecomplete-atlas', (key) => {
			if (!this._themeImageKeys.has(key)) return;
			if (this._themeImagesVerified.has(key)) return;
			if (!this._isThemeTextureReady(key)) {
				this._checkAssetsReady();
				return;
			}
			this._themeImagesLoaded++;
			this._themeImagesVerified.add(key);
			this._themeImagesEventFired.add(key);
			log(`[Preload] Theme atlas loaded: "${key}" (${this._themeImagesLoaded}/${this._themeImagesTotal})`, 'assets');
			this._checkAssetsReady();
		});

		this.load.on('loaderror', (file) => {
			if (this._themeImageKeys.has(file?.key)) {
				warn(`[Preload] Theme asset load error: "${file.key}"`, 'assets');
				this._themeImagesFailed.add(file.key);
				this._checkAssetsReady();
			}
		});

		this.load.on('progress', (progress) => {
			this.updateProgressBar(Math.max(0, Math.min(1, progress)));
		});

		this.editorPreload();

		// CRITICAL: Theme JSON was fetched in Boot. Phaser starts the loader when preload() returns —
		// queue all theme images here synchronously (do not await network I/O in preload).
		const themeData = this.registry.get('preloadThemeData') || {};
		if (!themeData || typeof themeData !== 'object' || Object.keys(themeData).length === 0) {
			warn('[Preload] preloadThemeData missing — theme graphics may not load', 'theme');
		} else {
			const cfg = this.registry.get('preloadGameConfig') || {};
			log(`[Preload] Queuing assets for theme: ${cfg.theme || 'default'}`, 'assets');
		}

		this._themeImagesLoading = true;
		this.checkType(themeData);
		this._themeImagesQueued = true;

		const fontSpecs = googleFamilySpecsFromThemeFonts(themeData);
		if (fontSpecs?.length) {
			this.load.addFile(new WebFontFile(this.load, fontSpecs));
		}

		if (this._themeImagesTotal > 0) {
			log(`[Preload] Queued ${this._themeImagesTotal} theme image(s)`, 'assets');
			log(`[Preload] Theme texture keys: [${Array.from(this._themeImageKeys).join(', ')}]`, 'assets');
		}

		if (!this.load.isLoading() && this.load.list.size > 0) {
			log('[Preload] Starting loader for queued assets', 'assets');
			this.load.start();
		}
	}

	/**
	 * @param {string} key
	 * @returns {boolean}
	 */
	_isThemeTextureReady(key) {
		if (!this.textures.exists(key)) {
			return false;
		}
		const texture = this.textures.get(key);
		let w = 0;
		let h = 0;
		if (texture?.frames?.size > 0) {
			const firstFrame = [...texture.frames.values()][0];
			w = firstFrame?.width ?? 0;
			h = firstFrame?.height ?? 0;
		} else {
			const source = texture?.source?.[0] || texture?.getSourceImage?.();
			const img = source?.image || source;
			w = img?.width ?? img?.naturalWidth ?? texture?.frame?.width ?? 0;
			h = img?.height ?? img?.naturalHeight ?? texture?.frame?.height ?? 0;
		}
		return w > 0 && h > 0;
	}

	/**
	 * Check if theme images exist in texture cache (fallback when filecomplete doesn't fire).
	 */
	_checkThemeImagesInCache() {
		if (this._themeImagesTotal === 0) return;
		for (const key of this._themeImageKeys) {
			if (this._themeImagesVerified.has(key) || this._themeImagesFailed.has(key)) {
				continue;
			}
			if (this._isThemeTextureReady(key)) {
				this._themeImagesLoaded++;
				this._themeImagesVerified.add(key);
				this._themeImagesEventFired.add(key);
				log(`[Preload] Theme texture in cache: "${key}" (${this._themeImagesLoaded}/${this._themeImagesTotal})`, 'assets');
			}
		}
	}

	/**
	 * @returns {boolean}
	 */
	_allThemeImageSlotsResolved() {
		return this._themeImagesLoaded + this._themeImagesFailed.size >= this._themeImagesTotal;
	}

	_verifyRequiredTexturesReady() {
		if (this._themeImagesTotal === 0) {
			return true;
		}
		if (!this._allThemeImageSlotsResolved()) {
			return false;
		}
		const critical = ['background', 'card', 'icons'];
		for (const key of critical) {
			if (!this._themeImageKeys.has(key)) {
				continue;
			}
			if (this._themeImagesFailed.has(key) || !this._isThemeTextureReady(key)) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Check if all assets are loaded and transition if ready.
	 * Transitions when theme images are loaded - does NOT wait for video (video loads in background).
	 */
	_checkAssetsReady() {
		if (!this._checkAssetsReadyEnabled) return;

		// Fallback: check texture cache (filecomplete may not fire for pack/async loads)
		this._checkThemeImagesInCache();

		const allThemeImagesLoaded =
			this._themeImagesTotal === 0 || this._allThemeImageSlotsResolved();
		const requiredTexturesReady = this._verifyRequiredTexturesReady();

		// Do not wait for theme videos / slow audio — those load in background after Level starts (scratch pattern).
		if (allThemeImagesLoaded && requiredTexturesReady && !this._hasTransitioned) {
			this._hasTransitioned = true;
			log(
				`[Preload] Theme images ready: ${this._themeImagesLoaded}/${this._themeImagesTotal}`,
				'assets',
			);
			const isMobile = BrowserDetector.isMobile();
			const settlingDelay = isMobile ? 75 : 50;
			this.time.delayedCall(settlingDelay, () => this.transitionToLevel());
		}
	}

	/**
	 * Transition to Level scene after assets are loaded.
	 */
	transitionToLevel() {
		if (this._safetyCheckTimer) {
			this._safetyCheckTimer.remove();
			this._safetyCheckTimer = null;
		}
		this.scene.start("Level");
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

	checkType(themeData)
	{
		const ik = themeData.imageKeys;
		if (!ik || typeof ik !== 'object') {
			warn('[Preload] themeData.imageKeys missing', 'theme');
		} else {
			for (const [slotKey, stem] of Object.entries(ik)) {
				if (stem === undefined || stem === null || stem === '') {
					continue;
				}
				if (!shouldPreloadPeelResultImageSlot(themeData, slotKey)) {
					continue;
				}
				const phaserKey = slotKey;
				if (slotKey === 'icons') {
					this.queueIconsAtlas(phaserKey, stem);
				} else if (typeof stem !== 'string') {
					continue;
				} else if (stem.startsWith('http')) {
					this._themeImageKeys.add(phaserKey);
					this._themeImagesTotal++;
					this.load.image(phaserKey, stem);
				} else {
					this._themeImageKeys.add(phaserKey);
					this._themeImagesTotal++;
					const cacheBuster = Date.now();
					const url = `assets/images/theme/${slotKey}/${stem}.png?t=${cacheBuster}`;
					this.load.image(phaserKey, url);
				}
			}
		}

		const sfxBasePath = 'assets/audio/sfx/';
		const effectiveSfx = { ...(GameConfig?.sfx || {}), ...(themeData?.sfx || {}) };
		setEffectiveSfx(effectiveSfx);
		const sfxCb = Date.now();
		for (const [, filename] of Object.entries(effectiveSfx)) {
			if (filename && typeof filename === 'string') {
				const cacheKey = filename.replace(/\.(ogg|mp3|wav)$/i, '');
				this.load.audio(cacheKey, `${sfxBasePath}${filename}?t=${sfxCb}`);
			}
		}

		if (themeData.music && typeof themeData.music === 'object' && themeData.music.audioKey != null && themeData.music.audioKey !== '') {
			this.queueThemeMusic(themeData.music);
		}
	}

	queueIconsAtlas(phaserKey, atlasStem)
	{
		if (typeof atlasStem !== 'string' || atlasStem.startsWith('http')) {
			warn('[Preload] Ignoring icons atlas stem:', 'assets', atlasStem);
			return;
		}
		this._themeImageKeys.add(phaserKey);
		this._themeImagesTotal++;

		const cb = Date.now();
		const png = `assets/images/theme/icons/${atlasStem}.png?t=${cb}`;
		const json = `assets/images/theme/icons/${atlasStem}.json?t=${cb}`;
		log(`[Preload] Queued icons atlas ${phaserKey} (${atlasStem})`, 'assets');
		this.load.atlas(phaserKey, png, json);
	}

	queueThemeMusic(musicData)
	{
		if (!musicData.audioKey || musicData.audioKey === '') {
			log('[Preload] Skipping theme music — audioKey empty', 'assets');
			return;
		}

		const phaserKey = musicData.audioKey;
		let audioPath = '';
		log(`[Preload] Theme music audioKey="${musicData.audioKey}", Phaser key="${phaserKey}"`, 'assets');

		if (String(musicData.audioKey).startsWith('http')) {
			audioPath = musicData.audioKey;
		} else {
			const cacheBuster = Date.now();
			audioPath = `assets/audio/music/${musicData.audioKey}?t=${cacheBuster}`;
		}

		this.load.audio(phaserKey, audioPath);
	}

	create() {
		const finalViewportWidth = ViewportHelper.getWidth();
		const finalViewportHeight = ViewportHelper.getHeight();
		if (this.scale.width !== finalViewportWidth || this.scale.height !== finalViewportHeight) {
			this.scale.resize(finalViewportWidth, finalViewportHeight);
			this.scale.refresh();
		}

		this._checkAssetsReadyEnabled = true;
		this._hasTransitioned = false;

		if (!this.load.isLoading() && this.load.list.size > 0) {
			log('[Preload] Loader idle with files queued, starting loader...', 'assets');
			this.load.start();
		}

		const isMobile = BrowserDetector.isMobile();
		const MAX_WAIT_TIME = isMobile ? 8000 : 10000;
		const CHECK_INTERVAL = isMobile ? 50 : 100;
		const waitStartTime = Date.now();

		const checkAndTransition = () => {
			const elapsed = Date.now() - waitStartTime;
			if (elapsed > MAX_WAIT_TIME) {
				warn(
					`[Preload] Timeout after ${elapsed}ms - forcing transition (${this._themeImagesLoaded}/${this._themeImagesTotal})`,
					'assets',
				);
				if (!this._hasTransitioned) {
					this._hasTransitioned = true;
					this.transitionToLevel();
				}
				return;
			}
			this._checkAssetsReady();
		};

		this.load.once('complete', () => checkAndTransition());

		this._safetyCheckTimer = this.time.addEvent({
			delay: CHECK_INTERVAL,
			callback: checkAndTransition,
			repeat: -1,
		});

		this.time.delayedCall(50, () => checkAndTransition());
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
