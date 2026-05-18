/**
 * Central config for pull-tabs + shared HUD factories (scratch-compatible shape).
 */

const USE_QUIET_LOG_CATEGORIES =
    (typeof __LLG_QUIET_LOG_CATEGORIES__ !== 'undefined' && __LLG_QUIET_LOG_CATEGORIES__) ||
    import.meta.env.PRODUCTION;

/**
 * Default for `debug.SHOW_LOG_CATEGORIES` in dev (see `applyLoggingFromGameConfig` in LoggerUtils.js).
 *
 * - **`[]`** — quiet: all logger categories off; raw `console` mirroring reduced when `initializeConsoleCapture()` runs from main.js.
 * - **`['all']`** — every category on (`api`, `theme`, `layout`, `ui`, `game`, `assets`).
 * - **`['theme', 'assets']`** — enable only listed categories (scratch-cards style tuning).
 */
const SHOW_LOG_CATEGORIES_DEVELOPMENT = ['all'];

export const GameConfig = {
    api: {
        BASE_URL_LIVE: 'https://kmz1ixsmv6.execute-api.us-east-1.amazonaws.com/staging',
        BASE_URL_LOCAL: `http://localhost:${typeof __CORS_PROXY_PORT__ !== 'undefined' ? __CORS_PROXY_PORT__ : '3005'}`
    },
    game: {
        TEST_BALANCE_MINOR: 300000,
        SESSION_DEMO_BALANCE_MINOR: 10000,

        TEST_BALANCE: 300000,

        CURRENCY_CODE: 'GC',
        MINOR_PER_DISPLAY_DOLLAR: 100,
        BALANCE_MINOR_PER_DOLLAR: 100,
        ECONOMY_GC_UNITS_PER_DISPLAY_DOLLAR: 1000,
        DISPLAY_CURRENCY_CODE: null,

        START_SPEED: 1,
        AUTOPLAY_ENABLED: false,
        AUTOPLAY_AMOUNT: 20,
        AUTOPLAY_AMOUNTS: [10, 25, 50, 75, 100, 500],
        SHOW_PLAYBUTTON_BUYIN_AMOUNT: true,
        START_MUTED: false,

        /**
         * When `false`, the left-column payout strings (`gameConfig.prizes`) beside each Peel row are not created.
         * In that mode the peel **`cardBack`** NineSlice width is sized from theme **`peelCard.horizontalContentInset`**
         * × 3 plus cover + peel strip widths so left margin, cover→peel gutter, and right margin all equal that inset.
         * `true` or omitted → legacy: prize labels shown, fixed 1000px wide `cardBack`, two edge insets only (extra space stays inside the slice).
         */
        SHOW_PEEL_PRIZE_LABELS: false,

        SESSION_DEMO_BALANCE: 10000
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
        SHOW_DEBUG_OVERLAY: null, // 1=Game, 2=Layout (live), 3=Device, 4=Viewport (live), 5=Pull-tab assets/icons, 6=Console+log upload, 7=Log strip only. ESC hides. With key 6 launch: console.log mirror off + logger warn-only (see applyLoggingFromGameConfig).
        SHOW_CONTROL_BAR_VISUAL_DEBUGGING: false,
        SHOW_CARD_CONTAINER_VISUAL_DEBUGGING: false,
        SHOW_PEEL_CARD_VISUAL_DEBUGGING: false,
        SHOW_SCRATCH_BACKING_GRID_VISUAL_DEBUGGING: false,
        SHOW_AUTO_PLAY_OPTIONS_VISUAL_DEBUGGING: false,
        SHOW_PRELOAD_VISUAL_DEBUGGING: false,
        // Dev: Ctrl+I toggles Phaser `debugInfo` if present; keys 1–7 = debug overlay panels when ENABLE_VISUAL_DEBUG_SHORTCUTS (see DebugOverlay). Q/W peel visual debug.
        ENABLE_VISUAL_DEBUG_SHORTCUTS: !USE_QUIET_LOG_CATEGORIES,
        /** See `SHOW_LOG_CATEGORIES_DEVELOPMENT` (top of this file). Wired by {@link applyLoggingFromGameConfig}. */
        SHOW_LOG_CATEGORIES: USE_QUIET_LOG_CATEGORIES ? [] : SHOW_LOG_CATEGORIES_DEVELOPMENT,
    },
    /**
     * SFX Configuration
     * Sound effect filenames in assets/audio/sfx/. Swap files to try different sounds.
     */
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
