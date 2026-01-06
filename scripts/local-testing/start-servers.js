/**
 * Start Servers Script
 * Runs cors-proxy.js and Python HTTP server concurrently
 * Usage: node start-servers.js
 */

const { spawn, execSync } = require('child_process');
const path = require('path');

const PORT_CORS_PROXY = 8081;
const PORT_PYTHON = 5500;

/**
 * Check if a port is in use and kill the process using it
 * @param {number} port - The port number to check
 * @returns {boolean} - True if a process was killed, false otherwise
 */
function killProcessOnPort(port) {
    try {
        // Use netstat to find the process ID using the port
        const isWindows = process.platform === 'win32';
        let command;
        
        if (isWindows) {
            // Windows: netstat -ano | findstr :PORT
            command = `netstat -ano | findstr ":${port}"`;
        } else {
            // Unix/Linux/Mac: lsof -ti:PORT
            command = `lsof -ti:${port}`;
        }
        
        const output = execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        
        if (output.trim()) {
            if (isWindows) {
                // Extract PID from netstat output (last column)
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
                
                // Kill each process
                for (const pid of pids) {
                    try {
                        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
                        console.log(`   ✅ Killed process ${pid} on port ${port}`);
                    } catch (err) {
                        // Process might have already exited
                    }
                }
            } else {
                // Unix/Linux/Mac
                const pid = output.trim().split('\n')[0];
                if (pid) {
                    execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
                    console.log(`   ✅ Killed process ${pid} on port ${port}`);
                }
            }
            return true;
        }
    } catch (error) {
        // Port is not in use or no process found
    }
    return false;
}

/**
 * Check and free both ports before starting servers
 */
function checkAndFreePorts() {
    console.log('🔍 Checking ports...');
    
    let foundAny = false;
    
    if (killProcessOnPort(PORT_CORS_PROXY)) {
        foundAny = true;
        console.log(`   ⚠️  Port ${PORT_CORS_PROXY} was in use and has been freed`);
    }
    
    if (killProcessOnPort(PORT_PYTHON)) {
        foundAny = true;
        console.log(`   ⚠️  Port ${PORT_PYTHON} was in use and has been freed`);
    }
    
    if (foundAny) {
        console.log('   ⏳ Waiting for ports to be fully released...\n');
        // Wait a moment for ports to be fully released
        return new Promise(resolve => setTimeout(resolve, 1000));
    } else {
        console.log('   ✅ Ports are available\n');
        return Promise.resolve();
    }
}

/**
 * Get the IPv4 address of the Wi-Fi adapter from ipconfig/ifconfig output
 * @returns {string|null} - The IPv4 address or null if not found
 */
function getWiFiIPv4Address() {
    try {
        const isWindows = process.platform === 'win32';
        let output;
        
        if (isWindows) {
            // Windows: Run ipconfig command
            output = execSync('ipconfig', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
            const lines = output.split('\n');
            
            // Find the Wi-Fi adapter section
            let inWiFiSection = false;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Check if we're entering the Wi-Fi adapter section
                if (line.includes('Wireless LAN adapter Wi-Fi:')) {
                    inWiFiSection = true;
                    continue;
                }
                
                // If we're in the Wi-Fi section, look for IPv4 Address
                if (inWiFiSection) {
                    // Check if we've hit the next adapter section (starts with a non-whitespace line that's not a property)
                    if (line && !line.startsWith(' ') && !line.startsWith('\t') && line.includes('adapter')) {
                        // We've moved to a different adapter, stop looking
                        break;
                    }
                    
                    // Look for IPv4 Address line
                    if (line.includes('IPv4 Address')) {
                        // Extract the IP address (format: "IPv4 Address. . . . . . . . . . . : 192.168.0.4")
                        const match = line.match(/IPv4 Address[^:]*:\s*([\d.]+)/);
                        if (match && match[1]) {
                            return match[1].trim();
                        }
                    }
                }
            }
        } else {
            // Unix/Linux/Mac: Run ifconfig command
            output = execSync('ifconfig', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
            const lines = output.split('\n');
            
            // Look for Wi-Fi interface (common names: en0, wlan0, wlp*, etc.)
            // macOS typically uses en0 for Wi-Fi, Linux uses wlan0 or wlp*
            let inWiFiInterface = false;
            let interfaceName = null;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                // Check for Wi-Fi interface names
                if (line.match(/^(en0|wlan0|wlp\d+s\d+|wifi0):/)) {
                    inWiFiInterface = true;
                    interfaceName = line.split(':')[0];
                    continue;
                }
                
                // If we're in a Wi-Fi interface section, look for inet address
                if (inWiFiInterface) {
                    // Check if we've hit the next interface
                    if (line.match(/^[a-z0-9]+:/) && !line.startsWith(interfaceName)) {
                        inWiFiInterface = false;
                        continue;
                    }
                    
                    // Look for inet address (IPv4)
                    // Format: "inet 192.168.0.4 netmask 0xffffff00 broadcast 192.168.0.255"
                    const match = line.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
                    if (match && match[1]) {
                        // Skip loopback addresses
                        if (match[1] !== '127.0.0.1') {
                            return match[1].trim();
                        }
                    }
                }
            }
        }
    } catch (error) {
        // Silently return null on any error
    }
    return null;
}

