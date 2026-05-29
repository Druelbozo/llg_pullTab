/**
 * HTML for Pull-tab Game Info modal: rules copy + API paytable (icons / payouts).
 */

import Modal from '../../Modal.js';
import PullTabsService from '../../../services/api/PullTabsService.js';
import { tierSymbolToFrameIndex } from '../../../utils/game/pullTabBuyDisplay.js';
import { isJunkAwardTierSymbol, payoutMinorForAwardTier } from '../../../utils/game/pullTabAwardTierUtils.js';
import {
    formatMinorForDisplayWithSymbol,
    formatGcMinorAmount,
    minorsToDisplayDollarStringWithSymbol,
    getActiveCurrencyCode,
    isGoldCoinsCurrency,
    getDefaultCreditValueMinor,
} from '../../../utils/formatting/FormattingUtils.js';
import { debug, warn } from '../../../utils/logger/LoggerUtils.js';
import {
    fetchIconsAtlasJson,
    resolvePaytableIconSpriteCss,
} from '../../../utils/ui/PaytableIconsSpriteUtils.js';

/** @typedef {Phaser.Scene|null} SceneRef */

/** @type {PullTabsService|null} */
let paytableSvc = null;

function getPullTabsSvc() {
    if (!paytableSvc) {
        paytableSvc = new PullTabsService();
    }
    return paytableSvc;
}

/**
 * @param {string} s
 * @returns {string}
 */
