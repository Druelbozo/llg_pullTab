/**
 * Graphics Drawing Utilities
 * 
 * Centralized utility for drawing graphics using both Phaser Graphics API (immediate mode)
 * and Canvas 2D API (texture generation). Provides reusable functions for rectangles,
 * rounded rectangles, circles, half-circles, and gradients.
 * 
 * @example
 * // Phaser Graphics (immediate mode)
 * const graphics = scene.add.graphics();
 * GraphicsUtils.drawRoundedRect(graphics, 0, 0, 100, 50, 10, 0xff0000, 1.0);
 * 
 * @example
 * // Canvas 2D (texture generation)
 * const sprite = GraphicsUtils.createRoundedRectTexture(scene, 100, 50, 10, '#ff0000');
 */

import ColorUtils from '../../color/ColorUtils.js';
import { error, warn } from '../../logger/LoggerUtils.js';

export default class GraphicsUtils {
    /**
     * Normalize color to number format
     * @private
     * @param {string|number} color - Color in hex string or number format
     * @returns {number} - Numeric color value
     */
    static _normalizeColor(color) {
        if (typeof color === 'number') {
            return color;
        }
        if (typeof color === 'string') {
            return ColorUtils.hexToNumber(color);
        }
        return 0x000000; // Default to black
    }

    /**
     * Calculate actual corner radius from relative or absolute value
     * @private
     * @param {number} cornerRadius - Corner radius (0-1 = relative, >1 = absolute)
     * @param {number} height - Height for relative calculation
     * @returns {number} - Actual corner radius in pixels
     */
    static _calculateCornerRadius(cornerRadius, height) {
        return cornerRadius < 1 ? height * cornerRadius : cornerRadius;
    }

