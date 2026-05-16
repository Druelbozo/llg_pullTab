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

