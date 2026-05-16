/**
 * DOM modal: independent SFX and music volume + mute (uses {@link AudioService}).
 */

import Modal from '../Modal.js';

const HTML = `
<div class="sound-options-modal">
  <h2 class="sound-options-title">Sound Options</h2>

  <div class="sound-options-section" data-channel="sfx">
    <h3>Sound effects</h3>
    <div class="sound-options-row">
      <label class="sound-options-mute">
        <input type="checkbox" id="sound-options-sfx-mute" />
        <span>Mute</span>
      </label>
      <input type="range" id="sound-options-sfx-volume" min="0" max="100" value="100" aria-label="Sound effects volume" aria-valuemin="0" aria-valuemax="100" />
      <span class="sound-options-value" id="sound-options-sfx-pct" aria-hidden="true">100%</span>
    </div>
  </div>

  <div class="sound-options-section" data-channel="music">
    <h3>Music</h3>
    <div class="sound-options-row">
      <label class="sound-options-mute">
        <input type="checkbox" id="sound-options-music-mute" />
        <span>Mute</span>
      </label>
      <input type="range" id="sound-options-music-volume" min="0" max="100" value="100" aria-label="Music volume" aria-valuemin="0" aria-valuemax="100" />
      <span class="sound-options-value" id="sound-options-music-pct" aria-hidden="true">100%</span>
    </div>
  </div>
</div>
`;

/**
 * @param {HTMLElement} overlay
 * @param {{ audioService?: import('../../services/game/AudioService.js').default, _updateSoundIcon?: () => void }} scene
 */
function mountSoundOptions(overlay, scene) {
    const audio = scene.audioService;
    if (!audio) {
        return;
    }

    const sfxVol = overlay.querySelector('#sound-options-sfx-volume');
    const sfxPct = overlay.querySelector('#sound-options-sfx-pct');
    const sfxMute = overlay.querySelector('#sound-options-sfx-mute');
    const musicVol = overlay.querySelector('#sound-options-music-volume');
    const musicPct = overlay.querySelector('#sound-options-music-pct');
    const musicMute = overlay.querySelector('#sound-options-music-mute');

    if (!sfxVol || !sfxMute || !musicVol || !musicMute) {
        return;
    }

    audio.setMusicMuted(true);

    const syncFromService = () => {
        const sv = Math.round(audio.getSfxVolume() * 100);
        const mv = Math.round(audio.getMusicVolume() * 100);
        sfxVol.value = String(sv);
        sfxPct.textContent = `${sv}%`;
        musicVol.value = String(mv);
        musicPct.textContent = `${mv}%`;
        sfxMute.checked = audio.isSfxMuted();
        musicMute.checked = audio.isMusicMuted();
    };

    syncFromService();

    let lastSfxPreviewAt = 0;
    const SFX_PREVIEW_THROTTLE_MS = 110;

    const playSfxVolumePreview = () => {
        if (audio.effectiveSfxVolume() <= 0) {
            return;
        }
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (now - lastSfxPreviewAt < SFX_PREVIEW_THROTTLE_MS) {
            return;
        }
        lastSfxPreviewAt = now;
        audio.playSfx('buttonClick');
    };

    const onSfxRange = () => {
        const v = Number(sfxVol.value);
        const t = Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 100;
        audio.setSfxVolume(t / 100);
        if (t > 0 && audio.isSfxMuted()) {
            audio.setSfxMuted(false);
            sfxMute.checked = false;
        }
        sfxPct.textContent = `${Math.round(audio.getSfxVolume() * 100)}%`;
        if (typeof scene._updateSoundIcon === 'function') {
            scene._updateSoundIcon();
        }
        playSfxVolumePreview();
    };

    const onSfxRangePointerDown = () => {
        requestAnimationFrame(() => {
            playSfxVolumePreview();
        });
    };

    const onMusicRange = () => {
        const v = Number(musicVol.value);
        const t = Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 100;
        audio.setMusicVolume(t / 100);
        if (t > 0 && audio.isMusicMuted()) {
            audio.setMusicMuted(false);
            musicMute.checked = false;
        }
        musicPct.textContent = `${Math.round(audio.getMusicVolume() * 100)}%`;
        if (typeof scene._updateSoundIcon === 'function') {
            scene._updateSoundIcon();
        }
    };

    const onSfxMute = () => {
        audio.setSfxMuted(!!sfxMute.checked);
        syncFromService();
        if (typeof scene._updateSoundIcon === 'function') {
            scene._updateSoundIcon();
        }
    };

    const onMusicMute = () => {
        audio.setMusicMuted(!!musicMute.checked);
        syncFromService();
        if (typeof scene._updateSoundIcon === 'function') {
            scene._updateSoundIcon();
        }
    };

    sfxVol.addEventListener('input', onSfxRange);
    sfxVol.addEventListener('pointerdown', onSfxRangePointerDown);
    musicVol.addEventListener('input', onMusicRange);
    sfxMute.addEventListener('change', onSfxMute);
    musicMute.addEventListener('change', onMusicMute);
}

/**
 * @param {{ audioService?: import('../../services/game/AudioService.js').default }} scene
 */
export function openSoundOptionsModal(scene) {
    if (typeof document !== 'undefined' && document.getElementById('soundOptions-overlay')) {
        return;
    }

    const modal = new Modal('soundOptions', HTML, {
        scene,
        onMount(overlay) {
            mountSoundOptions(overlay, scene);
        },
    });

    void modal.show();
}
