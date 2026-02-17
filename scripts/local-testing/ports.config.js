/**
 * Port configuration for local testing servers.
 * Pull-tabs: CORS 8083, Vite 5502 (avoids conflicts with video-poker 8081/5500, scratch 8082/5501)
 */
module.exports = {
  PORT_CORS_PROXY: 8083,
  PORT_VITE: 5502,
};
