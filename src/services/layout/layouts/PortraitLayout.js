/**
 * Portrait Layout for Portrait Orientation
 * Uses direct percentage-based positioning for all elements
 * Optimized for desktop devices in portrait orientation
 */
import { log, debug, warn, error } from '../../../utils/logger/LoggerUtils.js';
import { calculateContainerDimensions, calculateContainerPositions, calculateControlBarBackgroundTop, calculateHeaderPositions } from '../../../utils/layout/ControlBarLayoutUtils.js';
import { getLayoutConfigs, getControlBarSpacingPercent, getContentHeightPercent, getCardContainerConfig, getHeaderConfig } from '../../../utils/layout/ConfigAccessUtils.js';
import { getScreenWidth, getScreenHeight } from '../../../utils/viewport/ViewportUtils.js';

/** @typedef {import('../core/LayoutTypes.js').LayoutPositions} LayoutPositions */

/**
 * Calculate portrait layout positions for portrait orientation
 * 
 * @param {LayoutManager} responsiveUI - The LayoutManager instance
 * @returns {LayoutPositions} Layout positions object
 */
export function calculatePortraitLayout(responsiveUI) {
    const width = responsiveUI.screenWidth;
    const height = responsiveUI.screenHeight;
    const scene = responsiveUI.scene;
    
    // Get portrait configuration
    const { uiConfig, baseUIConfig } = getLayoutConfigs(responsiveUI, 'portrait');
    
    // Calculate available dimensions (padding removed)
    const verticalPaddingTop = 0.0;
    const verticalPaddingBottom = 0.0;
    const horizontalPaddingLeft = 0.0;
    const horizontalPaddingRight = 0.0;
    
    const availableWidth = width - (horizontalPaddingLeft + horizontalPaddingRight);
    const availableHeight = height - (verticalPaddingTop + verticalPaddingBottom);
    const centerX = width / 2;
    
    // ControlBar Positioning
    const contentHeightPercent = getContentHeightPercent(uiConfig, baseUIConfig, 0.08);
    const spacingPercent = getControlBarSpacingPercent(uiConfig, baseUIConfig);
    
    const containers = uiConfig?.controlBar?.layoutGroups || baseUIConfig?.controlBar?.layoutGroups;
    if (!containers || !Array.isArray(containers) || containers.length === 0) {
        error(`PortraitLayout: controlBar.layoutGroups is required in layout JSON config but was not found.`);
        return {
            cardContainerX: 0,
            cardContainerY: 0,
            cardContainerWidth: 0,
            cardContainerHeight: 0,
            containerPositions: {},
            controlBarBackgroundTop: 0
        };
    }
    
    const dimensions = calculateContainerDimensions({
        contentHeightPercent,
        availableHeight,
        height
    });
    
    const containerHeight = dimensions.containerHeight;
    const baseContainerHeight = dimensions.baseContainerHeight;
    const containerWidths = {};
    
    const positionResult = calculateContainerPositions({
        containers,
        containerHeight,
        width,
        height,
        horizontalPaddingLeft,
        verticalPaddingBottom,
        availableWidth,
        centerX,
        containerWidths,
        spacingPercent,
        baseContainerHeight,
        uiConfig,
        baseUIConfig
    });
    
    const { containerPositions, topmostContainerTop } = positionResult;
    
    const controlBarBackgroundTop = calculateControlBarBackgroundTop(
        topmostContainerTop,
        uiConfig,
        baseUIConfig,
        height
    );
    
    // Calculate header positions (if header config exists)
    let headerPositions = null;
    const headerConfig = getHeaderConfig(uiConfig, baseUIConfig);
    if (headerConfig) {
        const headerResult = calculateHeaderPositions({
            items: headerConfig.items,
            controlBarBackgroundTop,
            width,
            height,
            verticalOffset: headerConfig.verticalOffset,
            centerX,
            uiConfig,
            baseUIConfig
        });
        headerPositions = headerResult.headerPositions;
    }
    
    // Card Container Positioning and Sizing
    const cardContainerConfig = getCardContainerConfig(uiConfig, baseUIConfig);
    
    // Calculate card container dimensions
    // areaPercent applies the same percentage to both height and width
    const spaceBetweenScreenTopAndControlBar = controlBarBackgroundTop - 0;
    const areaPercent = cardContainerConfig.areaPercent ?? cardContainerConfig.heightPercent ?? 0.65;
    const cardContainerHeight = spaceBetweenScreenTopAndControlBar * areaPercent;
    const cardContainerWidth = width * areaPercent;
    
    // Calculate card container position: center between top of screen and top of controlBar
    const cardContainerX = centerX;
    
    // Validate controlBarBackgroundTop before using it
    // If it's invalid (negative, NaN, or way off screen), use a fallback calculation
    let baseCardContainerY;
    if (controlBarBackgroundTop !== undefined && controlBarBackgroundTop !== null && 
        !isNaN(controlBarBackgroundTop) && controlBarBackgroundTop > 0 && controlBarBackgroundTop < height) {
        // Valid controlBarBackgroundTop: center between screen top and controlBar top
        baseCardContainerY = (0 + controlBarBackgroundTop) / 2;
    } else {
        // Fallback: use controlBarTop (calculated from containerHeight)
        // Ensure containerHeight is reasonable (not larger than screen)
        const safeContainerHeight = Math.min(containerHeight, height * 0.5); // Cap at 50% of screen height
        const fallbackControlBarTop = Math.max(0, height - verticalPaddingBottom - safeContainerHeight);
        baseCardContainerY = (0 + fallbackControlBarTop) / 2;
        warn(`[PortraitLayout] Invalid controlBarBackgroundTop (${controlBarBackgroundTop}), using fallback: ${fallbackControlBarTop}`, 'layout');
    }
    
    // Apply offsetYPercent if provided (positive = down, negative = up)
    const offsetYPercent = cardContainerConfig.offsetYPercent ?? 0.0;
    const offsetY = height * offsetYPercent;
    let cardContainerY = baseCardContainerY + offsetY;
    
    // Final safety check: ensure cardContainerY is within reasonable bounds
    if (cardContainerY < 0 || cardContainerY > height || isNaN(cardContainerY)) {
        // Emergency fallback: center of upper half of screen
        cardContainerY = height * 0.25;
        warn(`[PortraitLayout] cardContainerY out of bounds, using emergency fallback: ${cardContainerY}`, 'layout');
    }
    
    // Calculate control bar top position (for reference, but cardContainer position is independent)
    const controlBarTop = height - verticalPaddingBottom - containerHeight;
    
    return {
        cardContainerX,
        cardContainerY,
        cardContainerWidth,
        cardContainerHeight,
        cardContainerConfig,
        controlBarTop,
        containerPositions,
        controlBarBackgroundTop,
        headerPositions
    };
}

