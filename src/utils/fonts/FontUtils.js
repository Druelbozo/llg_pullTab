/**
 * Font Utility Functions
 * Simplified Google Fonts system with automatic fallback to Lato-Bold
 * 
 * Features:
 * - Google Fonts loading via WebFont.js
 * - Font validation (checks if font is declared in theme)
 * - Automatic fallback to local Lato-Bold on failure
 * - Error reporting via LoggerUtils
 * - Support for font weights
 */

import { log, warn, error, debug } from '../logger/LoggerUtils.js';

class FontUtils {
    // Shared cache - prevents duplicate font loading
    static loadedFonts = new Set();
    static fontLoadingPromises = new Map();
    // Track failed fonts for fallback mechanism
    static failedFonts = new Set();
    // Track declared fonts from theme for validation
    static declaredFonts = new Set();

    /**
     * Load a Google Font for Phaser using WebFont.js
     * 
     * @param {string} fontFamily - Font family name (e.g., 'Roboto', 'Open Sans')
     * @param {string|string[]} weights - Font weight(s) to load (e.g., '400', ['400', '700'])
     * @param {Object} options - Additional options
     * @param {boolean} options.forceReload - Force reload even if already cached (default: false)
     * @param {boolean} options.silent - Suppress console logs (default: false)
     * @returns {Promise<{success: boolean, fontFamily: string}>} - Resolves when font is loaded
     */
    static async loadGoogleFont(fontFamily, weights = ['400'], options = {}) {
        const { forceReload = false, silent = false } = options;
        
        if (!fontFamily || typeof fontFamily !== 'string') {
            throw new Error('Font family must be a non-empty string');
        }

        // Normalize font name (capitalize first letter of each word)
        const normalizedFamily = this.normalizeFontName(fontFamily.trim());
        
        // Check if WebFont.js is available
        if (typeof WebFont === 'undefined') {
            if (!silent) {
                error('WebFont.js not available, cannot load Google Font:', 'theme', normalizedFamily);
            }
            this.failedFonts.add(normalizedFamily);
            return Promise.resolve({ success: false, fontFamily: normalizedFamily });
        }

        // Convert weight to array if single value
        const weightArray = Array.isArray(weights) ? weights : [String(weights)];
        
        // Validate weights
        const validWeights = weightArray.filter(w => {
            const wNum = parseInt(w);
            return !isNaN(wNum) && wNum >= 100 && wNum <= 900 && wNum % 100 === 0;
        });

        if (validWeights.length === 0) {
            if (!silent) {
                warn(`No valid font weights provided for ${normalizedFamily}, using default [400]`, 'theme');
            }
            validWeights.push('400');
        }

        const fontKey = `${normalizedFamily}-${validWeights.join(',')}`;
        
        // Check if already loaded (unless forcing reload)
        if (!forceReload && this.loadedFonts.has(fontKey)) {
            if (!silent) {
                log(`Font already loaded: ${normalizedFamily}`, 'theme');
            }
            return Promise.resolve({ success: true, fontFamily: normalizedFamily });
        }

        // Check if already loading (unless forcing reload)
        if (!forceReload && this.fontLoadingPromises.has(fontKey)) {
            if (!silent) {
                log(`Font already loading: ${normalizedFamily}`, 'theme');
            }
            return this.fontLoadingPromises.get(fontKey);
        }

        // Create loading promise
        const promise = new Promise((resolve) => {
            // Format font specification for WebFont.js
            // WebFont.js format: "Font Name:400" or "Font Name:400,700" for multiple weights
            const weightsString = validWeights.join(',');
            const fontSpec = `${normalizedFamily}:${weightsString}`;
            
            if (!silent) {
                log(`Loading Google Font: ${fontSpec}`, 'theme');
            }

            const timeout = setTimeout(() => {
                if (!silent) {
                    warn(`Font loading timeout: ${normalizedFamily}`, 'theme');
                }
                // Mark as failed and fallback
                this.failedFonts.add(normalizedFamily);
                this.fontLoadingPromises.delete(fontKey);
                resolve({ success: false, fontFamily: normalizedFamily });
            }, 10000); // 10 second timeout

            WebFont.load({
                google: {
                    families: [fontSpec]
                },
                active: () => {
                    clearTimeout(timeout);
                    if (!silent) {
                        log(`Successfully loaded Google Font: ${normalizedFamily} (weights: ${weightsString})`, 'theme');
                    }
                    this.loadedFonts.add(fontKey);
                    this.failedFonts.delete(normalizedFamily);
                    this.fontLoadingPromises.delete(fontKey);
                    setTimeout(() => resolve({ success: true, fontFamily: normalizedFamily }), 200);
                },
                inactive: () => {
                    clearTimeout(timeout);
                    if (!silent) {
                        error(`Failed to load Google Font: ${normalizedFamily} (typo/network/missing) - will use Lato-Bold fallback`, 'theme');
                    }
                    this.failedFonts.add(normalizedFamily);
                    this.fontLoadingPromises.delete(fontKey);
                    resolve({ success: false, fontFamily: normalizedFamily });
                },
                fontloading: (familyName) => {
                    if (!silent) {
                        log(`Font loading: ${familyName}`, 'theme');
                    }
                },
                fontactive: (familyName) => {
                    if (!silent) {
                        log(`Font active: ${familyName}`, 'theme');
                    }
                },
                fontinactive: (familyName) => {
                    if (!silent) {
                        error(`Font inactive: ${familyName} (failed to load)`, 'theme');
                    }
                }
            });
        });

        this.fontLoadingPromises.set(fontKey, promise);
        return promise;
    }

