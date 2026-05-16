/**
 * Universal Control Bar Layout Utilities
 * 
 * Provides universal functions for calculating control bar element dimensions and positions
 * that work across all layout modes (portrait, portrait mobile, landscape, landscape mobile).
 * 
 * Note: "Container" in function names refers to UI control elements (buttons, widgets, text areas),
 * not Phaser Container objects. These utilities work with the controlBar.layoutGroups system.
 */

import { getLayoutConfig } from '../config/ConfigUtils.js';
import { getScreenHeight } from '../viewport/ViewportUtils.js';
import { warn, debug } from '../logger/LoggerUtils.js';
import { getContentHeightPercent, getContentHeightPixels, getInsetPercent } from './ConfigAccessUtils.js';

/**
 * Calculate container dimensions (width, height)
 * 
 * @param {Object} params - Dimension calculation parameters
 * @param {number} [params.contentHeightPercent] - Content height as percentage (pixels are converted to percent before calling)
 * @param {number} params.availableHeight - Available height for containers (after padding)
 * @param {number} params.height - Screen height
 * @returns {Object} {containerWidth, containerHeight, baseContainerHeight}
 */
export function calculateContainerDimensions(params) {
    const {
        contentHeightPercent,
        availableHeight,
        height
    } = params;
    
    // Use contentPercent values with defaults
    // Note: pixels are converted to percent in getContentHeightPercent before calling this function
    const heightPercent = contentHeightPercent ?? 0.08;
    
    // Calculate container height - relative to available height after padding
    // CRITICAL: Clamp to minimum 44px (Apple HIG minimum touch target)
    let containerHeight = availableHeight * heightPercent;
    containerHeight = Math.max(containerHeight, 44); // Clamp to minimum 44px
    
    // Calculate base container height (without padding) - kept for backward compatibility
    // Note: Spacing now uses containerHeight (actual rendered height) instead of baseContainerHeight
    const baseContainerHeight = height * heightPercent;
    
    // Always use natural widths (from WidgetFactory/ButtonFactory)
    // Return null to indicate natural width should be used
    const containerWidth = null;
    
    return {
        containerWidth,
        containerHeight,
        baseContainerHeight // Base container height without padding (kept for backward compatibility)
    };
}

/**
 * Process container groups and calculate group dimensions
 * @private
 * @param {Array<Array<string>>} layoutGroups - Nested array of layout groups
 * @param {Object} containerWidths - Object mapping container names to widths
 * @param {number} containerHeight - Container height
 * @param {number} horizontalSpacingPercent - Horizontal spacing between elements within a group (as percentage of screen height)
 * @param {number} screenHeight - Screen height (used as reference for spacing calculation, independent of contentHeight)
 * @returns {Array<Object>} Array of group data objects with {groupIndex, containers, totalWidth, largestHeight}
 */
function _processContainerGroups(layoutGroups, containerWidths, containerHeight, horizontalSpacingPercent, screenHeight) {
    const groupData = [];
    // Use screen height as reference for spacing - spacing must be completely independent of contentHeight
    // spacingPercent.items is a percentage of screen height, not container height
    // This ensures spacing is ONLY controlled by spacingPercent.items, not affected by contentHeight.percent
    const groupSpacing = screenHeight * horizontalSpacingPercent;
    
    // Debug: Log input parameters
    debug(`[ControlBarLayoutUtils] _processContainerGroups:`, 'layout', {
        layoutGroups,
        containerWidths,
        containerHeight,
        horizontalSpacingPercent,
        screenHeight,
        groupSpacing
    });
    
    for (let groupIndex = 0; groupIndex < layoutGroups.length; groupIndex++) {
        const group = layoutGroups[groupIndex];
        let totalWidth = 0;
        let largestHeight = containerHeight;
        
        // Normalize group: convert string to array, and ensure single-item arrays are handled correctly
        // This makes ["betWidget"] and "betWidget" equivalent - both become arrays for processing
        const normalizedGroup = Array.isArray(group) ? group : [group];
        
        // Debug: Log the normalized group to see what we're processing
        if (groupIndex === 2) {
            debug(`[ControlBarLayoutUtils] Processing Group 2: original group=${JSON.stringify(group)}, normalizedGroup=${JSON.stringify(normalizedGroup)}, containerWidths keys=${Object.keys(containerWidths).join(', ')}`, 'layout');
        }
        
        // Calculate total width: sum of all element widths + spacing between them
        for (let i = 0; i < normalizedGroup.length; i++) {
            const item = normalizedGroup[i];
            
            // Handle nested arrays (sub-groups) - sum their widths
            if (Array.isArray(item)) {
                let subGroupWidth = 0;
                for (let j = 0; j < item.length; j++) {
                    const containerName = item[j];
                    let elementWidth = containerWidths?.[containerName];
                    if (!elementWidth) {
                        if (containerName === 'soundButton' || containerName === 'infoButton' || containerName === 'playButton' || containerName === 'autoButton') {
                            elementWidth = containerHeight; // Square buttons
                        } else if (containerName === 'radialCounter') {
                            // radialCounter is a circle, so width = height = containerHeight
                            elementWidth = containerHeight;
                        } else {
                            elementWidth = 200; // Fallback
                        }
                    }
                    subGroupWidth += elementWidth;
                    if (j < item.length - 1) {
                        subGroupWidth += groupSpacing;
                    }
                }
                totalWidth += subGroupWidth;
            } else {
                // Single element (string)
                const containerName = item;
                let elementWidth = containerWidths?.[containerName];
                if (!elementWidth) {
                    if (containerName === 'soundButton' || containerName === 'infoButton' || containerName === 'playButton' || containerName === 'autoButton') {
                        elementWidth = containerHeight; // Square buttons
                    } else if (containerName === 'radialCounter') {
                        // radialCounter is a circle, so width = height = containerHeight
                        elementWidth = containerHeight;
                    } else {
                        elementWidth = 200; // Fallback
                    }
                }
                totalWidth += elementWidth;
            }
            
            // Add spacing between items (not after the last one)
            if (i < normalizedGroup.length - 1) {
                totalWidth += groupSpacing;
            }
        }
        
        // Safety check: clamp totalWidth to reasonable bounds (max 2x screen width)
        const maxReasonableWidth = screenHeight * 2; // Use screenHeight as proxy for reasonable max
        if (totalWidth > maxReasonableWidth || totalWidth < 0 || isNaN(totalWidth)) {
            warn(`[ControlBarLayoutUtils] _processContainerGroups: Group ${groupIndex} totalWidth is invalid (${totalWidth}), clamping to reasonable value`, 'layout', {
                groupIndex,
                normalizedGroup,
                originalTotalWidth: totalWidth,
                containerHeight,
                containerWidths: normalizedGroup.map(item => {
                    const name = Array.isArray(item) ? item[0] : item;
                    return { name, width: containerWidths?.[name] };
                })
            });
            totalWidth = Math.min(maxReasonableWidth, Math.max(0, totalWidth || 200));
        }
        
        // Debug: Log calculated totalWidth for this group
        debug(`[ControlBarLayoutUtils] _processContainerGroups: Group ${groupIndex} totalWidth:`, 'layout', {
            groupIndex,
            normalizedGroup,
            totalWidth,
            containerHeight,
            containerWidths: normalizedGroup.map(item => {
                const name = Array.isArray(item) ? item[0] : item;
                return { name, width: containerWidths?.[name] };
            })
        });
        
        groupData.push({
            groupIndex,
            containers: normalizedGroup,
            totalWidth,
            largestHeight,
            hasNestedArrays: normalizedGroup.some(item => Array.isArray(item))
        });
    }
    
    return groupData;
}