    /**
     * Draw rounded rectangle path on canvas context
     * @private
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {number} radius - Corner radius
     */
    static _drawRoundedRectPath(ctx, x, y, width, height, radius) {
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    // ============================================================================
    // Phaser Graphics API Functions (Immediate Mode)
    // ============================================================================

    /**
     * Fill a rectangle (matches Phaser's fillRect API)
     * @param {Phaser.GameObjects.Graphics} graphics - Phaser Graphics object
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {string|number} color - Fill color (hex string or number)
     * @param {number} [alpha=1.0] - Fill alpha (0-1)
     */
    static fillRect(graphics, x, y, width, height, color, alpha = 1.0) {
        if (!graphics) {
            error('GraphicsUtils.fillRect: graphics object is required', 'ui');
            return;
        }
        const normalizedColor = this._normalizeColor(color);
        graphics.fillStyle(normalizedColor, alpha);
        graphics.fillRect(x, y, width, height);
    }

    /**
     * Fill a rounded rectangle (matches Phaser's fillRoundedRect API)
     * @param {Phaser.GameObjects.Graphics} graphics - Phaser Graphics object
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {number} radius - Corner radius (0-1 = relative to height, >1 = absolute)
     * @param {string|number} color - Fill color (hex string or number)
     * @param {number} [alpha=1.0] - Fill alpha (0-1)
     */
    static fillRoundedRect(graphics, x, y, width, height, radius, color, alpha = 1.0) {
        if (!graphics) {
            error('GraphicsUtils.fillRoundedRect: graphics object is required', 'ui');
            return;
        }
        const actualRadius = this._calculateCornerRadius(radius, height);
        const normalizedColor = this._normalizeColor(color);
        graphics.fillStyle(normalizedColor, alpha);
        graphics.fillRoundedRect(x, y, width, height, actualRadius);
    }

    /**
     * Fill a rounded rectangle with gradient (matches Phaser's fillGradientStyle + fillRoundedRect API)
     * @param {Phaser.GameObjects.Graphics} graphics - Phaser Graphics object
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {number} radius - Corner radius (0-1 = relative to height, >1 = absolute)
     * @param {number} topLeft - Top-left gradient color
     * @param {number} topRight - Top-right gradient color
     * @param {number} bottomLeft - Bottom-left gradient color
     * @param {number} bottomRight - Bottom-right gradient color
     * @param {number} [alpha=1.0] - Fill alpha (0-1)
     */
    static fillGradientRoundedRect(graphics, x, y, width, height, radius, topLeft, topRight, bottomLeft, bottomRight, alpha = 1.0) {
        if (!graphics) {
            error('GraphicsUtils.fillGradientRoundedRect: graphics object is required', 'ui');
            return;
        }
        const actualRadius = this._calculateCornerRadius(radius, height);
        graphics.fillGradientStyle(topLeft, topRight, bottomLeft, bottomRight, alpha);
        graphics.fillRoundedRect(x, y, width, height, actualRadius);
    }

    /**
     * Stroke a rounded rectangle (matches Phaser's lineStyle + strokeRoundedRect API)
     * @param {Phaser.GameObjects.Graphics} graphics - Phaser Graphics object
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {number} radius - Corner radius (0-1 = relative to height, >1 = absolute)
     * @param {string|number} color - Stroke color (hex string or number)
     * @param {number} width - Stroke width in pixels
     * @param {number} [alpha=1.0] - Stroke alpha (0-1)
     */
    static strokeRoundedRect(graphics, x, y, width, height, radius, color, strokeWidth, alpha = 1.0) {
        if (!graphics) {
            error('GraphicsUtils.strokeRoundedRect: graphics object is required', 'ui');
            return;
        }
        const actualRadius = this._calculateCornerRadius(radius, height);
        const normalizedColor = this._normalizeColor(color);
        graphics.lineStyle(strokeWidth, normalizedColor, alpha);
        graphics.strokeRoundedRect(x, y, width, height, actualRadius);
    }

    /**
     * Draw a rectangle on a Phaser Graphics object (low-level, supports both fill and stroke)
     * @param {Phaser.GameObjects.Graphics} graphics - Phaser Graphics object
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {string|number} [fillColor] - Fill color (hex string or number)
     * @param {number} [fillAlpha=1.0] - Fill alpha (0-1)
     * @param {string|number} [strokeColor] - Stroke color (hex string or number)
     * @param {number} [strokeWidth] - Stroke width in pixels
     * @param {number} [strokeAlpha=1.0] - Stroke alpha (0-1)
     */
    static drawRect(graphics, x, y, width, height, fillColor, fillAlpha = 1.0, strokeColor, strokeWidth, strokeAlpha = 1.0) {
        if (!graphics) {
            error('GraphicsUtils.drawRect: graphics object is required', 'ui');
            return;
        }

        // Set fill style if provided
        if (fillColor !== undefined && fillColor !== null) {
            const normalizedColor = this._normalizeColor(fillColor);
            graphics.fillStyle(normalizedColor, fillAlpha);
            graphics.fillRect(x, y, width, height);
        }

        // Set stroke style if provided
        if (strokeColor !== undefined && strokeColor !== null && strokeWidth !== undefined && strokeWidth > 0) {
            const normalizedColor = this._normalizeColor(strokeColor);
            graphics.lineStyle(strokeWidth, normalizedColor, strokeAlpha);
            graphics.strokeRect(x, y, width, height);
        }
    }

    /**
     * Draw a rounded rectangle on a Phaser Graphics object
     * @param {Phaser.GameObjects.Graphics} graphics - Phaser Graphics object
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {number} radius - Corner radius (0-1 = relative to height, >1 = absolute)
     * @param {string|number} [fillColor] - Fill color (hex string or number)
     * @param {number} [fillAlpha=1.0] - Fill alpha (0-1)
     * @param {string|number} [strokeColor] - Stroke color (hex string or number)
     * @param {number} [strokeWidth] - Stroke width in pixels
     * @param {number} [strokeAlpha=1.0] - Stroke alpha (0-1)
     * @param {Array} [gradientColors] - Gradient colors for fill [topLeft, topRight, bottomLeft, bottomRight] (Phaser format)
     */
    static drawRoundedRect(graphics, x, y, width, height, radius, fillColor, fillAlpha = 1.0, strokeColor, strokeWidth, strokeAlpha = 1.0, gradientColors) {
        if (!graphics) {
            error('GraphicsUtils.drawRoundedRect: graphics object is required', 'ui');
            return;
        }

        const actualRadius = this._calculateCornerRadius(radius, height);

        // Set fill style - support gradients
        if (fillColor !== undefined && fillColor !== null || gradientColors) {
            if (gradientColors && Array.isArray(gradientColors) && gradientColors.length === 4) {
                // Use Phaser's fillGradientStyle for gradients
                graphics.fillGradientStyle(
                    this._normalizeColor(gradientColors[0]),
                    this._normalizeColor(gradientColors[1]),
                    this._normalizeColor(gradientColors[2]),
                    this._normalizeColor(gradientColors[3]),
                    fillAlpha
                );
            } else if (fillColor !== undefined && fillColor !== null) {
                const normalizedColor = this._normalizeColor(fillColor);
                graphics.fillStyle(normalizedColor, fillAlpha);
            }
            graphics.fillRoundedRect(x, y, width, height, actualRadius);
        }

        // Set stroke style if provided
        if (strokeColor !== undefined && strokeColor !== null && strokeWidth !== undefined && strokeWidth > 0) {
            const normalizedColor = this._normalizeColor(strokeColor);
            graphics.lineStyle(strokeWidth, normalizedColor, strokeAlpha);
            graphics.strokeRoundedRect(x, y, width, height, actualRadius);
        }
    }

    /**
     * Draw a circle on a Phaser Graphics object
     * @param {Phaser.GameObjects.Graphics} graphics - Phaser Graphics object
     * @param {number} x - X position (center)
     * @param {number} y - Y position (center)
     * @param {number} radius - Circle radius
     * @param {string|number} [fillColor] - Fill color (hex string or number)
     * @param {number} [fillAlpha=1.0] - Fill alpha (0-1)
     * @param {string|number} [strokeColor] - Stroke color (hex string or number)
     * @param {number} [strokeWidth] - Stroke width in pixels
     * @param {number} [strokeAlpha=1.0] - Stroke alpha (0-1)
     */
    static drawCircle(graphics, x, y, radius, fillColor, fillAlpha = 1.0, strokeColor, strokeWidth, strokeAlpha = 1.0) {
        if (!graphics) {
            error('GraphicsUtils.drawCircle: graphics object is required', 'ui');
            return;
        }

        // Set fill style if provided
        if (fillColor !== undefined && fillColor !== null) {
            const normalizedColor = this._normalizeColor(fillColor);
            graphics.fillStyle(normalizedColor, fillAlpha);
            graphics.beginPath();
            graphics.arc(x, y, radius, 0, Math.PI * 2, false);
            graphics.closePath();
            graphics.fillPath();
        }

        // Set stroke style if provided
        if (strokeColor !== undefined && strokeColor !== null && strokeWidth !== undefined && strokeWidth > 0) {
            const normalizedColor = this._normalizeColor(strokeColor);
            graphics.lineStyle(strokeWidth, normalizedColor, strokeAlpha);
            graphics.beginPath();
            graphics.arc(x, y, radius, 0, Math.PI * 2, false);
            graphics.closePath();
            graphics.strokePath();
        }
    }

    /**
     * Fill a half-circle (arc) - convenience method
     * @param {Phaser.GameObjects.Graphics} graphics - Phaser Graphics object
     * @param {number} x - X position (center)
     * @param {number} y - Y position (center)
     * @param {number} radius - Circle radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {string|number} color - Fill color (hex string or number)
     * @param {number} [alpha=1.0] - Fill alpha (0-1)
     */
    static fillHalfCircle(graphics, x, y, radius, startAngle, endAngle, color, alpha = 1.0) {
        if (!graphics) {
            error('GraphicsUtils.fillHalfCircle: graphics object is required', 'ui');
            return;
        }
        const normalizedColor = this._normalizeColor(color);
        graphics.fillStyle(normalizedColor, alpha);
        graphics.beginPath();
        graphics.arc(x, y, radius, startAngle, endAngle, false);
        graphics.lineTo(x, y); // Close the path to center
        graphics.closePath();
        graphics.fillPath();
    }

    /**
     * Draw a half-circle (arc) on a Phaser Graphics object (low-level, supports both fill and stroke)
     * @param {Phaser.GameObjects.Graphics} graphics - Phaser Graphics object
     * @param {number} x - X position (center)
     * @param {number} y - Y position (center)
     * @param {number} radius - Circle radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {string|number} [fillColor] - Fill color (hex string or number)
     * @param {number} [fillAlpha=1.0] - Fill alpha (0-1)
     * @param {string|number} [strokeColor] - Stroke color (hex string or number)
     * @param {number} [strokeWidth] - Stroke width in pixels
     * @param {number} [strokeAlpha=1.0] - Stroke alpha (0-1)
     * @param {boolean} [closeToCenter=true] - Whether to close path to center (for filled half-circles)
     */
    static drawHalfCircle(graphics, x, y, radius, startAngle, endAngle, fillColor, fillAlpha = 1.0, strokeColor, strokeWidth, strokeAlpha = 1.0, closeToCenter = true) {
        if (!graphics) {
            error('GraphicsUtils.drawHalfCircle: graphics object is required', 'ui');
            return;
        }

        // Set fill style if provided
        if (fillColor !== undefined && fillColor !== null) {
            const normalizedColor = this._normalizeColor(fillColor);
            graphics.fillStyle(normalizedColor, fillAlpha);
            graphics.beginPath();
            graphics.arc(x, y, radius, startAngle, endAngle, false);
            if (closeToCenter) {
                graphics.lineTo(x, y); // Close the path to center
            }
            graphics.closePath();
            graphics.fillPath();
        }

        // Set stroke style if provided
        if (strokeColor !== undefined && strokeColor !== null && strokeWidth !== undefined && strokeWidth > 0) {
            const normalizedColor = this._normalizeColor(strokeColor);
            graphics.lineStyle(strokeWidth, normalizedColor, strokeAlpha);
            graphics.beginPath();
            graphics.arc(x, y, radius, startAngle, endAngle, false);
            if (closeToCenter) {
                graphics.lineTo(x, y);
            }
            graphics.closePath();
            graphics.strokePath();
        }
    }

    /**
     * Draw a line on a Phaser Graphics object
     * @param {Phaser.GameObjects.Graphics} graphics - Phaser Graphics object
     * @param {number} x1 - Start X position
     * @param {number} y1 - Start Y position
     * @param {number} x2 - End X position
     * @param {number} y2 - End Y position
     * @param {string|number} color - Line color (hex string or number)
     * @param {number} width - Line width in pixels
     * @param {number} [alpha=1.0] - Line alpha (0-1)
     */
    static drawLine(graphics, x1, y1, x2, y2, color, width, alpha = 1.0) {
        if (!graphics) {
            error('GraphicsUtils.drawLine: graphics object is required', 'ui');
            return;
        }

        const normalizedColor = this._normalizeColor(color);
        graphics.lineStyle(width, normalizedColor, alpha);
        graphics.beginPath();
        graphics.moveTo(x1, y1);
        graphics.lineTo(x2, y2);
        graphics.strokePath();
    }

    // ============================================================================
    // Canvas 2D API Functions (Texture Generation)
    // ============================================================================

    /**
     * Create a linear gradient on a canvas context
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
     * @param {number} x0 - Start X position
     * @param {number} y0 - Start Y position
     * @param {number} x1 - End X position
     * @param {number} y1 - End Y position
     * @param {Array<Object>} colorStops - Array of {position: number, color: string} objects
     * @returns {CanvasGradient} - Canvas gradient object
     */
    static createLinearGradient(ctx, x0, y0, x1, y1, colorStops) {
        if (!ctx) {
            error('GraphicsUtils.createLinearGradient: canvas context is required', 'ui');
            return null;
        }

        const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
        
        if (Array.isArray(colorStops)) {
            colorStops.forEach(stop => {
                if (stop && typeof stop.position === 'number' && stop.color) {
                    gradient.addColorStop(stop.position, stop.color);
                }
            });
        }

        return gradient;
    }

    /**
     * Create a radial gradient on a canvas context
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
     * @param {number} x0 - Inner circle center X
     * @param {number} y0 - Inner circle center Y
     * @param {number} r0 - Inner circle radius
     * @param {number} x1 - Outer circle center X
     * @param {number} y1 - Outer circle center Y
     * @param {number} r1 - Outer circle radius
     * @param {Array<Object>} colorStops - Array of {position: number, color: string} objects
     * @returns {CanvasGradient} - Canvas gradient object
     */
    static createRadialGradient(ctx, x0, y0, r0, x1, y1, r1, colorStops) {
        if (!ctx) {
            error('GraphicsUtils.createRadialGradient: canvas context is required', 'ui');
            return null;
        }

        const gradient = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
        
        if (Array.isArray(colorStops)) {
            colorStops.forEach(stop => {
                if (stop && typeof stop.position === 'number' && stop.color) {
                    gradient.addColorStop(stop.position, stop.color);
                }
            });
        }

        return gradient;
    }

    /**
     * Create a rounded rectangle texture using Canvas 2D API
     * @deprecated Use generateRoundedRectTexture() instead - it uses Phaser Graphics API which is better integrated and more performant
     * @param {Phaser.Scene} scene - Phaser scene instance
     * @param {number} width - Texture width
     * @param {number} height - Texture height
     * @param {number} cornerRadius - Corner radius (0-1 = relative to height, >1 = absolute)
     * @param {string|number} [fillColor] - Fill color (hex string or number)
     * @param {Array<Object>} [gradientStops] - Gradient color stops [{position: number, color: string}]
     * @param {string} [textureKey] - Optional texture key (auto-generated if not provided)
     * @param {string} [tintColor] - Optional tint color to apply to gradient stops
     * @returns {Phaser.GameObjects.Sprite} - Sprite with the texture, or null on error
     */
    static createRoundedRectTexture(scene, width, height, cornerRadius, fillColor, gradientStops, textureKey, tintColor) {
        if (!scene) {
            error('GraphicsUtils.createRoundedRectTexture: scene is required', 'ui');
            return null;
        }

        const actualRadius = this._calculateCornerRadius(cornerRadius, height);

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
            error('GraphicsUtils.createRoundedRectTexture: Failed to get canvas context', 'ui');
            return null;
        }

        // Create gradient or use solid color
        let fillStyle;
        if (gradientStops && Array.isArray(gradientStops) && gradientStops.length > 0) {
            // Create linear gradient (vertical by default, matching ButtonFactory)
            const gradient = this.createLinearGradient(ctx, 0, 0, 0, height, gradientStops.map(stop => {
                // Apply tint if provided
                const color = tintColor && stop.color ? ColorUtils.tintColor(stop.color, tintColor) : stop.color;
                return { position: stop.position, color: color };
            }));
            fillStyle = gradient;
        } else if (fillColor !== undefined && fillColor !== null) {
            // Use solid color
            const normalizedColor = this._normalizeColor(fillColor);
            fillStyle = typeof normalizedColor === 'number' 
                ? `#${normalizedColor.toString(16).padStart(6, '0')}` 
                : fillColor;
        } else {
            fillStyle = '#000000'; // Default to black
        }

        // Draw rounded rectangle
        ctx.fillStyle = fillStyle;
        ctx.beginPath();
        this._drawRoundedRectPath(ctx, 0, 0, width, height, actualRadius);
        ctx.fill();

        // Generate texture key if not provided
        if (!textureKey) {
            const roundedRadius = Math.round(actualRadius * 100) / 100;
            const colorStr = tintColor 
                ? (typeof tintColor === 'string' ? tintColor.replace('#', '') : tintColor.toString(16))
                : (fillColor ? (typeof fillColor === 'string' ? fillColor.replace('#', '') : fillColor.toString(16)) : '000000');
            textureKey = `rounded_rect_${Math.round(width)}_${Math.round(height)}_${colorStr}_${roundedRadius}`;
        }

        // Check if texture already exists
        if (!scene.textures.exists(textureKey)) {
            scene.textures.addCanvas(textureKey, canvas);
        }

        // Create sprite from texture
        const sprite = scene.add.sprite(0, 0, textureKey);
        sprite.setOrigin(0.5, 0.5);
        
        // Explicitly clear any tint - gradient has color baked into texture
        sprite.setTint(0xffffff);
        
        return sprite;
    }