    /**
     * Load multiple Google Fonts from theme fonts array
     * Supports both string format ("Font Name") and object format ({ family: "Font Name", weights: ["400"] })
     * 
     * @param {Array<string|Object>} fontsArray - Array of font strings or objects
     * @param {Object} options - Additional options
     * @returns {Promise<Array>} - Resolves with array of load results
     */
    static async loadGoogleFonts(fontsArray, options = {}) {
        if (!Array.isArray(fontsArray) || fontsArray.length === 0) {
            return Promise.resolve([]);
        }

        // Track declared fonts for validation
        fontsArray.forEach(font => {
            if (typeof font === 'string') {
                this.declaredFonts.add(this.normalizeFontName(font));
            } else if (font && typeof font === 'object' && font.family) {
                this.declaredFonts.add(this.normalizeFontName(font.family));
            }
        });

        const promises = fontsArray.map(font => {
            if (typeof font === 'string') {
                // Simple string format: "Font Name"
                return this.loadGoogleFont(font, ['400'], options);
            } else if (font && typeof font === 'object' && font.family) {
                // Object format: { family: "Font Name", weights: ["400", "700"] }
                const weights = font.weights || ['400'];
                return this.loadGoogleFont(font.family, weights, options);
            } else {
                warn('Invalid font entry in fonts array:', 'theme', font);
                return Promise.resolve({ success: false, fontFamily: null });
            }
        });

        const results = await Promise.all(promises);
        
        const successful = results.filter(r => r && r.success).length;
        const failed = results.filter(r => r && !r.success).length;
        
        if (!options.silent) {
            if (failed === 0) {
                log(`All Google Fonts loaded successfully (${fontsArray.length} fonts)`, 'theme');
            } else {
                warn(`Google Fonts loaded: ${successful} succeeded, ${failed} failed (will use Lato-Bold fallback)`, 'theme');
            }
        }
        
        return results;
    }