/**
 * Helper function to position elements within a group
 * @private
 */
function _positionGroupElementsInRow(group, groupLeftEdge, groupRightEdge, containerY, elementSpacing, containerWidths, containerPositions, groupAnchor, centerElementX) {
    // Validate containerY before use
    if (containerY === undefined || containerY === null || isNaN(containerY)) {
        warn(`⚠️ [LAYOUT] _positionGroupElementsInRow: containerY is invalid (${containerY}), cannot position elements`, 'layout');
        return; // Early return to prevent undefined Y positions
    }
    
    // Flatten group.containers to handle nested arrays (sub-groups)
    const flatContainers = [];
    for (let i = 0; i < group.containers.length; i++) {
        const item = group.containers[i];
        if (Array.isArray(item)) {
            // Nested array (sub-group) - flatten it
            flatContainers.push(...item);
        } else {
            // Single element (string)
            flatContainers.push(item);
        }
    }
    
    // Debug: Log spacing info
    debug(`[ControlBarLayoutUtils] _positionGroupElementsInRow:`, 'layout', {
        groupContainers: group.containers,
        flatContainers,
        groupLeftEdge,
        groupRightEdge,
        elementSpacing,
        groupAnchor,
        containerWidths: flatContainers.map(name => ({ name, width: containerWidths?.[name] }))
    });
    
    // Position elements sequentially using elementSpacing
    if (groupAnchor === 'right') {
        // Position elements from right to left to align right edge with screen/cardFrame right edge
        let currentX = groupRightEdge;
        
        for (let i = flatContainers.length - 1; i >= 0; i--) {
            const containerName = flatContainers[i];
            const elementWidth = containerWidths?.[containerName] || 200;
            
            // Position element center (right edge is at currentX)
            const elementX = currentX - (elementWidth / 2);
            containerPositions[containerName] = {
                x: elementX,
                y: containerY,
                width: elementWidth
            };
            
            // Move to next position (left): subtract width and spacing
            currentX -= elementWidth;
            if (i > 0) {
                currentX -= elementSpacing; // Add spacing between elements
            }
        }
    } else {
        // Position elements sequentially from left edge (left groups) or centered (center groups)
        
        // Handle center groups with multiple elements specially - center them around screen center
        if (groupAnchor === 'center' && flatContainers.length > 1 && centerElementX !== undefined && centerElementX !== null) {
            // Calculate total width of all elements + spacing
            const totalElementsWidth = flatContainers.reduce((sum, name) => {
                const width = containerWidths?.[name] || 200;
                return sum + width;
            }, 0);
            const totalSpacing = (flatContainers.length - 1) * elementSpacing;
            const totalGroupWidth = totalElementsWidth + totalSpacing;
            
            // Start from left edge of centered group (centered around screen center)
            const startX = centerElementX - (totalGroupWidth / 2);
            let currentX = startX;
            
            for (let i = 0; i < flatContainers.length; i++) {
                const containerName = flatContainers[i];
                const elementWidth = containerWidths?.[containerName] || 200;
                
                // Position element center
                const elementX = currentX + (elementWidth / 2);
                containerPositions[containerName] = {
                    x: elementX,
                    y: containerY,
                    width: elementWidth
                };
                
                // Move to next position
                currentX += elementWidth + elementSpacing;
            }
        } else {
            // Left groups or single-element center groups: position sequentially from left edge
            let currentX = groupLeftEdge;
            
            // Handle single-element groups specially (for center alignment)
            if (flatContainers.length === 1) {
                const containerName = flatContainers[0];
                const elementWidth = containerWidths?.[containerName] || 200;
                
                // For single elements, center them within the group bounds
                const elementX = groupLeftEdge + (groupRightEdge - groupLeftEdge) / 2;
                containerPositions[containerName] = {
                    x: elementX,
                    y: containerY,
                    width: elementWidth
                };
            } else {
                // Multiple elements: position sequentially using elementSpacing
                for (let i = 0; i < flatContainers.length; i++) {
                    const containerName = flatContainers[i];
                    const elementWidth = containerWidths?.[containerName] || 200;
                    
                    // Position element center
                    const elementX = currentX + (elementWidth / 2);
                    containerPositions[containerName] = {
                        x: elementX,
                        y: containerY,
                        width: elementWidth
                    };
                    
                    // Debug: Log element positioning
                    debug(`[ControlBarLayoutUtils] Positioning element in group:`, 'layout', {
                        containerName,
                        elementWidth,
                        elementX,
                        currentX,
                        elementSpacing,
                        nextCurrentX: currentX + elementWidth + elementSpacing
                    });
                    
                    // Move to next position (add spacing between elements)
                    currentX += elementWidth + elementSpacing;
                }
            }
        }
    }
}