console.log('🚀 Starting servers...\n');

let corsProxy;
let pythonServer;

// Function to handle cleanup
function cleanup() {
    console.log('\n\n🛑 Shutting down servers...');
    if (corsProxy) corsProxy.kill();
    if (pythonServer) pythonServer.kill();
    process.exit(0);
}

// Handle cleanup on exit
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

/**
 * Start both servers after ports have been checked and freed
 */
function startServers() {
    // Start CORS proxy server
    console.log(`📡 Starting CORS proxy server on port ${PORT_CORS_PROXY}...`);
    corsProxy = spawn('node', [path.join(__dirname, 'cors-proxy.js')], {
        stdio: 'pipe',
        shell: true
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
            if (pythonServer) pythonServer.kill();
            process.exit(code);
        }
    });

    // Wait a moment for CORS proxy to start, then start Python server
    setTimeout(() => {
        console.log(`\n🐍 Starting Python HTTP server on port ${PORT_PYTHON}...`);
        pythonServer = spawn('python', ['-m', 'http.server', PORT_PYTHON.toString()], {
            stdio: 'pipe',
            shell: true,
            cwd: path.join(__dirname, '..', '..')
        });

        pythonServer.stdout.on('data', (data) => {
            process.stdout.write(`[Python Server] ${data}`);
        });

        pythonServer.stderr.on('data', (data) => {
            process.stderr.write(`[Python Server] ${data}`);
        });

        pythonServer.on('error', (error) => {
            console.error(`❌ Error starting Python server: ${error.message}`);
            console.error('💡 Make sure Python is installed and available in your PATH');
            console.error('💡 Alternative: Try running with "python3" instead of "python"');
            console.error('💡 You can manually edit this script to use "python3" if needed');
        });

        pythonServer.on('exit', (code) => {
            if (code !== null && code !== 0) {
                console.error(`\n❌ Python server exited with code ${code}`);
            }
        });

        // Get Wi-Fi IPv4 address
        const wifiIP = getWiFiIPv4Address();

        console.log('\n✅ Both servers starting...');
        console.log(`   - CORS Proxy: http://localhost:${PORT_CORS_PROXY}`);
        console.log(`   - Python Server: http://localhost:${PORT_PYTHON}`);
        if (wifiIP) {
            console.log(`   - Wi-Fi IP Address: ${wifiIP}`);
            console.log(`   - Access from phone: http://${wifiIP}:${PORT_PYTHON}`);
        }
        console.log('\n💡 Press Ctrl+C to stop both servers\n');
    }, 1000);
}

// Check and free ports, then start servers
checkAndFreePorts().then(() => {
    startServers();
}).catch((error) => {
    console.error('❌ Error checking ports:', error);
    process.exit(1);
});
