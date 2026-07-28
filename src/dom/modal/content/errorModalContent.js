/**
 * Simple error modal with title and message (scratch-aligned).
 *
 * @param {string} title
 * @param {string} message
 * @returns {string}
 */
function escapeHtml(text) {
	return String(text ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export function errorModalContent(title = 'Error', message = 'An error occurred') {
	const safeTitle = escapeHtml(title);
	const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');
	return `
        <div class="error-modal-content">
            <h2 class="error-title">${safeTitle}</h2>
            <p class="error-message">${safeMessage}</p>
        </div>
    `;
}