/**
 * Calculate container positions based on layout structure (rows) and spacing
 * Universal algorithm: processes layoutGroups as rows (root-level arrays) and groups (arrays within rows)
 * 
 * @param {Object} params - Position calculation parameters
 * @param {Array<string>|Array<Array<string>>} params.containers - Array of container names OR nested array of container groups
 * @param {number} params.containerHeight - Container height
 * @param {number} params.width - Screen width
 * @param {number} params.height - Screen height
 * @param {number} params.horizontalPaddingLeft - Left horizontal padding
 * @param {number} params.verticalPaddingBottom - Bottom vertical padding
 * @param {number} params.availableWidth - Available width (after horizontal padding, may be further constrained by insetPercent.horizontal)
 * @param {number} params.centerX - Center X position
 * @param {Object} [params.containerWidths] - Optional: Object mapping container names to widths (for natural widths)
 * @param {number|Object} [params.spacingPercent] - Spacing percentage: number (backward compatibility) or object {h: number, v: number} where h=horizontal (between elements within groups), v=vertical (between rows), default: 0.2 = 20% of screen height (independent of contentHeight)
 * @param {number} [params.baseContainerHeight] - Base container height (without padding) for consistent spacing calculation, defaults to containerHeight if not provided
 * @param {number} [params.controlBarBackgroundTop] - Optional: Control bar background top position
 * @param {Object} [params.uiConfig] - Optional: Layout-specific config for reading paddingPercent.bottom and insetPercent.horizontal
 * @param {Object} [params.baseUIConfig] - Optional: Base config for reading paddingPercent.bottom and insetPercent.horizontal
 * @returns {Object} {containerPositions, topmostContainerName, topmostContainerY, topmostContainerTop}
 */
