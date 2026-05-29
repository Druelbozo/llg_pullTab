/**
 * Currency formatting utilities (scratch / video-poker / keno parity)
 *
 * All stored amounts (`creditValueMinor`, `payoutMinor`, bet totals, wallet balance) are
 * wallet minors (pennies). Display divisors by currency:
 *   GC  → ÷ GC_MINOR_PER_DISPLAY_UNIT   (default 100; 2 decimals, omitted when .00)
 *   SC  → ÷ SC_MINOR_PER_DISPLAY_DOLLAR (default 1000, 2 decimals)
 *   USD → ÷ USD_MINOR_PER_DISPLAY_DOLLAR (default 100, 2 decimals + $)
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

export function isUsdFiatPenniesCurrency(code) {
    return normalizeCurrencyCode(code) === 'USD';
}

export function usesUsdStyleMinorDisplay(code) {
    const c = normalizeCurrencyCode(code);
    return c === 'USD' || c === 'SC';
}

export function isGoldCoinsCurrency(code) {
    return String(code ?? '').trim().toUpperCase() === 'GC';
}

export function isSweepsCoinsCurrency(code) {
    return String(code ?? '').trim().toUpperCase() === 'SC';
}

export function getActiveCurrencyCode() {
    const raw = GameConfig.game.DISPLAY_CURRENCY_CODE ?? GameConfig.game.CURRENCY_CODE;
    return normalizeCurrencyCode(raw);
}

export function getMinorPerDisplayUnit(currencyCode) {
    const code = normalizeCurrencyCode(currencyCode ?? getActiveCurrencyCode());
    if (code === 'SC') {
        return getScMinorPerDisplayDollar();
    }
    if (code === 'USD') {
        return getUsdMinorPerDisplayDollar();
    }
    return getGcMinorPerDisplayUnit();
}

export function getUsdMinorPerDisplayDollar() {
    const raw = GameConfig.game.USD_MINOR_PER_DISPLAY_DOLLAR ?? GameConfig.game.MINOR_PER_DISPLAY_DOLLAR;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
        return n;
    }
    return 100;
}

export function getGcMinorPerDisplayUnit() {
    const raw = GameConfig.game.GC_MINOR_PER_DISPLAY_UNIT ?? GameConfig.game.BALANCE_MINOR_PER_DOLLAR;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
        return n;
    }
    return 100;
}

export function getScMinorPerDisplayDollar() {
    const raw = GameConfig.game.SC_MINOR_PER_DISPLAY_DOLLAR;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
        return n;
    }
    return 1000;
}

/** @deprecated Use {@link getMinorPerDisplayUnit} with currency code. */
export function getMinorPerDisplayDollar() {
    return getUsdMinorPerDisplayDollar();
}

/** @deprecated Use {@link getGcMinorPerDisplayUnit} or {@link getUsdMinorPerDisplayDollar}. */
export function getBalanceMinorPerDollar() {
    return getUsdMinorPerDisplayDollar();
}

/** @deprecated No longer used. */
export function getEconomyGcUnitsPerDisplayDollar() {
    return getGcMinorPerDisplayUnit();
}

export function getCreditValueAmounts(currencyCode) {
    const code = normalizeCurrencyCode(currencyCode ?? getActiveCurrencyCode());
    const list = code === 'GC'
        ? GameConfig.game.CREDIT_VALUE_AMOUNTS_GC
        : GameConfig.game.CREDIT_VALUE_AMOUNTS_SC_USD;
    return Array.isArray(list) ? [...list] : [];
}

export function getDefaultCreditValueMinor(currencyCode) {
    const code = normalizeCurrencyCode(currencyCode ?? getActiveCurrencyCode());
    const amounts = getCreditValueAmounts(code);
    const preferred = code === 'GC'
        ? GameConfig.game.CREDIT_VALUE_MINOR_GC
        : GameConfig.game.CREDIT_VALUE_MINOR_SC_USD;
    if (amounts.includes(preferred)) {
        return preferred;
    }
    return amounts[0] ?? 25;
}

export function normalizeCreditValueMinor(value, currencyCode) {
    const amounts = getCreditValueAmounts(currencyCode);
    const n = Math.round(Number(value));
    if (Number.isFinite(n) && amounts.includes(n)) {
        return n;
    }
    return getDefaultCreditValueMinor(currencyCode);
}

export function minorsToDisplayString(minor, currencyCode) {
    const n = Number(minor);
    const safe = Number.isFinite(n) ? n : 0;
    const code = normalizeCurrencyCode(currencyCode ?? getActiveCurrencyCode());
    const divisor = getMinorPerDisplayUnit(code);
    const value = safe / divisor;
    const gcWhole = code === 'GC' && divisor > 0 && safe % divisor === 0;
    return value.toLocaleString('en-US', {
        minimumFractionDigits: gcWhole ? 0 : 2,
        maximumFractionDigits: gcWhole ? 0 : 2,
    });
}

export function minorsToDisplayDollarString(minor, currencyCode) {
    return minorsToDisplayString(minor, currencyCode);
}

export function minorsToDisplayDollarStringWithSymbol(minor, currencyCode) {
    return '$' + minorsToDisplayString(minor, currencyCode);
}

export function formatBuyInMinorForDisplay(minor, currencyCode) {
    return formatMinorForDisplay(minor, currencyCode);
}

export function formatBuyInMinorForDisplayWithSymbol(minor, currencyCode) {
    return formatMinorForDisplayWithSymbol(minor, currencyCode);
}

export function formatGcMinorAmount(minor, currencyCode) {
    return minorsToDisplayString(minor, currencyCode ?? 'GC');
}

