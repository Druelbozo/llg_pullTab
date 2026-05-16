/**
 * Central config for pull-tabs + shared HUD factories (scratch-compatible shape).
 */

const USE_QUIET_LOG_CATEGORIES =
    (typeof __LLG_QUIET_LOG_CATEGORIES__ !== 'undefined' && __LLG_QUIET_LOG_CATEGORIES__) ||
    import.meta.env.PRODUCTION;

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

        CURRENCY_CODE: 'SC',
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

        SESSION_DEMO_BALANCE: 10000
    },
    ui: {
        DEFAULT_CORNER_RADIUS: 0.3,
        useRandomColors: false,
        enableHapticFeedback: true,
        LANDSCAPE_MOBILE_SIDE_PAYTABLE_SELECTOR: null
    },
    sfx: {},
    imageKeyMapping: {},
    debug: {
        SHOW_TEST_ERROR_MODAL: false,
        SHOW_TEST_LOGIN_MODAL: false,
        SHOW_DEBUG_OVERLAY: null,
        SHOW_CONTROL_BAR_VISUAL_DEBUGGING: false,
        SHOW_CARD_CONTAINER_VISUAL_DEBUGGING: false,
        SHOW_SCRATCH_BACKING_GRID_VISUAL_DEBUGGING: false,
        SHOW_AUTO_PLAY_OPTIONS_VISUAL_DEBUGGING: false,
        SHOW_PRELOAD_VISUAL_DEBUGGING: false,
        ENABLE_VISUAL_DEBUG_SHORTCUTS: !USE_QUIET_LOG_CATEGORIES,
        SHOW_LOG_CATEGORIES: USE_QUIET_LOG_CATEGORIES ? [] : SHOW_LOG_CATEGORIES_DEVELOPMENT,
    },
};
