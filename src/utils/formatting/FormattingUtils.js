/**
 * Currency formatting utilities
 *
 * **Economy** (buy-in `creditValueMinor`, paytable payouts, prize tiles, banner max win, win count-up):
 * SC/USD use `MINOR_PER_DISPLAY_DOLLAR`. GC uses `ECONOMY_GC_UNITS_PER_DISPLAY_DOLLAR` so e.g. `$1` SC face ↔ `1,000` GC face for the same stored minor.
 *
 * **Wallet / balance** (header Balance, balance text area, post-buy balance tween):
 * SC, USD, and GC use **pennies** — `BALANCE_MINOR_PER_DOLLAR` (default 100). SC/USD → `$` + cents; GC → whole dollars, grouped, no `$`.
 */
import { GameConfig } from '../../config/Global.js';

/**
 * @param {unknown} code
 * @returns {'USD'|'GC'|'SC'}
 */
export function normalizeCurrencyCode(code) {
    if (code == null || code === '') {
        return 'GC';
    }
    const u = String(code).trim().toUpperCase();
    if (u === 'USD') {
        return 'USD';
    }
    if (u === 'SC') {
        return 'SC';
    }
    if (u === 'GC') {
        return 'GC';
    }
    return 'GC';
}

/**
 * @param {unknown} code
 * @returns {boolean} True only for US dollar fiat (not SC / GC).
 */
export function isUsdFiatPenniesCurrency(code) {
    return normalizeCurrencyCode(code) === 'USD';
}

/**
 * Minor amounts shown as dollars with `$`: USD and SC (divisor from config).
 * @param {unknown} code
 * @returns {boolean}
 */
export function usesUsdStyleMinorDisplay(code) {
    const c = normalizeCurrencyCode(code);
    return c === 'USD' || c === 'SC';
}

/**
 * @param {unknown} code
 * @returns {boolean} True only for gold coins (not SC, not unknown).
 */
export function isGoldCoinsCurrency(code) {
    return String(code ?? '').trim().toUpperCase() === 'GC';
}

/**
 * @param {unknown} code
 * @returns {boolean} True only for sweeps coins.
 */
export function isSweepsCoinsCurrency(code) {
    return String(code ?? '').trim().toUpperCase() === 'SC';
}

/**
 * Active currency for display and API: session override when set, else Global.CURRENCY_CODE.
 * @returns {'USD'|'GC'|'SC'}
 */
export function getActiveCurrencyCode() {
    const raw = GameConfig.game.DISPLAY_CURRENCY_CODE ?? GameConfig.game.CURRENCY_CODE;
    return normalizeCurrencyCode(raw);
}

/**
 * Divisor for converting stored minors → displayed dollar amount for USD/SC (`minor / divisor`).
 * @returns {number}
 */
export function getMinorPerDisplayDollar() {
    const raw = GameConfig.game.MINOR_PER_DISPLAY_DOLLAR;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
        return n;
    }
    return 100;
}

/**
 * Wallet balance: minors are treated as pennies; display dollars = minors ÷ this (SC, USD, GC).
 * @returns {number}
 */
export function getBalanceMinorPerDollar() {
    const raw = GameConfig.game.BALANCE_MINOR_PER_DOLLAR;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
        return n;
    }
    return 100;
}

/**
 * Economy GC: displayed whole coins per one SC/USD display dollar at {@link getMinorPerDisplayDollar}.
 * @returns {number}
 */
export function getEconomyGcUnitsPerDisplayDollar() {
    const raw = GameConfig.game.ECONOMY_GC_UNITS_PER_DISPLAY_DOLLAR;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
        return n;
    }
    return 1000;
}

