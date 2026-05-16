/**
 * Layout Selector
 * Handles selection of appropriate layout based on device conditions
 * Uses priority-based selection from the layout registry
 */
import { log, debug, error } from '../../../utils/logger/LoggerUtils.js';

/** @typedef {import('./LayoutTypes.js').LayoutPositions} LayoutPositions */
/** @typedef {import('./LayoutTypes.js').LayoutDefinition} LayoutDefinition */

// Track last selected layout to avoid logging duplicates
let lastSelectedLayout = null;
let lastSelectionKey = null;

/**
 * Select the appropriate layout from the registry based on device conditions
 * @param {LayoutManager} responsiveUI - The LayoutManager instance
 * @param {Array<LayoutDefinition>} registry - Array of layout definitions sorted by priority
 * @returns {LayoutPositions} Layout positions object
 */
export function selectLayout(responsiveUI, registry) {
    // Create a key to identify this selection context (screen size + orientation)
    const selectionKey = `${responsiveUI.screenWidth}x${responsiveUI.screenHeight}_${responsiveUI.getOrientation()}_${responsiveUI.isMobile ? 'mobile' : 'desktop'}`;
    
    // Find first matching layout by priority
    for (const layout of registry) {
        try {
            if (layout.condition(responsiveUI)) {
                // Log layout selection only if it changed
                if (lastSelectedLayout !== layout.name || lastSelectionKey !== selectionKey) {
                    const orientation = responsiveUI.getOrientation();
                    const enabledLayouts = responsiveUI._getEnabledLayoutsForDevice ? responsiveUI._getEnabledLayoutsForDevice() : [];
                    log(`[LAYOUT] Selected: ${layout.name} (orientation=${orientation}, isMobile=${responsiveUI.isMobile}, enabledLayouts=[${enabledLayouts.join(', ')}])`, 'layout');
                    lastSelectedLayout = layout.name;
                    lastSelectionKey = selectionKey;
                }
                try {
                    return layout.calculator(responsiveUI);
                } catch (calcError) {
                    error(`❌ Error calculating ${layout.name} layout:`, calcError);
                    throw calcError; // Re-throw to prevent fallback to Portrait
                }
            }
        } catch (conditionError) {
            log(`⚠️ Error evaluating layout condition for ${layout.name}:`, conditionError);
            // Continue to next layout
        }
    }
    
    // Fallback: return last layout (should be portrait/default)
    // This should only happen if no layout conditions match, which indicates a configuration error
    const fallbackLayout = registry[registry.length - 1];
    if (fallbackLayout) {
        error(`📐 [LAYOUT] No matching layout found, using fallback: ${fallbackLayout.name}. This should not happen - check layout conditions and enabled layouts.`);
        return fallbackLayout.calculator(responsiveUI);
    }
    
    // Last resort: return empty positions (should never happen)
    log('⚠️ No layout found in registry, returning empty positions');
    return {
        cardContainerX: 0,
        cardContainerY: 0,
        cardContainerWidth: 0,
        cardContainerHeight: 0,
        containerPositions: {},
        controlBarBackgroundTop: 0
    };
}