export function calculateContainerPositions(params) {
    const {
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
        controlBarBackgroundTop,
        uiConfig,
        baseUIConfig
    } = params;
    
    // Use baseContainerHeight if provided, otherwise fall back to containerHeight for backward compatibility
    const baseHeight = baseContainerHeight ?? containerHeight;
    
    if (baseContainerHeight === undefined || baseContainerHeight === null) {
        warn(`⚠️ calculateContainerPositions: WARNING - baseContainerHeight not provided! Spacing may not be constant.`, 'layout');
    }
    
    const containerPositions = {};
    
    // ALL layouts use nested structure (array of arrays)
    // Root-level arrays = rows (if they contain arrays) or groups (if they contain strings)
    // Arrays within root-level arrays = groups within that row
    const layoutGroups = containers;
    
    // Detect layout structure (number of rows)
    const layoutStructure = detectLayoutStructure(layoutGroups);
    const numRows = layoutStructure.numRows;
    const rows = layoutStructure.rows;
    
    // Extract spacing percentages
    // spacingPercent.items: ALWAYS used for spacing between elements within groups
    // spacingPercent.rows: used for spacing between rows (if numRows > 1)
    let horizontalSpacingPercent = 0.2;
    let verticalSpacingPercent = 0.2;
    if (spacingPercent !== undefined && spacingPercent !== null) {
        if (typeof spacingPercent === 'object') {
            horizontalSpacingPercent = spacingPercent.items ?? 0.2;
            verticalSpacingPercent = spacingPercent.rows ?? 0.2;
        } else {
            horizontalSpacingPercent = spacingPercent;
            verticalSpacingPercent = spacingPercent;
        }
    }
    
    // Calculate spacing values
    // Use screen height as reference for spacing - spacing must be completely independent of contentHeight
    // spacingPercent.items and spacingPercent.rows are percentages of screen height, not container height
    // This ensures spacing is ONLY controlled by spacingPercent, not affected by contentHeight.percent
    const elementSpacing = height * horizontalSpacingPercent; // Spacing between elements within groups (ALWAYS)
    const rowSpacing = height * verticalSpacingPercent; // Spacing between rows (if numRows > 1)
    
    // Debug: Log spacing calculation
    debug(`[ControlBarLayoutUtils] Spacing calculation:`, 'layout', {
        spacingPercent,
        horizontalSpacingPercent,
        verticalSpacingPercent,
        height,
        elementSpacing,
        rowSpacing,
        calculation: `elementSpacing = height * horizontalSpacingPercent = ${height} * ${horizontalSpacingPercent} = ${elementSpacing}`
    });
    
    // Read insetPercent.horizontal to inset content area from left and right edges (background remains full width)
    // Default to 0.0 (no inset, full width, current behavior)
    // insetPercent.horizontal: percentage to inset from each side (e.g., 0.01 = 1% inset from left and right)
    // Use helper function to ensure proper reading from current layout configs (mirrors contentHeight and paddingPercent pattern)
    const insetPercentH = getInsetPercent(uiConfig, baseUIConfig);
    
    // Calculate constrained boundaries based on inset
    // Left boundary: inset from left edge
    // Right boundary: inset from right edge (width * (1 - insetPercent.horizontal))
    const constrainedLeftBoundary = width * insetPercentH;
    const constrainedRightBoundary = width * (1 - insetPercentH);
    const constrainedWidth = constrainedRightBoundary - constrainedLeftBoundary;
    const constrainedCenterX = width / 2; // Always center on screen
    
    // Use constrained area for content positioning
    let centerElementX;
    let leftBoundaryX;
    let rightBoundaryX;
    
    centerElementX = centerX !== undefined && centerX !== null ? centerX : constrainedCenterX;
    // Apply inset to boundaries (content area is inset from edges, but still centered)
    leftBoundaryX = constrainedLeftBoundary;
    rightBoundaryX = constrainedRightBoundary;
    
    // Calculate effective available width for content positioning (within constrained area)
    const effectiveAvailableWidth = constrainedWidth;
    
    // Debug: Log boundary calculations with inset constraint
    debug(`[ControlBarLayoutUtils] Boundary calculations with inset constraint:`, 'layout', {
        width,
        insetPercentH,
        constrainedLeftBoundary,
        constrainedRightBoundary,
        constrainedWidth,
        constrainedCenterX,
        horizontalPaddingLeft,
        originalAvailableWidth: availableWidth,
        effectiveAvailableWidth,
        leftBoundaryX,
        rightBoundaryX,
        centerElementX,
        calculation: `leftBoundary = ${width} * ${insetPercentH} = ${constrainedLeftBoundary}, rightBoundary = ${width} * (1 - ${insetPercentH}) = ${constrainedRightBoundary}, width = ${constrainedRightBoundary} - ${constrainedLeftBoundary} = ${constrainedWidth}`
    });
    
    // Read paddingPercent.bottom to shift content up when bottom padding exists
    // Bottom padding shifts content up, not background down (background always at screen bottom)
    const uiConfigPaddingPercent = uiConfig?.controlBar?.paddingPercent;
    const baseUIConfigPaddingPercent = baseUIConfig?.controlBar?.paddingPercent;
    const paddingPercentBottom = uiConfigPaddingPercent?.bottom ?? baseUIConfigPaddingPercent?.bottom ?? 0.0;
    const bottomPadding = height * paddingPercentBottom;
    
    // Process each row uniformly
    // Rows are processed from bottom to top
    // Layout calculates center Y positions, but containers have top-left origin (0,0)
    // For bottom alignment: topLeftY = height - containerHeight
    // But we calculate center Y, so: centerY = height - (containerHeight / 2)
    // With bottom padding: shift content up by bottomPadding so background can extend below
    // Always calculate from bottom - don't use controlBarBackgroundTop (it causes centering instead of bottom alignment)
    let currentRowY = (height - bottomPadding) - (containerHeight / 2);
    
    // Validate currentRowY
    if (currentRowY === undefined || currentRowY === null || isNaN(currentRowY)) {
        warn(`⚠️ [LAYOUT] currentRowY is invalid (${currentRowY}), using emergency fallback`, 'layout');
        currentRowY = height / 2;
    }
    
    // Debug logging for bottom padding adjustment
    if (paddingPercentBottom > 0) {
        debug(`[ControlBarLayoutUtils] Bottom padding applied - content shifted up:`, 'layout', {
            paddingPercentBottom,
            bottomPadding,
            height,
            containerHeight,
            originalRowY: height - (containerHeight / 2),
            adjustedRowY: currentRowY,
            calculation: `currentRowY = (${height} - ${bottomPadding}) - (${containerHeight} / 2) = ${height - bottomPadding} - ${containerHeight / 2} = ${currentRowY}`
        });
    }
    
    // Process rows from bottom to top (reverse order of rows array)
    for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex--) {
        const row = rows[rowIndex];
        const groupsInRow = row.items; // Groups in this row
        
        // Process groups in this row using _processContainerGroups
        // Pass screen height for spacing calculation (spacing must be independent of contentHeight)
        const groupData = _processContainerGroups(groupsInRow, containerWidths, containerHeight, horizontalSpacingPercent, height);
        
        // Determine group anchors based on number of groups in the row
        // Simple alignment rules (matches video-poker):
        // - 1 group: center
        // - 2 groups: left, right
        // - 3 groups: left, center, right
        // - 4+ groups: first left, last right, others evenly distributed
        const numGroups = groupData.length;
        let groupAnchors;
        if (numGroups === 1) {
            groupAnchors = ['center'];
        } else if (numGroups === 2) {
            groupAnchors = ['left', 'right'];
        } else if (numGroups === 3) {
            groupAnchors = ['left', 'center', 'right'];
        } else {
            // 4+ groups: first left, last right, others evenly distributed
            groupAnchors = ['left'];
            for (let i = 1; i < numGroups - 1; i++) {
                groupAnchors.push('center'); // Will be evenly distributed
            }
            groupAnchors.push('right');
        }
        
        // Position groups in this row
        if (numGroups >= 4) {
            // 4+ groups: evenly distributed (first left, last right, others evenly distributed)
            // Use effectiveAvailableWidth (constrained width) for calculations
            const totalGroupsWidth = groupData.reduce((sum, group) => sum + group.totalWidth, 0);
            const totalSpacing = (numGroups - 1) * elementSpacing;
            const remainingSpace = effectiveAvailableWidth - totalGroupsWidth - totalSpacing;
            const spacePerGap = remainingSpace / (numGroups - 1);
            
            let currentX = leftBoundaryX;
            for (let groupIndex = 0; groupIndex < groupData.length; groupIndex++) {
                const group = groupData[groupIndex];
                const groupX = currentX + (group.totalWidth / 2);
                const groupLeftEdge = currentX;
                const groupRightEdge = currentX + group.totalWidth;
                
                _positionGroupElementsInRow(group, groupLeftEdge, groupRightEdge, currentRowY, elementSpacing, containerWidths, containerPositions, null, centerElementX);
                
                currentX += group.totalWidth + elementSpacing + spacePerGap;
            }
        } else {
            // 1-3 groups: use anchor-based positioning
            for (let groupIndex = 0; groupIndex < groupData.length; groupIndex++) {
                const group = groupData[groupIndex];
                const groupAnchor = groupAnchors[groupIndex];
                
                // Calculate group X position based on anchor
                let groupX;
                if (groupAnchor === 'left') {
                    groupX = leftBoundaryX + (group.totalWidth / 2);
                } else if (groupAnchor === 'right') {
                    groupX = rightBoundaryX - (group.totalWidth / 2);
                } else { // 'center'
                    groupX = centerElementX;
                }
                
                const groupLeftEdge = groupX - (group.totalWidth / 2);
                const groupRightEdge = groupX + (group.totalWidth / 2);
                
                _positionGroupElementsInRow(group, groupLeftEdge, groupRightEdge, currentRowY, elementSpacing, containerWidths, containerPositions, groupAnchor, centerElementX);
            }
        }
        
        // Move up for next row (if not the last one)
        if (rowIndex > 0) {
            currentRowY = currentRowY - containerHeight - rowSpacing;
        }
    }
    
    // Dynamically determine topmost and bottommost containers for background positioning
    let topmostContainerName, topmostContainerY, topmostContainerTop;
    let bottommostContainerName, bottommostContainerY, bottommostContainerBottom;
    
    // Find the container with the smallest Y value (topmost row)
    // Y increases downward, so the smallest Y is the topmost
    let minY = Infinity;
    let topmostContainerNameFound = null;
    
    // Find the container with the largest Y value (bottommost row)
    // Y increases downward, so the largest Y is the bottommost
    let maxY = -Infinity;
    let bottommostContainerNameFound = null;
    
    for (const [name, pos] of Object.entries(containerPositions)) {
        if (pos && pos.y !== undefined && pos.y !== null && !isNaN(pos.y)) {
            if (pos.y < minY) {
                minY = pos.y;
                topmostContainerNameFound = name;
            }
            if (pos.y > maxY) {
                maxY = pos.y;
                bottommostContainerNameFound = name;
            }
        }
    }
    
    // Fallback to first container from topmost row if no valid positions found
    if (topmostContainerNameFound === null) {
        const topmostRow = rows.length > 0 ? rows[rows.length - 1] : null; // Last row is topmost (we process bottom to top)
        if (topmostRow && topmostRow.items && topmostRow.items.length > 0) {
            const firstItem = topmostRow.items[0];
            if (Array.isArray(firstItem)) {
                topmostContainerNameFound = firstItem.length > 0 ? firstItem[0] : 'playButton';
            } else {
                topmostContainerNameFound = firstItem;
            }
        } else {
            topmostContainerNameFound = 'playButton'; // Ultimate fallback
        }
        minY = containerPositions[topmostContainerNameFound]?.y || (height / 2);
    }
    
    // Fallback to first container from bottommost row if no valid positions found
    if (bottommostContainerNameFound === null) {
        const bottommostRow = rows.length > 0 ? rows[0] : null; // First row is bottommost (we process bottom to top)
        if (bottommostRow && bottommostRow.items && bottommostRow.items.length > 0) {
            const firstItem = bottommostRow.items[0];
            if (Array.isArray(firstItem)) {
                bottommostContainerNameFound = firstItem.length > 0 ? firstItem[0] : 'playButton';
            } else {
                bottommostContainerNameFound = firstItem;
            }
        } else {
            bottommostContainerNameFound = 'playButton'; // Ultimate fallback
        }
        maxY = containerPositions[bottommostContainerNameFound]?.y || (height / 2);
    }
    
    topmostContainerName = topmostContainerNameFound;
    topmostContainerY = minY;
    // Containers use center origin (0.5, 0.5), so Y position is the center Y
    // Convert center Y to top edge: topmostContainerTop = centerY - (containerHeight / 2)
    topmostContainerTop = topmostContainerY - (containerHeight / 2);
    
    bottommostContainerName = bottommostContainerNameFound;
    bottommostContainerY = maxY;
    // Containers use center origin (0.5, 0.5), so Y position is the center Y
    // Convert center Y to bottom edge: bottommostContainerBottom = centerY + (containerHeight / 2)
    bottommostContainerBottom = bottommostContainerY + (containerHeight / 2);
    
    // Validate Y positions before returning
    const undefinedYPositions = [];
    for (const [name, pos] of Object.entries(containerPositions)) {
        if (pos && (pos.y === undefined || pos.y === null || isNaN(pos.y))) {
            undefinedYPositions.push(name);
        }
    }
    
    if (undefinedYPositions.length > 0) {
        warn(`⚠️ [LAYOUT] calculateContainerPositions: Undefined Y positions detected: ${undefinedYPositions.join(', ')}`, 'layout');
    }
    
    return {
        containerPositions,
        topmostContainerName,
        topmostContainerY,
        topmostContainerTop,
        bottommostContainerName,
        bottommostContainerY,
        bottommostContainerBottom
    };
}

