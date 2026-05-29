/**
 * Central config for pull-tabs + shared HUD factories (scratch-compatible shape).
 */

const USE_QUIET_LOG_CATEGORIES =
    (typeof __LLG_QUIET_LOG_CATEGORIES__ !== 'undefined' && __LLG_QUIET_LOG_CATEGORIES__) ||
    import.meta.env.PRODUCTION;

/**
 * Default for `debug.SHOW_LOG_CATEGORIES` in dev (see `applyLoggingFromGameConfig` in LoggerUtils.js).
 */
const SHOW_LOG_CATEGORIES_DEVELOPMENT = ['all'];

/** Wallet minors (pennies) per one USD display dollar. */
const USD_MINOR_PER_DISPLAY_DOLLAR = 100;
/** Wallet minors (pennies) per one GC display unit (2 decimal places). */
const GC_MINOR_PER_DISPLAY_UNIT = 100;
/** Wallet minors (pennies) per one SC display dollar (2 decimal places). */
const SC_MINOR_PER_DISPLAY_DOLLAR = 1000;
/** Novalink/Wandando operator SC balance minors per one display dollar (100 → 0.15 SC). */
const OPERATOR_SC_MINOR_PER_DISPLAY_DOLLAR = 100;
/** Credit / bet denominations (pennies) — GC. */
const CREDIT_VALUE_AMOUNTS_GC = [
    10, 25, 50, 100, 200, 300, 400, 500, 1000, 2500,
];
/** Credit / bet denominations (pennies) — SC and USD (25 = default pull-tab ticket). */
const CREDIT_VALUE_AMOUNTS_SC_USD = [
    25, 50, 100, 250, 500, 1000,
];
const CREDIT_VALUE_MINOR_SC_USD =
    CREDIT_VALUE_AMOUNTS_SC_USD.find((v) => v === 25) ?? CREDIT_VALUE_AMOUNTS_SC_USD[0] ?? 25;

export const GameConfig = {
    api: {
        BASE_URL_LIVE: 'https://kmz1ixsmv6.execute-api.us-east-1.amazonaws.com/staging',
        BASE_URL_LOCAL: `http://localhost:${typeof __CORS_PROXY_PORT__ !== 'undefined' ? __CORS_PROXY_PORT__ : '3005'}`
    },
    game: {
        TEST_BALANCE_MINOR: 1000000,
        SESSION_DEMO_BALANCE_MINOR: 10000,
        /** @deprecated Use TEST_BALANCE_MINOR */
        TEST_BALANCE: 300000,
        CURRENCY_CODE: 'GC',
        /**
         * All economy fields (`creditValueMinor`, `payoutMinor`) are wallet minors (pennies).
         * Display divisors: GC ÷ GC_MINOR_PER_DISPLAY_UNIT, SC ÷ SC_MINOR_PER_DISPLAY_DOLLAR,
         * USD ÷ USD_MINOR_PER_DISPLAY_DOLLAR. Operator SC balance uses OPERATOR_SC_MINOR_PER_DISPLAY_DOLLAR.
         */
        USD_MINOR_PER_DISPLAY_DOLLAR,
        GC_MINOR_PER_DISPLAY_UNIT,
        SC_MINOR_PER_DISPLAY_DOLLAR,
        OPERATOR_SC_MINOR_PER_DISPLAY_DOLLAR,
        /** @deprecated Use currency-specific divisors above. */
        MINOR_PER_DISPLAY_DOLLAR: USD_MINOR_PER_DISPLAY_DOLLAR,
        /** @deprecated Wallet minors are pennies; display uses currency divisors above. */
        BALANCE_MINOR_PER_DOLLAR: USD_MINOR_PER_DISPLAY_DOLLAR,
        /** @deprecated GC display uses GC_MINOR_PER_DISPLAY_UNIT. */
        ECONOMY_GC_UNITS_PER_DISPLAY_DOLLAR: GC_MINOR_PER_DISPLAY_UNIT,
        CREDIT_VALUE_MINOR_GC: CREDIT_VALUE_AMOUNTS_GC.find((v) => v === 25) ?? CREDIT_VALUE_AMOUNTS_GC[1] ?? 25,
        CREDIT_VALUE_MINOR_SC_USD,
        CREDIT_VALUE_AMOUNTS_GC,
        CREDIT_VALUE_AMOUNTS_SC_USD,
        DISPLAY_CURRENCY_CODE: null,
        START_SPEED: 1,
        AUTO_PEEL_ROW_DELAY_MS: 150,
        AUTO_PEEL_ANIMATION_MS: 500,
        AUTOPLAY_ENABLED: false,
        AUTOPLAY_AMOUNT: 20,
        AUTOPLAY_AMOUNTS: [10, 25, 50, 75, 100, 500],
        SHOW_PLAYBUTTON_BUYIN_AMOUNT: true,
        START_MUTED: false,
        SHOW_PEEL_PRIZE_LABELS: false,
        /** @deprecated Use SESSION_DEMO_BALANCE_MINOR */
        SESSION_DEMO_BALANCE: 10000,
    },
    ui: {
        DEFAULT_CORNER_RADIUS: 0.3,
        useRandomColors: false,
        enableHapticFeedback: true,
        LANDSCAPE_MOBILE_SIDE_PAYTABLE_SELECTOR: null
    },
    imageKeyMapping: {},
    debug: {
        SHOW_TEST_ERROR_MODAL: false,
        SHOW_TEST_LOGIN_MODAL: false,
        SHOW_DEBUG_OVERLAY: null,
        SHOW_CONTROL_BAR_VISUAL_DEBUGGING: false,
        SHOW_CARD_CONTAINER_VISUAL_DEBUGGING: false,
        SHOW_PEEL_CARD_VISUAL_DEBUGGING: false,
        SHOW_SCRATCH_BACKING_GRID_VISUAL_DEBUGGING: false,
        SHOW_AUTO_PLAY_OPTIONS_VISUAL_DEBUGGING: false,
        SHOW_PRELOAD_VISUAL_DEBUGGING: false,
        ENABLE_VISUAL_DEBUG_SHORTCUTS: !USE_QUIET_LOG_CATEGORIES,
        SHOW_LOG_CATEGORIES: USE_QUIET_LOG_CATEGORIES ? [] : SHOW_LOG_CATEGORIES_DEVELOPMENT,
    },
    sfx: {
        buy: "buy3.ogg",
        buttonClick: "button-click.ogg",
        popupClose: "popup-close.ogg",
        popupOpen: "popup-open.ogg",
        tally: "tally.ogg",
        thud: "thud3.ogg",
        whoosh: "whoosh.ogg",
        win: "win.ogg",
        lose: "lose.ogg",
        pageTurn: "paper-rip.ogg",
    },
};
