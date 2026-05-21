/**
 * Simple error modal with title and message (scratch-aligned).
 *
 * @param {string} title
 * @param {string} message
 * @returns {string}
 */
export function errorModalContent(title = 'Error', message = 'An error occurred') {
	return `
        <div class="error-modal-content">
            <h2 class="error-title">${title}</h2>
            <p class="error-message">${message}</p>
        </div>
    `;
}