/**
 * Calculate control height based on layout configuration
 * Uses contentHeightPercent from layout config, clamps to minimum 44px (Apple HIG minimum touch target)
 * 
 * @param {Phaser.Scene} scene - The scene instance
 * @param {string} [layoutType] - Optional layout type ('portrait-mobile', 'landscape-mobile', 'portrait', 'landscape')
 * @param {number} [defaultValue=88] - Default height if contentHeightPercent is not configured
 * @returns {number} Control height in pixels (minimum 44px)
 */
export function calculateControlHeight(scene, layoutType = null, defaultValue = 88) {
    if (!scene) {
        return Math.max(defaultValue, 44);
    }
    
    const screenHeight = getScreenHeight(scene);
    const uiConfig = getLayoutConfig(scene, layoutType, {});
    const baseUIConfig = getLayoutConfig(scene, null, {});
    
    // Check for pixels override first
    const pixelsOverride = getContentHeightPixels(uiConfig, baseUIConfig);
    if (pixelsOverride !== null) {
        return Math.max(pixelsOverride, 44); // Clamp to minimum 44px
    }
    
    // Calculate availableHeight (padding removed - set to 0.0)
    const verticalPaddingTop = 0.0;
    const verticalPaddingBottom = 0.0;
    const availableHeight = screenHeight - (verticalPaddingTop + verticalPaddingBottom);
    
    // Get content height percent from config (matches video-poker pattern)
    const heightPercent = getContentHeightPercent(uiConfig, availableHeight, screenHeight) || getContentHeightPercent(baseUIConfig, availableHeight, screenHeight);
    if (heightPercent !== null && heightPercent !== undefined) {
        // Apply percent to availableHeight (consistent with calculateContainerDimensions)
        const controlHeight = availableHeight * heightPercent;
        return Math.max(controlHeight, 44); // Clamp to minimum 44px (Apple HIG minimum touch target)
    }
    
    return Math.max(defaultValue, 44); // Clamp default to minimum 44px
}