    /**
     * Create a circle texture using Canvas 2D API
     * @deprecated Use generateCircleTexture() instead - it uses Phaser Graphics API which is better integrated and more performant
     * @param {Phaser.Scene} scene - Phaser scene instance
     * @param {number} width - Texture width
     * @param {number} height - Texture height
     * @param {number} radius - Circle radius
     * @param {string|number} [fillColor] - Fill color (hex string or number)
     * @param {Array<Object>} [gradientStops] - Gradient color stops [{position: number, color: string}]
     * @param {string} [textureKey] - Optional texture key (auto-generated if not provided)
     * @param {number} [centerX] - Center X position (defaults to width/2)
     * @param {number} [centerY] - Center Y position (defaults to height/2)
     * @returns {Phaser.GameObjects.Image} - Image with the texture, or null on error
     */
    static createCircleTexture(scene, width, height, radius, fillColor, gradientStops, textureKey, centerX, centerY) {
        if (!scene) {
            error('GraphicsUtils.createCircleTexture: scene is required', 'ui');
            return null;
        }

        const cx = centerX !== undefined ? centerX : width / 2;
        const cy = centerY !== undefined ? centerY : height / 2;

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
            error('GraphicsUtils.createCircleTexture: Failed to get canvas context', 'ui');
            return null;
        }