export function formatBalanceMinorForDisplay(minor, currencyCode) {
    return minorsToDisplayString(minor, currencyCode ?? getActiveCurrencyCode());
}

export function formatBalanceMinorForDisplayWithSymbol(minor, currencyCode) {
    const code = normalizeCurrencyCode(currencyCode ?? getActiveCurrencyCode());
    if (isGoldCoinsCurrency(code)) {
        return formatBalanceMinorForDisplay(minor, code);
    }
    return '$' + formatBalanceMinorForDisplay(minor, code);
}

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
    const amountStr = formatGcMinorAmount(maxPayout, code);
    return `Match ${matchDisplay.trim()} prizes and win up to ${amountStr} coins!`;
}

export function formatMinorForDisplay(minor, currencyCode) {
    return minorsToDisplayString(minor, currencyCode ?? getActiveCurrencyCode());
}

export function formatMinorForDisplayWithSymbol(minor, currencyCode) {
    const code = normalizeCurrencyCode(currencyCode ?? getActiveCurrencyCode());
    if (!usesUsdStyleMinorDisplay(code)) {
        return formatGcMinorAmount(minor, code);
    }
    return minorsToDisplayDollarStringWithSymbol(minor, code);
}

export function formatCreditValueOptionLabel(amountMinor, currencyCode) {
    const code = normalizeCurrencyCode(currencyCode ?? getActiveCurrencyCode());
    const a = Math.round(Number(amountMinor));
    const safe = Number.isFinite(a) ? a : 0;
    if (code === 'USD') {
        const d = getUsdMinorPerDisplayDollar();
        if (safe < d) {
            return `${safe}¢`;
        }
    }
    return formatMinorForDisplayWithSymbol(safe, code);
}

/**
 * Peel banner line: max tier payout at current credit denomination.
 * @param {number} topPayoutMinor
 * @returns {string}
 */
export function formatPullTabBannerMessage(topPayoutMinor) {
    const n = Number(topPayoutMinor);
    const safeMax = Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
    if (safeMax <= 0) {
        return '';
    }
    const code = getActiveCurrencyCode();
    const amtStr = formatMinorForDisplayWithSymbol(safeMax, code);
    let line = `OPEN THE TABS FOR WINS UP TO ${amtStr}`;
    if (isGoldCoinsCurrency(code)) {
        line += ' COINS';
    }
    return line.toUpperCase();
}

export function formatPenniesToDollars(pennies, currencyCode) {
    return minorsToDisplayString(pennies, currencyCode ?? 'USD');
}

export function formatPenniesToDollarsWithSymbol(pennies, currencyCode) {
    return minorsToDisplayDollarStringWithSymbol(pennies, currencyCode ?? 'USD');
}

function formatKmScaled(x) {
    const rounded = Math.round(x * 10) / 10;
    if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
        return String(Math.round(rounded));
    }
    const s = rounded.toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
}

function tryFormatCompactKm(absFace) {
    if (absFace >= 1_000_000) {
        return formatKmScaled(absFace / 1_000_000) + 'm';
    }
    if (absFace >= 1000) {
        return formatKmScaled(absFace / 1000) + 'k';
    }
    return null;
}

export function formatScratchPrizeTileText(prizeMinor, currencyCode) {
    const code = normalizeCurrencyCode(currencyCode ?? getActiveCurrencyCode());
    const minor = Math.round(Number(prizeMinor));
    if (!Number.isFinite(minor)) {
        return '';
    }

    const divisor = getMinorPerDisplayUnit(code);
    const displayFace = minor / divisor;
    const sign = displayFace < 0 ? '-' : '';
    const compact = tryFormatCompactKm(Math.abs(displayFace));
    if (compact !== null) {
        return sign + compact;
    }

    if (!usesUsdStyleMinorDisplay(code)) {
        return formatGcMinorAmount(minor, code);
    }

    return minorsToDisplayDollarString(minor, code);
}

export function dollarsToCents(dollars, currencyCode) {
    const code = normalizeCurrencyCode(currencyCode ?? 'USD');
    return Math.round(Number(dollars) * getMinorPerDisplayUnit(code));
}

export function normalizeBalance(balance, currencyCode = 'USD') {
    const code = normalizeCurrencyCode(currencyCode);
    const n = Math.round(Number(balance));
    if (!Number.isFinite(n)) {
        return 0;
    }

    if (!usesUsdStyleMinorDisplay(code)) {
        return n;
    }

    if (isSweepsCoinsCurrency(code)) {
        const internalDivisor = getScMinorPerDisplayDollar();
        const operatorDivisor = GameConfig.game.OPERATOR_SC_MINOR_PER_DISPLAY_DOLLAR ?? 100;
        if (
            operatorDivisor > 0 &&
            internalDivisor > operatorDivisor &&
            n < internalDivisor
        ) {
            return Math.round(n * (internalDivisor / operatorDivisor));
        }
        return n;
    }

    const usdDivisor = getUsdMinorPerDisplayDollar();
    if (n < 1000) {
        return Math.round(n * usdDivisor);
    }
    return n;
}

export function migrateLegacyEconomyMinorToPennyNative(minor) {
    const n = Math.round(Number(minor));
    if (!Number.isFinite(n) || n <= 0) {
        return 0;
    }
    if (n >= 10000) {
        return Math.round(n / 1000);
    }
    return n;
}

/** Stored minors are wallet pennies — no conversion at bet/payout boundaries. */
export function economyMinorToWalletMinors(economyMinor, _currencyCode) {
    const e = Math.round(Number(economyMinor));
    return Number.isFinite(e) ? e : 0;
}
