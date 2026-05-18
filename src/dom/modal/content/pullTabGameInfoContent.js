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
} from '../../../utils/formatting/FormattingUtils.js';
import { debug, warn } from '../../../utils/logger/LoggerUtils.js';

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
    const minor = Number.isFinite(raw) && raw > 0 ? raw : 100;
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
 * @param {object} atlasJson
 * @param {number} atlasFrameIndex — `0.png` maps to symbol `symbol_01` via {@link tierSymbolToFrameIndex}
 * @param {number} displayPx
 * @returns {{ styleAttr: string, boxW: number, boxH: number } | null}
 */
function buildIconsAtlasSpriteCss(atlasJson, atlasFrameIndex, displayPx = 36) {
    const tex = atlasJson?.textures?.[0];
    const frames = tex?.frames;
    if (!Array.isArray(frames) || frames.length === 0) {
        return null;
    }

    const filename = `${Math.max(0, Math.floor(Number(atlasFrameIndex)))}.png`;
    const hit = frames.find((f) => f.filename === filename);
    if (!hit?.frame) {
        return null;
    }

    const fx = Number(hit.frame.x) || 0;
    const fy = Number(hit.frame.y) || 0;
    const fw = Number(hit.frame.w) || 32;
    const fh = Number(hit.frame.h) || 32;
    const sheetW = Number(tex.size?.w) || 512;
    const sheetH = Number(tex.size?.h) || 512;

    const scaleFactor = displayPx / Math.max(fw, 1);
    const bgW = Math.round(sheetW * scaleFactor);
    const bgH = Math.round(sheetH * scaleFactor);
    const posX = -Math.round(fx * scaleFactor);
    const posY = -Math.round(fy * scaleFactor);
    const boxW = Math.round(fw * scaleFactor);
    const boxH = Math.round(fh * scaleFactor);

    const imgRel = tex.image ?? '';
    if (!imgRel || typeof imgRel !== 'string') {
        return null;
    }

    const url = encodeURI(`assets/Images/theme/icons/${imgRel}`);

    const styleAttr =
        `width:${boxW}px;height:${boxH}px;` +
        `background-image:url('${url}');` +
        `background-repeat:no-repeat;background-size:${bgW}px ${bgH}px;` +
        `background-position:${posX}px ${posY}px;`;

    return { styleAttr, boxW, boxH };
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

    const creditRaw = gc.creditValueMinor ?? smCfg?.creditValueMinor ?? 100;
    const creditValueMinor =
        Number.isFinite(Math.round(Number(creditRaw))) && Math.round(Number(creditRaw)) > 0
            ? Math.round(Number(creditRaw))
            : 100;

    const themeRaw = gc.theme ?? smCfg?.theme ?? 'mega-monster';
    const theme = String(themeRaw ?? '')
        .trim()
        .split(/[:]/)[0]
        .trim() || 'mega-monster';

    return { paytableId, creditValueMinor, theme };
}

/** @returns {Promise<object|null>} */
async function fetchIconsAtlasJson(themeName) {
    const t = String(themeName || 'mega-monster').trim() || 'mega-monster';
    const cacheBuster = Date.now();

    let iconsKey = 'icons-default';
    try {
        const themeRes = await fetch(`src/config/themes/${encodeURIComponent(t)}.json?t=${cacheBuster}`, {
            cache: 'no-store',
        });
        if (themeRes.ok) {
            const themeJson = await themeRes.json();
            const ik = themeJson?.imageKeys?.icons;
            if (typeof ik === 'string' && ik.trim()) {
                iconsKey = ik.trim();
            }
        }
    } catch (e) {
        warn('[pullTabGameInfoContent] theme json fetch failed', 'ui', e);
    }

    const atlasUrl = `assets/Images/theme/icons/${encodeURIComponent(iconsKey)}.json?t=${cacheBuster}`;
    try {
        const atlasRes = await fetch(atlasUrl, { cache: 'no-store' });
        if (!atlasRes.ok) {
            return null;
        }
        return await atlasRes.json();
    } catch (e2) {
        warn('[pullTabGameInfoContent] icons atlas fetch failed', 'ui', e2);
        return null;
    }
}

/**
 * @param {SceneRef} scene
 * @returns {Promise<string>}
 */
export async function pullTabGameInfoContent(scene) {
    const currency = getActiveCurrencyCode();
    const { paytableId, creditValueMinor, theme } = resolvePullTabCatalogContext(scene);

    let atlasJson = await fetchIconsAtlasJson(theme);
    if (!atlasJson) {
        atlasJson = await fetchIconsAtlasJson('default');
        debug('[pullTabGameInfoContent] fell back to default icons atlas', 'ui', {});
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
            const sprite = atlasJson ? buildIconsAtlasSpriteCss(atlasJson, frameIdx, 36) : null;

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
        `<h3>How to play</h3>` +
        `<ul>` +
        `<li>Each ticket has several horizontal tabs. Peel or reveal each tab to uncover the symbols underneath.</li>` +
        `<li>This paytable pays when an entire winning row matches the same prize symbol (<strong>three of a kind on that row</strong>).</li>` +
        `<li>To play another ticket, peel again after the outcome is settled (ticket cost applies each round).</li>` +
        `</ul>` +
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