        // Create gradient or use solid color
        let fillStyle;
        if (gradientStops && Array.isArray(gradientStops) && gradientStops.length > 0) {
            // Create radial gradient
            const gradient = this.createRadialGradient(ctx, cx, cy, 0, cx, cy, radius, gradientStops);
            fillStyle = gradient;
        } else if (fillColor !== undefined && fillColor !== null) {
            // Use solid color
            const normalizedColor = this._normalizeColor(fillColor);
            fillStyle = typeof normalizedColor === 'number' 
                ? `#${normalizedColor.toString(16).padStart(6, '0')}` 
                : fillColor;
        } else {
            fillStyle = '#000000'; // Default to black
        }

        // Draw circle
        ctx.fillStyle = fillStyle;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // Generate texture key if not provided
        if (!textureKey) {
            const colorStr = fillColor 
                ? (typeof fillColor === 'string' ? fillColor.replace('#', '') : fillColor.toString(16)) 
                : '000000';
            textureKey = `circle_${Math.round(width)}_${Math.round(height)}_${colorStr}_${Math.round(radius)}`;
        }

        // Check if texture already exists
        if (!scene.textures.exists(textureKey)) {
            scene.textures.addCanvas(textureKey, canvas);
        }

        // Create image from texture
        const image = scene.add.image(0, 0, textureKey);
        image.setOrigin(0.5, 0.5);
        
