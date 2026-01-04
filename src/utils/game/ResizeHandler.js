import ViewportHelper from '../ui/ViewportHelper.js';

/**
 * ResizeHandler - Reusable utility for handling window resize events in Phaser games
 * 
 * This utility handles window resize, maximize, and minimize events by:
 * - Listening to window resize events
 * - Listening to window focus events (catches maximize/minimize)
 * - Listening to visualViewport resize events (catches browser UI changes like Safari iOS bottom bar)
 * - Polling for size changes as a fallback for browsers that don't fire resize on maximize
 * 
 * @example
 * // Basic usage
 * const resizeHandler = new ResizeHandler(game);
 * 
 * // With custom configuration
 * const resizeHandler = new ResizeHandler(game, {
 *     pollingInterval: 250,
 *     focusDelay: 100,
 *     enableLogging: true
 * });
 * 
 * // Cleanup when done
 * resizeHandler.destroy();
 */
export default class ResizeHandler {
    /**
     * Create a new ResizeHandler instance
     * @param {Phaser.Game} game - The Phaser game instance
     * @param {Object} config - Configuration options
     * @param {number} config.pollingInterval - Interval in milliseconds for polling size changes (default: 250)
     * @param {number} config.focusDelay - Delay in milliseconds before handling focus events (default: 100)
     * @param {boolean} config.enableLogging - Whether to log resize events (default: false)
     */
    constructor(game, config = {}) {
        if (!game || !game.scale) {
            console.warn('⚠️ ResizeHandler: Game instance or scale manager not available');
            return;
        }

        this.game = game;
        this.config = {
            pollingInterval: config.pollingInterval || 250,
            focusDelay: config.focusDelay || 100,
            enableLogging: config.enableLogging || false
        };

        // Store references for cleanup
        this.resizeListener = null;
        this.focusListener = null;
        this.visualViewportListener = null;
        this.pollingInterval = null;
        this.lastWidth = ViewportHelper.getWidth();
        this.lastHeight = ViewportHelper.getHeight();
        
        // Store initial canvas size to prevent unnecessary resize on first poll
        // This prevents visible jump if canvas was already resized correctly in main.js
        this.initialCanvasWidth = game.scale.width;
        this.initialCanvasHeight = game.scale.height;

        // Setup all resize detection mechanisms
        this.setup();
    }

    /**
     * Setup all resize detection mechanisms
     * @private
     */
    setup() {
        // Function to handle resize
        const handleResize = () => {
            if (this.game && this.game.scale) {
                const newWidth = ViewportHelper.getWidth();
                const newHeight = ViewportHelper.getHeight();
                
                // Resize Phaser game
                this.game.scale.resize(newWidth, newHeight);
                
                if (this.config.enableLogging) {
                    console.log(`📱 Game resized to: ${newWidth}x${newHeight}`);
                }
                
                // Trigger resize event on Phaser scale manager to ensure scenes get notified
                this.game.scale.refresh();
            }
        };

        // Store handleResize reference for cleanup
        this.handleResize = handleResize;

        // Listen for window resize events
        this.resizeListener = handleResize;
        window.addEventListener('resize', this.resizeListener);
        
        // Listen for visualViewport resize events (catches browser UI changes like Safari iOS bottom bar)
        if (window.visualViewport) {
            this.visualViewportListener = handleResize;
            window.visualViewport.addEventListener('resize', this.visualViewportListener);
            window.visualViewport.addEventListener('scroll', this.visualViewportListener);
        }
        
        // Listen for window focus events (catches maximize/minimize)
        this.focusListener = () => {
            // Small delay to let window finish resizing
            setTimeout(handleResize, this.config.focusDelay);
        };
        window.addEventListener('focus', this.focusListener);
        
        // Polling mechanism as fallback for browsers that don't fire resize on maximize
        const checkResize = () => {
            const currentWidth = ViewportHelper.getWidth();
            const currentHeight = ViewportHelper.getHeight();
            
            // Check if viewport size changed
            if (currentWidth !== this.lastWidth || currentHeight !== this.lastHeight) {
                // Also check if canvas size differs from viewport (needs resize)
                const canvasWidth = this.game.scale.width;
                const canvasHeight = this.game.scale.height;
                
                if (currentWidth !== canvasWidth || currentHeight !== canvasHeight) {
                    this.lastWidth = currentWidth;
                    this.lastHeight = currentHeight;
                    handleResize();
                } else {
                    // Viewport changed but canvas already matches - just update tracking
                    this.lastWidth = currentWidth;
                    this.lastHeight = currentHeight;
                }
            }
        };
        
        // Check for resize changes periodically (catches maximize/minimize)
        this.pollingInterval = setInterval(checkResize, this.config.pollingInterval);
        
        if (this.config.enableLogging) {
            console.log('✅ ResizeHandler: Resize handler set up');
        }
    }

    /**
     * Destroy the resize handler and clean up all event listeners and intervals
     */
    destroy() {
        // Remove event listeners
        if (this.resizeListener) {
            window.removeEventListener('resize', this.resizeListener);
            this.resizeListener = null;
        }
        
        if (this.focusListener) {
            window.removeEventListener('focus', this.focusListener);
            this.focusListener = null;
        }
        
        if (this.visualViewportListener && window.visualViewport) {
            window.visualViewport.removeEventListener('resize', this.visualViewportListener);
            window.visualViewport.removeEventListener('scroll', this.visualViewportListener);
            this.visualViewportListener = null;
        }
        
        // Clear polling interval
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        
        // Clear references
        this.handleResize = null;
        this.game = null;
        
        if (this.config.enableLogging) {
            console.log('✅ ResizeHandler: Cleaned up');
        }
    }
}

