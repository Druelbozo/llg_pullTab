
// You can write more code here

/* START OF COMPILED CODE */

/* START-USER-IMPORTS */
import WebFontFile from '../utils/ui/WebFontFile.js';
import BrowserDetector from '../utils/ui/BrowserDetector.js';
import ViewportHelper from '../utils/ui/ViewportHelper.js';
import { loadThemeWithOverride } from '../utils/theme/ThemeMergeUtils.js';
import { googleFamilySpecsFromThemeFonts } from '../utils/theme/ThemeFontResolutionUtils.js';
import { GameConfig } from '../config/Global.js';
import { setEffectiveSfx } from '../utils/audio/SfxConfigUtils.js';
import { log, warn, error as logErr } from '../utils/logger/LoggerUtils.js';
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
		this._hasTransitioned = false;

		this._LOADER_MAX_PROGRESS = 0.85;

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
			}
		});

		await this.queueThemeAssetsFromRegistry();

		this.load.on("progress", (progress) => {

			const cappedProgress = Math.min(progress, this._LOADER_MAX_PROGRESS);
			this.updateProgressBar(cappedProgress);
		});
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
	_verifyRequiredTexturesReady() {
		if (this._themeImagesTotal === 0) {
			return true;
		}
		let readyCount = 0;
		for (const key of this._themeImageKeys) {
			if (this._themeImagesFailed.has(key) || this._isThemeTextureReady(key)) {
				readyCount++;
			}
		}
		return readyCount >= this._themeImagesTotal;
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
			this._themeImagesTotal === 0 || this._themeImagesLoaded >= this._themeImagesTotal;
		const phaserComplete = !this.load.isLoading() && this.load.list.size === 0;
		const requiredTexturesReady = this._verifyRequiredTexturesReady();

		if (allThemeImagesLoaded && phaserComplete && requiredTexturesReady && !this._hasTransitioned) {
			this._hasTransitioned = true;
			log(
				`[Preload] All assets ready: theme images=${this._themeImagesLoaded}/${this._themeImagesTotal}, phaserComplete=${phaserComplete}`,
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

	/**
	 * Queue theme textures/audio from registry (JSON was fetched in Boot before this scene started).
	 */
	async queueThemeAssetsFromRegistry() {
		const cfg =
			this.registry.get('preloadGameConfig') ||
			(typeof window !== 'undefined' && window.__selectedGameConfig) ||
			{};
		const selectedTheme = cfg.theme || 'default';

		let themeData = this.registry.get('preloadThemeData');
		if (!themeData || typeof themeData !== 'object' || Object.keys(themeData).length === 0) {
			warn('[Preload] preloadThemeData missing — fetching theme in Preload (Boot should have set this)', 'theme');
			try {
				const loaded = await loadThemeWithOverride(selectedTheme);
				themeData = loaded.themeData;
				this.registry.set('preloadThemeData', themeData);
				this.registry.set('preloadThemeOverride', loaded.themeOverride);
			} catch (error) {
				logErr(`[Preload] Error loading themes: ${error?.message ?? error}`, 'assets', error);
				themeData = {};
				this.registry.set('preloadThemeData', themeData);
			}
		} else {
			log(`[Preload] Theme JSON from Boot: ${selectedTheme}`, 'assets');
		}

		try {
			await this._hydratePullTabIconsLayout(themeData);

			this._themeImagesLoading = true;
			this.checkType(themeData);
			this._themeImagesQueued = true;

			const fontSpecs = googleFamilySpecsFromThemeFonts(themeData);
			if (fontSpecs?.length) {
				this.load.addFile(new WebFontFile(this.load, fontSpecs));
			}

			if (this._themeImagesTotal > 0) {
				log(`[Preload] Queued ${this._themeImagesTotal} theme asset(s)`, 'assets');
				log(`[Preload] Theme texture keys: [${Array.from(this._themeImageKeys).join(', ')}]`, 'assets');
			} else {
				log('[Preload] No theme imageKeys to queue', 'assets');
			}
		} catch (error) {
			logErr(`[Preload] Error queuing theme assets: ${error?.message ?? error}`, 'assets', error);
			this.registry.set('pullTabIconsLayout', {});
			this._themeImagesQueued = true;
		}
	}

	async _hydratePullTabIconsLayout(themeData)
	{
		const mergedBase = themeData.pullTabIconsLayout || {};
		const stem = themeData.imageKeys?.icons;
		this.registry.set('pullTabIconsLayout', mergedBase);

		if (!stem || typeof stem !== 'string' || stem.startsWith('http')) {
			return;
		}
		try {
			const cb = Date.now();
			const r = await fetch(`assets/images/theme/icons/${stem}.json?t=${cb}`);
			if (!r.ok) return;
			const j = await r.json();
			if (j.pullTabLayout && typeof j.pullTabLayout === 'object') {
				this.registry.set('pullTabIconsLayout', {
					...mergedBase,
					...j.pullTabLayout,
				});
			}
		} catch (err) {
			warn(`[Preload] Icons layout fetch failed: ${err?.message ?? err}`, 'assets', err);
		}
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

		const vk = themeData.videoKeys;
		if (!vk || typeof vk !== 'object') {
			return;
		}

		for (const [slotKey, stem] of Object.entries(vk)) {
			if (stem === undefined || stem === null || stem === '') {
				continue;
			}
			const cacheBuster = Date.now();

			let path = '';
			if (typeof stem === 'string' && stem.startsWith('http')) {
				path = stem;
			} else if (typeof stem !== 'string') {
				warn('[Preload] Ignoring videoKeys slot:', 'assets', slotKey, stem);
				continue;
			} else {
				path = `assets/videos/${slotKey}/${stem}.mp4?t=${cacheBuster}`;
			}

			log(`[Preload] Queued theme video key="${slotKey}" path="${path}"`, 'assets');
			this.load.video(slotKey, path, 'loadeddata', true);
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