export function minorsToDisplayDollarString(minor) {
    const n = Number(minor);
    const safe = Number.isFinite(n) ? n : 0;
    const divisor = getMinorPerDisplayDollar();
    return (safe / divisor).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function minorsToDisplayDollarStringWithSymbol(minor) {
    return '$' + minorsToDisplayDollarString(minor);
}

/**
 * Buy-in / `creditValueMinor`: **economy** path — same as {@link formatMinorForDisplay} (not wallet pennies).
 *
 * @param {number} minor
 * @param {unknown} [currencyCode]
 * @returns {string}
 */
export function formatBuyInMinorForDisplay(minor, currencyCode) {
    return formatMinorForDisplay(minor, currencyCode);
}

/**
 * @param {number} minor
 * @param {unknown} [currencyCode]
 * @returns {string}
 */
export function formatBuyInMinorForDisplayWithSymbol(minor, currencyCode) {
    return formatMinorForDisplayWithSymbol(minor, currencyCode);
}

/**
 * Economy GC: whole coin units from stored minors (`minors ×` {@link getEconomyGcUnitsPerDisplayDollar} `÷` {@link getMinorPerDisplayDollar}).
 * @param {unknown} minor
 * @returns {number}
 */
function economyGcMinorToDisplayWhole(minor) {
    const n = Math.round(Number(minor));
    const safe = Number.isFinite(n) ? n : 0;
    const D = getMinorPerDisplayDollar();
    const k = getEconomyGcUnitsPerDisplayDollar();
    return Math.trunc((safe * k) / D);
}

function formatEconomyGcMinorDigits(minor) {
    const whole = economyGcMinorToDisplayWhole(minor);
    return whole.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/**
 * @param {number} minor - Economy-layer GC amount (same scale as `creditValueMinor` / payouts)
 * @returns {string} Grouped whole GC coins (no suffix)
 */
export function formatGcMinorAmount(minor) {
    return formatEconomyGcMinorDigits(minor);
}

/**
 * Wallet display: penny-denominated minors → SC/USD `$` with cents, or GC whole dollars (no `$`).
 * @param {number} minor
 * @param {unknown} [currencyCode]
 * @returns {string}
 */
export function formatBalanceMinorForDisplay(minor, currencyCode) {
    const code = normalizeCurrencyCode(currencyCode ?? getActiveCurrencyCode());
    const b = getBalanceMinorPerDollar();
    const n = Number(minor);
    const safe = Number.isFinite(n) ? n : 0;
    if (isGoldCoinsCurrency(code)) {
        return Math.trunc(safe / b).toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
    return (safe / b).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/**
 * @param {number} minor
 * @param {unknown} [currencyCode]
 * @returns {string} GC: same as {@link formatBalanceMinorForDisplay}; SC/USD: `$` + amount
 */
export function formatBalanceMinorForDisplayWithSymbol(minor, currencyCode) {
    const code = normalizeCurrencyCode(currencyCode ?? getActiveCurrencyCode());
    if (isGoldCoinsCurrency(code)) {
        return formatBalanceMinorForDisplay(minor, code);
    }
    return '$' + formatBalanceMinorForDisplay(minor, code);
}

/**
 * Top win in minor units: max `prizeInventory[].payoutMinor`, else `derived.topMultiplier × creditValueMinor`.
 * @param {Object} paytableData
 * @returns {number|null}
 */
function getMaxPayoutMinorFromPaytable(paytableData) {
    if (!paytableData || typeof paytableData !== 'object') {
        return null;
    }
    const inv = paytableData.prizeInventory;
    if (Array.isArray(inv) && inv.length > 0) {
        let max = 0;
        for (const p of inv) {
            const v = p?.payoutMinor;
            if (typeof v === 'number' && Number.isFinite(v) && v > max) {
                max = v;
            }
        }
        if (max > 0) {
            return max;
        }
    }
    const tm = paytableData.derived?.topMultiplier;
    const c = paytableData.creditValueMinor;
    if (
        typeof tm === 'number' &&
        typeof c === 'number' &&
        Number.isFinite(tm) &&
        Number.isFinite(c) &&
        tm > 0 &&
        c > 0
    ) {
        return Math.round(tm * c);
    }
    return null;
}

/**
 * messageText line above the scratch card: match count + max win.
 * USD / SC: uses API `prizeDisplayText` (unchanged).
 * GC / other non-USD: "Match {matchDisplay} prizes and win up to {N} coins!"
 *
 * @param {Object|null|undefined} paytableData
 * @returns {string}
 */
export function formatScratchPrizeBannerMessage(paytableData) {
    if (!paytableData || typeof paytableData !== 'object') {
        return '';
    }
    const code = getActiveCurrencyCode();
    if (usesUsdStyleMinorDisplay(code)) {
        return paytableData.prizeDisplayText || '';
    }
    const maxPayout = getMaxPayoutMinorFromPaytable(paytableData);
    if (maxPayout == null || !Number.isFinite(maxPayout) || maxPayout <= 0) {
        return paytableData.prizeDisplayText || '';
    }
    const { matchDisplay } = paytableData;
    if (!matchDisplay || typeof matchDisplay !== 'string' || !matchDisplay.trim()) {
        return paytableData.prizeDisplayText || '';
    }
    const amountStr = formatGcMinorAmount(maxPayout);
    return `Match ${matchDisplay.trim()} prizes and win up to ${amountStr} coins!`;
}

/**
 * @param {number} minor
 * @param {unknown} [currencyCode] - defaults to getActiveCurrencyCode()
 * @returns {string} SC/USD: economy dollars ({@link getMinorPerDisplayDollar}); GC: economy GC units ({@link getEconomyGcUnitsPerDisplayDollar})
 */
export function formatMinorForDisplay(minor, currencyCode) {
    const code = normalizeCurrencyCode(currencyCode ?? getActiveCurrencyCode());
    if (!usesUsdStyleMinorDisplay(code)) {
        return formatEconomyGcMinorDigits(minor);
    }
    return minorsToDisplayDollarString(minor);
}

/**
 * @param {number} minor
 * @param {unknown} [currencyCode]
 * @returns {string} Economy: `"$1,000.00"` (USD/SC) or grouped GC coins (no `$`)
 */
export function formatMinorForDisplayWithSymbol(minor, currencyCode) {
    const code = normalizeCurrencyCode(currencyCode ?? getActiveCurrencyCode());
    if (!usesUsdStyleMinorDisplay(code)) {
        return formatGcMinorAmount(minor);
    }
    return minorsToDisplayDollarStringWithSymbol(minor);
}

/**
 * Credit value picker: **economy** — GC coins vs SC/USD divisor; USD + `D===100` uses `¢` when &lt; $1.
 * @param {number} amountMinor
 * @param {unknown} [currencyCode]
 * @returns {string}
 */
export function formatCreditValueOptionLabel(amountMinor, currencyCode) {
    const code = normalizeCurrencyCode(currencyCode ?? getActiveCurrencyCode());
    if (!usesUsdStyleMinorDisplay(code)) {
        return formatGcMinorAmount(amountMinor);
    }
    const D = getMinorPerDisplayDollar();
    const a = Math.round(Number(amountMinor));
    const safe = Number.isFinite(a) ? a : 0;
    if (D === 100 && safe < 100) {
        return `${safe}¢`;
    }
    return minorsToDisplayDollarStringWithSymbol(safe);
}

/**
 * Legacy name: minors → dollar string without `$`, two fraction digits. Uses {@link getMinorPerDisplayDollar}.
 */
export function formatPenniesToDollars(pennies) {
    return minorsToDisplayDollarString(pennies);
}

/**
 * Legacy name: minors → dollar string with `$`. Uses {@link getMinorPerDisplayDollar}.
 */
export function formatPenniesToDollarsWithSymbol(pennies) {
    return minorsToDisplayDollarStringWithSymbol(pennies);
}

/**
 * One decimal for k/m suffix; whole numbers omit fraction (e.g. 1.5 → "1.5", 1.0 → "1").
 * @param {number} x - positive scaled value
 */
function formatKmScaled(x) {
    const rounded = Math.round(x * 10) / 10;
    if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
        return String(Math.round(rounded));
    }
    const s = rounded.toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/**
 * @param {number} absFace - absolute display amount (economy GC whole units or USD/SC dollars)
 * @returns {string|null} e.g. "1.5k", "1.2m", or null if &lt; 1000
 */
function tryFormatCompactKm(absFace) {
    if (absFace >= 1_000_000) {
        return formatKmScaled(absFace / 1_000_000) + 'm';
    }
    if (absFace >= 1000) {
        return formatKmScaled(absFace / 1000) + 'k';
    }
    return null;
}

/**
 * Scratch tile prize text (no currency symbol): compact k/m for large values; otherwise GC or USD/SC via divisor.
 *
 * @param {number} prizeMinor
 * @param {unknown} [currencyCode]
 * @returns {string}
 */
export function formatScratchPrizeTileText(prizeMinor, currencyCode) {
    const code = normalizeCurrencyCode(currencyCode ?? getActiveCurrencyCode());
    const minor = Math.round(Number(prizeMinor));
    if (!Number.isFinite(minor)) {
        return '';
    }

    if (!usesUsdStyleMinorDisplay(code)) {
        const sign = minor < 0 ? '-' : '';
        const displayFace = Math.abs(economyGcMinorToDisplayWhole(minor));
        const compact = tryFormatCompactKm(displayFace);
        if (compact !== null) {
            return sign + compact;
        }
        return formatEconomyGcMinorDigits(minor);
    }

    const divisor = getMinorPerDisplayDollar();
    const dollars = minor / divisor;
    const sign = dollars < 0 ? '-' : '';
    const compact = tryFormatCompactKm(Math.abs(dollars));
    if (compact !== null) {
        return sign + compact;
    }
    return minorsToDisplayDollarString(minor);
}

/**
 * Convert display dollars → stored minors (USD/SC). Legacy name retained for callers.
 */
export function dollarsToCents(dollars) {
    return Math.round(Number(dollars) * getMinorPerDisplayDollar());
}

/**
 * Normalize wallet balance from API to internal **penny** minors (SC/USD/GC wallets).
 */
export function normalizeBalance(balance, currencyCode = 'USD') {
    const code = normalizeCurrencyCode(currencyCode);
    const b = getBalanceMinorPerDollar();
    if (!usesUsdStyleMinorDisplay(code)) {
        return Math.round(Number(balance));
    }
    if (balance < 1000) {
        return Math.round(balance * b);
    }
    return Math.round(balance);
}

/**
 * Converts **economy** minors (API `creditValueMinor` / `payoutMinor`) to **wallet** minors (`balancePennies` scale).
 *
 * **USD / SC:** `round(economy × BALANCE_MINOR_PER_DOLLAR ÷ MINOR_PER_DISPLAY_DOLLAR)` so \$1 stake face subtracts \$1 of wallet pennies.
 *
 * **GC:** buy-in tally uses grouped whole GC coins ({@link getEconomyGcUnitsPerDisplayDollar} / {@link getMinorPerDisplayDollar}), same as `formatMinorForDisplay`; wallet decreases by **that whole count ×** {@link getBalanceMinorPerDollar}, so subtracting displayed GC matches the label.
 *
 * Uses {@link getActiveCurrencyCode()} when `currencyCode` is omitted (session / `GameConfig.game.CURRENCY_CODE`).
 *
 * @param {number} economyMinor
 * @param {unknown} [currencyCode] — override for tests or pre-session callers; defaults to active currency.
 * @returns {number}
 */
export function economyMinorToWalletMinors(economyMinor, currencyCode) {
    const e = Math.round(Number(economyMinor));
    if (!Number.isFinite(e)) {
        return 0;
    }
    if (e === 0) {
        return 0;
    }
    const code = normalizeCurrencyCode(currencyCode ?? getActiveCurrencyCode());
    const walletB = getBalanceMinorPerDollar();
    if (isGoldCoinsCurrency(code)) {
        const whole = economyGcMinorToDisplayWhole(e);
        return Math.round(whole * walletB);
    }
    const economyD = getMinorPerDisplayDollar();
    return Math.round((e * walletB) / economyD);
}
