/**
 * Theme music + SFX (Scratch-style): independent mute/volume, optional localStorage volumes.
 * Pull-tab: SFX playback rate for selected keys follows {@link PeelManager#speed}.
 */

import { getLocalStorageItem, removeLocalStorageItem, setLocalStorageItem } from '../../utils/data/StorageUtils.js';
import { debug, log, warn } from '../../utils/logger/LoggerUtils.js';
import { GameConfig } from '../../config/Global.js';
import { getSfxKey, SFX_SPEED_CONTROLLED_KEYS } from '../../utils/audio/SfxConfigUtils.js';
import { AUDIO_MUSIC_VOLUME_STORAGE_KEY, AUDIO_SFX_VOLUME_STORAGE_KEY } from '../../utils/audio/AudioLocalStorageKeys.js';

const TALLY_SFX_MAX_DURATION_MS = 10000;
const DEFAULT_MUSIC_VOLUME_FIRST_VISIT = 0.3;
const DEFAULT_SFX_VOLUME_FIRST_VISIT = 1;

function clamp01(x) {
    const n = Number(x);
    if (!Number.isFinite(n)) {
        return 1;
    }
    return Math.max(0, Math.min(1, n));
}

/**
 * @param {unknown} raw
 * @param {number} defaultWhenMissing
 * @returns {number}
 */
function volumeFromStorage(raw, defaultWhenMissing) {
    if (raw == null) {
        return defaultWhenMissing;
    }
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
    if (!Number.isFinite(n)) {
        return defaultWhenMissing;
    }
    return clamp01(n);
}

export default class AudioService {
    /**
     * @param {Phaser.Scene} scene
     */
    constructor(scene) {
        this.scene = scene;

        const persistVolumes = GameConfig?.game?.PERSIST_AUDIO_VOLUMES !== false;

        this._sfxMuted = false;
        this._musicMuted = false;
        this._sfxVolume = 1;
        this._musicVolume = 1;

        if (persistVolumes) {
            this._loadVolumePrefs();
        }
        this._pruneLegacyMuteStorage();

        this._ensureGlobalSoundUnmuted();

        this._themeMusic = null;
        this._themeMusicKey = null;
        /** @type {Phaser.Sound.BaseSound|null} */
        this._loopingSfx = null;
        /** @type {Phaser.Time.TimerEvent|null} */
        this._loopingTallyCapTimer = null;
        this._audioUnlocked = false;
    }

    _loadVolumePrefs() {
        const sV = getLocalStorageItem(AUDIO_SFX_VOLUME_STORAGE_KEY);
        this._sfxVolume = volumeFromStorage(sV, DEFAULT_SFX_VOLUME_FIRST_VISIT);

        const mV = getLocalStorageItem(AUDIO_MUSIC_VOLUME_STORAGE_KEY);
        this._musicVolume = volumeFromStorage(mV, DEFAULT_MUSIC_VOLUME_FIRST_VISIT);
    }

    _pruneLegacyMuteStorage() {
        removeLocalStorageItem('audioMuted');
        removeLocalStorageItem('audioSfxMuted');
        removeLocalStorageItem('audioMusicMuted');
    }

    _persistVolumePrefs() {
        if (GameConfig?.game?.PERSIST_AUDIO_VOLUMES === false) {
            return;
        }
        setLocalStorageItem(AUDIO_SFX_VOLUME_STORAGE_KEY, this._sfxVolume);
        setLocalStorageItem(AUDIO_MUSIC_VOLUME_STORAGE_KEY, this._musicVolume);
    }

    _ensureGlobalSoundUnmuted() {
        if (this.scene?.sound) {
            this.scene.sound.mute = false;
        }
    }

    _peelPlaybackRate() {
        return this.scene?.peelManager?.speed ?? GameConfig.game.START_SPEED ?? 1;
    }

    effectiveSfxVolume() {
        return this._sfxMuted ? 0 : this._sfxVolume;
    }

    effectiveMusicVolume() {
        return this._musicMuted ? 0 : this._musicVolume;
    }

    getSfxVolume() {
        return this._sfxVolume;
    }