/**
 * Calculate control bar background top position
 * 
 * Calculates the top position of the control bar background to match the top of the content,
 * adjusted for paddingPercent.top (extends background above content by configurable percentage of screenHeight).
 * 
 * @param {number} topmostContainerTop - Top position of the topmost container
 * @param {Object} uiConfig - Layout-specific config
 * @param {Object} baseUIConfig - Base config
 * @param {number} height - Screen height
 * @returns {number} Control bar background top position (adjusted for top padding)
 */
export function calculateControlBarBackgroundTop(topmostContainerTop, uiConfig, baseUIConfig, height) {
    // Read paddingPercent.top from config with fallback chain: uiConfig -> baseUIConfig -> 0.0
    // Check each level explicitly for debugging
    const uiConfigPaddingPercent = uiConfig?.controlBar?.paddingPercent;
    const baseUIConfigPaddingPercent = baseUIConfig?.controlBar?.paddingPercent;
    const uiConfigTop = uiConfigPaddingPercent?.top;
    const baseUIConfigTop = baseUIConfigPaddingPercent?.top;
    
    const paddingPercentTop = uiConfigTop ?? baseUIConfigTop ?? 0.0;
    
    // Calculate top padding in pixels (percentage of screen height)
    const topPadding = height * paddingPercentTop;
    
    // Adjust background top to extend above content by topPadding
    // Subtract topPadding to move background top upward
    const adjustedTop = topmostContainerTop - topPadding;
    
    // Debug logging with detailed breakdown
    debug(`[ControlBarLayoutUtils] calculateControlBarBackgroundTop:`, 'layout', {
        topmostContainerTop,
        height,
        uiConfigHasControlBar: !!uiConfig?.controlBar,
        uiConfigHasPaddingPercent: !!uiConfigPaddingPercent,
        uiConfigTop,
        baseUIConfigHasControlBar: !!baseUIConfig?.controlBar,
        baseUIConfigHasPaddingPercent: !!baseUIConfigPaddingPercent,
        baseUIConfigTop,
        paddingPercentTop,
        topPadding,
        adjustedTop,
        calculation: `adjustedTop = ${topmostContainerTop} - (${height} * ${paddingPercentTop}) = ${topmostContainerTop} - ${topPadding} = ${adjustedTop}`
    });
    
    return adjustedTop;
}

