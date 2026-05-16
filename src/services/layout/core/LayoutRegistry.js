/**
 * Layout Registry
 * Central registry of all available layouts
 * Add new layouts here to extend the system without modifying the router
 */
import { calculateLandscapeLayout } from '../layouts/LandscapeLayout.js';
import { calculatePortraitLayout } from '../layouts/PortraitLayout.js';
import { calculateLandscapeMobileLayout } from '../layouts/LandscapeMobileLayout.js';
import { calculatePortraitMobileLayout } from '../layouts/PortraitMobileLayout.js';

/** @typedef {import('./LayoutTypes.js').LayoutDefinition} LayoutDefinition */

/**
 * Layout Registry
 * Array of layout definitions sorted by priority (lower number = higher priority)
 * 
 * Each layout definition includes:
 * - name: Unique identifier
 * - description: Human-readable description
 * - condition: Function that determines if layout should be used
 * - calculator: Function that calculates layout positions
 * - priority: Selection priority (1 = highest, checked first)
 * 
 * @type {Array<LayoutDefinition>}
 */
export const layoutRegistry = [
    {
        name: 'landscape-mobile',
        description: '2-column layout for mobile landscape orientation (65% game content, 35% controls)',
        condition: (responsiveUI) => responsiveUI.needsLandscapeMobileLayout(),
        calculator: calculateLandscapeMobileLayout,
        priority: 1
    },
    {
        name: 'portrait-mobile',
        description: 'Percentage-based vertical zones layout for mobile portrait orientation (smaller screens)',
        condition: (responsiveUI) => responsiveUI.needsPortraitMobileLayout(),
        calculator: calculatePortraitMobileLayout,
        priority: 2
    },
    {
        name: 'landscape',
        description: 'Standard single-column layout with dynamic spacing for desktop landscape orientation',
        condition: (responsiveUI) => responsiveUI.needsLandscapeLayout(),
        calculator: calculateLandscapeLayout,
        priority: 3
    },
    {
        name: 'portrait',
        description: 'Percentage-based vertical zones layout for portrait orientation',
        condition: (responsiveUI) => responsiveUI.needsPortraitLayout(),
        calculator: calculatePortraitLayout,
        priority: 4
    }
];

/**
 * Get the layout registry sorted by priority
 * @returns {Array<LayoutDefinition>} Sorted layout registry
 */
export function getLayoutRegistry() {
    // Ensure registry is sorted by priority
    return [...layoutRegistry].sort((a, b) => a.priority - b.priority);
}

/**
 * Get a layout by name
 * @param {string} name - Layout name
 * @returns {LayoutDefinition|null} Layout definition or null if not found
 */
export function getLayoutByName(name) {
    return layoutRegistry.find(layout => layout.name === name) || null;
}

