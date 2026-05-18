/**
 * Card Container Utilities
 * Functions for calculating card container sizing and scale
 */

import { getScreenWidth, getScreenHeight } from '../viewport/ViewportUtils.js';
import { warn, debug } from '../logger/LoggerUtils.js';

/** Frames smaller than this are often placeholders before the first decoded upload on slow/network first paint */
const MIN_TRUSTED_TEXTURE_DIM = 32;

/**
 * Prefer intrinsic image/canvas pixels when Phaser reports a tiny frame size (live mobile first load).
 * @param {Phaser.Textures.Texture} texture
 * @returns {{width: number, height: number}|null}
 */
function trySourceIntrinsicSize(texture) {
    if (!texture || typeof texture.getSourceImage !== 'function') {
        return null;
    }
    const src = texture.getSourceImage();
    if (!src) {
        return null;
    }
    if (typeof HTMLImageElement !== 'undefined' && src instanceof HTMLImageElement) {
        if (!src.complete) {
            return null;
        }
        const w = src.naturalWidth;
        const h = src.naturalHeight;
        if (w >= MIN_TRUSTED_TEXTURE_DIM && h >= MIN_TRUSTED_TEXTURE_DIM) {
            return { width: w, height: h };
        }
    }
    if (typeof HTMLCanvasElement !== 'undefined' && src instanceof HTMLCanvasElement) {
        if (src.width >= MIN_TRUSTED_TEXTURE_DIM && src.height >= MIN_TRUSTED_TEXTURE_DIM) {
            return { width: src.width, height: src.height };
        }
    }
    return null;
}

/**
 * Calculate the original dimensions of an image
 * @param {Phaser.GameObjects.Image} image - The image object
 * @param {number} aspectRatio - Optional cached aspect ratio
 * @returns {{width: number, height: number}} Original dimensions
 */
export function getImageOriginalDimensions(image, aspectRatio = 0) {
    if (!image) {
        return { width: 0, height: 0 };
    }

    let originalWidth = 0;
    let originalHeight = 0;

    // Method 1: Try texture frame dimensions (most reliable once GPU is ready)
    if (image.texture && image.texture.frame) {
        originalWidth = image.texture.frame.width;
        originalHeight = image.texture.frame.height;
    }

    // Method 2: Fallback to image width/height properties
    if (originalWidth === 0 || originalHeight === 0) {
        originalWidth = image.width || 0;
        originalHeight = image.height || 0;
    }

    // Method 3: Use displayWidth/displayHeight if scale is 1
    if (originalWidth === 0 || originalHeight === 0) {
        const scaleX = image.scaleX || 1;
        const scaleY = image.scaleY || 1;
        if (scaleX === 1 && scaleY === 1) {
            originalWidth = image.displayWidth || 0;
            originalHeight = image.displayHeight || 0;
        }
    }

    // Method 4: Tiny or missing frame — use underlying HTMLImageElement / canvas dimensions (fixes giant cards on cold load)
    const tex = image.texture;
    const texKey = tex?.key ?? '';
    if (texKey !== '_MISSING' && texKey !== '__MISSING') {
        if (
            originalWidth === 0 ||
            originalHeight === 0 ||
            originalWidth < MIN_TRUSTED_TEXTURE_DIM ||
            originalHeight < MIN_TRUSTED_TEXTURE_DIM
        ) {
            const intrinsic = trySourceIntrinsicSize(tex);
            if (intrinsic) {
                originalWidth = intrinsic.width;
                originalHeight = intrinsic.height;
            }
        }
    }

    // Fallback: Use aspect ratio if we have it
    if (originalHeight === 0 && aspectRatio > 0) {
        // Can't determine height without width, so return 0
        return { width: 0, height: 0 };
    }
    if (originalWidth === 0 && originalHeight > 0 && aspectRatio > 0) {
        originalWidth = originalHeight * aspectRatio;
    }

    return { width: originalWidth, height: originalHeight };
}

