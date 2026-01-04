/**
 * Simple CORS Proxy Server
 * Run with: node cors-proxy.js
 * 
 * This proxy server allows your local frontend to make API calls
 * without CORS issues by forwarding requests to the actual API.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// Allow port to be specified via command-line argument or environment variable
// Defaults to 3001 if not specified
const PORT = process.argv[2] ? parseInt(process.argv[2], 10) : (process.env.PORT ? parseInt(process.env.PORT, 10) : 3001);

// API Configuration - Update config.js or set API_BASE_URL environment variable
const API_BASE_URL = process.env.API_BASE_URL || 'https://kmz1ixsmv6.execute-api.us-east-1.amazonaws.com/staging';

const TARGET_API_BASE_URL = API_BASE_URL;

console.log('📋 API Base URL: ' + TARGET_API_BASE_URL);
console.log('💡 To update: Edit config.js or set API_BASE_URL environment variable\n');

const server = http.createServer((req, res) => {
    // Enable CORS for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Get the target URL from the request path
    const targetPath = req.url.startsWith('/') ? req.url.slice(1) : req.url;
    const targetUrl = `${TARGET_API_BASE_URL}/${targetPath}`;

    console.log(`[CORS Proxy] ${req.method} ${targetUrl}`);

    // Parse the target URL
    const url = new URL(targetUrl);
    const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: req.method,
        headers: {
            ...req.headers,
            host: url.hostname
        }
    };

    // Choose the appropriate module (http or https)
    const httpModule = url.protocol === 'https:' ? https : http;

    // Forward the request
    const proxyReq = httpModule.request(options, (proxyRes) => {
        // Copy response headers
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (error) => {
        console.error(`[CORS Proxy Error]`, error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy error: ' + error.message }));
    });

    // Forward the request body if present
    if (req.method === 'POST' || req.method === 'PUT') {
        req.pipe(proxyReq);
    } else {
        proxyReq.end();
    }
});

server.listen(PORT, () => {
    console.log(`🚀 CORS Proxy Server running on http://localhost:${PORT}`);
    console.log(`📡 Proxying to: ${TARGET_API_BASE_URL}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down CORS proxy server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

