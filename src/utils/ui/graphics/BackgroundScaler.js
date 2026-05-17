/**
 * Background Scaling Utilities
 * Functions for calculating cover scale to ensure background images always fill viewport
 */

/**
 * Calculate the scale needed to cover the entire viewport while maintaining aspect ratio
 * Uses "cover" mode: image will fill viewport, may clip on one axis
 * 
 * @param {number} imageWidth - Original width of the image
 * @param {number} imageHeight - Original height of the image
 * @param {number} viewportWidth - Width of the viewport to cover
 * @param {number} viewportHeight - Height of the viewport to cover
 * @returns {number} Scale factor to apply (use same value for both scaleX and scaleY)
 */
export function calculateCoverScale(imageWidth, imageHeight, viewportWidth, viewportHeight) {
    if (!imageWidth || !imageHeight || !viewportWidth || !viewportHeight) {
        return 1; // Default scale if dimensions are invalid
    }

    // Calculate scale needed to fill width
    const scaleX = viewportWidth / imageWidth;
    
    // Calculate scale needed to fill height
    const scaleY = viewportHeight / imageHeight;
    
    // Return the larger scale to ensure the image always covers the viewport
    // This means one dimension will fill exactly, the other will extend beyond (and clip)
    return Math.max(scaleX, scaleY);
}

/**
 * Prefer source image pixels; fallback to texture frame/source metadata.
 * Used for full-viewport backdrop cover scaling (scratch-style BackgroundScalingService).
 *
 * @param {Phaser.GameObjects.Image} sprite
 * @returns {{ width: number, height: number }}
 */
export function getSpriteNaturalTextureSize(sprite) {
    if (!sprite?.texture) {
        return { width: 0, height: 0 };
    }
    const tex = sprite.texture;

    /** @returns {{ width: number, height: number } | null} */
    const finite = (w, h) => {
        const ww = Number(w);
        const hh = Number(h);
        if (!Number.isFinite(ww) || !Number.isFinite(hh) || ww <= 0 || hh <= 0) return null;
        return { width: ww, height: hh };
    };

    try {
        const sourceImage = typeof tex.getSourceImage === 'function' ? tex.getSourceImage() : null;
        if (sourceImage) {
            const w = sourceImage.width || sourceImage.naturalWidth;
            const h = sourceImage.height || sourceImage.naturalHeight;
            const pair = finite(w, h);
            if (pair) return pair;
        }
        if (tex.source?.[0]) {
            const pair = finite(tex.source[0].width, tex.source[0].height);
            if (pair) return pair;
        }
    } catch (_e) {
        /* fall through */
    }

    try {
        if (tex.source?.[0]) {
            const pair = finite(tex.source[0].width, tex.source[0].height);
            if (pair) return pair;
        }
        const fw = tex.frame?.width;
        const fh = tex.frame?.height;
        const pair = finite(fw, fh);
        if (pair) return pair;
    } catch (_e2) {
        /* noop */
    }

    return { width: 0, height: 0 };
}

