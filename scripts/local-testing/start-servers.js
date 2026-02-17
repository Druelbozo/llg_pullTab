/**
 * Start Servers Script
 * Runs cors-proxy.js and Vite dev server concurrently
 * Usage: node start-servers.js
 *
 * Ports are configured in ports.config.js - update when copying to new projects.
 */

const { spawn, execSync } = require('child_process');
const path = require('path');

// Load ports from config (with fallback defaults)
let PORT_CORS_PROXY = 8083;
let PORT_VITE = 5502;
try {
  const portsConfig = require('./ports.config.js');
  PORT_CORS_PROXY = portsConfig.PORT_CORS_PROXY ?? PORT_CORS_PROXY;
  PORT_VITE = portsConfig.PORT_VITE ?? PORT_VITE;
} catch (e) {
  // Use defaults if config not found
}

/**
 * Check if a port is in use and kill the process using it
 * @param {number} port - The port number to check
 * @returns {boolean} - True if a process was killed, false otherwise
 */
function killProcessOnPort(port) {
    try {
        const isWindows = process.platform === 'win32';
        let command;

        if (isWindows) {
            command = `netstat -ano | findstr ":${port}"`;
        } else {
            command = `lsof -ti:${port}`;
        }

        const output = execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

        if (output.trim()) {
            if (isWindows) {
                const lines = output.trim().split('\n');
                const pids = new Set();

                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length > 0) {
                        const pid = parts[parts.length - 1];
                        if (pid && !isNaN(pid)) {
                            pids.add(pid);
                        }
                    }
                }

                for (const pid of pids) {
                    try {
                        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
                        console.log(`   ✅ Killed process ${pid} on port ${port}`);
                    } catch (err) {}
                }
            } else {
                const pid = output.trim().split('\n')[0];
                if (pid) {
                    execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
                    console.log(`   ✅ Killed process ${pid} on port ${port}`);
                }
            }
            return true;
        }
    } catch (error) {}
    return false;
}

function checkAndFreePorts() {
    console.log('🔍 Checking ports...');

    let foundAny = false;

    if (killProcessOnPort(PORT_CORS_PROXY)) {
        foundAny = true;
        console.log(`   ⚠️  Port ${PORT_CORS_PROXY} was in use and has been freed`);
    }

    if (killProcessOnPort(PORT_VITE)) {
        foundAny = true;
        console.log(`   ⚠️  Port ${PORT_VITE} was in use and has been freed`);
    }

    if (foundAny) {
        console.log('   ⏳ Waiting for ports to be fully released...\n');
        return new Promise(resolve => setTimeout(resolve, 1000));
    } else {
        console.log('   ✅ Ports are available\n');
        return Promise.resolve();
    }
}

function getWiFiIPv4Address() {
    try {
        const isWindows = process.platform === 'win32';
        let output;

        if (isWindows) {
            output = execSync('ipconfig', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
            const lines = output.split('\n');
            let inWiFiSection = false;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.includes('Wireless LAN adapter Wi-Fi:')) {
                    inWiFiSection = true;
                    continue;
                }
                if (inWiFiSection) {
                    if (line && !line.startsWith(' ') && !line.startsWith('\t') && line.includes('adapter')) {
                        break;
                    }
                    if (line.includes('IPv4 Address')) {
                        const match = line.match(/IPv4 Address[^:]*:\s*([\d.]+)/);
                        if (match && match[1]) {
                            return match[1].trim();
                        }
                    }
                }
            }
        } else {
            output = execSync('ifconfig', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
            const lines = output.split('\n');
            let inWiFiInterface = false;
            let interfaceName = null;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.match(/^(en0|wlan0|wlp\d+s\d+|wifi0):/)) {
                    inWiFiInterface = true;
                    interfaceName = line.split(':')[0];
                    continue;
                }
                if (inWiFiInterface) {
                    if (line.match(/^[a-z0-9]+:/) && !line.startsWith(interfaceName)) {
                        inWiFiInterface = false;
                        continue;
                    }
                    const match = line.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
                    if (match && match[1] && match[1] !== '127.0.0.1') {
                        return match[1].trim();
                    }
                }
            }
        }
    } catch (error) {}
    return null;
}

console.log('🚀 Starting servers...\n');

let corsProxy;
let viteServer;

function cleanup() {
    console.log('\n\n🛑 Shutting down servers...');
    if (corsProxy) corsProxy.kill();
    if (viteServer) viteServer.kill();
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

function startServers() {
    console.log(`📡 Starting CORS proxy server on port ${PORT_CORS_PROXY}...`);
    corsProxy = spawn('node', [path.join(__dirname, 'cors-proxy.js'), PORT_CORS_PROXY.toString()], {
        stdio: 'pipe',
        shell: true,
        cwd: __dirname
    });

    corsProxy.stdout.on('data', (data) => {
        process.stdout.write(`[CORS Proxy] ${data}`);
    });

    corsProxy.stderr.on('data', (data) => {
        process.stderr.write(`[CORS Proxy] ${data}`);
    });

    corsProxy.on('error', (error) => {
        console.error(`❌ Error starting CORS proxy: ${error.message}`);
        process.exit(1);
    });

    corsProxy.on('exit', (code) => {
        if (code !== null && code !== 0) {
            console.error(`\n❌ CORS proxy exited with code ${code}`);
            if (viteServer) viteServer.kill();
            process.exit(code);
        }
    });

    setTimeout(() => {
        console.log(`\n🌐 Starting Vite dev server on port ${PORT_VITE}...`);
        const projectRoot = path.join(__dirname, '..', '..');
        viteServer = spawn('npx', ['vite', '--port', PORT_VITE.toString()], {
            stdio: 'pipe',
            shell: true,
            cwd: projectRoot
        });

        viteServer.stdout.on('data', (data) => {
            process.stdout.write(`[Vite] ${data}`);
        });

        viteServer.stderr.on('data', (data) => {
            process.stderr.write(`[Vite] ${data}`);
        });

        viteServer.on('error', (error) => {
            console.error(`❌ Error starting Vite dev server: ${error.message}`);
            console.error('💡 Make sure dependencies are installed: npm install');
        });

        viteServer.on('exit', (code) => {
            if (code !== null && code !== 0) {
                console.error(`\n❌ Vite dev server exited with code ${code}`);
            }
        });

        const wifiIP = getWiFiIPv4Address();

        console.log('\n✅ Both servers starting...');
        console.log(`   - CORS Proxy: http://localhost:${PORT_CORS_PROXY}`);
        console.log(`   - Game (Vite): http://localhost:${PORT_VITE}`);
        if (wifiIP) {
            console.log(`   - Wi-Fi IP Address: ${wifiIP}`);
            console.log(`   - Access from phone: http://${wifiIP}:${PORT_VITE}`);
        }
        console.log('\n💡 Press Ctrl+C to stop both servers\n');
    }, 1000);
}

checkAndFreePorts().then(() => {
    startServers();
}).catch((error) => {
    console.error('❌ Error checking ports:', error);
    process.exit(1);
});
