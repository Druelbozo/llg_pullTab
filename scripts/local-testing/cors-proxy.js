/**
 * Simple CORS proxy (same pattern as LL_ScratchGame/scripts/local-testing/cors-proxy.js).
 *
 * Run with: node cors-proxy.js [PORT]
 * Override upstream with env API_BASE_URL (must match API Gateway stage URL, no trailing slash).
 *
 * Forwards every path to staging so `/pull-tabs/test/buy`, `/scratch-cards/test/buy`,
 * `/provider/session`, etc. work without an `/api` prefix (unlike the old Express proxy).
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.argv[2]
	? parseInt(process.argv[2], 10)
	: process.env.PORT
		? parseInt(process.env.PORT, 10)
		: 3005;

// Align with src/config/Global.js GameConfig.api.BASE_URL_LIVE when unset
const API_BASE_URL =
	process.env.API_BASE_URL ||
	'https://kmz1ixsmv6.execute-api.us-east-1.amazonaws.com/staging';

const TARGET_API_BASE_URL = API_BASE_URL.replace(/\/+$/, '');

console.log('📋 Pull-tab CORS proxy (scratch-style)');
console.log('📋 API Base URL: ' + TARGET_API_BASE_URL);
console.log('💡 Override: set API_BASE_URL in .env or environment\n');

const server = http.createServer((req, res) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	res.setHeader(
		'Access-Control-Allow-Headers',
		'Content-Type, Authorization, X-Requested-With, X-Brand-Id, X-Secret-Key'
	);

	if (req.method === 'OPTIONS') {
		res.writeHead(200);
		res.end();
		return;
	}

	let targetPath = req.url.startsWith('/') ? req.url.slice(1) : req.url;
	const originalPath = targetPath;

	if (targetPath.startsWith('api/')) {
		targetPath = targetPath.slice(4);
	}

	const targetUrl = `${TARGET_API_BASE_URL}/${targetPath}`;

	if (originalPath !== targetPath) {
		console.log(`[CORS Proxy] Path transformed: ${originalPath} -> ${targetPath}`);
	}

	console.log(`[CORS Proxy] ${req.method} ${req.url} -> ${targetUrl}`);

	const url = new URL(targetUrl);
	const options = {
		hostname: url.hostname,
		port: url.port || (url.protocol === 'https:' ? 443 : 80),
		path: url.pathname + url.search,
		method: req.method,
		headers: {
			...req.headers,
			host: url.hostname,
		},
	};

	const httpModule = url.protocol === 'https:' ? https : http;

	const proxyReq = httpModule.request(options, (proxyRes) => {
		res.writeHead(proxyRes.statusCode, proxyRes.headers);
		proxyRes.pipe(res);
	});

	proxyReq.on('error', (error) => {
		console.error('[CORS Proxy Error]', error);
		res.writeHead(500, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ error: 'Proxy error: ' + error.message }));
	});

	if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
		req.pipe(proxyReq);
	} else {
		proxyReq.end();
	}
});

const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => {
	console.log(`🚀 CORS Proxy Server running on http://localhost:${PORT}`);
	console.log(`📡 Proxying to: ${TARGET_API_BASE_URL}`);
});

process.on('SIGTERM', () => {
	console.log('Shutting down CORS proxy server...');
	server.close(() => process.exit(0));
});