/**
 * Uniform scale for a card (e.g. pull-tab peel `cardBack`) inside a cardArea rectangle.
 * The cardArea spans full viewport width and from y=0 down to control-bar top (height = cardAreaHeight).
 *
 * areaPercent applies along the **narrow** dimension of the cardArea (tie: width if Aw === Ah):
 * - If Aw <= Ah: primary target width = Aw * areaPercent
 * - Else: primary target height = Ah * areaPercent
 *
 * Then shrink-only containment so the scaled card fits inside Aw × Ah.
 *
 * @param {Object} options
 * @param {number} options.cardAreaWidth - Aw (px)
 * @param {number} options.cardAreaHeight - Ah (px)
 * @param {number} options.areaPercent - fraction in (0, 1]
 * @param {number} options.baseCardWidth - card local display width at peel/collection scale 1 for the axis basis
 * @param {number} options.baseCardHeight - card local display height at scale 1
 * @returns {number} Uniform scale factor (>= 0)
 */
export function computeAreaPercentUniformScale({
    cardAreaWidth,
    cardAreaHeight,
    areaPercent,
    baseCardWidth,
    baseCardHeight,
}) {
    const epsilon = 1e-6;
    let ap = Number(areaPercent);
    if (!Number.isFinite(ap)) {
        ap = 0.65;
    }
    ap = Math.min(1, Math.max(epsilon, ap));

    const Aw = Number(cardAreaWidth);
    const Ah = Number(cardAreaHeight);
    const bw = Number(baseCardWidth);
    const bh = Number(baseCardHeight);

    if (!Number.isFinite(Aw) || !Number.isFinite(Ah) || Aw <= epsilon || Ah <= epsilon) {
        return 1;
    }
    if (!Number.isFinite(bw) || !Number.isFinite(bh) || bw <= epsilon || bh <= epsilon) {
        return 1;
    }

    const s0 = Aw <= Ah ? (Aw * ap) / bw : (Ah * ap) / bh;
    if (!Number.isFinite(s0) || s0 <= 0) {
        return 1;
    }

    const wDisp = bw * s0;
    const hDisp = bh * s0;
    const k = Math.min(1, Aw / wDisp, Ah / hDisp);
    const s = s0 * k;
    return Number.isFinite(s) && s > 0 ? s : 1;
}

/**
 * Calculate card container scale based on desired height and max width constraints
 * @param {Object} options - Calculation options
 * @param {Phaser.GameObjects.Image} options.shockWave - The shockWave image object
 * @param {number} options.desiredHeight - Desired height in pixels
 * @param {number} options.maxWidth - Maximum allowed width in pixels
 * @param {number} options.aspectRatio - Optional cached aspect ratio
 * @returns {number} Scale factor to apply to card container
 */
export function calculateCardContainerScale({ shockWave, desiredHeight, maxWidth, aspectRatio = 0 }) {
    if (!shockWave) {
        warn('[CardContainerUtils] shockWave is required for scale calculation');
        return 1;
    }

    // Get original dimensions
    const { width: originalWidth, height: originalHeight } = getImageOriginalDimensions(shockWave, aspectRatio);

    // Fallback if we can't determine original dimensions
    if (originalHeight === 0) {
        warn('[CardContainerUtils] Could not determine original height, using desired height');
        return 1; // Return 1 to maintain current scale
    }
    if (originalWidth === 0 && aspectRatio > 0) {
        // Use aspect ratio to calculate width
        const calculatedWidth = originalHeight * aspectRatio;
        return calculateCardContainerScale({
            shockWave,
            desiredHeight,
            maxWidth,
            aspectRatio
        });
    }
    if (originalWidth === 0) {
        warn('[CardContainerUtils] Could not determine original width, using desired height as fallback');
        return desiredHeight / originalHeight;
    }

    // Calculate scale factor based on desired height
    const scaleYForHeight = desiredHeight / originalHeight;

    // Calculate what the width would be at that scale
    const calculatedWidth = originalWidth * scaleYForHeight;

    // If calculated width exceeds max allowed width, scale down proportionally
    let finalScale = scaleYForHeight;
    if (calculatedWidth > maxWidth && originalWidth > 0) {
        // Calculate scale based on max width instead
        const scaleXForWidth = maxWidth / originalWidth;
        // Use the smaller scale to ensure both constraints are met
        finalScale = Math.min(scaleYForHeight, scaleXForWidth);
    }

    // Defence-in-depth when frame size was bogus on first upload (cold load)
    const MAX_FINAL_SCALE = 24;
    if (!Number.isFinite(finalScale)) {
        return 1;
    }
    if (finalScale > MAX_FINAL_SCALE) {
        warn(
            `[CardContainerUtils] clamping excessive card scale (${finalScale.toFixed(2)} -> ${MAX_FINAL_SCALE}); check shockWave texture metrics`,
            'layout'
        );
        finalScale = MAX_FINAL_SCALE;
    }

    return finalScale;
}