    /** @param {number} v 0–1 */
    setSfxVolume(v) {
        this._sfxVolume = clamp01(v);
        this._persistVolumePrefs();
        this._applyLoopingSfxVolume();
    }

    getMusicVolume() {
        return this._musicVolume;
    }

    /** @param {number} v 0–1 */
    setMusicVolume(v) {
        this._musicVolume = clamp01(v);
        this._persistVolumePrefs();
        this._applyThemeMusicVolume();
    }

    isSfxMuted() {
        return this._sfxMuted;
    }

    setSfxMuted(muted) {
        const m = !!muted;
        if (this._sfxMuted === m) {
            return;
        }
        this._sfxMuted = m;
        this._applyLoopingSfxVolume();
    }

    isMusicMuted() {
        return this._musicMuted;
    }

    setMusicMuted(muted) {
        const m = !!muted;
        if (this._musicMuted === m) {
            return;
        }
        this._musicMuted = m;
        this._applyThemeMusicVolume();
    }

    isMuted() {
        return this.effectiveSfxVolume() <= 0 && this.effectiveMusicVolume() <= 0;
    }

    setMuted(muted) {
        this._sfxMuted = !!muted;
        this._musicMuted = !!muted;
        this._applyLoopingSfxVolume();
        this._applyThemeMusicVolume();
        if (!muted && this._audioUnlocked && this._themeMusicKey && !this.isThemeMusicPlaying()) {
            const musicKey = this._themeMusicKey;
            this._themeMusicKey = null;
            this.playThemeMusic(musicKey);
        }
    }

    toggleMute() {
        this.setMuted(!this.isMuted());
    }

    _applyLoopingSfxVolume() {
        const v = this.effectiveSfxVolume();
        if (this._loopingSfx && typeof this._loopingSfx.setVolume === 'function') {
            try {
                this._loopingSfx.setVolume(v);
            } catch (_e) {
                /* noop */
            }
        }
    }

    _applyThemeMusicVolume() {
        const v = this.effectiveMusicVolume();
        if (this._themeMusic && typeof this._themeMusic.setVolume === 'function') {
            try {
                this._themeMusic.setVolume(v);
            } catch (_e) {
                /* noop */
            }
        }
        if (
            v > 0 &&
            this._audioUnlocked &&
            this._themeMusic &&
            typeof this._themeMusic.play === 'function' &&
            !this.isThemeMusicPlaying()
        ) {
            try {
                this._themeMusic.play();
            } catch (_e) {
                /* noop */
            }
        }
    }

    unlockAudio() {
        if (this._audioUnlocked) {
            return false;
        }

        if (this.scene && this.scene.sound) {
            this.scene.sound.unlock();
            this._audioUnlocked = true;
            log('Audio context unlocked', 'assets');

            if (
                this._themeMusicKey &&
                !this.isThemeMusicPlaying() &&
                this.effectiveMusicVolume() > 0
            ) {
                const musicKey = this._themeMusicKey;
                this._themeMusicKey = null;
                this.playThemeMusic(musicKey);
            }

            return true;
        }

        return false;
    }

    isAudioUnlocked() {
        return this._audioUnlocked;
    }

    /**
     * @param {string} musicKey - Phaser cache key (same as theme `music.audioKey`, e.g. "song.ogg")
     * @param {Object} [options]
     * @returns {boolean}
     */
    playThemeMusic(musicKey, options = {}) {
        if (!this.scene || !this.scene.sound) {
            warn('Cannot play theme music: scene or sound system not available', 'assets');
            return false;
        }

        if (!this.scene.cache.audio.exists(musicKey)) {
            warn(`Theme music "${musicKey}" not loaded. Make sure it's loaded in Preload scene.`, 'assets');
            return false;
        }

        this.stopThemeMusic();

        this._themeMusicKey = musicKey;

        const baseVol = options.volume !== undefined ? options.volume : 1.0;
        const vol = this.effectiveMusicVolume() * baseVol;

        const config = {
            loop: options.loop !== undefined ? options.loop : true,
            volume: vol,
        };

        this._themeMusic = this.scene.sound.add(musicKey, config);

        if (this._audioUnlocked) {
            try {
                this._themeMusic.play();
                log(`Theme music "${musicKey}" started`, 'assets');
            } catch (error) {
                warn('Failed to play theme music:', 'assets', error);
            }
        } else {
            debug(`Theme music "${musicKey}" ready but waiting for audio unlock`, 'assets');
        }

        return true;
    }

