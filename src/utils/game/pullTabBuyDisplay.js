/**
 * Maps pull-tabs `/buy` API rows onto peel-tab atlas frame indices (positions in ordered frame list).
 * Win tiers use `symbol_01`…→ index 0,1,… (lowest prize = first atlas frame). Lose rows use distinct indices.
 */

import {
	extractOrderedIconsFrameNamesFromTexture,
	getPullTabIconsFrameNames,
} from '../theme/PullTabIconsAtlasUtils.js';
import { economyMinorToWalletMinors, getDefaultCreditValueMinor } from '../formatting/FormattingUtils.js';

const SYMBOL_RE = /^symbol_(\d+)$/i;

function hashString(s) {
    const str = String(s ?? '');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/** Unsigned 32-bit mix — varies loser-row art across rounds using API entropy */
function mixU32(a, b = 0, c = 0) {
    let x = (Number(a) || 0) >>> 0;
    x ^= (Number(b) || 0) >>> 0;
    x = Math.imul(x, 2246822519);
    x ^= (Number(c) || 0) >>> 0;
    x = Math.imul(x, 3266489917);
    x ^= x >>> 16;
    return x >>> 0;
}

/**
 * Stable seed per `/buy` response so loser rows change each ticket (not just per row index).
 * @param {object} buyJson
 */
export function buyRoundEntropySeed(buyJson) {
    let h = hashString(buyJson?.rngNonce);
    h = mixU32(h, hashString(buyJson?.timestamp));
    h = mixU32(h, Number(buyJson?.ticketPoolIndex) || 0, Number(buyJson?.ticketPoolSize) || 0);
    h = mixU32(h, hashString(buyJson?.outcomeTierId), hashString(buyJson?.paytableId));
    h = mixU32(h, Number(buyJson?.payoutMinor) || 0);
    return h >>> 0;
}

function junkSymbolsFingerprint(symbols) {
    const arr = Array.isArray(symbols) ? symbols : [];
    let h = 374761393 >>> 0;
    for (let i = 0; i < arr.length; i++) {
        h = mixU32(h, hashString(arr[i]));
    }
    return h >>> 0;
}

/**
 * @param {string} symbol
 * @returns {number}
 */
export function tierSymbolToFrameIndex(symbol) {
    const m = SYMBOL_RE.exec(String(symbol ?? '').trim());
    if (!m) return 0;
    return Math.max(0, parseInt(m[1], 10) - 1);
}

/**
 * Ordered atlas slot indices 0…n-1 (matches {@link getPullTabIconsFrameNames} order).
 *
 * @param {Phaser.Scene} scene
 * @returns {number[]}
 */
function sortedPullTabIconSlotIndices(scene) {
	const names = getPullTabIconsFrameNames(scene);
	if (names.length > 0) {
		const out = [];
		for (let i = 0; i < names.length; i++) {
			out.push(i);
		}
		return out;
	}
	const key = peelTabIconsAtlasKey(scene);
	const tex = scene?.textures?.get?.(key);
	const fallbackNames = extractOrderedIconsFrameNamesFromTexture(tex);
	return fallbackNames.map((_, i) => i);
}

/** @returns {string} Phaser atlas key — must match PeelIcons */
export function peelTabIconsAtlasKey(scene) {
    return scene?.textures?.exists?.('icons') ? 'icons' : 'DI_Icons_Default';
}

/**
 * Wallet minors required for one pull-tab buy (economy creditValueMinor → wallet scale).
 *
 * @param {Phaser.Scene|null|undefined} scene
 * @returns {number}
 */
export function resolvePullTabBuyWalletDebitMinor(scene) {
	const sm = scene?.serverManager;
	const gc = typeof window !== 'undefined' ? window.__selectedGameConfig || {} : {};
	const creditMinor = Math.round(
		Number(gc.creditValueMinor ?? sm?.gameConfig?.creditValueMinor ?? getDefaultCreditValueMinor()),
	);
	const priceMinor = Number.isFinite(creditMinor) && creditMinor > 0 ? creditMinor : getDefaultCreditValueMinor();
	return economyMinorToWalletMinors(priceMinor);
}

/**
 * Pick three distinct frame indices so we never show a false “triple winner” row.
 *
 * @param {Phaser.Scene} scene
 * @param {number} rowIndex — peel row index (layout only)
 * @param {number} [rowEntropy] — mixed from round seed + junk symbols (+ row index)
 * @returns {[number, number, number]}
 */
export function loserRowDisplayTriple(scene, rowIndex, rowEntropy = 0) {
    const nums = sortedPullTabIconSlotIndices(scene);
    let pool = nums.length >= 3 ? [...nums] : null;

    if (!pool?.length) {
        const key = peelTabIconsAtlasKey(scene);
        const tex = scene?.textures?.get?.(key);
        const count = tex?.frameTotal ?? 24;
        pool = [];
        for (let i = 0; i < Math.max(9, Math.min(count, 60)); i++) {
            pool.push(i);
        }
    }

    const n = pool.length;
    const ri = Number(rowIndex) || 0;
    const seed = mixU32(rowEntropy, ri * 2654435761, ri + 0x9e3779b9);
    let a = pool[seed % n];
    let b = pool[(seed + Math.max(1, Math.floor(n / 7))) % n];
    let c = pool[(seed + Math.max(2, Math.floor((3 * n) / 11))) % n];

    let k = 0;
    while ((a === b || a === c || b === c) && k < n * 8) {
        b = pool[(seed + k + 1 + Math.floor(k / n)) % n];
        c = pool[(seed + k * 3 + Math.floor(n / 2) + k) % n];
        k++;
    }

    if (a === b || a === c || b === c) {
        const unique = [...new Set(pool)];
        while (unique.length < 3) {
            unique.push(unique.length || 7);
        }
        return unique.slice(0, 3);
    }

    return [a, b, c];
}

/**
 * @typedef {object} PullTabNormalizedRound
 * @property {number[][]} tabs - One triple of frame indices per row (matches peel lines)
 * @property {number} payoutMinor - Win amount in economy minors
 * @property {boolean} won
 * @property {number} rowCount
 * @property {{ symbols: string[], isWinRow: boolean }[]} rowsRaw
 * @property {object} apiResponse
 */

/**
 * @param {Phaser.Scene} scene
 * @param {object} buyJson — `/pull-tabs/(test/)buy` success body
 * @returns {PullTabNormalizedRound}
 */
export function normalizePullTabsBuy(scene, buyJson) {
    const payoutMinor = Math.round(Number(buyJson?.payoutMinor ?? 0));
    const rowsIn = Array.isArray(buyJson?.rows) ? buyJson.rows : [];
    const declared = Number(buyJson?.rowCount);
    const rowCount =
        Number.isFinite(declared) && declared > 0
            ? declared
            : rowsIn.length > 0
              ? rowsIn.length
              : 7;

    const roundSeed = buyRoundEntropySeed(buyJson);

    /** @type {number[][]} */
    const tabs = [];
    rowsIn.forEach((row, rowIdx) => {
        const symbols = Array.isArray(row?.symbols) ? row.symbols : [];
        /** @type {number[]} */
        let triple;

        if (row?.isWinRow === true && symbols.length >= 3) {
            const fi = tierSymbolToFrameIndex(symbols[0]);
            triple = [fi, fi, fi];
        } else {
            const junkFp = junkSymbolsFingerprint(symbols);
            const rowEntropy = mixU32(roundSeed, junkFp, rowIdx * 4099);
            triple = loserRowDisplayTriple(scene, rowIdx, rowEntropy);
        }
        tabs.push(triple);
    });

    while (tabs.length < rowCount) {
        const padIdx = tabs.length + 999;
        tabs.push(
            loserRowDisplayTriple(scene, padIdx, mixU32(roundSeed, padIdx * 733, 0xbeef)),
        );
    }
    if (tabs.length > rowCount) {
        tabs.length = rowCount;
    }

    return {
        tabs,
        payoutMinor,
        won: payoutMinor > 0 || rowsIn.some((r) => r?.isWinRow === true),
        rowCount,
        rowsRaw: rowsIn.map((r) => ({
            symbols: Array.isArray(r?.symbols) ? [...r.symbols] : [],
            isWinRow: !!r?.isWinRow,
        })),
        apiResponse: buyJson || {},
    };
}