/**
 * Calculate control bar background bottom position
 * 
 * Background bottom is always aligned to screen bottom (height).
 * Bottom padding shifts content up, not the background down.
 * 
 * @param {number} bottommostContainerBottom - Bottom position of the bottommost container (unused, kept for API compatibility)
 * @param {Object} uiConfig - Layout-specific config (unused, kept for API compatibility)
 * @param {Object} baseUIConfig - Base config (unused, kept for API compatibility)
 * @param {number} height - Screen height
 * @returns {number} Control bar background bottom position (always equals height)
 */
export function calculateControlBarBackgroundBottom(bottommostContainerBottom, uiConfig, baseUIConfig, height) {
    // Background bottom should always be at screen bottom
    // Bottom padding shifts content up, not background down
    debug(`[ControlBarLayoutUtils] calculateControlBarBackgroundBottom: background always at screen bottom`, 'layout', {
        height,
        note: 'Background bottom is always at screen bottom. Bottom padding shifts content up instead.'
    });
    
    return height;
}

/**
 * Detect layout structure from layoutGroups array
 * Determines number of rows and structure based on root-level arrays
 * 
 * @param {Array<Array<string>|string>} layoutGroups - Layout groups array from controlBar.layoutGroups
 * @returns {Object} Layout structure information
 * @returns {number} returns.numRows - Number of root-level arrays (rows)
 * @returns {boolean} returns.isMultiRow - Whether there are multiple rows (numRows > 1)
 * @returns {Array<Object>} returns.rows - Array of row data objects
 * @returns {Array} returns.rows[].items - Items in this row (strings or nested arrays)
 * @returns {number} returns.rows[].itemCount - Number of items in this row
 * @returns {boolean} returns.rows[].hasNestedArrays - Whether this row contains nested arrays (groups)
 * @returns {number} returns.rows[].rowIndex - Index of this row (0-based, bottom to top)
 */
export function detectLayoutStructure(layoutGroups) {
    if (!Array.isArray(layoutGroups) || layoutGroups.length === 0) {
        return {
            numRows: 0,
            isMultiRow: false,
            rows: []
        };
    }
    
    // Universal structure rules (ALL layouts follow this):
    // - If root-level arrays contain arrays → each root-level array is a row, arrays within are groups
    // - If root-level arrays contain strings → all root-level arrays are groups in 1 row
    // Example 1 row: [["soundButton", "infoButton"], ["playButton", "autoButton"], ["balanceContainer"]]
    // Example 2 rows: [[["soundButton"], ["balanceTextArea"]], [["betWidget"], ["dealButton"]]]
    
    // Check if root-level items are arrays that contain arrays (indicating multiple rows)
    // vs arrays that contain strings (indicating groups in a single row)
    const firstItem = layoutGroups[0];
    const hasMultipleRows = Array.isArray(firstItem) && firstItem.some(subItem => Array.isArray(subItem));
    
    let numRows;
    let isMultiRow;
    let rows;
    
    if (hasMultipleRows) {
        // Multiple rows: root-level arrays contain arrays (rows with groups)
        // Example: [[["soundButton"], ["balanceTextArea"]], [["betWidget"], ["dealButton"]]]
        // Each root-level array is a row, items in each row are groups (arrays)
        numRows = layoutGroups.length;
        isMultiRow = numRows > 1;
        
        rows = layoutGroups.map((row, index) => {
            if (!Array.isArray(row)) {
                // Safety check: if row is not an array, wrap it
                const items = [[row]];
                return {
                    items,
                    itemCount: 1,
                    hasNestedArrays: true,
                    rowIndex: index
                };
            }
            
            // Items in this row are groups (arrays)
            const items = row;
            const itemCount = items.length;
            const hasNestedArrays = true; // Groups are arrays
            
            return {
                items,
                itemCount,
                hasNestedArrays,
                rowIndex: index // 0 = bottom row, higher = top rows
            };
        });
    } else {
        // Single row: all root-level arrays are groups in one row
        // Example: [["soundButton", "infoButton"], ["playButton", "autoButton"], ["balanceContainer"]]
        // This is 1 row with 3 groups (each root-level array is a group)
        numRows = 1;
        isMultiRow = false;
        
        const items = layoutGroups; // All root-level arrays are groups
        const itemCount = items.length;
        const hasNestedArrays = false; // Groups contain strings, not arrays
        
        rows = [{
            items,
            itemCount,
            hasNestedArrays,
            rowIndex: 0
        }];
    }
    
    return {
        numRows,
        isMultiRow,
        rows
    };
}