    /**
     * Get font family and weight from font config object
     * Matches video-poker pattern: weights come from fonts declaration array, not usage location
     * 
     * New schema (video-poker style):
     * - Fonts declared: `"fonts": [{ "family": "Creepster", "weights": ["400"] }]`
     * - Font usage: `"font": { "family": "Creepster" }` (no weight - weight comes from fonts declaration)
     * 
     * Supports old schema for backward compatibility:
     * - `fontFamily: "Font Name"` (string)
     * - `font: { family: "Font Name", weight: "400" }` (weight in usage - deprecated)
     * 
     * @param {Object|string} fontConfig - Font config from theme (e.g., { family: "Font Name" } or "Font Name")
     * @param {Object} theme - Theme object for validation and weight lookup
     * @returns {Object} - { fontFamily: string, fontWeight: string|null }
     */
    static getFontFamily(fontConfig, theme = null) {
        let fontFamily = null;
        let fontWeight = null;

        // Support new schema: font: { family: "Font Name" } (no weight - weight comes from fonts declaration)
        if (fontConfig && typeof fontConfig === 'object' && fontConfig.family) {
            fontFamily = fontConfig.family;
            // Don't use weight from usage - lookup from fonts declaration array instead
            // Only use weight from usage if theme doesn't have fonts array (backward compatibility)
            if (!theme || !theme.fonts || theme.fonts.length === 0) {
                fontWeight = fontConfig.weight || '400'; // Fallback for old schema
            } else {
                fontWeight = null; // Will be looked up from fonts array
            }
        }
        // Support old schema: fontFamily: "Font Name" (backward compatibility)
        else if (typeof fontConfig === 'string') {
            fontFamily = fontConfig;
            fontWeight = null; // Will be looked up from fonts array or default to '400'
        }
        // Invalid config
        else {
            warn('Invalid font config, using Lato-Bold fallback:', 'theme', fontConfig);
            return { fontFamily: 'Lato-Bold', fontWeight: null };
        }

        // Normalize font name
        const normalizedFamily = this.normalizeFontName(fontFamily);

        // Look up weight from theme.fonts declaration array (matching video-poker pattern)
        if (theme && theme.fonts && theme.fonts.length > 0 && fontWeight === null) {
            const declaredFont = theme.fonts.find(font => {
                if (typeof font === 'string') {
                    return this.normalizeFontName(font) === normalizedFamily;
                } else if (font && typeof font === 'object' && font.family) {
                    return this.normalizeFontName(font.family) === normalizedFamily;
                }
                return false;
            });

            if (declaredFont) {
                // Font is declared - get first weight from weights array
                if (typeof declaredFont === 'object' && declaredFont.weights && Array.isArray(declaredFont.weights) && declaredFont.weights.length > 0) {
                    fontWeight = String(declaredFont.weights[0]); // Get first weight
                } else {
                    // String format or no weights array - default to '400'
                    fontWeight = '400';
                }
            } else {
                // Font not declared in fonts array
                warn(`Font "${normalizedFamily}" used but not declared in fonts array - will use Lato-Bold fallback if load fails`, 'theme');
                fontWeight = '400'; // Default weight
            }
        } else if (fontWeight === null) {
            // No theme or fonts array, use default
            fontWeight = '400';
        }

        return { fontFamily: normalizedFamily, fontWeight };
    }

    /**
     * Get safe font family with automatic fallback to Lato-Bold
     * Checks if font failed to load and falls back to local Lato-Bold
     * 
     * @param {string} fontFamily - Requested font family name
     * @returns {string} - Safe font family (requested font or Lato-Bold)
     */
    static getSafeFontFamily(fontFamily) {
        if (!fontFamily || typeof fontFamily !== 'string') {
            return 'Lato-Bold';
        }

        const normalized = this.normalizeFontName(fontFamily);

        // If font was marked as failed, use fallback
        if (this.failedFonts.has(normalized)) {
            return 'Lato-Bold';
        }

        // Local @font-face fonts (assets/fonts/lato/lato-font.css) — always available
        const lower = normalized.toLowerCase();
        if (lower === 'lato-bold' || lower === 'lato bold') {
            return 'Lato-Bold';
        }
        if (lower === 'lato-black' || lower === 'lato black') {
            return 'Lato-Black';
        }

        // Trust that if the font was loaded, it's available
        // If it wasn't loaded yet, it might still work (async loading)
        return normalized;
    }

