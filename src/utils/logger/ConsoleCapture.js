/**
 * Console Capture Utility
 * Intercepts console.error, console.warn, and console.log calls
 * Stores them for display in debug overlay (useful for mobile debugging)
 * When SHOW_DEBUG_OVERLAY is 6, suppresses console.log from browser (only warn/error show). Mode 7 does not change this.
 */

import { GameConfig } from '../../config/Global.js';

// Storage for captured console messages
const capturedMessages = [];
/** Max entries retained (FIFO). Exported so debug upload can match the buffer size. */
export const MAX_CAPTURED_BUFFER = 500;
const MAX_MESSAGES = MAX_CAPTURED_BUFFER;

// Original console methods (backed up before override)
const originalConsole = {
	error: console.error.bind(console),
	warn: console.warn.bind(console),
	log: console.log.bind(console)
};

/**
 * Format a console message entry
 * @param {string} level - Log level ('error', 'warn', 'log')
 * @param {Array} args - Original console arguments
 * @returns {Object} Formatted message entry
 */
function formatMessage(level, args) {
	const timestamp = new Date().toISOString();
	
	// Convert arguments to strings
	const messageParts = args.map(arg => {
		if (arg instanceof Error) {
			return arg.toString() + (arg.stack ? '\n' + arg.stack : '');
		} else if (typeof arg === 'object' && arg !== null) {
			try {
				return JSON.stringify(arg, null, 2);
			} catch (e) {
				return String(arg);
			}
		}
		return String(arg);
	});
	
	const message = messageParts.join(' ');
	
	// Extract stack trace if available
	let stack = null;
	if (args.length > 0 && args[0] instanceof Error && args[0].stack) {
		stack = args[0].stack;
	} else if (args.length > 0 && typeof args[0] === 'object' && args[0]?.stack) {
		stack = args[0].stack;
	}
	
	return {
		timestamp,
		level,
		message,
		stack,
		args: args // Store original args for detailed inspection
	};
}

/**
 * Capture a console message
 * @param {string} level - Log level ('error', 'warn', 'log')
 * @param {Array} args - Original console arguments
 */
function captureMessage(level, args) {
	const entry = formatMessage(level, args);
	
	// Add to beginning of array (most recent first)
	capturedMessages.unshift(entry);
	
	// Limit array size to prevent memory issues
	if (capturedMessages.length > MAX_MESSAGES) {
		capturedMessages.pop();
	}
}

/**
 * When SHOW_LOG_CATEGORIES is [], category logging is off; raw console.log/warn would still spam without this.
 */
function isConsoleQuiet() {
	const cats = GameConfig?.debug?.SHOW_LOG_CATEGORIES;
	return Array.isArray(cats) && cats.length === 0;
}

/**
 * Mirror to the real browser console (still capture for overlay/upload buffers when applicable).
 * Errors always mirror so real failures stay visible in DevTools.
 */
function shouldMirrorToBrowserConsole(level) {
	if (level === 'error') {
		return true;
	}
	if (isConsoleQuiet()) {
		return false;
	}
	if (level === 'log' && GameConfig?.debug?.SHOW_DEBUG_OVERLAY === 6) {
		return false;
	}
	return true;
}

/**
 * Initialize console interception
 * Should be called early (in main.js) to catch all console calls
 */
export function initializeConsoleCapture() {
	// Override console.error
	console.error = function(...args) {
		captureMessage('error', args);
		originalConsole.error(...args);
	};

	// Override console.warn
	console.warn = function(...args) {
		captureMessage('warn', args);
		if (shouldMirrorToBrowserConsole('warn')) {
			originalConsole.warn(...args);
		}
	};

	// Override console.log - when SHOW_DEBUG_OVERLAY is 6, suppress from browser (only warn/error show)
	console.log = function(...args) {
		captureMessage('log', args);
		if (shouldMirrorToBrowserConsole('log')) {
			originalConsole.log(...args);
		}
	};

	// Libraries often use info/debug; when quiet, do not forward to DevTools (capture only as 'log' for buffer)
	if (isConsoleQuiet()) {
		console.info = function(...args) {
			captureMessage('log', args);
		};
		console.debug = function(...args) {
			captureMessage('log', args);
		};
	}
}

/**
 * Get captured console messages
 * @param {Object} options - Options for filtering
 * @param {string[]} options.levels - Filter by levels (e.g., ['error', 'warn'])
 * @param {number} options.limit - Maximum number of messages to return (default: 50)
 * @returns {Array} Array of captured message entries
 */
export function getCapturedMessages(options = {}) {
	const { levels = null, limit = 50 } = options;
	
	let messages = capturedMessages;
	
	// Filter by level if specified
	if (levels && Array.isArray(levels) && levels.length > 0) {
		messages = messages.filter(msg => levels.includes(msg.level));
	}
	
	// Limit results
	return messages.slice(0, limit);
}

/**
 * Clear captured messages
 */
export function clearCapturedMessages() {
	capturedMessages.length = 0;
}

/**
 * Get message count by level
 * @returns {Object} Count of messages by level
 */
export function getMessageCounts() {
	const counts = {
		error: 0,
		warn: 0,
		log: 0,
		total: capturedMessages.length
	};
	
	capturedMessages.forEach(msg => {
		if (counts.hasOwnProperty(msg.level)) {
			counts[msg.level]++;
		}
	});
	
	return counts;
}

/**
 * Filter messages to only show preloader-related ones
 * @param {Array} messages - Array of message objects
 * @returns {Array} Filtered messages
 */
export function filterPreloadMessages(messages) {
	const preloadKeywords = [
		'[Preload]',
		'[Perf]',
		'preload',
		'assets',
		'theme',
		'loading',
		'loader',
		'texture',
		'image',
		'filecomplete',
		'waitfortheme',
		'progress',
		// Scratch surface / mask (game category); keeps cold-start logs in default upload filter
		'processimage',
		'scratchcover',
		'backingmask',
		'implausible',
		'verifytilecoverage',
		'deferred until cover'
	];
	
	return messages.filter(msg => {
		const message = msg.message.toLowerCase();
		// Always include errors and warnings
		if (msg.level === 'error' || msg.level === 'warn') {
			return true;
		}
		// Include logs that match preload keywords
		return preloadKeywords.some(keyword => 
			message.includes(keyword.toLowerCase())
		);
	});
}

