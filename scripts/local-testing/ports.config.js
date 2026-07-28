/**
 * Port configuration for local testing servers.
 * Pull-tabs: CORS 3005, Vite 5502 (avoids conflicts with video-poker 8081/5500, scratch 8082/5501)
 *
 * CORS proxy: set WHITELIST_CLIENT_IP to your public IP so /pull-tabs/test/buy passes IP whitelist locally.
 * Example: WHITELIST_CLIENT_IP=65.128.127.37 node scripts/local-testing/cors-proxy.js
 */
module.exports = {
  PORT_CORS_PROXY: 3005,
  PORT_VITE: 5502,
};