function esc(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * One-line ticket price for modal copy: GC "N coins"; SC/USD "$X.XX" (economy minors).
 * @param {number} creditValueMinor
 * @param {'USD'|'GC'|'SC'} currencyCode
 * @returns {string}
 */
function formatTicketPriceSentenceFragment(creditValueMinor, currencyCode) {
    const raw = Math.round(Number(creditValueMinor));
    const minor = Number.isFinite(raw) && raw > 0 ? raw : getDefaultCreditValueMinor(currencyCode);
    if (isGoldCoinsCurrency(currencyCode)) {
        return `${formatGcMinorAmount(minor)} coins`;
    }
    return minorsToDisplayDollarStringWithSymbol(minor);
}

/**
 * @param {unknown} rtp
 * @returns {string|null}
 */
function formatRtpForDisplay(rtp) {
    if (rtp === null || rtp === undefined || rtp === '') {
        return null;
    }
    const r = Number(rtp);
    if (!Number.isFinite(r)) {
        return null;
    }
    if (r > 0 && r <= 1) {
        return `${(r * 100).toFixed(2)}%`;
    }
    if (r > 1 && r <= 100) {
        return `${r.toFixed(2)}%`;
    }
    return String(rtp);
}

/**
 * @param {SceneRef} scene
 * @returns {{ paytableId: string, creditValueMinor: number, theme: string }}
 */
function resolvePullTabCatalogContext(scene) {
    /** @type {Record<string, unknown>} */
    const gc =
        (typeof window !== 'undefined' && window.__selectedGameConfig) ||
        scene?.registry?.get?.('preloadGameConfig') ||
        {};

    const smCfg = scene?.serverManager?.gameConfig;

    const paytableId = String(gc.paytableId ?? smCfg?.paytableId ?? '').trim();

    const creditRaw = gc.creditValueMinor ?? smCfg?.creditValueMinor ?? getDefaultCreditValueMinor();
    const creditValueMinor =
        Number.isFinite(Math.round(Number(creditRaw))) && Math.round(Number(creditRaw)) > 0
            ? Math.round(Number(creditRaw))
            : getDefaultCreditValueMinor();

    const themeRaw = gc.theme ?? smCfg?.theme ?? 'mega-monster';
    const theme = String(themeRaw ?? '')
        .trim()
        .split(/[:]/)[0]
        .trim() || 'mega-monster';

    return { paytableId, creditValueMinor, theme };
}

/**
 * @param {SceneRef} scene
 * @returns {Promise<string>}
 */
export async function pullTabGameInfoContent(scene) {
    const currency = getActiveCurrencyCode();
    const { paytableId, creditValueMinor, theme } = resolvePullTabCatalogContext(scene);

    /** @type {object|null} */
    let atlasJson = await fetchIconsAtlasJson(theme);
    if (!atlasJson) {
        atlasJson = await fetchIconsAtlasJson('default');
        debug('[pullTabGameInfoContent] fell back to default icons atlas', 'ui', {});
    }
    if (!atlasJson) {
        warn('[pullTabGameInfoContent] icons atlas unavailable for paytable sprites', 'ui', { theme });
    }

    /** @type {object|null} */
    let payMeta = null;
    /** @type {string|null} */
    let payErr = null;

    if (paytableId) {
        try {
            payMeta = await getPullTabsSvc().getPaytableInfo(paytableId, creditValueMinor);
        } catch (e) {
            payErr = e instanceof Error ? e.message : String(e);
        }
    } else {
        payErr = 'Missing paytableId in configuration.';
    }

    const rtpStr = formatRtpForDisplay(payMeta?.rtp);

    const ticketPricePhrase = formatTicketPriceSentenceFragment(creditValueMinor, currency);

    /** @type {object[]} */
    const rawTiers = Array.isArray(payMeta?.awardTiers) ? payMeta.awardTiers : [];
    const tiers = rawTiers.filter((t) => t && typeof t === 'object' && !isJunkAwardTierSymbol(t.symbol));

    tiers.sort((a, b) => {
        const pa = payoutMinorForAwardTier(a, creditValueMinor);
        const pb = payoutMinorForAwardTier(b, creditValueMinor);
        if (pa !== pb) {
            return pa - pb;
        }
        const ca = typeof a.ticketWinCount === 'number' ? a.ticketWinCount : 0;
        const cb = typeof b.ticketWinCount === 'number' ? b.ticketWinCount : 0;
        return cb - ca;
    });

    /** @type {string[]} */
    const tableRowsHtml = [];

    if (payErr && tiers.length === 0) {
        tableRowsHtml.push(
            `<tr><td colspan="2" class="pulltab-paytable-empty">${esc(
                payErr.replace(/^API Error:\s*/i, '').trim(),
            )}</td></tr>`,
        );
    } else {
        for (const tier of tiers) {
            const sym = String(tier.symbol ?? '').trim() || '—';
            const frameIdx = tierSymbolToFrameIndex(sym);
            const sprite = resolvePaytableIconSpriteCss(scene, atlasJson, frameIdx, 36);

            let iconMarkup =
                sprite != null
                    ? `<span class="prize-sprite pulltab-paytable-icon" role="presentation" aria-hidden="true" style="${sprite.styleAttr}"></span>`
                    : '<span class="pulltab-paytable-icon-missing" aria-hidden="true"></span>';

            /** Three icons to mirror a triple-on-row win; single dash before payout amount only. */
            const iconsTriple =
                `<div class="pulltab-paytable-icons-triple" role="presentation" aria-hidden="true">` +
                `${iconMarkup}${iconMarkup}${iconMarkup}</div>` +
                `<span aria-hidden="true"> - </span>`;

            const payoutMinor = payoutMinorForAwardTier(tier, creditValueMinor);
            const payoutStr =
                payoutMinor > 0
                    ? formatMinorForDisplayWithSymbol(payoutMinor, currency)
                    : '—';

            const avail =
                typeof tier.ticketWinCount === 'number' && Number.isFinite(tier.ticketWinCount)
                    ? Math.max(0, Math.round(tier.ticketWinCount))
                    : '—';

            tableRowsHtml.push(
                `<tr>` +
                    `<td class="prize-amount-cell pulltab-paytable-payouts"><div class="pulltab-paytable-payout-row">${iconsTriple}<span class="pulltab-paytable-payout-text">${esc(
                        payoutStr,
                    )}</span></div></td>` +
                    `<td class="right">${typeof avail === 'number' ? String(avail) : esc(avail)}</td>` +
                    `</tr>`,
            );
        }

        if (tableRowsHtml.length === 0) {
            tableRowsHtml.push('<tr><td colspan="2" class="pulltab-paytable-empty">No pay tiers returned.</td></tr>');
        }
    }

    let rtpLine = '';
    if (rtpStr != null && rtpStr.length > 0) {
        rtpLine = `<p class="fineprint">Return to player (theoretical): <strong>${esc(rtpStr)}</strong>.</p>`;
    }

    return (
        `<h2>Pull-tab Game Info</h2>` +
        `<h3>Paytable</h3>` +
        `<p>Payout amounts are for one ticket priced at <strong>${esc(ticketPricePhrase)}</strong>.</p>` +
        `<table class="pulltab-paytable">` +
        `<thead><tr>` +
        `<th>Payouts</th>` +
        `<th class="right">Tickets in deal</th>` +
        `</tr></thead>` +
        `<tbody>${tableRowsHtml.join('')}</tbody>` +
        `</table>` +
        rtpLine +
        `<h3>How to play</h3>` +
        `<ul>` +
        `<li>Each ticket has several horizontal tabs. Peel or reveal each tab to uncover the symbols underneath.</li>` +
        `<li>This paytable pays when an entire winning row matches the same prize symbol (<strong>three of a kind on that row</strong>).</li>` +
        `<li>To play another ticket, peel again after the outcome is settled (ticket cost applies each round).</li>` +
        `</ul>` +
        `<h3>General</h3>` +
        `<p>Malfunctions void all pays and plays. Outcomes come from certified server-side RNG. Play responsibly and comply with applicable rules from your gaming operator.</p>`
    );
}

/**
 * @param {Phaser.Scene|null} scene
 */
export function openPullTabGameInfoModal(scene) {
    const modal = new Modal(
        'pullTabGameInfo',
        () => pullTabGameInfoContent(scene ?? null),
        scene ?? undefined,
    );
    void modal.show();
}