/**
 * Calculate desired card container height based on configuration
 * heightPercent is relative to the distance between top of screen and top of controlBar
 * @param {Object} options - Calculation options
 * @param {number} options.availableHeight - Available height (top of screen to top of control bar)
 * @param {number} options.heightPercent - Height as percentage of available space (default: 0.65)
 * @returns {number} Desired height in pixels
 */
export function calculateDesiredCardHeight({
    availableHeight,
    heightPercent = 0.65
}) {
    // heightPercent is relative to the space between top of screen and top of controlBar
    return availableHeight * heightPercent;
}

/**
 * Calculate card container scale and dimensions for a layout
 * @param {Object} options - Calculation options
 * @param {Phaser.Scene} options.scene - The Phaser scene
 * @param {Phaser.GameObjects.Image} options.shockWave - The shockWave image object
 * @param {number} options.controlBarTop - Y position of the top of the control bar
 * @param {Object} options.config - Card container configuration from layout JSON
 * @param {number} options.aspectRatio - Optional cached aspect ratio
 * @returns {{scale: number, width: number, height: number}} Scale and dimensions
 */
export function calculateCardContainerSize({
    scene,
    shockWave,
    controlBarTop,
    config = {},
    aspectRatio = 0
}) {
    const viewportWidth = getScreenWidth(scene);
    const viewportHeight = getScreenHeight(scene);
    
    // Get configuration values with defaults
    // Use areaPercent if provided (applies same percentage to both width and height)
    // Fall back to individual heightPercent/maxWidthPercent for backward compatibility
    const areaPercent = config.areaPercent ?? config.heightPercent ?? 0.65;
    const heightPercent = areaPercent; // Use areaPercent for height
    const maxWidthPercent = areaPercent; // Use areaPercent for width
    
    // Calculate available height (top of screen to top of control bar)
    // Safety check: if controlBarTop is 0 or invalid, use viewportHeight as fallback
    let availableHeight = controlBarTop - 0; // Distance from top of screen (0) to top of control bar
    if (availableHeight <= 0 || !isFinite(availableHeight)) {
        warn('controlBarTop is invalid, using viewportHeight as fallback', 'layout', {
            controlBarTop,
            availableHeight,
            viewportHeight
        });
        availableHeight = viewportHeight;
    }
    
    debug('calculateCardContainerSize:', 'layout', {
        controlBarTop,
        availableHeight,
        areaPercent,
        heightPercent,
        maxWidthPercent,
        viewportWidth,
        viewportHeight,
        note: 'areaPercent applies the same percentage to both width and height'
    });
    
    // Calculate desired height (areaPercent/heightPercent is relative to available space)
    const desiredHeight = calculateDesiredCardHeight({
        availableHeight,
        heightPercent
    });
    
    debug('desiredHeight calculation:', 'layout', {
        desiredHeight,
        calculation: `availableHeight * areaPercent = ${availableHeight} * ${areaPercent} = ${desiredHeight}`
    });
    
    // Calculate max allowed width (areaPercent/maxWidthPercent is relative to viewport width)
    const maxAllowedWidth = viewportWidth * maxWidthPercent;
    
    // Calculate scale
    const scale = calculateCardContainerScale({
        shockWave,
        desiredHeight,
        maxWidth: maxAllowedWidth,
        aspectRatio
    });
    
    // Get original dimensions to calculate final dimensions
    const { width: originalWidth, height: originalHeight } = getImageOriginalDimensions(shockWave, aspectRatio);
    
    // Calculate final dimensions
    const width = originalWidth > 0 ? originalWidth * scale : 0;
    const height = originalHeight > 0 ? originalHeight * scale : 0;
    
    debug('final result:', 'layout', {
        scale,
        width,
        height,
        originalWidth,
        originalHeight,
        maxAllowedWidth
    });
    
    return {
        scale,
        width,
        height
    };
}

