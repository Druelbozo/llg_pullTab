/**
 * Autoplay Options Content Generator
 * Creates HTML content for the autoplay options popup
 * @param {boolean} autoplayEnabled - Whether autoplay is currently enabled
 * @param {number} selectedAmount - The currently selected autoplay amount
 * @param {number[]} availableAmounts - Array of available autoplay amounts
 * @returns {string} HTML content for the popup
 */
export function autoplayOptionsContent(autoplayEnabled = false, selectedAmount = 10, availableAmounts = [10, 25, 50, 75, 100, 500]) {
    const toggleText = autoplayEnabled ? 'ON' : 'OFF';
    const toggleClass = autoplayEnabled ? 'selected' : '';
    
    const amountButtonsHTML = availableAmounts.map(amount => {
        const isSelected = amount === selectedAmount ? 'selected' : '';
        return `<button class="autoplay-options-amount-button ${isSelected}" data-amount="${amount}">${amount}</button>`;
    }).join('');
    
    return `
        <div class="autoplay-options-content">
            <h2 class="autoplay-options-title">AUTOPLAY OPTIONS</h2>
            
            <div class="autoplay-options-section">
                <button class="autoplay-options-toggle-button ${toggleClass}" data-toggle="autoplay">
                    ${toggleText}
                </button>
            </div>
            
            <div class="autoplay-options-section">
                <h3 class="autoplay-options-section-title">AUTOPLAY AMOUNT</h3>
                <div class="autoplay-options-amount-buttons">
                    ${amountButtonsHTML}
                </div>
            </div>
        </div>
    `;
}

