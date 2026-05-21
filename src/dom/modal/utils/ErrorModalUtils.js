import Modal from '../../Modal.js';
import { errorModalContent } from '../content/errorModalContent.js';

/**
 * @param {string} title
 * @param {string} message
 * @param {Phaser.Scene|null|undefined} [scene]
 * @returns {Modal}
 */
export function showErrorModal(title = 'Error', message = 'An error occurred', scene = null) {
	const modal = new Modal('error', () => errorModalContent(title, message), scene ?? undefined);
	void modal.show();
	return modal;
}

/**
 * @param {string} message
 * @param {Phaser.Scene|null|undefined} [scene]
 * @returns {Modal}
 */
export function showServerErrorModal(message = 'A server error occurred. Please try again later.', scene = null) {
	return showErrorModal('Server Error', message, scene);
}

/**
 * Insufficient balance for the current buy-in.
 *
 * @param {Phaser.Scene|null|undefined} [scene]
 * @returns {Modal}
 */
export function showInsufficientFundsModal(scene = null) {
	return showErrorModal(
		'Insufficient Funds',
		'You do not have enough balance to place this bet.',
		scene,
	);
}

/**
 * Buy API failed (network / server). Customer-facing: no charge, retry.
 *
 * @param {Phaser.Scene|null|undefined} [scene]
 * @returns {Modal}
 */
export function showPurchaseFailedModal(scene = null) {
	return showErrorModal(
		'Unable to Complete Purchase',
		'We could not process your purchase just now. You have not been charged for this round. Please try again in a few moments.',
		scene,
	);
}
