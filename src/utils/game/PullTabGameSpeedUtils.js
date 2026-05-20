/**
 * Pull-tab game speed (speed button x1/x2/x3 → PeelManager.speed + registry GameSpeed).
 */

import { GameConfig } from '../../config/Global.js';

/**
 * Active speed multiplier from the speed button / PeelManager.
 *
 * @param {Phaser.Scene} scene
 * @returns {number}
 */
export function getPullTabGameSpeed(scene) {
	const fromManager = Number(scene?.peelManager?.speed);
	if (Number.isFinite(fromManager) && fromManager > 0) {
		return fromManager;
	}
	const fromRegistry = Number(scene?.registry?.get?.('GameSpeed'));
	if (Number.isFinite(fromRegistry) && fromRegistry > 0) {
		return fromRegistry;
	}
	const start = Number(GameConfig.game.START_SPEED);
	return Number.isFinite(start) && start > 0 ? start : 1;
}

/**
 * Convert a wall-time value at speed 1 into ms at the current game speed (higher speed → shorter).
 *
 * @param {Phaser.Scene} scene
 * @param {number} msAtSpeed1
 * @returns {number}
 */
export function msAtSpeed1ToGameSpeed(scene, msAtSpeed1) {
	const base = Number(msAtSpeed1);
	if (!Number.isFinite(base) || base < 0) {
		return 0;
	}
	return base / getPullTabGameSpeed(scene);
}
