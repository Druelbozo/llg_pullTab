/**
 * Pull-tab `awardTiers` math shared by UI banner and modal paytable rendering.
 */

/**
 * @param {string} symbol
 * @returns {boolean}
 */
export function isJunkAwardTierSymbol(symbol) {
    return /junk/i.test(String(symbol ?? '').trim());
}

/**
 * Economy minors for one tier at the session / config credit denomination.
 *
 * @param {object} tier
 * @param {number} creditValueMinor
 * @returns {number}
 */
export function payoutMinorForAwardTier(tier, creditValueMinor) {
    const pm = tier?.payoutMinor;
    if (typeof pm === 'number' && Number.isFinite(pm)) {
        return Math.round(pm);
    }
    const mul = tier?.multiplier;
    const c = Math.round(Number(creditValueMinor));
    if (typeof mul === 'number' && Number.isFinite(mul) && c > 0) {
        return Math.round(mul * c);
    }
    return 0;
}

/**
 * Largest winning payout across non-junk award tiers (`get-paytable-info` / Dynamo shape).
 *
 * @param {unknown} awardTiers
 * @param {number} creditValueMinor
 * @returns {number|null}
 */
export function maxPayoutMinorFromAwardTiers(awardTiers, creditValueMinor) {
    if (!Array.isArray(awardTiers) || awardTiers.length === 0) {
        return null;
    }
    const c = Math.round(Number(creditValueMinor));
    let max = 0;
    for (const tier of awardTiers) {
        if (!tier || typeof tier !== 'object') continue;
        if (isJunkAwardTierSymbol(tier.symbol)) continue;
        const p = payoutMinorForAwardTier(tier, c);
        if (p > max) max = p;
    }
    return max > 0 ? max : null;
}
