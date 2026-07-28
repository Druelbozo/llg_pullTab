/**
 * CORS proxy for local pull-tab / scratch-style API testing.
 *
 * Run with: node cors-proxy.js [PORT]
 * Override upstream with env API_BASE_URL (no trailing slash).
 * Optional: WHITELIST_CLIENT_IP sets X-Forwarded-For / X-Real-IP on upstream requests.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.argv[2]
	? parseInt(process.argv[2], 10)
	: process.env.PORT
		? parseInt(process.env.PORT, 10)
		: 3005;

const API_BASE_URL =
	process.env.API_BASE_URL ||
	'https://kmz1ixsmv6.execute-api.us-east-1.amazonaws.com/staging';

const TARGET_API_BASE_URL = API_BASE_URL.replace(/\/+$/, '');
const WHITELIST_CLIENT_IP = (process.env.WHITELIST_CLIENT_IP || '').trim();

const FORWARD_HEADER_NAMES = [
	'content-type',
	'authorization',
	'x-brand-id',
	'x-secret-key',
	'x-requested-with',
];

console.log('📋 Pull-tab CORS proxy');
console.log('📋 API Base URL: ' + TARGET_API_BASE_URL);
if (WHITELIST_CLIENT_IP) {
	console.log('📋 WHITELIST_CLIENT_IP: ' + WHITELIST_CLIENT_IP);
}
console.log('💡 Override: API_BASE_URL, WHITELIST_CLIENT_IP in environment\n');

function readRequestBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		req.on('data', (chunk) => chunks.push(chunk));
		req.on('end', () => resolve(Buffer.concat(chunks)));
		req.on('error', reject);
	});
}

function buildUpstreamHeaders(req, bodyLength) {
	const headers = {
		'Content-Length': String(bodyLength),
		Accept: req.headers.accept || 'application/json',
	};

	const lower = {};
	for (const [key, value] of Object.entries(req.headers || {})) {
		if (value != null && value !== '') {
			lower[key.toLowerCase()] = value;
		}
	}

	for (const name of FORWARD_HEADER_NAMES) {
		if (lower[name]) {
			headers[name] = lower[name];
		}
	}

	if (WHITELIST_CLIENT_IP) {
		headers['X-Forwarded-For'] = WHITELIST_CLIENT_IP;
		headers['X-Real-IP'] = WHITELIST_CLIENT_IP;
	}

	return headers;
}

const server = http.createServer(async (req, res) => {
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
	if (targetPath.startsWith('api/')) {
		targetPath = targetPath.slice(4);
	}

	const targetUrl = `${TARGET_API_BASE_URL}/${targetPath}`;
	console.log(`[CORS Proxy] ${req.method} ${req.url} -> ${targetUrl}`);

	let body = Buffer.alloc(0);
	if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
		try {
			body = await readRequestBody(req);
		} catch (error) {
			console.error('[CORS Proxy] Failed to read request body:', error);
			res.writeHead(400, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ error: 'Failed to read request body' }));
			return;
		}
	}

	const url = new URL(targetUrl);
	const headers = buildUpstreamHeaders(req, body.length);
	const httpModule = url.protocol === 'https:' ? https : http;

	const proxyReq = httpModule.request(
		{
			hostname: url.hostname,
			port: url.port || (url.protocol === 'https:' ? 443 : 80),
			path: url.pathname + url.search,
			method: req.method,
			headers,
		},
		(proxyRes) => {
			console.log(
				`[CORS Proxy] <- ${proxyRes.statusCode} ${req.method} ${targetPath || req.url}`
			);
			res.writeHead(proxyRes.statusCode, proxyRes.headers);
			proxyRes.pipe(res);
		}
	);

	proxyReq.on('error', (error) => {
		console.error('[CORS Proxy Error]', error);
		res.writeHead(500, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ error: 'Proxy error: ' + error.message }));
	});

	if (body.length > 0) {
		proxyReq.write(body);
	}
	proxyReq.end();
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
