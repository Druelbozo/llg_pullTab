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
 * @param {string} [detail] Optional reason (HTTP status / API message).
 * @returns {Modal}
 */
export function showPurchaseFailedModal(scene = null, detail = '') {
	const fallback =
		'We could not process your purchase just now. You have not been charged for this round. Please try again in a few moments.';
	const message = detail && String(detail).trim() ? String(detail).trim() : fallback;
	return showErrorModal('Unable to Complete Purchase', message, scene);
}

/**
 * Game config missing required demo fields (paytableId).
 *
 * @param {Phaser.Scene|null|undefined} [scene]
 * @param {string} [detail]
 * @returns {Modal}
 */
export function showConfigErrorModal(scene = null, detail = '') {
	const message =
		detail && String(detail).trim()
			? String(detail).trim()
			: 'Game configuration is incomplete (missing paytableId). Reload with a valid ?config= theme or provider session.';
	return showErrorModal('Configuration Error', message, scene);
}