        return image;
    }

    /**
     * Create a half-circle texture using Canvas 2D API
     * @deprecated Use generateHalfCircleTexture() instead - it uses Phaser Graphics API which is better integrated and more performant
     * @param {Phaser.Scene} scene - Phaser scene instance
     * @param {number} width - Texture width
     * @param {number} height - Texture height
     * @param {number} radius - Circle radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {string|number} [fillColor] - Fill color (hex string or number)
     * @param {Array<Object>} [gradientStops] - Gradient color stops [{position: number, color: string}]
     * @param {string} [textureKey] - Optional texture key (auto-generated if not provided)
     * @param {number} [centerX] - Center X position (defaults to width/2)
     * @param {number} [centerY] - Center Y position (defaults to height/2)
     * @returns {Phaser.GameObjects.Image} - Image with the texture, or null on error
     */
    static createHalfCircleTexture(scene, width, height, radius, startAngle, endAngle, fillColor, gradientStops, textureKey, centerX, centerY) {
        if (!scene) {
            error('GraphicsUtils.createHalfCircleTexture: scene is required', 'ui');
            return null;
        }

        const cx = centerX !== undefined ? centerX : width / 2;
        const cy = centerY !== undefined ? centerY : height / 2;

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
            error('GraphicsUtils.createHalfCircleTexture: Failed to get canvas context', 'ui');
            return null;
        }

        // Create gradient or use solid color
        let fillStyle;
        if (gradientStops && Array.isArray(gradientStops) && gradientStops.length > 0) {
            // Create radial gradient
            const gradient = this.createRadialGradient(ctx, cx, cy, 0, cx, cy, radius, gradientStops);
            fillStyle = gradient;
        } else if (fillColor !== undefined && fillColor !== null) {
            // Use solid color
            const normalizedColor = this._normalizeColor(fillColor);
            fillStyle = typeof normalizedColor === 'number' 
                ? `#${normalizedColor.toString(16).padStart(6, '0')}` 
                : fillColor;
        } else {
            fillStyle = '#000000'; // Default to black
        }

        // Draw half-circle
        ctx.fillStyle = fillStyle;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle, false);
        ctx.lineTo(cx, cy); // Line to center
        ctx.closePath();
        ctx.fill();

        // Generate texture key if not provided
        if (!textureKey) {
            const colorStr = fillColor 
                ? (typeof fillColor === 'string' ? fillColor.replace('#', '') : fillColor.toString(16)) 
                : '000000';
            const angleStr = `${Math.round(startAngle * 100)}_${Math.round(endAngle * 100)}`;
            textureKey = `half_circle_${Math.round(width)}_${Math.round(height)}_${colorStr}_${Math.round(radius)}_${angleStr}`;
        }

        // Check if texture already exists
        if (!scene.textures.exists(textureKey)) {
            scene.textures.addCanvas(textureKey, canvas);
        }

        // Create image from texture
        const image = scene.add.image(0, 0, textureKey);
        image.setOrigin(0.5, 0.5);
        
        return image;
    }

    // ============================================================================
    // Phaser Graphics Texture Generation (Recommended - Standardized API)
    // ============================================================================

    /**
     * Convert multi-stop gradient to 4-color corner gradient for Phaser Graphics
     * Phaser Graphics only supports 4-color corner gradients, so we approximate
     * multi-stop gradients by sampling colors at position 0 (start) and position 1 (end)
     * @private
     * @param {Array<Object>} gradientStops - Array of {position: number, color: string}
     * @param {string} [tintColor] - Optional tint color to apply
     * @param {boolean} [isVertical=true] - Whether gradient is vertical (true) or horizontal (false)
     * @returns {Array<number>} - [topLeft, topRight, bottomLeft, bottomRight] color numbers
     */
    static _convertGradientStopsToCornerColors(gradientStops, tintColor, isVertical = true) {
        if (!gradientStops || gradientStops.length === 0) {
            return [0x000000, 0x000000, 0x000000, 0x000000];
        }

        // Sort stops by position
        const sortedStops = [...gradientStops].sort((a, b) => a.position - b.position);
        
        // Get color at position 0 (start) and position 1 (end)
        // Find closest stop or interpolate
        const getColorAtPosition = (position) => {
            // Find stops that bracket this position
            for (let i = 0; i < sortedStops.length - 1; i++) {
                if (position >= sortedStops[i].position && position <= sortedStops[i + 1].position) {
                    // Interpolate between the two stops
                    const t = (position - sortedStops[i].position) / (sortedStops[i + 1].position - sortedStops[i].position);
                    const color1 = sortedStops[i].color;
                    const color2 = sortedStops[i + 1].color;
                    
                    // Convert to RGB for interpolation
                    const hex1 = color1.replace('#', '');
                    const hex2 = color2.replace('#', '');
                    const r1 = parseInt(hex1.substr(0, 2), 16);
                    const g1 = parseInt(hex1.substr(2, 2), 16);
                    const b1 = parseInt(hex1.substr(4, 2), 16);
                    const r2 = parseInt(hex2.substr(0, 2), 16);
                    const g2 = parseInt(hex2.substr(2, 2), 16);
                    const b2 = parseInt(hex2.substr(4, 2), 16);
                    
                    // Interpolate
                    const r = Math.round(r1 + (r2 - r1) * t);
                    const g = Math.round(g1 + (g2 - g1) * t);
                    const b = Math.round(b1 + (b2 - b1) * t);
                    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                }
            }
            // Fallback to first or last stop
            if (position <= sortedStops[0].position) {
                return sortedStops[0].color;
            }
            return sortedStops[sortedStops.length - 1].color;
        };

        const startColor = getColorAtPosition(0);
        const endColor = getColorAtPosition(1);

        // Apply tint if provided
        const startColorTinted = tintColor ? ColorUtils.tintColor(startColor, tintColor) : startColor;
        const endColorTinted = tintColor ? ColorUtils.tintColor(endColor, tintColor) : endColor;

        // Convert to numbers
        const startColorNum = this._normalizeColor(startColorTinted);
        const endColorNum = this._normalizeColor(endColorTinted);

        if (isVertical) {
            // Vertical gradient: top = same on both sides, bottom = same on both sides
            return [startColorNum, startColorNum, endColorNum, endColorNum];
        } else {
            // Horizontal gradient: left = same top/bottom, right = same top/bottom
            return [startColorNum, endColorNum, startColorNum, endColorNum];
        }
    }

    /**
     * Generate a rounded rectangle texture using Phaser Graphics API
     * This is the recommended method - uses Phaser's native Graphics API with generateTexture()
     * @param {Phaser.Scene} scene - Phaser scene instance
     * @param {number} width - Texture width
     * @param {number} height - Texture height
     * @param {number} cornerRadius - Corner radius (0-1 = relative to height, >1 = absolute)
     * @param {string|number} [fillColor] - Fill color (hex string or number)
     * @param {Array<Object>} [gradientStops] - Gradient color stops [{position: number, color: string}] (converted to 4-color corner gradient)
     * @param {string} [textureKey] - Optional texture key (auto-generated if not provided)
     * @param {string} [tintColor] - Optional tint color to apply to gradient stops
     * @returns {Phaser.GameObjects.Sprite} - Sprite with the texture, or null on error
     */
    static generateRoundedRectTexture(scene, width, height, cornerRadius, fillColor, gradientStops, textureKey, tintColor) {
        if (!scene) {
            error('GraphicsUtils.generateRoundedRectTexture: scene is required', 'ui');
            return null;
        }

        // Generate texture key if not provided
        if (!textureKey) {
            const actualRadius = this._calculateCornerRadius(cornerRadius, height);
            const roundedRadius = Math.round(actualRadius * 100) / 100;
            const colorStr = tintColor 
                ? (typeof tintColor === 'string' ? tintColor.replace('#', '') : tintColor.toString(16))
                : (fillColor ? (typeof fillColor === 'string' ? fillColor.replace('#', '') : fillColor.toString(16)) : '000000');
            textureKey = `rounded_rect_${Math.round(width)}_${Math.round(height)}_${colorStr}_${roundedRadius}`;
        }

        // Check if texture already exists
        if (scene.textures.exists(textureKey)) {
            const sprite = scene.add.sprite(0, 0, textureKey);
            sprite.setOrigin(0.5, 0.5);
            sprite.setTint(0xffffff);
            return sprite;
        }

        // Create temporary graphics object (not added to scene initially)
        const graphics = scene.make.graphics({ add: false });
        graphics.clear(); // Clear any existing drawing commands
        
        const actualRadius = this._calculateCornerRadius(cornerRadius, height);

        // Set styles BEFORE drawing
        if (gradientStops && Array.isArray(gradientStops) && gradientStops.length > 0) {
            // Convert multi-stop gradient to 4-color corner gradient
            const cornerColors = this._convertGradientStopsToCornerColors(gradientStops, tintColor, true);
            // cornerColors should already be numbers from _normalizeColor
            const topLeft = cornerColors[0];
            const topRight = cornerColors[1];
            const bottomLeft = cornerColors[2];
            const bottomRight = cornerColors[3];
            
            // Debug: verify colors are valid numbers
            if (typeof topLeft !== 'number' || isNaN(topLeft) || topLeft === 0) {
                error(`GraphicsUtils.generateRoundedRectTexture: Invalid gradient colors - topLeft: ${topLeft}, topRight: ${topRight}, bottomLeft: ${bottomLeft}, bottomRight: ${bottomRight}`, 'ui');
            }
            
            // Set gradient style - Phaser expects numeric color values
            graphics.fillGradientStyle(topLeft, topRight, bottomLeft, bottomRight, 1.0);
        } else if (fillColor !== undefined && fillColor !== null) {
            const normalizedColor = this._normalizeColor(fillColor);
            graphics.fillStyle(normalizedColor, 1.0);
        } else {
            graphics.fillStyle(0x000000, 1.0);
        }

        // Draw at (0, 0) to ensure it fits the texture bounds
        graphics.fillRoundedRect(0, 0, width, height, actualRadius);

        // Add to scene temporarily (required for generateTexture in some Phaser versions)
        scene.add.existing(graphics);
        graphics.setPosition(-10000, -10000); // Position off-screen
        graphics.setVisible(true);
        graphics.setDepth(-1000);

        // Generate texture from graphics
        graphics.generateTexture(textureKey, width, height);

        // Clean up temporary graphics object
        graphics.destroy();

        // Create sprite from texture
        const sprite = scene.add.sprite(0, 0, textureKey);
        sprite.setOrigin(0.5, 0.5);
        sprite.setTint(0xffffff); // Clear tint - gradient has color baked in
        
        return sprite;
    }

    /**
     * Generate a circle texture using Phaser Graphics API
     * This is the recommended method - uses Phaser's native Graphics API with generateTexture()
     * @param {Phaser.Scene} scene - Phaser scene instance
     * @param {number} width - Texture width
     * @param {number} height - Texture height
     * @param {number} radius - Circle radius
     * @param {string|number} [fillColor] - Fill color (hex string or number)
     * @param {Array<Object>} [gradientStops] - Gradient color stops [{position: number, color: string}] (converted to 4-color corner gradient)
     * @param {string} [textureKey] - Optional texture key (auto-generated if not provided)
     * @param {number} [centerX] - Center X position (defaults to width/2)
     * @param {number} [centerY] - Center Y position (defaults to height/2)
     * @returns {Phaser.GameObjects.Image} - Image with the texture, or null on error
     */
    static generateCircleTexture(scene, width, height, radius, fillColor, gradientStops, textureKey, centerX, centerY) {
        if (!scene) {
            error('GraphicsUtils.generateCircleTexture: scene is required', 'ui');
            return null;
        }

        const cx = centerX !== undefined ? centerX : width / 2;
        const cy = centerY !== undefined ? centerY : height / 2;

        // Generate texture key if not provided
        if (!textureKey) {
            const colorStr = fillColor 
                ? (typeof fillColor === 'string' ? fillColor.replace('#', '') : fillColor.toString(16)) 
                : '000000';
            textureKey = `circle_${Math.round(width)}_${Math.round(height)}_${colorStr}_${Math.round(radius)}`;
        }

        // Check if texture already exists
        if (scene.textures.exists(textureKey)) {
            const image = scene.add.image(0, 0, textureKey);
            image.setOrigin(0.5, 0.5);
            return image;
        }

        // Use Canvas API for proper radial gradients (Phaser Graphics doesn't support true radial gradients)
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Draw circle
        if (gradientStops && Array.isArray(gradientStops) && gradientStops.length > 0) {
            // Create radial gradient using Canvas API (proper radial gradient support)
            const sortedStops = [...gradientStops].sort((a, b) => a.position - b.position);
            
            // Create radial gradient: center at (cx, cy) with radius
            const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            
            // Add color stops from the sorted gradient stops
            for (const stop of sortedStops) {
                gradient.addColorStop(stop.position, stop.color);
            }
            
            ctx.fillStyle = gradient;
        } else if (fillColor !== undefined && fillColor !== null) {
            const normalizedColor = this._normalizeColor(fillColor);
            ctx.fillStyle = typeof normalizedColor === 'string' ? normalizedColor : `#${normalizedColor.toString(16).padStart(6, '0')}`;
        } else {
            ctx.fillStyle = '#000000';
        }

        // Draw full circle
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2, false);
        ctx.closePath();
        ctx.fill();

        // Add canvas texture to Phaser
        scene.textures.addCanvas(textureKey, canvas);

        // Create image from texture
        const image = scene.add.image(0, 0, textureKey);
        image.setOrigin(0.5, 0.5);
        
        return image;
    }

    /**
     * Generate a half-circle texture using Phaser Graphics API
     * This is the recommended method - uses Phaser's native Graphics API with generateTexture()
     * @param {Phaser.Scene} scene - Phaser scene instance
     * @param {number} width - Texture width
     * @param {number} height - Texture height
     * @param {number} radius - Circle radius
     * @param {number} startAngle - Start angle in radians
     * @param {number} endAngle - End angle in radians
     * @param {string|number} [fillColor] - Fill color (hex string or number)
     * @param {Array<Object>} [gradientStops] - Gradient color stops [{position: number, color: string}] (converted to 4-color corner gradient)
     * @param {string} [textureKey] - Optional texture key (auto-generated if not provided)
     * @param {number} [centerX] - Center X position (defaults to width/2)
     * @param {number} [centerY] - Center Y position (defaults to height/2)
     * @returns {Phaser.GameObjects.Image} - Image with the texture, or null on error
     */
    static generateHalfCircleTexture(scene, width, height, radius, startAngle, endAngle, fillColor, gradientStops, textureKey, centerX, centerY) {
        if (!scene) {
            error('GraphicsUtils.generateHalfCircleTexture: scene is required', 'ui');
            return null;
        }

        const cx = centerX !== undefined ? centerX : width / 2;
        const cy = centerY !== undefined ? centerY : height / 2;

        // Generate texture key if not provided
        if (!textureKey) {
            const colorStr = fillColor 
                ? (typeof fillColor === 'string' ? fillColor.replace('#', '') : fillColor.toString(16)) 
                : '000000';
            const angleStr = `${Math.round(startAngle * 100)}_${Math.round(endAngle * 100)}`;
            textureKey = `half_circle_${Math.round(width)}_${Math.round(height)}_${colorStr}_${Math.round(radius)}_${angleStr}`;
        }

        // Check if texture already exists
        if (scene.textures.exists(textureKey)) {
            const image = scene.add.image(0, 0, textureKey);
            image.setOrigin(0.5, 0.5);
            return image;
        }

        // Use Canvas API for proper radial gradients (Phaser Graphics doesn't support true radial gradients)
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Draw half-circle
        if (gradientStops && Array.isArray(gradientStops) && gradientStops.length > 0) {
            // Create radial gradient using Canvas API (proper radial gradient support)
            const sortedStops = [...gradientStops].sort((a, b) => a.position - b.position);
            
            // Create radial gradient: center at (cx, cy) with radius
            const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            
            // Add color stops from the sorted gradient stops
            for (const stop of sortedStops) {
                gradient.addColorStop(stop.position, stop.color);
            }
            
            ctx.fillStyle = gradient;
        } else if (fillColor !== undefined && fillColor !== null) {
            const normalizedColor = this._normalizeColor(fillColor);
            ctx.fillStyle = typeof normalizedColor === 'string' ? normalizedColor : `#${normalizedColor.toString(16).padStart(6, '0')}`;
        } else {
            ctx.fillStyle = '#000000';
        }

        // Draw only the half-circle (from startAngle to endAngle)
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle, false); // From startAngle to endAngle
        ctx.lineTo(cx, cy); // Line to center
        ctx.closePath();
        ctx.fill();

        // Add canvas texture to Phaser
        scene.textures.addCanvas(textureKey, canvas);

        // Create image from texture
        const image = scene.add.image(0, 0, textureKey);
        image.setOrigin(0.5, 0.5);
        
        return image;
    }
}

