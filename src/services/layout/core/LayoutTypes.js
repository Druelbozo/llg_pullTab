/**
 * Layout System Type Definitions
 * Defines explicit interfaces for the layout system
 */

/**
 * Layout Position Object Interface
 * Defines the structure of position data returned by layout calculators
 * 
 * @typedef {Object} LayoutPositions
 * @property {number} [cardContainerX] - Card container X position
 * @property {number} [cardContainerY] - Card container Y position
 * @property {number} [cardContainerWidth] - Card container width
 * @property {number} [cardContainerHeight] - Card container height
 * @property {Object.<string, {x: number, y: number}>} [containerPositions] - Dynamic container positions (container name -> {x, y}). Used for controlBar layoutGroups.
 * @property {number} [controlBarBackgroundTop] - Top Y position of the control bar background graphics object
 * @property {number} [controlBarTop] - Top Y of the control bar row (used e.g. for landscape-mobile message band)
 */

/**
 * Layout Calculator Function
 * Function that calculates layout positions based on responsiveUI state
 * 
 * @typedef {Function} LayoutCalculator
 * @param {LayoutManager} responsiveUI - The LayoutManager instance
 * @returns {LayoutPositions} Layout positions object
 */

/**
 * Layout Condition Function
 * Function that determines if a layout should be used
 * 
 * @typedef {Function} LayoutCondition
 * @param {LayoutManager} responsiveUI - The LayoutManager instance
 * @returns {boolean} True if this layout should be used
 */

/**
 * Layout Definition Interface
 * Defines the structure of a layout definition in the registry
 * 
 * @typedef {Object} LayoutDefinition
 * @property {string} name - Unique identifier for the layout (e.g., 'landscape-mobile', 'landscape', 'portrait')
 * @property {string} description - Human-readable description of the layout
 * @property {LayoutCondition} condition - Function that returns true if this layout should be used
 * @property {LayoutCalculator} calculator - Function that calculates layout positions
 * @property {number} priority - Lower number = higher priority (1 is highest, used for selection order)
 */

export {};