    /**
     * Normalize font family name - capitalize first letter of each word
     * Google Fonts are case-sensitive
     * 
     * @param {string} fontFamily - Font family name to normalize
     * @returns {string} - Normalized font family name
     */
    static normalizeFontName(fontFamily) {
        if (!fontFamily || typeof fontFamily !== 'string') {
            return fontFamily;
        }
        
        return fontFamily.split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    }

    /**
     * Get list of all failed fonts
     * 
     * @returns {Array<string>} - Array of font family names that failed to load
     */
    static getFailedFonts() {
        return Array.from(this.failedFonts);
    }

    /**
     * Clear failed fonts tracking (useful for testing)
     */
    static clearFailedFonts() {
        this.failedFonts.clear();
    }

    /**
     * Clear declared fonts tracking (useful for testing)
     */
    static clearDeclaredFonts() {
        this.declaredFonts.clear();
    }

    /**
     * Create a Phaser Loader File for loading Google Fonts
     * This allows FontUtils to be used directly with Phaser's loader system
     * Replaces the need for a separate WebFontFile.js
     * 
     * @param {Phaser.Loader.LoaderPlugin} loader - Phaser loader instance
     * @param {Array<string>} fontSpecs - Array of font specifications (e.g., ["Font Name:400", "Font Name:400,700"])
     * @returns {WebFontLoaderFile} - Phaser loader file instance
     */
    static createPhaserLoaderFile(loader, fontSpecs) {
        return new WebFontLoaderFile(loader, fontSpecs);
    }
}

/**
 * Phaser Loader File for loading Google Fonts via WebFont.js
 * Consolidated from WebFontFile.js into FontUtils.js
 */
class WebFontLoaderFile extends Phaser.Loader.File {
    constructor(loader, fontNames, service = 'google') {
        super(loader, { type: 'webfont', key: fontNames.toString() });
        this.fontNames = Array.isArray(fontNames) ? fontNames : [fontNames];
        this.service = service;
        this.success = false;
        this.failedFonts = new Set(); // Track which specific fonts failed
    }

    load() {
        debug(`Starting load for: ${this.fontNames.join(', ')}`, 'assets');

        WebFont.load({
            [this.service]: { families: this.fontNames },

            // Fires when *any* font starts loading
            fontloading: (family, fvd) => {
                debug(`Loading font: ${family} (${fvd})`, 'assets');
            },

            // Fires when a font finishes successfully
            fontactive: (family, fvd) => {
                log(`Font active: ${family} (${fvd})`, 'assets');
            },

            // Fires when a font fails (typo, network, missing weight, etc.)
            fontinactive: (family, fvd) => {
                const normalizedFamily = FontUtils.normalizeFontName(family);
                this.failedFonts.add(normalizedFamily);
                FontUtils.failedFonts.add(normalizedFamily);
                error(`Failed to load Google Font: ${family} (${fvd}) - typo/network/missing - will use Lato-Bold fallback`, 'theme');
            },

            // Called when ALL requested fonts are loaded or failed
            active: () => {
                this.success = true;
                const failedList = Array.from(this.failedFonts);
                if (failedList.length > 0) {
                    warn(`Some fonts failed to load: ${failedList.join(', ')} - will use Lato-Bold fallback`, 'theme');
                } else {
                    log(`All fonts ready: ${this.fontNames.join(', ')}`, 'assets');
                }
                this.loader.nextFile(this, true);
            },

            inactive: () => {
                this.success = false;
                const failedList = Array.from(this.failedFonts);
                error(`All fonts failed to load: ${this.fontNames.join(', ')} - failed fonts: ${failedList.join(', ')} - will use Lato-Bold fallback`, 'theme');
                this.loader.nextFile(this, false);
            }
        });
    }
}

export default FontUtils;
