/**
 * Central config for pull-tabs: API bases and balance defaults (mirrors scratch Global pattern).
 */

export const GameConfig = {
    api: {
        BASE_URL_LIVE: 'https://kmz1ixsmv6.execute-api.us-east-1.amazonaws.com/staging',
        BASE_URL_LOCAL: `http://localhost:${typeof __CORS_PROXY_PORT__ !== 'undefined' ? __CORS_PROXY_PORT__ : '3005'}`
    },
    game: {
        /** Test balance in minor units (pennies) when not in session mode */
        TEST_BALANCE_MINOR: 300000,
        /** Demo session balance in pennies ($100) — matches scratch SESSION_DEMO_BALANCE */
        SESSION_DEMO_BALANCE_MINOR: 10000
    }
};
