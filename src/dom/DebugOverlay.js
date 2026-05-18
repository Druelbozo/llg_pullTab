/**
 * DebugOverlay - DOM-based debug overlay panel
 * Handles creation, visibility, keyboard controls, and switching between debug formatters
 * Uses DOM elements for native scrolling and better performance
 */

import { error, warn, debug } from '../utils/logger/LoggerUtils.js';
import { GameConfig } from '../config/Global.js';

export default class DebugOverlay {
	constructor(scene, options = {}) {
		this.scene = scene; // Keep scene reference for formatters that need it
		this.panelElement = null; // DOM panel element
		this.contentElement = null; // DOM content element
		this.consoleHeaderElement = null; // Persistent header for console panel (keys 6 and 7)
		this.formatters = new Map(); // key -> formatter function
		this.dynamicFormatters = new Set(); // keys that should update periodically
		this.staticFormatterCache = new Map(); // key -> cached result for static formatters
		this.activeKey = null;
		this.isVisible = false;
		this.updateInterval = null; // Interval for dynamic formatters
		
		// Options
		this.position = options.position || { x: 10, y: 10 };
		this.width = options.width || 450; // Panel width
		this.maxHeight = options.maxHeight || null; // Max height (null = use screen height)
		this.defaultVisibleKey = options.defaultVisibleKey || null; // Key to show by default
		this.updateIntervalMs = options.updateIntervalMs || 100; // Update frequency for dynamic formatters (ms)
		this.enablePanelNumberHotkeys = options.enablePanelNumberHotkeys !== false; // keys 1–7; default true
		
		// Create DOM panel
		this._createPanel();
		
		// Setup keyboard listeners
		this._setupKeyboardListeners();
	}
	