    stopThemeMusic() {
        if (this._themeMusic) {
            this._themeMusic.stop();
            this._themeMusic.destroy();
            this._themeMusic = null;
        }
        this._themeMusicKey = null;
    }

    isThemeMusicPlaying() {
        return this._themeMusic !== null && this._themeMusic.isPlaying;
    }

    _cancelLoopingTallyCapTimer() {
        if (this._loopingTallyCapTimer) {
            this._loopingTallyCapTimer.remove(false);
            this._loopingTallyCapTimer = null;
        }
    }

    _scheduleLoopingTallyHardStop() {
        this._cancelLoopingTallyCapTimer();
        if (!this.scene) {
            return;
        }
        this._loopingTallyCapTimer = this.scene.time.delayedCall(TALLY_SFX_MAX_DURATION_MS, () => {
            this._loopingTallyCapTimer = null;
            this.stopLoopingSfx();
        });
    }

    /** @param {Phaser.Sound.BaseSound|null|undefined|false} snd */
    _scheduleTallyOneShotHardStop(snd) {
        if (!snd || !this.scene) {
            return;
        }
        this.scene.time.delayedCall(TALLY_SFX_MAX_DURATION_MS, () => {
            try {
                if (snd.isPlaying) {
                    snd.stop();
                }
            } catch (_e) {
                /* noop */
            }
        });
    }

    playLoopingSfx(configKey, options = {}) {
        if (!this.scene?.sound) {
            return false;
        }
        const eff = this.effectiveSfxVolume();
        if (eff <= 0) {
            return false;
        }
        if (!this._audioUnlocked) {
            this.unlockAudio();
        }
        const key = getSfxKey(configKey);
        if (!key || !this.scene.cache.audio.exists(key)) {
            warn(`SFX "${configKey}" not loaded. Make sure it's loaded in Preload scene.`, 'assets');
            return false;
        }
        this.stopLoopingSfx();
        const optVol = options.volume !== undefined ? options.volume : 1.0;
        const volume = eff * optVol;
        const rate = SFX_SPEED_CONTROLLED_KEYS.has(configKey) ? this._peelPlaybackRate() : 1;
        this._loopingSfx = this.scene.sound.add(key, { loop: true, volume, rate });
        try {
            this._loopingSfx.play();
        } catch (playError) {
            warn('Failed to play looping SFX:', 'assets', playError);
            this._loopingSfx = null;
            return false;
        }
        if (configKey === 'tally') {
            this._scheduleLoopingTallyHardStop();
        }
        return true;
    }

    stopLoopingSfx() {
        this._cancelLoopingTallyCapTimer();
        if (this._loopingSfx) {
            this._loopingSfx.stop();
            this._loopingSfx.destroy();
            this._loopingSfx = null;
        }
    }

    playSfx(configKey, options = {}) {
        if (!this.scene?.sound) {
            return false;
        }
        const eff = this.effectiveSfxVolume();
        if (eff <= 0) {
            return false;
        }
        if (!this._audioUnlocked) {
            this.unlockAudio();
        }
        const key = getSfxKey(configKey);
        if (!key || !this.scene.cache.audio.exists(key)) {
            warn(`SFX "${configKey}" not loaded. Make sure it's loaded in Preload scene.`, 'assets');
            return false;
        }
        const optVol = options.volume !== undefined ? options.volume : 1.0;
        const volume = eff * optVol;
        const rate = SFX_SPEED_CONTROLLED_KEYS.has(configKey) ? this._peelPlaybackRate() : 1;
        try {
            const played = this.scene.sound.play(key, { volume, rate });
            if (configKey === 'tally' && played) {
                this._scheduleTallyOneShotHardStop(/** @type {Phaser.Sound.BaseSound} */ (played));
            }
            return true;
        } catch (playError) {
            warn('Failed to play SFX:', 'assets', playError);
            return false;
        }
    }

    destroy() {
        this.stopThemeMusic();
        this.stopLoopingSfx();
        this.scene = null;
    }
}
