import AutoPlayOptions from '../../AutoPlayOptions.js';

/**
 * Show the autoplay options popup
 * @param {Phaser.Scene} scene - The Phaser scene instance (needed to access prefab_ScratchManager)
 * @returns {AutoPlayOptions} The AutoPlayOptions instance
 */
export function showAutoPlayOptions(scene) {
    const popup = new AutoPlayOptions(scene);
    popup.show();
    return popup;
}