	/**
	 * Create the DOM panel element
	 * @private
	 */
	_createPanel() {
		// Create panel container
		this.panelElement = document.createElement('div');
		this.panelElement.className = 'debug-panel-overlay';
		this.panelElement.id = 'debug-panel-overlay';
		this.panelElement.style.display = 'none'; // Hidden by default
		
		// Create content area
		this.contentElement = document.createElement('div');
		this.contentElement.className = 'debug-panel-content';
		this.contentElement.id = 'debug-panel-content';
		
		// Event delegation for Log button (persistent header when key 6)
		this._logActionHandler = (e) => {
			const logBtn = e.target.closest ? e.target.closest('[data-action="log"]') : (e.target.id === 'console-debug-log-btn' ? e.target : null);
			if (!logBtn) return;
			if (logBtn.disabled) return;
			const contentDiv = this.contentElement?.querySelector('#console-debug-content');
			const textContent = contentDiv?.getAttribute('data-text-content') || contentDiv?.textContent || '';
			if (!textContent.trim()) {
				warn('[DebugOverlay] No debug content to log', 'ui');
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			const statusEl = this.consoleHeaderElement?.querySelector('#console-debug-log-status');
			const setStatus = (msg, isError = false) => {
				if (statusEl) {
					statusEl.textContent = msg;
					statusEl.style.color = isError ? '#f44336' : '#4caf50';
					statusEl.style.display = msg ? 'inline' : 'none';
				}
			};
			const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('localhost'));
			const fallbackLocal = `http://localhost:${typeof __CORS_PROXY_PORT__ !== 'undefined' ? __CORS_PROXY_PORT__ : '3005'}`;
			const fallbackLive =
				GameConfig?.api?.BASE_URL_LIVE || 'https://kmz1ixsmv6.execute-api.us-east-1.amazonaws.com/staging';
			const apiUrl = isLocal ? (GameConfig?.api?.BASE_URL_LOCAL || fallbackLocal) : (GameConfig?.api?.BASE_URL_LIVE || fallbackLive);
			const url = `${apiUrl}/admin/logs`;
			const originalText = logBtn.textContent;
			logBtn.textContent = 'Sending...';
			logBtn.disabled = true;
			setStatus('');
			fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: textContent })
			}).then(res => {
				if (res.ok) {
					logBtn.textContent = 'Sent';
					logBtn.style.background = 'rgba(76, 175, 80, 0.5)';
					setStatus('Success');
				} else {
					const errMsg = `${res.status} ${res.statusText}`;
					logBtn.textContent = 'Error';
					logBtn.style.background = 'rgba(244, 67, 54, 0.5)';
					setStatus(`Failed: ${errMsg}`, true);
					warn(`[DebugOverlay] Log API error: ${errMsg}`, 'ui');
				}
			}).catch(err => {
				const errMsg = err.message || String(err);
				logBtn.textContent = 'Error';
				logBtn.style.background = 'rgba(244, 67, 54, 0.5)';
				setStatus(`Failed: ${errMsg}`, true);
				warn(`[DebugOverlay] Failed to log to API: ${errMsg}`, 'ui');
			}).finally(() => {
				setTimeout(() => {
					logBtn.textContent = originalText;
					logBtn.disabled = false;
					logBtn.style.background = '';
					setStatus('');
				}, 3000);
			});
		};
		// Use panelElement for delegation (header is sibling of content)
		this.panelElement.addEventListener('click', this._logActionHandler);
		this.panelElement.addEventListener('touchend', this._logActionHandler, { passive: false });
		this.panelElement.addEventListener('pointerdown', this._logActionHandler);
		
		// Assemble panel
		this.panelElement.appendChild(this.contentElement);
		
		// Add to DOM
		document.body.appendChild(this.panelElement);
	}
	
	/**
	 * Ensure console header exists when showing keys 6 or 7, remove when switching away
	 * @param {string|null} key - Active formatter key or null when hidden
	 * @private
	 */
	_ensureConsoleHeader(key) {
		const shouldShow = key === '6' || key === '7';
		if (shouldShow && !this.consoleHeaderElement) {
			this.consoleHeaderElement = document.createElement('div');
			this.consoleHeaderElement.id = 'console-debug-header';
			this.consoleHeaderElement.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 10px;margin:0;min-height:0;flex-shrink:0;border-bottom:1px solid rgba(255,255,255,0.2);';
			this.consoleHeaderElement.innerHTML = `
				<button id="console-debug-log-btn" type="button" data-action="log" style="min-height:44px;min-width:44px;padding:6px 14px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:4px;color:#fff;font-size:12px;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;">
					Log
				</button>
				<span id="console-debug-log-status" style="font-size:11px;display:none;"></span>
			`;
			this.panelElement.insertBefore(this.consoleHeaderElement, this.contentElement);
		} else if (!shouldShow && this.consoleHeaderElement) {
			this.consoleHeaderElement.remove();
			this.consoleHeaderElement = null;
		}
	}
	
	/**
	 * Setup keyboard listeners for debug overlay controls
	 * @private
	 */
	_setupKeyboardListeners() {
		this._keyboardHandler = (event) => {
			if (
				this.enablePanelNumberHotkeys &&
				(event.key === '1' || event.key === '2' || event.key === '3' || event.key === '4' ||
					event.key === '5' || event.key === '6' || event.key === '7')
			) {
				if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
					this.show(event.key);
					event.preventDefault();
				}
			} else if (event.key === 'Escape') {
				if (this.isVisible) {
					this.hide();
					event.preventDefault();
				}
			}
		};
		
		// Add DOM keyboard event listener
		if (typeof window !== 'undefined') {
			window.addEventListener('keydown', this._keyboardHandler);
		}
	}
	
	/**
	 * Register a formatter function with a key
	 * @param {string} key - Key to trigger this formatter (e.g., '1', '2')
	 * @param {Function} formatterFunction - Function that returns formatted debug content (string[] or string)
	 * @param {boolean} isDynamic - If true, formatter updates periodically. If false, formatter is called once and cached.
	 */
	registerFormatter(key, formatterFunction, isDynamic = false) {
		if (typeof formatterFunction !== 'function') {
			error(`Formatter for key '${key}' must be a function`, 'ui');
			return;
		}
		this.formatters.set(key, formatterFunction);
		
		if (isDynamic) {
			this.dynamicFormatters.add(key);
		}
		
		// If this is the default visible key and overlay isn't visible yet, show it
		if (this.defaultVisibleKey === key && !this.isVisible) {
			this.show(key);
		}
	}
	
	/**
	 * Show debug overlay with specified formatter
	 * @param {string} key - Key of formatter to use
	 */
	show(key) {
		if (!this.formatters.has(key)) {
			warn(`No formatter registered for key '${key}'`, 'ui');
			return;
		}
		
		if (!this.panelElement || !this.contentElement) {
			warn('Panel elements not created yet', 'ui');
			return;
		}
		
		this.activeKey = key;
		this.isVisible = true;
		this.panelElement.style.display = 'block';
		this._ensureConsoleHeader(key);
		
		// For static formatters, check cache first; for dynamic, always update
		if (this.dynamicFormatters.has(key)) {
			// Dynamic formatter - update immediately and start update loop
			this.update();
			this._startUpdateLoop();
		} else {
			// Static formatter - check cache or call once
			if (this.staticFormatterCache.has(key)) {
				// Use cached result
				this._setContent(this.staticFormatterCache.get(key));
			} else {
				// Call formatter once and cache result
				this.update();
			}
			// Stop update loop for static formatters
			this._stopUpdateLoop();
		}
		
		// Note: Auto-copy removed - using localStorage persistence instead
	}
	
	/**
	 * Hide debug overlay
	 */
	hide() {
		this.isVisible = false;
		this._ensureConsoleHeader(null);
		this.activeKey = null;
		if (this.panelElement) {
			this.panelElement.style.display = 'none';
		}
		// Stop update loop
		this._stopUpdateLoop();
		// Clear static formatter cache when hiding (so it refreshes next time)
		this.staticFormatterCache.clear();
	}
	
	/**
	 * Update debug overlay content from active formatter
	 * Supports both synchronous and asynchronous formatters
	 * For static formatters, caches the result
	 */
	update() {
		if (!this.isVisible || !this.activeKey || !this.formatters.has(this.activeKey)) {
			return;
		}
		
		if (!this.contentElement) {
			warn('Content element not available for update', 'ui');
			return;
		}
		
		const formatter = this.formatters.get(this.activeKey);
		const isDynamic = this.dynamicFormatters.has(this.activeKey);
		
		try {
			const content = formatter();
			
			// Handle async formatters (promises)
			if (content && typeof content.then === 'function') {
				content.then(result => {
					// Cache static formatter results
					if (!isDynamic) {
						this.staticFormatterCache.set(this.activeKey, result);
					}
					this._setContent(result);
				}).catch(formatterError => {
					error(`Error in async formatter for key '${this.activeKey}':`, 'ui', formatterError);
					const errorText = `Error in formatter '${this.activeKey}': ${formatterError.message}`;
					this._setContent([errorText]);
				});
				return;
			}
			
			// Handle synchronous formatters
			// Cache static formatter results
			if (!isDynamic) {
				this.staticFormatterCache.set(this.activeKey, content);
			}
			this._setContent(content);
		} catch (formatterError) {
			error(`Error in formatter for key '${this.activeKey}':`, 'ui', formatterError);
			// Show error message in debug overlay
			const errorText = `Error in formatter '${this.activeKey}': ${formatterError.message}`;
			this._setContent([errorText]);
		}
	}
	
	/**
	 * Internal method to set content from formatter result
	 * Converts string arrays to HTML
	 * @param {string|string[]|Object} content - Formatter result (string, array of strings, or object with html/content)
	 * @private
	 */
	_setContent(content) {
		let htmlContent = '';
		
		// Handle special HTML format (for console debug with copy button)
		// Check for object with html property (more robust check for mobile compatibility)
		// Use 'in' operator instead of hasOwnProperty() for better mobile browser support
		// Check for html property being truthy (not just === true) for better mobile compatibility
		if (content !== null && 
		    content !== undefined && 
		    typeof content === 'object' && 
		    !Array.isArray(content) &&
		    ('html' in content) && 
		    (content.html === true || content.html === 1 || content.html === 'true') &&
		    ('content' in content) &&
		    typeof content.content === 'string') {
			
			htmlContent = content.content;
			
			// Store text content in data attribute for copy button
			// The click handler is set up via event delegation in _createPanel()
			if (content.textContent) {
				// Store in a data attribute on the content div for easy access
				const tempDiv = document.createElement('div');
				tempDiv.innerHTML = htmlContent;
				const contentDiv = tempDiv.querySelector('#console-debug-content');
				if (contentDiv) {
					contentDiv.setAttribute('data-text-content', content.textContent);
				}
				htmlContent = tempDiv.innerHTML;
			}
			
			// Set HTML content
			this.contentElement.innerHTML = htmlContent;
			return;
		}
		
		if (Array.isArray(content)) {
			// Convert array of strings to HTML (escape HTML and join with <br>)
			htmlContent = content.map(line => {
				// Escape HTML characters
				const escaped = line
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;')
					.replace(/"/g, '&quot;')
					.replace(/'/g, '&#039;');
				return escaped;
			}).join('<br>');
		} else if (typeof content === 'string') {
			// Escape HTML characters in string
			htmlContent = content
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#039;')
				.replace(/\n/g, '<br>');
		} else {
			// Log detailed error information for debugging mobile issues
			const contentType = content === null ? 'null' : 
			                   content === undefined ? 'undefined' : 
			                   Array.isArray(content) ? 'array' : 
			                   typeof content;
			
			let errorDetails = `Formatter must return string or array of strings. Got: ${contentType}`;
			
			// Try fallback: if it looks like the HTML format object but validation failed,
			// try to extract the content anyway (for mobile compatibility)
			if (content && typeof content === 'object' && !Array.isArray(content)) {
				try {
					const keys = Object.keys(content);
					errorDetails += ` (keys: ${keys.join(', ')})`;
					
					// Check if it looks like the HTML format but failed validation
					if ('html' in content || 'content' in content) {
						errorDetails += ` [html: ${content.html}, hasContent: ${'content' in content}]`;
						
						// Fallback: try to use the content property if it exists
						// This handles cases where the object structure is correct but validation failed
						if ('content' in content && typeof content.content === 'string') {
							warn(`[DebugOverlay] Using fallback: extracting content from object format for key '${this.activeKey}'`, 'ui');
							htmlContent = content.content;
							
							// Store text content if available
							if (content.textContent && this.contentElement) {
								const tempDiv = document.createElement('div');
								tempDiv.innerHTML = htmlContent;
								const contentDiv = tempDiv.querySelector('#console-debug-content');
								if (contentDiv) {
									contentDiv.setAttribute('data-text-content', content.textContent);
								}
								htmlContent = tempDiv.innerHTML;
							}
							
							// Set HTML content and return early
							if (this.contentElement) {
								this.contentElement.innerHTML = htmlContent;
							}
							return;
						}
					}
				} catch (e) {
					errorDetails += ` (could not enumerate keys: ${e.message})`;
				}
			}
			
			warn(errorDetails, 'ui');
			htmlContent = `[DebugOverlay] Invalid formatter output for key '${this.activeKey}' (type: ${contentType})`;
		}
		
		// Ensure we have some content to display
		if (!htmlContent || htmlContent.trim().length === 0) {
			htmlContent = `[DebugOverlay] No content from formatter '${this.activeKey}'`;
		}
		
		// Set HTML content
		this.contentElement.innerHTML = htmlContent;
	}
	
	/**
	 * Copy text to clipboard
	 * @param {string} text - Text to copy
	 * @param {HTMLElement} button - The copy button element (for feedback)
	 * @private
	 */
	_copyToClipboard(text, button) {
		// Store button reference for feedback
		const copyButton = button || this.contentElement.querySelector('#console-debug-copy-btn');
		
		// Try modern clipboard API first (works in secure contexts and requires user gesture)
		if (navigator.clipboard && navigator.clipboard.writeText) {
			// Call immediately within user gesture context
			navigator.clipboard.writeText(text).then(() => {
				// Show feedback
				if (copyButton) {
					const originalText = copyButton.textContent || copyButton.innerText;
					copyButton.textContent = '✓ Copied!';
					copyButton.style.background = '#45a049';
					setTimeout(() => {
						copyButton.textContent = originalText;
						copyButton.style.background = '#4CAF50';
					}, 2000);
				}
				debug('[DebugOverlay] Successfully copied to clipboard using Clipboard API', 'ui');
			}).catch(err => {
				warn(`Failed to copy to clipboard using Clipboard API: ${err.message}`, 'ui');
				debug(`[DebugOverlay] Clipboard API error details: ${JSON.stringify(err)}`, 'ui');
				// Fallback to older method
				this._fallbackCopyToClipboard(text, copyButton);
			});
		} else {
			// Fallback for older browsers or non-secure contexts
			debug('[DebugOverlay] Clipboard API not available, using fallback method', 'ui');
			this._fallbackCopyToClipboard(text, copyButton);
		}
	}
	
	/**
	 * Fallback copy method for older browsers or when Clipboard API fails
	 * @param {string} text - Text to copy
	 * @param {HTMLElement} button - The copy button element (for feedback)
	 * @private
	 */
	_fallbackCopyToClipboard(text, button) {
		const copyButton = button || this.contentElement.querySelector('#console-debug-copy-btn');
		
		// Create temporary textarea element
		const textArea = document.createElement('textarea');
		textArea.value = text;
		
		// Style to make it invisible but still functional
		textArea.style.position = 'fixed';
		textArea.style.left = '0';
		textArea.style.top = '0';
		textArea.style.width = '2em';
		textArea.style.height = '2em';
		textArea.style.padding = '0';
		textArea.style.border = 'none';
		textArea.style.outline = 'none';
		textArea.style.boxShadow = 'none';
		textArea.style.background = 'transparent';
		textArea.style.opacity = '0';
		textArea.style.pointerEvents = 'none';
		textArea.setAttribute('readonly', '');
		textArea.setAttribute('aria-hidden', 'true');
		
		document.body.appendChild(textArea);
		
		// For mobile, we need to ensure the textarea is in the viewport
		// Some mobile browsers require the element to be visible (even if transparent)
		textArea.style.position = 'absolute';
		textArea.style.left = '50%';
		textArea.style.top = '50%';
		textArea.style.transform = 'translate(-50%, -50%)';
		
		// Select and copy
		textArea.focus();
		textArea.select();
		textArea.setSelectionRange(0, text.length); // For mobile
		
		try {
			const successful = document.execCommand('copy');
			if (successful) {
				if (copyButton) {
					const originalText = copyButton.textContent || copyButton.innerText;
					copyButton.textContent = '✓ Copied!';
					copyButton.style.background = '#45a049';
					setTimeout(() => {
						copyButton.textContent = originalText;
						copyButton.style.background = '#4CAF50';
					}, 2000);
				}
				debug('[DebugOverlay] Successfully copied to clipboard using execCommand', 'ui');
			} else {
				warn('[DebugOverlay] Fallback copy command returned false', 'ui');
				if (copyButton) {
					copyButton.textContent = '❌ Copy Failed';
					copyButton.style.background = '#f44336';
					setTimeout(() => {
						const originalText = copyButton.textContent || copyButton.innerText;
						copyButton.textContent = originalText.replace('❌ Copy Failed', '📋 Copy to Clipboard');
						copyButton.style.background = '#4CAF50';
					}, 2000);
				}
			}
		} catch (err) {
			warn(`[DebugOverlay] Fallback copy failed: ${err.message}`, 'ui');
			if (copyButton) {
				copyButton.textContent = '❌ Copy Failed';
				copyButton.style.background = '#f44336';
				setTimeout(() => {
					const originalText = copyButton.textContent || copyButton.innerText;
					copyButton.textContent = originalText.replace('❌ Copy Failed', '📋 Copy to Clipboard');
					copyButton.style.background = '#4CAF50';
				}, 2000);
			}
		} finally {
			// Clean up
			document.body.removeChild(textArea);
		}
	}
	
	/**
	 * Start update loop for dynamic formatters
	 * @private
	 */
	_startUpdateLoop() {
		// Stop any existing loop
		this._stopUpdateLoop();
		
		// Start new loop
		this.updateInterval = setInterval(() => {
			if (this.isVisible && this.activeKey && this.dynamicFormatters.has(this.activeKey)) {
				this.update();
			}
		}, this.updateIntervalMs);
	}
	
	/**
	 * Stop update loop
	 * @private
	 */
	_stopUpdateLoop() {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = null;
		}
	}
	
	
	/**
	 * Cleanup - remove event listeners and DOM elements
	 */
	destroy() {
		// Stop update loop
		this._stopUpdateLoop();
		
		// Remove keyboard listener
		if (this._keyboardHandler && typeof window !== 'undefined') {
			window.removeEventListener('keydown', this._keyboardHandler);
		}
		
		// Remove Log button click listener
		if (this.contentElement && this._logClickHandler) {
			this.contentElement.removeEventListener('click', this._logClickHandler);
		}
		
		// Remove DOM elements
		if (this.panelElement && this.panelElement.parentNode) {
			this.panelElement.parentNode.removeChild(this.panelElement);
		}
		
		// Clear references
		this.panelElement = null;
		this.contentElement = null;
		
		// Clear formatters
		this.formatters.clear();
		this.dynamicFormatters.clear();
		this.staticFormatterCache.clear();
	}
}

