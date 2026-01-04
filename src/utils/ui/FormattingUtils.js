/**
 * Currency formatting utilities
 */

/**
 * Format pennies to dollar string (returns formatted number without dollar sign)
 * @param {number} pennies - Amount in pennies
 * @returns {string} Formatted dollar amount without $ symbol (e.g., "2,000.00")
 */
export function formatPenniesToDollars(pennies) {
    return (pennies / 100).toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
}

/**
 * Convert dollars to cents
 * @param {number} dollars - Amount in dollars
 * @returns {number} Amount in cents
 */
export function dollarsToCents(dollars) {
    return Math.round(dollars * 100);
}

/**
 * Normalize balance value - auto-detect if in dollars or cents and convert to cents
 * @param {number} balance - Balance value (may be in dollars or cents)
 * @returns {number} Balance in cents
 */
export function normalizeBalance(balance) {
    // If balance is less than 1000, it's likely in dollars, convert to cents
    if (balance < 1000) {
        return Math.round(balance * 100);
    }
    // Otherwise, assume it's already in cents
    return Math.round(balance);
}