/**
 * Calculate header text field positions (winText, betText, balanceText)
 * Positions three text fields above the control bar: left, center, right
 * 
 * @param {Object} params - Header position calculation parameters
 * @param {Array<string>} params.items - Array of 3 item names (e.g., ["winText", "betText", "balanceText"])
 * @param {number} params.controlBarBackgroundTop - Top position of control bar background
 * @param {number} params.width - Screen width
 * @param {number} params.height - Screen height
 * @param {number} params.verticalOffset - Vertical offset as percentage of height (default: 0.003)
 * @param {number} [params.insetPercentHorizontal] - Horizontal inset percentage (default: 0.0)
 * @param {number} [params.centerX] - Center X position (default: width / 2)
 * @param {Object} [params.uiConfig] - Layout-specific config (for insetPercent)
 * @param {Object} [params.baseUIConfig] - Base config (for insetPercent)
 * @returns {{headerPositions: Object, headerY: number}} Header positions object
 */
export function calculateHeaderPositions(params) {
    const {
        items,
        controlBarBackgroundTop,
        width,
        height,
        verticalOffset = 0.003,
        centerX,
        uiConfig,
        baseUIConfig
    } = params;
    
    // Validate items array (now supports 0-3 items)
    if (!items || !Array.isArray(items)) {
        warn(`[ControlBarLayoutUtils] calculateHeaderPositions: items must be an array, got: ${items}`, 'layout');
        return {
            headerPositions: {},
            headerY: controlBarBackgroundTop
        };
    }
    
    // Calculate header Y position (above controlBarBackgroundTop by verticalOffset)
    const verticalOffsetPixels = verticalOffset * height;
    const headerY = controlBarBackgroundTop - verticalOffsetPixels;
    
    // Read insetPercent.horizontal to match layoutGroups content positioning
    // Use helper function to ensure proper reading from current layout configs (mirrors contentHeight and paddingPercent pattern)
    const insetPercentHorizontal = getInsetPercent(uiConfig, baseUIConfig);
    
    // Calculate constrained boundaries based on inset (same logic as calculateContainerPositions)
    const constrainedLeftBoundary = width * insetPercentHorizontal;
    const constrainedRightBoundary = width * (1 - insetPercentHorizontal);
    const constrainedCenterX = width / 2; // Always center on screen
    
    // Calculate X positions for left, center, right text fields
    const centerElementX = centerX !== undefined && centerX !== null ? centerX : constrainedCenterX;
    const leftBoundaryX = constrainedLeftBoundary;
    const rightBoundaryX = constrainedRightBoundary;
    
    // Position text fields based on alignment pattern (matches layoutGroups row alignment)
    // - 1 item: center
    // - 2 items: left, right
    // - 3 items: left, center, right
    // - 4+ items: first left, last right, others evenly distributed
    const headerPositions = {};
    const numItems = items.length;
    
    if (numItems === 0) {
        // No items - return empty positions
    } else if (numItems === 1) {
        // 1 item: center-aligned
        headerPositions[items[0]] = {
            x: centerElementX,
            y: headerY
        };
    } else if (numItems === 2) {
        // 2 items: left, right
        headerPositions[items[0]] = {
            x: leftBoundaryX,
            y: headerY
        };
        headerPositions[items[1]] = {
            x: rightBoundaryX,
            y: headerY
        };
    } else if (numItems === 3) {
        // 3 items: left, center, right
        headerPositions[items[0]] = {
            x: leftBoundaryX,
            y: headerY
        };
        headerPositions[items[1]] = {
            x: centerElementX,
            y: headerY
        };
        headerPositions[items[2]] = {
            x: rightBoundaryX,
            y: headerY
        };
    } else {
        // 4+ items: first left, last right, others evenly distributed
        // Calculate evenly distributed positions
        const availableWidth = rightBoundaryX - leftBoundaryX;
        // Estimate text width (we don't have actual widths, so use a reasonable estimate)
        // For evenly distributed, we'll space them evenly across the available width
        const spacing = availableWidth / (numItems - 1);
        
        for (let i = 0; i < numItems; i++) {
            if (i === 0) {
                // First item: left-aligned
                headerPositions[items[i]] = {
                    x: leftBoundaryX,
                    y: headerY
                };
            } else if (i === numItems - 1) {
                // Last item: right-aligned
                headerPositions[items[i]] = {
                    x: rightBoundaryX,
                    y: headerY
                };
            } else {
                // Middle items: evenly distributed
                headerPositions[items[i]] = {
                    x: leftBoundaryX + (spacing * i),
                    y: headerY
                };
            }
        }
    }
    
    // Build debug message for items that were positioned
    const debugPositions = items.map(item => {
        const pos = headerPositions[item];
        return `${item}=(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`;
    }).join(', ');
    debug(`[ControlBarLayoutUtils] Header positions calculated (${numItems} items): ${debugPositions}`, 'layout');
    
    return {
        headerPositions,
        headerY
    };
}

