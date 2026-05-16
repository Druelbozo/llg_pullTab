/**
 * Layout Debug Visualization Utilities
 * 
 * Provides shared functions for visual debugging of control bar elements and card area bounds
 * across all layout modes (portrait, portrait mobile, landscape, landscape mobile).
 */

import { log, debug } from '../logger/LoggerUtils.js';
import { GameConfig } from '../../config/Global.js';
import gameConfig from '../../config/game/game-config.js';
import { getScratchGridFromGameConfig } from '../game/ScratchGridDimensionsUtils.js';
import { getScreenWidth, getScreenHeight } from '../viewport/ViewportUtils.js';


/**
 * Draw visual debugging bounds for control bar elements (buttons, widgets, textAreas)
 * 
 * @param {Object} params - Debug visualization parameters
 * @param {Phaser.Scene} params.scene - The scene instance
 * @param {Object} params.elementMap - Map of element names to Phaser container objects
 *   Expected keys: soundButton, infoButton, playButton, autoButton, balanceTextArea
 * @param {Object} params.containerPositions - Container positions from layout calculations
 */
export function drawControlBarElementBounds(params) {
    const {
        scene,
        elementMap,
        containerPositions
    } = params;
    
    // Check if visual debugging is enabled
    if (!GameConfig.debug.SHOW_CONTROL_BAR_VISUAL_DEBUGGING) {
        // Clean up any existing debug graphics if debugging is disabled
        if (scene && scene.controlBarElementBoundsDebug) {
            scene.controlBarElementBoundsDebug.forEach(debugItem => {
                if (debugItem.graphics) {
                    debugItem.graphics.clear();
                    debugItem.graphics.destroy();
                }
                if (debugItem.labelText) {
                    debugItem.labelText.destroy();
                }
            });
            scene.controlBarElementBoundsDebug = [];
        }
        return;
    }
    
    if (!scene) return;
    
    // Initialize array on scene if it doesn't exist
    if (!scene.controlBarElementBoundsDebug) {
        scene.controlBarElementBoundsDebug = [];
    }
    
    // Clean up existing debug graphics
    scene.controlBarElementBoundsDebug.forEach(debugItem => {
        if (debugItem.graphics) {
            debugItem.graphics.clear();
            debugItem.graphics.destroy();
        }
        if (debugItem.labelText) {
            debugItem.labelText.destroy();
        }
    });
    scene.controlBarElementBoundsDebug = [];
    
    // Define element configurations (name, color, label)
    const elementConfigs = [
        { name: 'soundButton', color: 0x00ff00, label: 'soundButton' }, // Green
        { name: 'infoButton', color: 0x00ff00, label: 'infoButton' }, // Green
        { name: 'playButton', color: 0x00ff00, label: 'playButton' }, // Green
        { name: 'autoButton', color: 0x00ff00, label: 'autoButton' }, // Green
        { name: 'speedButton', color: 0x00ff00, label: 'speedButton' }, // Green
        { name: 'balanceTextArea', color: 0xffff00, label: 'balanceTextArea' }, // Yellow
        { name: 'balanceContainer', color: 0xffff00, label: 'balanceContainer' }, // Yellow (alias)
        { name: 'radialCounter', color: 0x00ffff, label: 'radialCounter' } // Cyan
    ];
    
    // Draw bounds for each element
    elementConfigs.forEach(config => {
        let element = elementMap[config.name];
        
        if (!element) return;
        
        // Skip if element is not visible (prevents drawing bounds for hidden elements at 0,0)
        if (element.visible === false) {
            return;
        }
        
        // Get bounds from the element
        let bounds;
        try {
            if (typeof element.getBounds === 'function') {
                bounds = element.getBounds();
            } else {
                // Fallback: use position and display dimensions
                bounds = {
                    x: element.x - (element.displayWidth / 2),
                    y: element.y - (element.displayHeight / 2),
                    width: element.displayWidth || element.width || 0,
                    height: element.displayHeight || element.height || 0
                };
            }
        } catch (error) {
            log(`ControlBarElementBounds: Could not get bounds for ${config.name}: ${error.message}`, 'layout');
            return;
        }
        
        if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
            return; // Skip if bounds are invalid
        }
        
        // Skip if element is at (0,0) and has very small dimensions (likely not positioned yet)
        // This prevents drawing debug boxes in the upper-left corner for unpositioned elements
        const isAtOrigin = Math.abs(bounds.x) < 1 && Math.abs(bounds.y) < 1;
        const isVerySmall = bounds.width < 10 && bounds.height < 10;
        if (isAtOrigin && isVerySmall) {
            return; // Skip unpositioned/small elements at origin
        }
        
        // Get calculated position from layout (if available) for comparison
        const calculatedPos = containerPositions?.[config.name] || containerPositions?.[config.name === 'balanceTextArea' ? 'balanceContainer' : config.name];
        
        // Create graphics object for bounds rectangle
        const graphics = scene.add.graphics();
        graphics.lineStyle(2, config.color, 1); // 2px outline, fully opaque
        graphics.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        graphics.setDepth(99999); // Very high depth to be on top
        graphics.setVisible(true);
        
        // Create label text
        const labelY = bounds.y - 15;
        const labelX = bounds.x + (bounds.width / 2);
        const labelStyle = { 
            font: '12px Arial', 
            fill: `#${config.color.toString(16).padStart(6, '0')}`, 
            backgroundColor: '#000000', 
            padding: { x: 4, y: 2 } 
        };
        
        let labelText = `${config.label}\n${bounds.width.toFixed(1)}×${bounds.height.toFixed(1)}`;
        if (calculatedPos && calculatedPos.x !== undefined) {
            const xDiff = Math.abs(element.x - calculatedPos.x);
            const yDiff = Math.abs(element.y - calculatedPos.y);
            if (xDiff > 0.1 || yDiff > 0.1) {
                labelText += `\ncalc(${calculatedPos.x.toFixed(1)}, ${calculatedPos.y.toFixed(1)})`;
            }
        }
        
        const label = scene.add.text(labelX, labelY, labelText, labelStyle);
        label.setOrigin(0.5, 1); // Center horizontally, anchor at bottom
        label.setDepth(100000); // Above the rectangle
        label.setVisible(true);
        
        // Store debug item for cleanup (include bounds for spacing calculations)
        scene.controlBarElementBoundsDebug.push({
            graphics,
            labelText: label,
            elementName: config.name,
            bounds: bounds,
            element: element
        });
        
        log(`ControlBarElementBounds: Drew bounds for ${config.name} at (${bounds.x.toFixed(1)}, ${bounds.y.toFixed(1)}) ${bounds.width.toFixed(1)}×${bounds.height.toFixed(1)}`, 'layout');
    });
    
    // Draw spacing lines and labels between elements on the same row
    // Group elements by Y position (same Y = same row, within a small tolerance)
    const Y_TOLERANCE = 5; // pixels - elements within 5px Y difference are considered on same row
    
    // Sort elements by X position for easier spacing calculation
    const elementsByRow = {};
    scene.controlBarElementBoundsDebug.forEach(debugItem => {
        const centerY = debugItem.bounds.y + (debugItem.bounds.height / 2);
        
        // Find existing row or create new one
        let rowKey = null;
        for (const key in elementsByRow) {
            const rowCenterY = parseFloat(key);
            if (Math.abs(centerY - rowCenterY) <= Y_TOLERANCE) {
                rowKey = key;
                break;
            }
        }
        
        if (!rowKey) {
            rowKey = centerY.toFixed(1);
            elementsByRow[rowKey] = [];
        }
        
        elementsByRow[rowKey].push(debugItem);
    });
    
    // For each row, calculate and draw spacing between adjacent elements
    Object.values(elementsByRow).forEach(rowElements => {
        if (rowElements.length < 2) return; // Need at least 2 elements to show spacing
        
        // Sort by X position (left to right)
        rowElements.sort((a, b) => {
            const centerXA = a.bounds.x + (a.bounds.width / 2);
            const centerXB = b.bounds.x + (b.bounds.width / 2);
            return centerXA - centerXB;
        });
        
        // Draw spacing between adjacent elements
        for (let i = 0; i < rowElements.length - 1; i++) {
            const leftElement = rowElements[i];
            const rightElement = rowElements[i + 1];
            
            const leftRightX = leftElement.bounds.x + leftElement.bounds.width;
            const rightLeftX = rightElement.bounds.x;
            const spacing = rightLeftX - leftRightX;
            
            // Only draw spacing if there's actual space between elements
            if (spacing > 0) {
                const leftCenterY = leftElement.bounds.y + (leftElement.bounds.height / 2);
                const rightCenterY = rightElement.bounds.y + (rightElement.bounds.height / 2);
                const centerY = (leftCenterY + rightCenterY) / 2;
                const centerX = (leftRightX + rightLeftX) / 2;
                
                // Draw a small horizontal line at the center Y showing the gap
                const spacingGraphics = scene.add.graphics();
                spacingGraphics.lineStyle(1, 0xff8800, 0.8); // Orange, slightly transparent
                spacingGraphics.lineBetween(leftRightX, centerY, rightLeftX, centerY);
                spacingGraphics.setDepth(99998); // Just below the bounds rectangles
                
                // Add label showing spacing distance
                const spacingLabel = scene.add.text(centerX, centerY - 8, `${spacing.toFixed(1)}px`, {
                    font: '10px Arial',
                    fill: '#ff8800',
                    backgroundColor: '#000000',
                    padding: { x: 2, y: 1 }
                });
                spacingLabel.setOrigin(0.5, 1); // Center horizontally, anchor at bottom
                spacingLabel.setDepth(100000); // Above everything
                
                // Store spacing graphics and label for cleanup
                scene.controlBarElementBoundsDebug.push({
                    graphics: spacingGraphics,
                    labelText: spacingLabel,
                    elementName: `${leftElement.elementName}-${rightElement.elementName}-spacing`,
                    bounds: null,
                    element: null
                });
                
                log(`ControlBarElementBounds: Spacing between ${leftElement.elementName} and ${rightElement.elementName}: ${spacing.toFixed(1)}px`, 'layout');
            }
        }
    });
    
    log(`ControlBarElementBounds: Debug visualization complete - ${scene.controlBarElementBoundsDebug.length} items (bounds + spacing)`, 'layout');
}

/**
 * Draw visual debugging bounds for the control bar background
 * This should be called after the containerBar is created
 * 
 * @param {Object} params - Debug visualization parameters
 * @param {Phaser.Scene} params.scene - The scene instance
 * @param {Object} params.layoutPositions - Layout positions containing controlBarBackgroundTop
 */
export function drawControlBarBackgroundBounds(params) {
    const { scene, layoutPositions } = params;
    
    // Check if visual debugging is enabled
    if (!GameConfig.debug.SHOW_CONTROL_BAR_VISUAL_DEBUGGING) {
        return;
    }
    
    if (!scene) return;
    
    // Get control bar background top position from layout positions
    const controlBarBackgroundTop = layoutPositions?.controlBarBackgroundTop;
    if (controlBarBackgroundTop === undefined || controlBarBackgroundTop === null) {
        return; // No position available
    }
    
    // Initialize array on scene if it doesn't exist
    if (!scene.controlBarElementBoundsDebug) {
        scene.controlBarElementBoundsDebug = [];
    }
    
    // Remove any existing controlBar background debug items
    scene.controlBarElementBoundsDebug = scene.controlBarElementBoundsDebug.filter(debugItem => {
        if (debugItem.elementName === 'controlBar') {
            if (debugItem.graphics) {
                debugItem.graphics.clear();
                debugItem.graphics.destroy();
            }
            if (debugItem.labelText) {
                debugItem.labelText.destroy();
            }
            return false; // Remove this item
        }
        return true; // Keep other items
    });
    
    // Calculate bounds from layout positions (same as ControlBarBackgroundService does)
    const width = getScreenWidth(scene);
    const height = getScreenHeight(scene);
    
    const barX = 0; // Left edge of screen (ignoring padding)
    const barY = controlBarBackgroundTop; // Top edge of bar (from layout positions)
    const barWidth = width; // Full screen width
    const barHeight = height - controlBarBackgroundTop; // From bar top to screen bottom
    
    if (barWidth <= 0 || barHeight <= 0) {
        return; // Invalid dimensions
    }
    
    // Create graphics object for controlBar background bounds rectangle (magenta color)
    const backgroundGraphics = scene.add.graphics();
    backgroundGraphics.lineStyle(3, 0xff00ff, 1); // Magenta outline, 3px width, fully opaque
    backgroundGraphics.strokeRect(barX, barY, barWidth, barHeight);
    backgroundGraphics.setDepth(99997); // Just below element bounds rectangles
    backgroundGraphics.setVisible(true);
    
    // Create label text showing dimensions
    const labelY = barY - 15;
    const labelX = barX; // Left edge of bounds
    const labelStyle = { 
        font: '12px Arial', 
        fill: '#ff00ff', // Magenta
        backgroundColor: '#000000', 
        padding: { x: 4, y: 2 } 
    };
    
    const labelText = `controlBar\n${barWidth.toFixed(1)}×${barHeight.toFixed(1)}`;
    const backgroundLabel = scene.add.text(labelX, labelY, labelText, labelStyle);
    backgroundLabel.setOrigin(0, 1); // Left align horizontally, anchor at bottom
    backgroundLabel.setDepth(100000); // Above everything
    backgroundLabel.setVisible(true);
    
    // Store debug item for cleanup
    scene.controlBarElementBoundsDebug.push({
        graphics: backgroundGraphics,
        labelText: backgroundLabel,
        elementName: 'controlBar',
        bounds: { x: barX, y: barY, width: barWidth, height: barHeight },
        element: null
    });
    
    log(`ControlBarElementBounds: Drew bounds for controlBar background at (${barX.toFixed(1)}, ${barY.toFixed(1)}) ${barWidth.toFixed(1)}×${barHeight.toFixed(1)}`, 'layout');
}

/**
 * Draw visual debugging bounds for the cardContainer and messageText
 * This should be called after the cardContainer is positioned and scaled
 * 
 * @param {Object} params - Debug visualization parameters
 * @param {Phaser.Scene} params.scene - The scene instance
 * @param {Phaser.GameObjects.Container} params.cardContainer - The card container object
 * @param {Phaser.GameObjects.Text} params.messageText - The message text object (optional)
 * @param {Phaser.GameObjects.Image} params.shockWave - The shockWave image inside cardContainer (optional but recommended for accurate bounds)
 * @param {Phaser.GameObjects.Container} params.gameContainer - The gameContainer child of cardContainer (optional, will search if not provided)
 * @param {Phaser.GameObjects.Container} params.cover - The cover container child of cardContainer (optional, will search if not provided)
 * @param {Phaser.GameObjects.Container} params.main_ScratchSurface - The main_ScratchSurface prefab (scratchCover imageKey) (optional)
 * @param {Object} params.cardSize - The calculated card size object with width, height, scale (optional, used as fallback)
 */
export function drawCardContainerBounds(params) {
    const { scene, cardContainer, messageText, shockWave, gameContainer, cover, main_ScratchSurface, cardSize } = params;
    
    // Check if visual debugging is enabled
    if (!GameConfig.debug.SHOW_CARD_CONTAINER_VISUAL_DEBUGGING) {
        // Clean up any existing debug graphics if debugging is disabled
        if (scene && scene.cardContainerBoundsDebug) {
            scene.cardContainerBoundsDebug.forEach(debugItem => {
                if (debugItem.graphics) {
                    debugItem.graphics.clear();
                    debugItem.graphics.destroy();
                }
                if (debugItem.labelText) {
                    debugItem.labelText.destroy();
                }
            });
            scene.cardContainerBoundsDebug = [];
        }
        return;
    }
    
    if (!scene || !cardContainer) return;
    
    // Initialize array on scene if it doesn't exist
    if (!scene.cardContainerBoundsDebug) {
        scene.cardContainerBoundsDebug = [];
    }
    
    // Clean up existing debug graphics
    scene.cardContainerBoundsDebug.forEach(debugItem => {
        if (debugItem.graphics) {
            debugItem.graphics.clear();
            debugItem.graphics.destroy();
        }
        if (debugItem.labelText) {
            debugItem.labelText.destroy();
        }
    });
    scene.cardContainerBoundsDebug = [];
    
    // Calculate cardContainer bounds based on actual displayed size
    // cardContainer has origin at (0.5, 0.5), so its center is at (x, y)
    // Use cardSize which is already calculated correctly accounting for scaling
    // displayWidth/displayHeight don't account for parent scaling in Phaser
    let cardWidth, cardHeight;
    if (cardSize && cardSize.width && cardSize.height) {
        // cardSize is already the correctly calculated rendered size
        cardWidth = cardSize.width;
        cardHeight = cardSize.height;
        debug(`CardContainerBounds: Using cardSize - width=${cardWidth.toFixed(1)}, height=${cardHeight.toFixed(1)}`, 'layout');
    } else if (shockWave && cardContainer) {
        // Fallback: calculate manually from frame dimensions and container scale
        const scaleX = cardContainer.scaleX || 1;
        const scaleY = cardContainer.scaleY || 1;
        const shockWaveWidth = shockWave.frame ? shockWave.frame.width : (shockWave.width || 1300);
        const shockWaveHeight = shockWave.frame ? shockWave.frame.height : (shockWave.height || 1060);
        cardWidth = shockWaveWidth * scaleX;
        cardHeight = shockWaveHeight * scaleY;
        debug(`CardContainerBounds: Manual calculation - frameWidth=${shockWaveWidth}, frameHeight=${shockWaveHeight}, scaleX=${scaleX}, scaleY=${scaleY}, finalWidth=${cardWidth.toFixed(1)}, finalHeight=${cardHeight.toFixed(1)}`, 'layout');
    } else {
        // Final fallback: use display dimensions from container
        cardWidth = cardContainer.displayWidth || 0;
        cardHeight = cardContainer.displayHeight || 0;
        debug(`CardContainerBounds: Using container display dimensions - width=${cardWidth.toFixed(1)}, height=${cardHeight.toFixed(1)}`, 'layout');
    }
    
    // Calculate bounds from center position (origin 0.5, 0.5)
    const cardBounds = {
        x: cardContainer.x - (cardWidth / 2),
        y: cardContainer.y - (cardHeight / 2),
        width: cardWidth,
        height: cardHeight
    };
    
    if (!cardBounds || cardBounds.width <= 0 || cardBounds.height <= 0) {
        debug(`CardContainerBounds: Invalid bounds, skipping. cardWidth=${cardWidth}, cardHeight=${cardHeight}`, 'layout');
        return; // Skip if bounds are invalid
    }
    
    debug(`CardContainerBounds: Drawing bounds - x=${cardBounds.x.toFixed(1)}, y=${cardBounds.y.toFixed(1)}, width=${cardBounds.width.toFixed(1)}, height=${cardBounds.height.toFixed(1)}`, 'layout');
    
    // Draw cardContainer bounds (cyan color)
    const cardGraphics = scene.add.graphics();
    cardGraphics.lineStyle(3, 0x00ffff, 1); // Cyan outline, 3px width, fully opaque
    cardGraphics.strokeRect(cardBounds.x, cardBounds.y, cardBounds.width, cardBounds.height);
    
    // Draw top edge (red)
    cardGraphics.lineStyle(2, 0xff0000, 1);
    cardGraphics.lineBetween(cardBounds.x, cardBounds.y, cardBounds.x + cardBounds.width, cardBounds.y);
    
    // Draw bottom edge (blue)
    cardGraphics.lineStyle(2, 0x0000ff, 1);
    cardGraphics.lineBetween(cardBounds.x, cardBounds.y + cardBounds.height, cardBounds.x + cardBounds.width, cardBounds.y + cardBounds.height);
    
    cardGraphics.setDepth(99996); // Just below control bar debug
    cardGraphics.setVisible(true);
    
    // Create label text showing dimensions
    const labelY = cardBounds.y - 15;
    const labelX = cardBounds.x + (cardBounds.width / 2);
    const labelStyle = { 
        font: '12px Arial', 
        fill: '#00ffff', // Cyan
        backgroundColor: '#000000', 
        padding: { x: 4, y: 2 } 
    };
    
    const displayHeight = cardContainer.displayHeight || cardBounds.height;
    const displayWidth = cardContainer.displayWidth || cardBounds.width;
    const labelText = `cardContainer\n${displayWidth.toFixed(1)}×${displayHeight.toFixed(1)}\nTop: ${cardBounds.y.toFixed(1)}\nBottom: ${(cardBounds.y + cardBounds.height).toFixed(1)}`;
    const cardLabel = scene.add.text(labelX, labelY, labelText, labelStyle);
    cardLabel.setOrigin(0.5, 1); // Center horizontally, anchor at bottom
    cardLabel.setDepth(100000); // Above everything
    cardLabel.setVisible(true);
    
    // Store debug item for cleanup
    scene.cardContainerBoundsDebug.push({
        graphics: cardGraphics,
        labelText: cardLabel,
        elementName: 'cardContainer',
        bounds: cardBounds,
        element: cardContainer
    });
    
    log(`CardContainerBounds: Drew bounds for cardContainer at (${cardBounds.x.toFixed(1)}, ${cardBounds.y.toFixed(1)}) ${cardBounds.width.toFixed(1)}×${cardBounds.height.toFixed(1)}`, 'layout');
    
    // Draw gameContainer bounds if available (child of cardContainer)
    const gameContainerToDraw = gameContainer || (cardContainer && cardContainer.list && Array.isArray(cardContainer.list) ? 
        cardContainer.list.find(child => {
            // Find gameContainer by looking for image_2 (first child) or scratchContainer
            if (!child || !child.list || !Array.isArray(child.list)) return false;
            let hasImage2 = false;
            let hasScratchContainer = false;
            for (let grandChild of child.list) {
                if (grandChild && (grandChild.texture || grandChild.textureKey)) hasImage2 = true;
                if (grandChild && grandChild.list && Array.isArray(grandChild.list)) hasScratchContainer = true;
                if (hasImage2 && hasScratchContainer) break;
            }
            return hasImage2 && hasScratchContainer;
        }) : null);
    
    if (gameContainerToDraw) {
        try {
            let gameContainerBounds;
            if (typeof gameContainerToDraw.getBounds === 'function') {
                gameContainerBounds = gameContainerToDraw.getBounds();
            } else {
                const childWidth = gameContainerToDraw.displayWidth || gameContainerToDraw.width || 0;
                const childHeight = gameContainerToDraw.displayHeight || gameContainerToDraw.height || 0;
                if (childWidth > 0 && childHeight > 0) {
                    gameContainerBounds = {
                        x: gameContainerToDraw.x - (childWidth / 2),
                        y: gameContainerToDraw.y - (childHeight / 2),
                        width: childWidth,
                        height: childHeight
                    };
                }
            }
            
            if (gameContainerBounds && gameContainerBounds.width > 0 && gameContainerBounds.height > 0) {
                // Draw gameContainer bounds (orange color to distinguish from cardContainer)
                const gameContainerGraphics = scene.add.graphics();
                gameContainerGraphics.lineStyle(2, 0xff8800, 1); // Orange outline, 2px, fully opaque
                gameContainerGraphics.strokeRect(gameContainerBounds.x, gameContainerBounds.y, gameContainerBounds.width, gameContainerBounds.height);
                gameContainerGraphics.setDepth(99997); // Just below cardContainer bounds
                gameContainerGraphics.setVisible(true);
                
                // Create label text
                const gameContainerLabelY = gameContainerBounds.y - 15;
                const gameContainerLabelX = gameContainerBounds.x + (gameContainerBounds.width / 2);
                const gameContainerLabelStyle = { 
                    font: '11px Arial', 
                    fill: '#ff8800', // Orange
                    backgroundColor: '#000000', 
                    padding: { x: 3, y: 1 } 
                };
                const gameContainerLabelText = `gameContainer\n${gameContainerBounds.width.toFixed(1)}×${gameContainerBounds.height.toFixed(1)}`;
                const gameContainerLabel = scene.add.text(gameContainerLabelX, gameContainerLabelY, gameContainerLabelText, gameContainerLabelStyle);
                gameContainerLabel.setOrigin(0.5, 1);
                gameContainerLabel.setDepth(100000);
                gameContainerLabel.setVisible(true);
                
                // Store debug item
                scene.cardContainerBoundsDebug.push({
                    graphics: gameContainerGraphics,
                    labelText: gameContainerLabel,
                    elementName: 'gameContainer',
                    bounds: gameContainerBounds,
                    element: gameContainerToDraw
                });
                
                log(`CardContainerBounds: Drew bounds for gameContainer at (${gameContainerBounds.x.toFixed(1)}, ${gameContainerBounds.y.toFixed(1)}) ${gameContainerBounds.width.toFixed(1)}×${gameContainerBounds.height.toFixed(1)}`, 'layout');
            }
        } catch (gameContainerError) {
            debug(`CardContainerBounds: Could not draw gameContainer bounds: ${gameContainerError.message}`, 'layout');
        }
    }
    
    // Draw cover container bounds if available (child of cardContainer)
    const coverToDraw = cover || (cardContainer && cardContainer.list && Array.isArray(cardContainer.list) ?
        cardContainer.list.find(child => {
            // Find cover by scale 0.8 and dI_Cover_1 child
            if (!child || !child.list || !Array.isArray(child.list)) return false;
            const hasScale08 = Math.abs((child.scaleX || 1) - 0.8) < 0.01 && Math.abs((child.scaleY || 1) - 0.8) < 0.01;
            if (!hasScale08) return false;
            return child.list.some(grandChild => grandChild && grandChild.texture && grandChild.texture.key === 'DI_Cover_01');
        }) : null);
    
    if (coverToDraw) {
        try {
            let coverBounds;
            if (typeof coverToDraw.getBounds === 'function') {
                coverBounds = coverToDraw.getBounds();
            } else {
                const childWidth = coverToDraw.displayWidth || coverToDraw.width || 0;
                const childHeight = coverToDraw.displayHeight || coverToDraw.height || 0;
                if (childWidth > 0 && childHeight > 0) {
                    coverBounds = {
                        x: coverToDraw.x - (childWidth / 2),
                        y: coverToDraw.y - (childHeight / 2),
                        width: childWidth,
                        height: childHeight
                    };
                }
            }
            
            if (coverBounds && coverBounds.width > 0 && coverBounds.height > 0) {
                // Draw cover bounds (lime/green color to distinguish)
                const coverGraphics = scene.add.graphics();
                coverGraphics.lineStyle(2, 0x88ff00, 1); // Lime/green outline, 2px, fully opaque
                coverGraphics.strokeRect(coverBounds.x, coverBounds.y, coverBounds.width, coverBounds.height);
                coverGraphics.setDepth(99998); // Just above gameContainer bounds
                coverGraphics.setVisible(true);
                
                // Create label text
                const coverLabelY = coverBounds.y - 15;
                const coverLabelX = coverBounds.x + (coverBounds.width / 2);
                const coverLabelStyle = { 
                    font: '11px Arial', 
                    fill: '#88ff00', // Lime/green
                    backgroundColor: '#000000', 
                    padding: { x: 3, y: 1 } 
                };
                const coverLabelText = `cover\n${coverBounds.width.toFixed(1)}×${coverBounds.height.toFixed(1)}\nscale: ${(coverToDraw.scaleX || 1).toFixed(1)}`;
                const coverLabel = scene.add.text(coverLabelX, coverLabelY, coverLabelText, coverLabelStyle);
                coverLabel.setOrigin(0.5, 1);
                coverLabel.setDepth(100000);
                coverLabel.setVisible(true);
                
                // Store debug item
                scene.cardContainerBoundsDebug.push({
                    graphics: coverGraphics,
                    labelText: coverLabel,
                    elementName: 'cover',
                    bounds: coverBounds,
                    element: coverToDraw
                });
                
                log(`CardContainerBounds: Drew bounds for cover at (${coverBounds.x.toFixed(1)}, ${coverBounds.y.toFixed(1)}) ${coverBounds.width.toFixed(1)}×${coverBounds.height.toFixed(1)}`, 'layout');
            }
        } catch (coverError) {
            debug(`CardContainerBounds: Could not draw cover bounds: ${coverError.message}`, 'layout');
        }
    }
    
    // Draw main_ScratchSurface tileContainer bounds if available (scratchCover imageKey)
    // The tileContainer contains all the tiles that make up the scratchCover surface
    // It's populated after processImage() is called on scene-awake, so check if initialized
    if (main_ScratchSurface && main_ScratchSurface.visible !== false && main_ScratchSurface.tileContainer) {
        try {
            // Use tileContainer bounds - this represents the actual scratchCover surface area
            let scratchSurfaceBounds;
            const tileContainer = main_ScratchSurface.tileContainer;
            
            // Check if processImage() has run (tiles are created and tileContainer has children)
            // If not initialized yet, calculate bounds from imageWidth/imageHeight if available
            if (main_ScratchSurface.initalized && tileContainer.list && tileContainer.list.length > 0) {
                // Tiles exist - calculate bounds from maskBounds if available (more accurate than getBounds which is affected by parent scales)
                if (main_ScratchSurface.maskBounds) {
                    // Use maskBounds directly - these are the actual backing dimensions in world coordinates
                    scratchSurfaceBounds = {
                        x: main_ScratchSurface.maskBounds.x,
                        y: main_ScratchSurface.maskBounds.y,
                        width: main_ScratchSurface.maskBounds.width,
                        height: main_ScratchSurface.maskBounds.height
                    };
                } else if (typeof tileContainer.getBounds === 'function') {
                    // Fallback to getBounds() if maskBounds not available
                    scratchSurfaceBounds = tileContainer.getBounds();
                } else {
                    // Fallback: calculate from tileContainer dimensions
                    const containerWidth = tileContainer.displayWidth || tileContainer.width || 0;
                    const containerHeight = tileContainer.displayHeight || tileContainer.height || 0;
                    if (containerWidth > 0 && containerHeight > 0) {
                        scratchSurfaceBounds = {
                            x: tileContainer.x - (containerWidth / 2),
                            y: tileContainer.y - (containerHeight / 2),
                            width: containerWidth,
                            height: containerHeight
                        };
                    }
                }
            } else if (main_ScratchSurface.imageWidth && main_ScratchSurface.imageHeight && 
                       main_ScratchSurface.imageWidth > 0 && main_ScratchSurface.imageHeight > 0) {
                // Not initialized yet, but we have image dimensions from processImage()
                // Calculate bounds from image dimensions (tiles will be positioned relative to these)
                // main_ScratchSurface is positioned at scratchCoverOffsetX/Y relative to scratchContainer
                // tileContainer is at (0,0) relative to main_ScratchSurface
                // So world position is main_ScratchSurface position
                const worldX = main_ScratchSurface.x;
                const worldY = main_ScratchSurface.y;
                scratchSurfaceBounds = {
                    x: worldX - (main_ScratchSurface.imageWidth / 2),
                    y: worldY - (main_ScratchSurface.imageHeight / 2),
                    width: main_ScratchSurface.imageWidth,
                    height: main_ScratchSurface.imageHeight
                };
            } else {
                // Fallback: try to get bounds from main_ScratchSurface container itself
                // This will at least show where the container is positioned
                if (typeof main_ScratchSurface.getBounds === 'function') {
                    scratchSurfaceBounds = main_ScratchSurface.getBounds();
                }
            }
            
            if (scratchSurfaceBounds && scratchSurfaceBounds.width > 0 && scratchSurfaceBounds.height > 0) {
                // Draw main_ScratchSurface tileContainer bounds (pink/magenta color to distinguish from cover)
                const scratchSurfaceGraphics = scene.add.graphics();
                scratchSurfaceGraphics.lineStyle(2, 0xff88ff, 1); // Pink/magenta outline, 2px, fully opaque
                scratchSurfaceGraphics.strokeRect(scratchSurfaceBounds.x, scratchSurfaceBounds.y, scratchSurfaceBounds.width, scratchSurfaceBounds.height);
                scratchSurfaceGraphics.setDepth(99999); // Just above cover bounds
                scratchSurfaceGraphics.setVisible(true);
                
                // Create label text
                const scratchSurfaceLabelY = scratchSurfaceBounds.y - 15;
                const scratchSurfaceLabelX = scratchSurfaceBounds.x + (scratchSurfaceBounds.width / 2);
                const scratchSurfaceLabelStyle = { 
                    font: '11px Arial', 
                    fill: '#ff88ff', // Pink/magenta
                    backgroundColor: '#000000', 
                    padding: { x: 3, y: 1 } 
                };
                const initializedStatus = main_ScratchSurface.initalized ? 'initialized' : 'pending';
                const scratchSurfaceLabelText = `main_ScratchSurface\ntileContainer (scratchCover)\n${scratchSurfaceBounds.width.toFixed(1)}×${scratchSurfaceBounds.height.toFixed(1)}\n[${initializedStatus}]`;
                const scratchSurfaceLabel = scene.add.text(scratchSurfaceLabelX, scratchSurfaceLabelY, scratchSurfaceLabelText, scratchSurfaceLabelStyle);
                scratchSurfaceLabel.setOrigin(0.5, 1);
                scratchSurfaceLabel.setDepth(100000);
                scratchSurfaceLabel.setVisible(true);
                
                // Store debug item
                scene.cardContainerBoundsDebug.push({
                    graphics: scratchSurfaceGraphics,
                    labelText: scratchSurfaceLabel,
                    elementName: 'main_ScratchSurface_tileContainer',
                    bounds: scratchSurfaceBounds,
                    element: tileContainer
                });
                
                log(`CardContainerBounds: Drew bounds for main_ScratchSurface tileContainer (scratchCover) at (${scratchSurfaceBounds.x.toFixed(1)}, ${scratchSurfaceBounds.y.toFixed(1)}) ${scratchSurfaceBounds.width.toFixed(1)}×${scratchSurfaceBounds.height.toFixed(1)} [${initializedStatus}]`, 'layout');
                
                // Draw actual tile area bounds
                // Use maskBounds directly (matches scratchBacking and scratchCover mask)
                // This ensures the tileArea dimensions match scratchBacking (455.8×227.9)
                if (main_ScratchSurface.maskBounds && main_ScratchSurface.maskBounds.width > 0 && main_ScratchSurface.maskBounds.height > 0) {
                    try {
                        // Use maskBounds directly - they already match scratchBacking exactly
                        const tileAreaBounds = {
                            x: main_ScratchSurface.maskBounds.x,
                            y: main_ScratchSurface.maskBounds.y,
                            width: main_ScratchSurface.maskBounds.width,
                            height: main_ScratchSurface.maskBounds.height
                        };
                        
                        // Draw tile area bounds (yellow color to distinguish)
                        const tileAreaGraphics = scene.add.graphics();
                        tileAreaGraphics.lineStyle(2, 0xffff00, 1); // Yellow outline, 2px, fully opaque
                        tileAreaGraphics.strokeRect(tileAreaBounds.x, tileAreaBounds.y, tileAreaBounds.width, tileAreaBounds.height);
                        tileAreaGraphics.setDepth(100003); // On top of other debug layers
                        tileAreaGraphics.setVisible(true);
                        
                        // Create label text - left-aligned over top of the box
                        const tileAreaLabelY = tileAreaBounds.y - 15;
                        const tileAreaLabelX = tileAreaBounds.x; // Left-aligned
                        const tileAreaLabelStyle = { 
                            font: '11px Arial', 
                            fill: '#ffff00', // Yellow
                            backgroundColor: '#000000', 
                            padding: { x: 3, y: 1 } 
                        };
                        const tileAreaLabelText = `tileArea (actual)\n${tileAreaBounds.width.toFixed(1)}×${tileAreaBounds.height.toFixed(1)}\n(${tileAreaBounds.x.toFixed(1)}, ${tileAreaBounds.y.toFixed(1)})`;
                        const tileAreaLabel = scene.add.text(tileAreaLabelX, tileAreaLabelY, tileAreaLabelText, tileAreaLabelStyle);
                        tileAreaLabel.setOrigin(0, 1); // Left-aligned, bottom origin
                        tileAreaLabel.setDepth(100004); // On top of graphics
                        tileAreaLabel.setVisible(true);
                        
                        // Store debug item
                        scene.cardContainerBoundsDebug.push({
                            graphics: tileAreaGraphics,
                            labelText: tileAreaLabel,
                            elementName: 'tileArea_actual',
                            bounds: tileAreaBounds,
                            element: tileContainer
                        });
                        
                        log(`CardContainerBounds: Drew bounds for tileArea (actual) at (${tileAreaBounds.x.toFixed(1)}, ${tileAreaBounds.y.toFixed(1)}) ${tileAreaBounds.width.toFixed(1)}×${tileAreaBounds.height.toFixed(1)}`, 'layout');
                    } catch (tileAreaError) {
                        debug(`CardContainerBounds: Could not draw tileArea bounds: ${tileAreaError.message}`, 'layout');
                    }
                }
            }
        } catch (scratchSurfaceError) {
            debug(`CardContainerBounds: Could not draw main_ScratchSurface tileContainer bounds: ${scratchSurfaceError.message}`, 'layout');
        }
    }
    
    // Draw mask bounds if available (the mask applied to scratchCover)
    // The mask should align with the backing image bounds (scratchBacking)
    // Use maskBounds directly - these are the actual backing dimensions in world coordinates
    if (main_ScratchSurface && main_ScratchSurface.backingMask && main_ScratchSurface.maskBounds) {
        try {
            const maskBounds = main_ScratchSurface.maskBounds;
            
            if (maskBounds && maskBounds.width > 0 && maskBounds.height > 0) {
                // Draw mask bounds (cyan color to distinguish from other bounds)
                const maskDebugGraphics = scene.add.graphics();
                maskDebugGraphics.lineStyle(2, 0x00ffff, 1); // Cyan outline, 2px, fully opaque
                maskDebugGraphics.strokeRect(maskBounds.x, maskBounds.y, maskBounds.width, maskBounds.height);
                maskDebugGraphics.setDepth(100001); // Above other bounds
                maskDebugGraphics.setVisible(true);
                
                // Create label text
                const maskLabelY = maskBounds.y - 15;
                const maskLabelX = maskBounds.x + (maskBounds.width / 2);
                const maskLabelStyle = { 
                    font: '11px Arial', 
                    fill: '#00ffff', // Cyan
                    backgroundColor: '#000000', 
                    padding: { x: 3, y: 1 } 
                };
                const maskLabelText = `scratchCover mask\n${maskBounds.width.toFixed(1)}×${maskBounds.height.toFixed(1)}\n(${maskBounds.x.toFixed(1)}, ${maskBounds.y.toFixed(1)})`;
                const maskLabel = scene.add.text(maskLabelX, maskLabelY, maskLabelText, maskLabelStyle);
                maskLabel.setOrigin(0.5, 1);
                maskLabel.setDepth(100002);
                maskLabel.setVisible(true);
                
                // Store debug item
                scene.cardContainerBoundsDebug.push({
                    graphics: maskDebugGraphics,
                    labelText: maskLabel,
                    elementName: 'scratchCover_mask',
                    bounds: maskBounds,
                    element: maskGraphics
                });
                
                log(`CardContainerBounds: Drew bounds for scratchCover mask at (${maskBounds.x.toFixed(1)}, ${maskBounds.y.toFixed(1)}) ${maskBounds.width.toFixed(1)}×${maskBounds.height.toFixed(1)}`, 'layout');
            }
        } catch (maskError) {
            debug(`CardContainerBounds: Could not draw mask bounds: ${maskError.message}`, 'layout');
        }
    }
    
    // Draw scratchBacking bounds for cover container
    // Skip drawing cover_scratchBacking debug box (hide it for now)
    /*
    if (cover && scene && scene.cover_scratchBacking) {
        try {
            const coverBacking = scene.cover_scratchBacking;
            let coverBackingBounds;
            if (typeof coverBacking.getBounds === 'function') {
                coverBackingBounds = coverBacking.getBounds();
            } else {
                const displayWidth = coverBacking.displayWidth || coverBacking.width || 0;
                const displayHeight = coverBacking.displayHeight || coverBacking.height || 0;
                if (displayWidth > 0 && displayHeight > 0) {
                    const coverBackingWorldMatrix = coverBacking.getWorldTransformMatrix();
                    const coverBackingWorldCenter = coverBackingWorldMatrix.transformPoint(0, 0);
                    const coverBackingOriginX = coverBacking.originX || 0.5;
                    const coverBackingOriginY = coverBacking.originY || 0.5;
                    
                    coverBackingBounds = {
                        x: coverBackingWorldCenter.x - (displayWidth * coverBackingOriginX),
                        y: coverBackingWorldCenter.y - (displayHeight * coverBackingOriginY),
                        width: displayWidth,
                        height: displayHeight
                    };
                }
            }
            
            if (coverBackingBounds && coverBackingBounds.width > 0 && coverBackingBounds.height > 0) {
                // Draw cover scratchBacking bounds (yellow color)
                const coverBackingGraphics = scene.add.graphics();
                coverBackingGraphics.lineStyle(2, 0xffff00, 0.9); // Yellow outline, 2px, semi-transparent
                coverBackingGraphics.strokeRect(coverBackingBounds.x, coverBackingBounds.y, coverBackingBounds.width, coverBackingBounds.height);
                coverBackingGraphics.setDepth(99994); // Below text but visible
                coverBackingGraphics.setVisible(true);
                
                // Add label for cover scratchBacking
                const coverBackingLabelY = coverBackingBounds.y - 15;
                const coverBackingLabelX = coverBackingBounds.x + (coverBackingBounds.width / 2);
                const coverBackingLabelStyle = { 
                    font: '11px Arial', 
                    fill: '#ffff00', // Yellow
                    backgroundColor: '#000000', 
                    padding: { x: 3, y: 1 } 
                };
                const coverBackingLabelText = `cover scratchBacking\n${coverBackingBounds.width.toFixed(1)}×${coverBackingBounds.height.toFixed(1)}\n(${coverBackingBounds.x.toFixed(1)}, ${coverBackingBounds.y.toFixed(1)})`;
                const coverBackingLabel = scene.add.text(coverBackingLabelX, coverBackingLabelY, coverBackingLabelText, coverBackingLabelStyle);
                coverBackingLabel.setOrigin(0.5, 1);
                coverBackingLabel.setDepth(100000);
                coverBackingLabel.setVisible(true);
                
                // Store debug item
                scene.cardContainerBoundsDebug.push({
                    graphics: coverBackingGraphics,
                    labelText: coverBackingLabel,
                    elementName: 'cover_scratchBacking',
                    bounds: coverBackingBounds,
                    element: coverBacking
                });
                
                log(`CardContainerBounds: Drew bounds for cover scratchBacking - ${coverBackingBounds.width.toFixed(1)}×${coverBackingBounds.height.toFixed(1)}`, 'layout');
            }
        } catch (coverBackingError) {
            debug(`CardContainerBounds: Could not draw cover scratchBacking bounds: ${coverBackingError.message}`, 'layout');
        }
    }
    */
    
    // Draw messageText bounds if available
    // messageText is now an independent element (not a child of cardContainer)
    // Use getBounds() directly which returns accurate world coordinates
    if (messageText && messageText.visible) {
        let messageBounds;
        try {
            // For text objects, getBounds() is most accurate as it returns world coordinates
            // and dimensions already accounting for all transforms (position, scale)
            // Since messageText is independent, no need to account for parent scaling
            if (typeof messageText.getBounds === 'function') {
                const bounds = messageText.getBounds();
                messageBounds = bounds;
                debug(`CardContainerBounds: messageText (independent) - using getBounds() - x=${bounds.x.toFixed(1)}, y=${bounds.y.toFixed(1)}, width=${bounds.width.toFixed(1)}, height=${bounds.height.toFixed(1)}`, 'layout');
            } else {
                // Fallback: use position and display dimensions directly
                const worldX = messageText.x;
                const worldY = messageText.y;
                const worldWidth = messageText.displayWidth || messageText.width || 0;
                const worldHeight = messageText.displayHeight || messageText.height || 0;
                
                debug(`CardContainerBounds: messageText (independent) - manual calculation - worldPos=(${worldX.toFixed(1)},${worldY.toFixed(1)}), worldSize=(${worldWidth.toFixed(1)},${worldHeight.toFixed(1)})`, 'layout');
                
                if (worldWidth > 0 && worldHeight > 0) {
                    // Text origin is (0.5, 0.5), so center is at world position
                    messageBounds = {
                        x: worldX - (worldWidth / 2),
                        y: worldY - (worldHeight / 2),
                        width: worldWidth,
                        height: worldHeight
                    };
                }
            }
        } catch (boundsError) {
            debug(`CardContainerBounds: Could not get bounds for messageText: ${boundsError.message}`, 'layout');
            messageBounds = null;
        }
        
        if (messageBounds && messageBounds.width > 0 && messageBounds.height > 0) {
            // Draw messageText bounds (yellow color)
            const messageGraphics = scene.add.graphics();
            messageGraphics.lineStyle(2, 0xffff00, 1); // Yellow outline, 2px width, fully opaque
            messageGraphics.strokeRect(messageBounds.x, messageBounds.y, messageBounds.width, messageBounds.height);
            messageGraphics.setDepth(99995); // Just below cardContainer bounds
            messageGraphics.setVisible(true);
            
            // Create label text for messageText
            const messageLabelY = messageBounds.y - 15;
            const messageLabelX = messageBounds.x + (messageBounds.width / 2);
            const messageLabelStyle = { 
                font: '11px Arial', 
                fill: '#ffff00', // Yellow
                backgroundColor: '#000000', 
                padding: { x: 3, y: 1 } 
            };
            
            // Get messageText world position for label
            const messageTextWorldY = messageText.y;
            const messageLabelText = `messageText\n${messageBounds.width.toFixed(1)}×${messageBounds.height.toFixed(1)}\nY: ${messageTextWorldY.toFixed(1)}`;
            const messageLabel = scene.add.text(messageLabelX, messageLabelY, messageLabelText, messageLabelStyle);
            messageLabel.setOrigin(0.5, 1); // Center horizontally, anchor at bottom
            messageLabel.setDepth(100000); // Above everything
            messageLabel.setVisible(true);
            
            // Store debug item for cleanup
            scene.cardContainerBoundsDebug.push({
                graphics: messageGraphics,
                labelText: messageLabel,
                elementName: 'messageText',
                bounds: messageBounds,
                element: messageText
            });
            
            log(`CardContainerBounds: Drew bounds for messageText at (${messageBounds.x.toFixed(1)}, ${messageBounds.y.toFixed(1)}) ${messageBounds.width.toFixed(1)}×${messageBounds.height.toFixed(1)}`, 'layout');
        } else {
            log(`CardContainerBounds: messageText has invalid bounds or could not calculate bounds`, 'layout');
        }
    }
    
    // Draw bounds for card text values (prize values displayed in rows and columns)
    // Find ScoreCard within cardContainer hierarchy: cardContainer -> gameContainer -> scratchContainer -> prefab_ScoreCard
    try {
        let scoreCard = null;
        
        // Search through cardContainer children to find gameContainer
        // Hierarchy: cardContainer -> gameContainer -> scratchContainer -> prefab_ScoreCard
        if (cardContainer.list && Array.isArray(cardContainer.list)) {
            for (let child of cardContainer.list) {
                // gameContainer should be a container (has 'list' property)
                if (child && child.list && Array.isArray(child.list)) {
                    // Search through gameContainer children to find scratchContainer
                    for (let grandChild of child.list) {
                        // scratchContainer should be a container with ScoreCard children
                        if (grandChild && grandChild.list && Array.isArray(grandChild.list)) {
                            // Find ScoreCard (it should have a 'group' property with Prefab_ScoreIcon children)
                            for (let greatGrandChild of grandChild.list) {
                                if (greatGrandChild && greatGrandChild.group && typeof greatGrandChild.group.getChildren === 'function') {
                                    scoreCard = greatGrandChild;
                                    break;
                                }
                            }
                            if (scoreCard) break;
                        }
                    }
                    if (scoreCard) break;
                }
            }
        }
        
        if (scoreCard && scoreCard.group) {
            // Draw backing image bounds (shows full card area)
            if (scoreCard.backing) {
                try {
                    let backingBounds;
                    if (typeof scoreCard.backing.getBounds === 'function') {
                        backingBounds = scoreCard.backing.getBounds();
                    } else {
                        // Fallback: calculate from backing properties
                        // Try to get world bounds through ScoreCard's transform
                        if (typeof scoreCard.getBounds === 'function') {
                            const scoreCardBounds = scoreCard.getBounds();
                            const backingWidth = scoreCard.backing.width || scoreCard.backing.displayWidth || 0;
                            const backingHeight = scoreCard.backing.height || scoreCard.backing.displayHeight || 0;
                            if (backingWidth > 0 && backingHeight > 0) {
                                // Backing is centered in ScoreCard container (at 0,0 relative to container)
                                // Use ScoreCard's world position as reference
                                backingBounds = {
                                    x: scoreCardBounds.x + (scoreCardBounds.width / 2) - (backingWidth / 2),
                                    y: scoreCardBounds.y + (scoreCardBounds.height / 2) - (backingHeight / 2),
                                    width: backingWidth,
                                    height: backingHeight
                                };
                            }
                        } else {
                            // Simple fallback: assume backing is at ScoreCard's world position
                            const backingWidth = scoreCard.backing.width || scoreCard.backing.displayWidth || 0;
                            const backingHeight = scoreCard.backing.height || scoreCard.backing.displayHeight || 0;
                            if (backingWidth > 0 && backingHeight > 0) {
                                backingBounds = {
                                    x: scoreCard.x - (backingWidth / 2),
                                    y: scoreCard.y - (backingHeight / 2),
                                    width: backingWidth,
                                    height: backingHeight
                                };
                            }
                        }
                    }
                    
                    if (backingBounds && backingBounds.width > 0 && backingBounds.height > 0) {
                        // Draw gameContainer scratchBacking bounds (green color)
                        const backingGraphics = scene.add.graphics();
                        backingGraphics.lineStyle(2, 0x00ff00, 0.9); // Green outline, 2px, semi-transparent
                        backingGraphics.strokeRect(backingBounds.x, backingBounds.y, backingBounds.width, backingBounds.height);
                        backingGraphics.setDepth(99994); // Below text but visible
                        backingGraphics.setVisible(true);
                        
                        // Add label for gameContainer scratchBacking showing dimensions and position
                        const backingLabelY = backingBounds.y - 15;
                        const backingLabelX = backingBounds.x + (backingBounds.width / 2);
                        const backingLabelStyle = { 
                            font: '11px Arial', 
                            fill: '#00ff00', // Green
                            backgroundColor: '#000000', 
                            padding: { x: 3, y: 1 } 
                        };
                        const backingLabelText = `gameContainer scratchBacking\n${backingBounds.width.toFixed(1)}×${backingBounds.height.toFixed(1)}\n(${backingBounds.x.toFixed(1)}, ${backingBounds.y.toFixed(1)})`;
                        const backingLabel = scene.add.text(backingLabelX, backingLabelY, backingLabelText, backingLabelStyle);
                        backingLabel.setOrigin(0.5, 1); // Center horizontally, anchor at bottom
                        backingLabel.setDepth(100000); // Above everything
                        backingLabel.setVisible(true);
                        
                        // Store debug item
                        scene.cardContainerBoundsDebug.push({
                            graphics: backingGraphics,
                            labelText: backingLabel,
                            elementName: 'gameContainer_scratchBacking',
                            bounds: backingBounds,
                            element: scoreCard.backing
                        });
                        
                        log(`CardContainerBounds: Drew bounds for gameContainer scratchBacking - ${backingBounds.width.toFixed(1)}×${backingBounds.height.toFixed(1)}`, 'layout');
                    }
                } catch (backingError) {
                    debug(`CardContainerBounds: Could not draw backing bounds: ${backingError.message}`, 'layout');
                }
            }
            
            const tiles = scoreCard.group.getChildren();
            let textBoundsCount = 0;
            let tileBoundsCount = 0;
            
            tiles.forEach((tile, index) => {
                // Draw tile container bounds (the grid cell for each tile)
                try {
                    let tileBounds;
                    // Use getBounds() for accurate world coordinates (accounts for parent transforms and scale)
                    if (typeof tile.getBounds === 'function') {
                        tileBounds = tile.getBounds();
                    } else {
                        // Fallback: calculate from tile properties
                        // Tiles are positioned at (tile.x, tile.y) relative to ScoreCard
                        // Need to account for ScoreCard's world transform
                        const tileWidth = tile.displayWidth || tile.width || 0;
                        const tileHeight = tile.displayHeight || tile.height || 0;
                        if (tileWidth > 0 && tileHeight > 0 && typeof scoreCard.getBounds === 'function') {
                            // Use ScoreCard's world bounds as reference
                            const scoreCardBounds = scoreCard.getBounds();
                            const scoreCardCenterX = scoreCardBounds.x + (scoreCardBounds.width / 2);
                            const scoreCardCenterY = scoreCardBounds.y + (scoreCardBounds.height / 2);
                            // Tile position is relative to ScoreCard center (0,0 in container space)
                            tileBounds = {
                                x: scoreCardCenterX + tile.x - (tileWidth / 2),
                                y: scoreCardCenterY + tile.y - (tileHeight / 2),
                                width: tileWidth,
                                height: tileHeight
                            };
                        }
                    }
                    
                    if (tileBounds && tileBounds.width > 0 && tileBounds.height > 0) {
                        // Draw tile container bounds (blue color)
                        const tileGraphics = scene.add.graphics();
                        tileGraphics.lineStyle(1, 0x0088ff, 0.6); // Blue outline, 1px, semi-transparent
                        tileGraphics.strokeRect(tileBounds.x, tileBounds.y, tileBounds.width, tileBounds.height);
                        tileGraphics.setDepth(99991); // Below padded area
                        tileGraphics.setVisible(true);
                        
                        // Store debug item (only label first tile to avoid clutter)
                        let tileLabel = null;
                        if (index === 0) {
                            const tileLabelY = tileBounds.y - 8;
                            const tileLabelX = tileBounds.x + (tileBounds.width / 2);
                            const tileLabelStyle = { 
                                font: '9px Arial', 
                                fill: '#0088ff', 
                                backgroundColor: '#000000', 
                                padding: { x: 2, y: 1 } 
                            };
                            const tileLabelText = `Tile Container\n[${index}]`;
                            tileLabel = scene.add.text(tileLabelX, tileLabelY, tileLabelText, tileLabelStyle);
                            tileLabel.setOrigin(0.5, 1);
                            tileLabel.setDepth(100000);
                            tileLabel.setVisible(true);
                        }
                        
                        scene.cardContainerBoundsDebug.push({
                            graphics: tileGraphics,
                            labelText: tileLabel,
                            elementName: `tile_${index}`,
                            bounds: tileBounds,
                            element: tile
                        });
                        
                        tileBoundsCount++;
                    }
                } catch (tileBoundsError) {
                    debug(`CardContainerBounds: Could not get bounds for tile container at index ${index}: ${tileBoundsError.message}`, 'layout');
                }
                
                // Draw text bounds (existing code)
                // Each tile is a Prefab_ScoreIcon which has a 'text' property (Phaser.GameObjects.Text)
                if (tile && tile.text && tile.text.visible !== false) {
                    try {
                        let textBounds;
                        
                        // Use getBounds() for accurate world coordinates (accounts for parent transforms)
                        if (typeof tile.text.getBounds === 'function') {
                            const bounds = tile.text.getBounds();
                            textBounds = bounds;
                        } else {
                            // Fallback: calculate from world position using DisplayList
                            // Phaser's DisplayList can compute world coordinates accounting for all parent transforms
                            if (tile.text.parentContainer) {
                                const parentContainer = tile.text.parentContainer;
                                // Get the world transform from the parent
                                const worldMatrix = parentContainer.getWorldTransformMatrix();
                                const localX = tile.text.x;
                                const localY = tile.text.y;
                                
                                // Transform local coordinates to world
                                const worldPoint = worldMatrix.transformPoint(localX, localY);
                                const worldWidth = tile.text.displayWidth || tile.text.width || 0;
                                const worldHeight = tile.text.displayHeight || tile.text.height || 0;
                                
                                if (worldWidth > 0 && worldHeight > 0) {
                                    // Text origin is (0.5, 0.5), so center is at position
                                    textBounds = {
                                        x: worldPoint.x - (worldWidth / 2),
                                        y: worldPoint.y - (worldHeight / 2),
                                        width: worldWidth,
                                        height: worldHeight
                                    };
                                }
                            } else {
                                // Simple fallback: assume text is at world origin if no parent
                                const worldWidth = tile.text.displayWidth || tile.text.width || 0;
                                const worldHeight = tile.text.displayHeight || tile.text.height || 0;
                                if (worldWidth > 0 && worldHeight > 0) {
                                    textBounds = {
                                        x: tile.text.x - (worldWidth / 2),
                                        y: tile.text.y - (worldHeight / 2),
                                        width: worldWidth,
                                        height: worldHeight
                                    };
                                }
                            }
                        }
                        
                        if (textBounds && textBounds.width > 0 && textBounds.height > 0) {
                            // Draw text bounds (green color to distinguish from other debug elements)
                            const textGraphics = scene.add.graphics();
                            textGraphics.lineStyle(1, 0x00ff00, 1); // Green outline, 1px width, fully opaque
                            textGraphics.strokeRect(textBounds.x, textBounds.y, textBounds.width, textBounds.height);
                            textGraphics.setDepth(99994); // Below messageText but above autoPlayOptions
                            textGraphics.setVisible(true);
                            
                            // Create small label text (optional - can be commented out if too cluttered)
                            // Only show label for first few tiles to avoid clutter
                            if (index < 3) {
                                const textLabelY = textBounds.y - 8;
                                const textLabelX = textBounds.x + (textBounds.width / 2);
                                const textLabelStyle = { 
                                    font: '8px Arial', 
                                    fill: '#00ff00', // Green
                                    backgroundColor: '#000000', 
                                    padding: { x: 2, y: 1 } 
                                };
                                
                                const textValue = tile.text.text || tile.value || '';
                                const textLabelText = `${textValue}\n[${index}]`;
                                const textLabel = scene.add.text(textLabelX, textLabelY, textLabelText, textLabelStyle);
                                textLabel.setOrigin(0.5, 1); // Center horizontally, anchor at bottom
                                textLabel.setDepth(100000); // Above everything
                                textLabel.setVisible(true);
                                
                                // Store debug item for cleanup
                                scene.cardContainerBoundsDebug.push({
                                    graphics: textGraphics,
                                    labelText: textLabel,
                                    elementName: `cardText_${index}`,
                                    bounds: textBounds,
                                    element: tile.text
                                });
                            } else {
                                // Store without label for tiles beyond first 3
                                scene.cardContainerBoundsDebug.push({
                                    graphics: textGraphics,
                                    labelText: null,
                                    elementName: `cardText_${index}`,
                                    bounds: textBounds,
                                    element: tile.text
                                });
                            }
                            
                            textBoundsCount++;
                        }
                    } catch (textBoundsError) {
                        debug(`CardContainerBounds: Could not get bounds for card text at index ${index}: ${textBoundsError.message}`, 'layout');
                    }
                }
            });
            
            if (textBoundsCount > 0) {
                log(`CardContainerBounds: Drew bounds for ${textBoundsCount} card text values`, 'layout');
            }
            if (tileBoundsCount > 0) {
                log(`CardContainerBounds: Drew bounds for ${tileBoundsCount} tile containers`, 'layout');
            }
            
            // Draw icon bounds and grid division lines
            if (scoreCard.iconSprites && Array.isArray(scoreCard.iconSprites) && scoreCard.iconSprites.length > 0) {
                let iconBoundsCount = 0;
                
                // Draw bounds for each icon sprite
                scoreCard.iconSprites.forEach((iconSprite, iconIndex) => {
                    if (!iconSprite || !iconSprite.visible) return;
                    
                    try {
                        let iconBounds;
                        if (typeof iconSprite.getBounds === 'function') {
                            iconBounds = iconSprite.getBounds();
                        } else {
                            // Fallback: calculate from icon properties
                            const iconWidth = iconSprite.displayWidth || iconSprite.width || 0;
                            const iconHeight = iconSprite.displayHeight || iconSprite.height || 0;
                            if (iconWidth > 0 && iconHeight > 0) {
                                // Icon origin is (0.5, 0.5), so center is at position
                                iconBounds = {
                                    x: iconSprite.x - (iconWidth / 2),
                                    y: iconSprite.y - (iconHeight / 2),
                                    width: iconWidth,
                                    height: iconHeight
                                };
                            }
                        }
                        
                        if (iconBounds && iconBounds.width > 0 && iconBounds.height > 0) {
                            // Draw icon bounds (red color to distinguish from other debug elements)
                            const iconGraphics = scene.add.graphics();
                            iconGraphics.lineStyle(1, 0xff0000, 0.8); // Red outline, 1px, semi-transparent
                            iconGraphics.strokeRect(iconBounds.x, iconBounds.y, iconBounds.width, iconBounds.height);
                            iconGraphics.setDepth(99990); // Below tiles but visible
                            iconGraphics.setVisible(true);
                            
                            // Store debug item (only label first icon to avoid clutter)
                            let iconLabel = null;
                            if (iconIndex === 0) {
                                const iconLabelY = iconBounds.y - 8;
                                const iconLabelX = iconBounds.x + (iconBounds.width / 2);
                                const iconLabelStyle = { 
                                    font: '9px Arial', 
                                    fill: '#ff0000', 
                                    backgroundColor: '#000000', 
                                    padding: { x: 2, y: 1 } 
                                };
                                const iconLabelText = `Icon\n[${iconIndex}]`;
                                iconLabel = scene.add.text(iconLabelX, iconLabelY, iconLabelText, iconLabelStyle);
                                iconLabel.setOrigin(0.5, 1);
                                iconLabel.setDepth(100000);
                                iconLabel.setVisible(true);
                            }
                            
                            scene.cardContainerBoundsDebug.push({
                                graphics: iconGraphics,
                                labelText: iconLabel,
                                elementName: `icon_${iconIndex}`,
                                bounds: iconBounds,
                                element: iconSprite
                            });
                            
                            iconBoundsCount++;
                        }
                    } catch (iconBoundsError) {
                        debug(`CardContainerBounds: Could not get bounds for icon at index ${iconIndex}: ${iconBoundsError.message}`, 'layout');
                    }
                });
                
                if (iconBoundsCount > 0) {
                    log(`CardContainerBounds: Drew bounds for ${iconBoundsCount} icons`, 'layout');
                }
                
                // Draw grid division lines
                if (scoreCard.backing && scoreCard.width > 0 && scoreCard.height > 0) {
                    try {
                        let backingBounds;
                        if (typeof scoreCard.backing.getBounds === 'function') {
                            backingBounds = scoreCard.backing.getBounds();
                        } else {
                            // Use same fallback logic as above for backing bounds
                            if (typeof scoreCard.getBounds === 'function') {
                                const scoreCardBounds = scoreCard.getBounds();
                                const backingWidth = scoreCard.backing.width || scoreCard.backing.displayWidth || 0;
                                const backingHeight = scoreCard.backing.height || scoreCard.backing.displayHeight || 0;
                                if (backingWidth > 0 && backingHeight > 0) {
                                    backingBounds = {
                                        x: scoreCardBounds.x + (scoreCardBounds.width / 2) - (backingWidth / 2),
                                        y: scoreCardBounds.y + (scoreCardBounds.height / 2) - (backingHeight / 2),
                                        width: backingWidth,
                                        height: backingHeight
                                    };
                                }
                            }
                        }
                        
                        if (backingBounds && backingBounds.width > 0 && backingBounds.height > 0) {
                            // Apply scratchArea parameter to match tile grid calculation
                            // Access theme data from scene's prefab_ScratchManager
                            const theme = scene.prefab_ScratchManager?.themeData;
                            const scratchArea = theme?.cardConfig?.scratchArea !== undefined ? theme.cardConfig.scratchArea : 1.0;
                            
                            // Calculate available area (reduced by scratchArea percentage)
                            const availableWidth = backingBounds.width * scratchArea;
                            const availableHeight = backingBounds.height * scratchArea;
                            
                            // Calculate padding (equal on all sides to center the reduced area)
                            const paddingX = (backingBounds.width - availableWidth) / 2;
                            const paddingY = (backingBounds.height - availableHeight) / 2;
                            
                            // Calculate grid square dimensions from available area
                            const gridSquareWidth = availableWidth / scoreCard.width;
                            const gridSquareHeight = availableHeight / scoreCard.height;
                            
                            // Calculate grid area bounds (centered within backing)
                            const gridAreaX = backingBounds.x + paddingX;
                            const gridAreaY = backingBounds.y + paddingY;
                            
                            const gridGraphics = scene.add.graphics();
                            gridGraphics.lineStyle(1, 0xffffff, 0.5); // White lines, 1px, semi-transparent
                            
                            // Draw vertical grid lines (columns) within the reduced area
                            for (let col = 1; col < scoreCard.width; col++) {
                                const x = gridAreaX + (col * gridSquareWidth);
                                gridGraphics.lineBetween(x, gridAreaY, x, gridAreaY + availableHeight);
                            }
                            
                            // Draw horizontal grid lines (rows) within the reduced area
                            for (let row = 1; row < scoreCard.height; row++) {
                                const y = gridAreaY + (row * gridSquareHeight);
                                gridGraphics.lineBetween(gridAreaX, y, gridAreaX + availableWidth, y);
                            }
                            
                            gridGraphics.setDepth(99989); // Below icons
                            gridGraphics.setVisible(true);
                            
                            scene.cardContainerBoundsDebug.push({
                                graphics: gridGraphics,
                                labelText: null,
                                elementName: 'grid_divisions',
                                bounds: backingBounds,
                                element: null
                            });
                            
                            log(`CardContainerBounds: Drew grid division lines - ${scoreCard.width}×${scoreCard.height} grid`, 'layout');
                        }
                    } catch (gridError) {
                        debug(`CardContainerBounds: Could not draw grid division lines: ${gridError.message}`, 'layout');
                    }
                }
            }
        } else {
            debug(`CardContainerBounds: ScoreCard not found in cardContainer hierarchy`, 'layout');
        }
    } catch (scoreCardError) {
        debug(`CardContainerBounds: Error finding ScoreCard or drawing text bounds: ${scoreCardError.message}`, 'layout');
    }
    
    log(`CardContainerBounds: Debug visualization complete - ${scene.cardContainerBoundsDebug.length} items`, 'layout');
}

/**
 * Draw visual debugging bounds for the autoPlayOptions container and its key elements (radialCounter, buttonGroup, etc.)
 * 
 * NOTE: As of refactoring, autoPlayOptions is now a DOM-based component (not a Phaser container).
 * This function is kept for backwards compatibility but will only handle Phaser containers.
 * DOM-based autoPlayOptions debugging should be handled via browser DevTools.
 * 
 * @param {Object} params - Debug visualization parameters
 * @param {Phaser.Scene} params.scene - The scene instance
 * @param {Phaser.GameObjects.Container|Object} params.autoPlayOptions - The autoPlayOptions container object (Phaser) or DOM component
 */
export function drawAutoPlayOptionsBounds(params) {
    const { scene, autoPlayOptions } = params;
    
    // Check if visual debugging is enabled
    if (!GameConfig.debug.SHOW_AUTO_PLAY_OPTIONS_VISUAL_DEBUGGING) {
        // Clean up any existing debug graphics if debugging is disabled
        if (scene && scene.autoPlayOptionsBoundsDebug) {
            scene.autoPlayOptionsBoundsDebug.forEach(debugItem => {
                if (debugItem.graphics) {
                    debugItem.graphics.clear();
                    debugItem.graphics.destroy();
                }
                if (debugItem.labelText) {
                    debugItem.labelText.destroy();
                }
            });
            scene.autoPlayOptionsBoundsDebug = [];
        }
        return;
    }
    
    // Handle DOM-based autoPlayOptions (new implementation)
    if (autoPlayOptions && typeof autoPlayOptions.modalElement !== 'undefined') {
        // This is the DOM-based AutoPlayOptions component
        // Debug via browser DevTools - the DOM element has class 'autoplay-options-container'
        log(`AutoPlayOptionsBounds: autoPlayOptions is now DOM-based. Use browser DevTools to inspect DOM elements.`, 'layout');
        return;
    }
    
    // Handle Phaser container (old implementation - kept for backwards compatibility)
    if (!scene || !autoPlayOptions || !autoPlayOptions.visible) return;
    
    // Initialize array on scene if it doesn't exist
    if (!scene.autoPlayOptionsBoundsDebug) {
        scene.autoPlayOptionsBoundsDebug = [];
    }
    
    // Clean up existing debug graphics
    scene.autoPlayOptionsBoundsDebug.forEach(debugItem => {
        if (debugItem.graphics) {
            debugItem.graphics.clear();
            debugItem.graphics.destroy();
        }
        if (debugItem.labelText) {
            debugItem.labelText.destroy();
        }
    });
    scene.autoPlayOptionsBoundsDebug = [];
    
    // Draw autoPlayOptions backing bounds (purple/magenta color)
    // Use the backing element (dark gray background) bounds instead of the entire container
    let autoPlayOptionsBounds;
    const backing = autoPlayOptions.backing;
    
    if (backing) {
        try {
            if (typeof backing.getBounds === 'function') {
                autoPlayOptionsBounds = backing.getBounds();
            } else {
                // Fallback: calculate bounds from backing element properties
                // Backing is a rectangle with origin (0.5, 1) at position (0, 0) relative to container
                // Backing size: 500x350
                const backingWidth = backing.width || 500;
                const backingHeight = backing.height || 350;
                
                // Get backing's world position (it's at 0,0 in container coordinates)
                // Container's position is the center-bottom of the backing
                // Since backing origin is (0.5, 1), the world top-left is:
                const worldX = autoPlayOptions.x - (backingWidth / 2);
                const worldY = autoPlayOptions.y - backingHeight;
                
                autoPlayOptionsBounds = {
                    x: worldX,
                    y: worldY,
                    width: backingWidth,
                    height: backingHeight
                };
            }
        } catch (error) {
            log(`AutoPlayOptionsBounds: Could not get bounds for backing: ${error.message}`, 'layout');
            autoPlayOptionsBounds = null;
        }
    } else {
        log(`AutoPlayOptionsBounds: backing element not found on autoPlayOptions`, 'layout');
        autoPlayOptionsBounds = null;
    }
    
    if (autoPlayOptionsBounds && autoPlayOptionsBounds.width > 0 && autoPlayOptionsBounds.height > 0) {
        // Draw autoPlayOptions backing bounds (purple/magenta)
        const containerGraphics = scene.add.graphics();
        containerGraphics.lineStyle(3, 0xff00ff, 1); // Magenta outline, 3px width, fully opaque
        containerGraphics.strokeRect(autoPlayOptionsBounds.x, autoPlayOptionsBounds.y, autoPlayOptionsBounds.width, autoPlayOptionsBounds.height);
        containerGraphics.setDepth(99994); // Below card container debug
        containerGraphics.setVisible(true);
        
        // Create label text
        const labelY = autoPlayOptionsBounds.y - 15;
        const labelX = autoPlayOptionsBounds.x + (autoPlayOptionsBounds.width / 2);
        const labelStyle = { 
            font: '12px Arial', 
            fill: '#ff00ff', // Magenta
            backgroundColor: '#000000', 
            padding: { x: 4, y: 2 } 
        };
        
        const labelText = `autoPlayOptions (backing)\n${autoPlayOptionsBounds.width.toFixed(1)}×${autoPlayOptionsBounds.height.toFixed(1)}`;
        const containerLabel = scene.add.text(labelX, labelY, labelText, labelStyle);
        containerLabel.setOrigin(0.5, 1); // Center horizontally, anchor at bottom
        containerLabel.setDepth(100000); // Above everything
        containerLabel.setVisible(true);
        
        // Store debug item for cleanup
        scene.autoPlayOptionsBoundsDebug.push({
            graphics: containerGraphics,
            labelText: containerLabel,
            elementName: 'autoPlayOptions_backing',
            bounds: autoPlayOptionsBounds,
            element: backing || autoPlayOptions
        });
        
        log(`AutoPlayOptionsBounds: Drew bounds for autoPlayOptions backing at (${autoPlayOptionsBounds.x.toFixed(1)}, ${autoPlayOptionsBounds.y.toFixed(1)}) ${autoPlayOptionsBounds.width.toFixed(1)}×${autoPlayOptionsBounds.height.toFixed(1)}`, 'layout');
    }
    
    // Draw radialCounter bounds (cyan color)
    // RadialCounter_v1 is now positioned at scene level (top-right corner), not inside the popup
    // Try to get it from the scene directly
    let radialCounter = scene.radialCounter || null;
    
    // Fallback: try to find it in the popup (for backwards compatibility)
    if (!radialCounter && autoPlayOptions.list) {
        // Search through the container's children to find RadialCounter_v1
        // Try multiple methods to identify the RadialCounter_v1 instance
        for (let child of autoPlayOptions.list) {
            if (child) {
                // Check by constructor name (works if not minified)
                if (child.constructor && (child.constructor.name === 'RadialCounter_v1' || child.constructor.name === 'RadialCounter')) {
                    radialCounter = child;
                    break;
                }
                // Also check if it has RadialCounter-specific properties
                // RadialCounter_v1 has properties: dial (Image), countText (Text), max (number), bonusContainer (Container)
                if (child.dial && child.countText && typeof child.max === 'number' && child.bonusContainer) {
                    radialCounter = child;
                    break;
                }
            }
        }
    }
    
    if (radialCounter && radialCounter.visible !== false) {
        let radialCounterBounds;
        try {
            if (typeof radialCounter.getBounds === 'function') {
                radialCounterBounds = radialCounter.getBounds();
            } else {
                // Fallback: use position and display dimensions
                const width = radialCounter.displayWidth || 150; // Default radial counter size
                const height = radialCounter.displayHeight || 150;
                // Radial counter origin is typically (0.5, 0.5)
                radialCounterBounds = {
                    x: radialCounter.x - (width / 2),
                    y: radialCounter.y - (height / 2),
                    width: width,
                    height: height
                };
            }
        } catch (error) {
            log(`AutoPlayOptionsBounds: Could not get bounds for radialCounter: ${error.message}`, 'layout');
            radialCounterBounds = null;
        }
        
        if (radialCounterBounds && radialCounterBounds.width > 0 && radialCounterBounds.height > 0) {
            // Draw radialCounter bounds (cyan)
            const radialGraphics = scene.add.graphics();
            radialGraphics.lineStyle(2, 0x00ffff, 1); // Cyan outline, 2px width, fully opaque
            radialGraphics.strokeRect(radialCounterBounds.x, radialCounterBounds.y, radialCounterBounds.width, radialCounterBounds.height);
            radialGraphics.setDepth(99993); // Just below autoPlayOptions bounds
            radialGraphics.setVisible(true);
            
            // Create label text
            const radialLabelY = radialCounterBounds.y - 15;
            const radialLabelX = radialCounterBounds.x + (radialCounterBounds.width / 2);
            const radialLabelStyle = { 
                font: '11px Arial', 
                fill: '#00ffff', // Cyan
                backgroundColor: '#000000', 
                padding: { x: 3, y: 1 } 
            };
            
            const radialLabelText = `radialCounter\n${radialCounterBounds.width.toFixed(1)}×${radialCounterBounds.height.toFixed(1)}`;
            const radialLabel = scene.add.text(radialLabelX, radialLabelY, radialLabelText, radialLabelStyle);
            radialLabel.setOrigin(0.5, 1); // Center horizontally, anchor at bottom
            radialLabel.setDepth(100000); // Above everything
            radialLabel.setVisible(true);
            
            // Store debug item for cleanup
            scene.autoPlayOptionsBoundsDebug.push({
                graphics: radialGraphics,
                labelText: radialLabel,
                elementName: 'radialCounter',
                bounds: radialCounterBounds,
                element: radialCounter
            });
            
            log(`AutoPlayOptionsBounds: Drew bounds for radialCounter at (${radialCounterBounds.x.toFixed(1)}, ${radialCounterBounds.y.toFixed(1)}) ${radialCounterBounds.width.toFixed(1)}×${radialCounterBounds.height.toFixed(1)}`, 'layout');
        }
    } else {
        log(`AutoPlayOptionsBounds: radialCounter not found or not visible`, 'layout');
    }
    
    // Draw buttonSpeed bounds (yellow/gold color)
    const buttonSpeed = autoPlayOptions.buttonSpeed;
    if (buttonSpeed && buttonSpeed.visible !== false) {
        let buttonSpeedBounds;
        try {
            if (typeof buttonSpeed.getBounds === 'function') {
                buttonSpeedBounds = buttonSpeed.getBounds();
            } else {
                // Fallback: use position and display dimensions
                const width = buttonSpeed.displayWidth || buttonSpeed.width || 150;
                const height = buttonSpeed.displayHeight || buttonSpeed.height || 150;
                // Get buttonSpeed's world position
                const worldX = buttonSpeed.x;
                const worldY = buttonSpeed.y;
                // Assume origin is (0.5, 0.5) for buttons typically
                buttonSpeedBounds = {
                    x: worldX - (width / 2),
                    y: worldY - (height / 2),
                    width: width,
                    height: height
                };
            }
        } catch (error) {
            log(`AutoPlayOptionsBounds: Could not get bounds for buttonSpeed: ${error.message}`, 'layout');
            buttonSpeedBounds = null;
        }
        
        if (buttonSpeedBounds && buttonSpeedBounds.width > 0 && buttonSpeedBounds.height > 0) {
            // Draw buttonSpeed bounds (yellow/gold)
            const buttonSpeedGraphics = scene.add.graphics();
            buttonSpeedGraphics.lineStyle(2, 0xffaa00, 1); // Gold/yellow outline, 2px width, fully opaque
            buttonSpeedGraphics.strokeRect(buttonSpeedBounds.x, buttonSpeedBounds.y, buttonSpeedBounds.width, buttonSpeedBounds.height);
            buttonSpeedGraphics.setDepth(99992); // Just below radialCounter bounds
            buttonSpeedGraphics.setVisible(true);
            
            // Create label text
            const buttonSpeedLabelY = buttonSpeedBounds.y - 15;
            const buttonSpeedLabelX = buttonSpeedBounds.x + (buttonSpeedBounds.width / 2);
            const buttonSpeedLabelStyle = { 
                font: '11px Arial', 
                fill: '#ffaa00', // Gold/yellow
                backgroundColor: '#000000', 
                padding: { x: 3, y: 1 } 
            };
            
            const buttonSpeedLabelText = `buttonSpeed\n${buttonSpeedBounds.width.toFixed(1)}×${buttonSpeedBounds.height.toFixed(1)}`;
            const buttonSpeedLabel = scene.add.text(buttonSpeedLabelX, buttonSpeedLabelY, buttonSpeedLabelText, buttonSpeedLabelStyle);
            buttonSpeedLabel.setOrigin(0.5, 1); // Center horizontally, anchor at bottom
            buttonSpeedLabel.setDepth(100000); // Above everything
            buttonSpeedLabel.setVisible(true);
            
            // Store debug item for cleanup
            scene.autoPlayOptionsBoundsDebug.push({
                graphics: buttonSpeedGraphics,
                labelText: buttonSpeedLabel,
                elementName: 'buttonSpeed',
                bounds: buttonSpeedBounds,
                element: buttonSpeed
            });
            
            log(`AutoPlayOptionsBounds: Drew bounds for buttonSpeed at (${buttonSpeedBounds.x.toFixed(1)}, ${buttonSpeedBounds.y.toFixed(1)}) ${buttonSpeedBounds.width.toFixed(1)}×${buttonSpeedBounds.height.toFixed(1)}`, 'layout');
        }
    } else {
        log(`AutoPlayOptionsBounds: buttonSpeed not found or not visible`, 'layout');
    }
    
    log(`AutoPlayOptionsBounds: Debug visualization complete - ${scene.autoPlayOptionsBoundsDebug.length} items`, 'layout');
}

/**
 * Finds the main ScoreCard under cardContainer → gameContainer → scratchContainer (same as drawCardContainerBounds).
 * @param {Phaser.GameObjects.Container | null | undefined} cardContainer
 * @returns {Phaser.GameObjects.Container | null}
 */
function findScoreCardInCardHierarchy(cardContainer) {
    if (!cardContainer?.list || !Array.isArray(cardContainer.list)) {
        return null;
    }
    for (const child of cardContainer.list) {
        if (!child?.list || !Array.isArray(child.list)) {
            continue;
        }
        for (const grandChild of child.list) {
            if (!grandChild?.list || !Array.isArray(grandChild.list)) {
                continue;
            }
            for (const greatGrandChild of grandChild.list) {
                if (
                    greatGrandChild &&
                    greatGrandChild.group &&
                    typeof greatGrandChild.group.getChildren === 'function'
                ) {
                    return greatGrandChild;
                }
            }
        }
    }
    return null;
}

/**
 * Outline each scratch atlas icon (ScoreCard.iconSprites) and prize text (ScoreIcon.text) in world space.
 * Called when SHOW_SCRATCH_BACKING_GRID_VISUAL_DEBUGGING is on (E shortcut).
 *
 * @param {Phaser.Scene} scene
 * @param {Phaser.GameObjects.Container | null} scoreCard
 */
function appendScratchIconAndPrizeTextDebug(scene, scoreCard) {
    if (!scene || !scoreCard) {
        return;
    }

    const iconStroke = 0xff00ff; // magenta — atlas scratch icons on ScoreCard
    const textStroke = 0x00ff66; // green — prize text on tiles

    const icons = scoreCard.iconSprites;
    if (Array.isArray(icons)) {
        icons.forEach((icon, idx) => {
            if (!icon || !icon.active || typeof icon.getBounds !== 'function') {
                return;
            }
            try {
                const b = icon.getBounds();
                if (b.width <= 0 || b.height <= 0) {
                    return;
                }
                const g = scene.add.graphics();
                g.lineStyle(2, iconStroke, 0.95);
                g.strokeRect(b.x, b.y, b.width, b.height);
                g.setDepth(100013);
                g.setVisible(true);
                scene.scratchBackingGridDebug.push({
                    graphics: g,
                    labelText: null,
                    elementName: `scratch_atlas_icon_${idx}`,
                    bounds: b,
                    element: icon
                });
            } catch (err) {
                debug(`ScratchBackingGridDebug: icon ${idx} bounds: ${err.message}`, 'layout');
            }
        });
    }

    const group = scoreCard.group;
    const tiles = group && typeof group.getChildren === 'function' ? group.getChildren() : [];
    tiles.forEach((tile, idx) => {
        const text = tile && tile.text;
        if (!text || !text.visible || typeof text.getBounds !== 'function') {
            return;
        }
        try {
            const b = text.getBounds();
            if (b.width <= 0 || b.height <= 0) {
                return;
            }
            const g = scene.add.graphics();
            g.lineStyle(2, textStroke, 0.95);
            g.strokeRect(b.x, b.y, b.width, b.height);
            g.setDepth(100013);
            g.setVisible(true);
            scene.scratchBackingGridDebug.push({
                graphics: g,
                labelText: null,
                elementName: `prize_text_${idx}`,
                bounds: b,
                element: text
            });
        } catch (err) {
            debug(`ScratchBackingGridDebug: prize text ${idx} bounds: ${err.message}`, 'layout');
        }
    });

    log('ScratchBackingGridDebug: Magenta = atlas scratch icons, green = prize text (world bounds)', 'layout');
}

/**
 * Visual debug: scratch backing image bounds and the card icon grid (columns × rows from game config),
 * using the same scratchArea inset as ScoreCard / prize layout (see drawCardContainerBounds grid).
 *
 * @param {Object} params
 * @param {Phaser.Scene} params.scene
 */
export function drawScratchBackingGridDebug(params) {
    const { scene } = params;

    const cleanup = () => {
        if (!scene || !scene.scratchBackingGridDebug) {
            return;
        }
        scene.scratchBackingGridDebug.forEach((debugItem) => {
            if (debugItem.graphics) {
                debugItem.graphics.clear();
                debugItem.graphics.destroy();
            }
            if (debugItem.labelText) {
                debugItem.labelText.destroy();
            }
        });
        scene.scratchBackingGridDebug = [];
    };

    if (!GameConfig.debug.SHOW_SCRATCH_BACKING_GRID_VISUAL_DEBUGGING) {
        cleanup();
        return;
    }

    if (!scene) {
        return;
    }

    cleanup();
    scene.scratchBackingGridDebug = [];

    const scoreCard = scene.prefab_ScoreCard || findScoreCardInCardHierarchy(scene.cardContainer);
    const mss = scene.main_ScratchSurface;
    const sm = scene.prefab_ScratchManager;

    /** @type {{ x: number, y: number, width: number, height: number } | null} */
    let backingBounds = null;
    if (scoreCard?.backing && typeof scoreCard.backing.getBounds === 'function') {
        try {
            backingBounds = scoreCard.backing.getBounds();
        } catch (_) {
            backingBounds = null;
        }
    }
    if (
        (!backingBounds || backingBounds.width <= 0 || backingBounds.height <= 0) &&
        mss?.maskBounds &&
        mss.maskBounds.width > 0 &&
        mss.maskBounds.height > 0
    ) {
        backingBounds = mss.maskBounds;
    }

    if (!backingBounds || backingBounds.width <= 0 || backingBounds.height <= 0) {
        debug('ScratchBackingGridDebug: No backing or mask bounds', 'layout');
        return;
    }

    const backingGraphics = scene.add.graphics();
    backingGraphics.lineStyle(3, 0xff0000, 1);
    backingGraphics.strokeRect(backingBounds.x, backingBounds.y, backingBounds.width, backingBounds.height);
    backingGraphics.setDepth(100010);
    backingGraphics.setVisible(true);

    const theme = sm?.themeData;
    const scratchArea =
        theme?.cardConfig?.scratchArea !== undefined ? theme.cardConfig.scratchArea : 1.0;

    // Inset rect: same math as Prefab_ScoreCard (scratchArea × backing size, centered on backing).
    const availableWidth = backingBounds.width * scratchArea;
    const availableHeight = backingBounds.height * scratchArea;
    const paddingX = (backingBounds.width - availableWidth) / 2;
    const paddingY = (backingBounds.height - availableHeight) / 2;
    const gridAreaX = backingBounds.x + paddingX;
    const gridAreaY = backingBounds.y + paddingY;

    let scratchAreaGraphics = null;
    if (scratchArea < 0.999) {
        scratchAreaGraphics = scene.add.graphics();
        scratchAreaGraphics.lineStyle(2, 0xffff00, 1);
        scratchAreaGraphics.strokeRect(gridAreaX, gridAreaY, availableWidth, availableHeight);
        scratchAreaGraphics.setDepth(100010);
        scratchAreaGraphics.setVisible(true);
    }

    // Grid size from game config (session or ?config=); matches Prefab_ScratchManager.iconsX/iconsY.
    const grid = getScratchGridFromGameConfig(gameConfig);
    const cols = grid.columns;
    const rows = grid.rows;

    const labelStyle = {
        font: '12px Arial',
        fill: '#ff0000',
        backgroundColor: '#000000',
        padding: { x: 4, y: 2 }
    };
    const gridLabel =
        cols > 0 && rows > 0
            ? `scratchBacking (full)\ncard grid ${cols}×${rows}\nscratchArea ${scratchArea}`
            : 'scratchBacking (full)\n(card grid: invalid game-config columns/rows)\nscratchArea ' + scratchArea;
    const insetLine =
        scratchArea < 0.999
            ? `\nyellow = scratchArea ${availableWidth.toFixed(1)}×${availableHeight.toFixed(1)}`
            : '\nscratchArea 1.0 (same as full bounds)';
    const iconTextLegend = '\nmagenta = atlas icons · green = prize text';
    const backingLabelText = `${gridLabel}\n${backingBounds.width.toFixed(1)}×${backingBounds.height.toFixed(1)}${insetLine}${iconTextLegend}`;
    const backingLabel = scene.add.text(
        backingBounds.x + backingBounds.width / 2,
        backingBounds.y - 8,
        backingLabelText,
        labelStyle
    );
    backingLabel.setOrigin(0.5, 1);
    backingLabel.setDepth(100012);
    backingLabel.setVisible(true);

    scene.scratchBackingGridDebug.push({
        graphics: backingGraphics,
        labelText: backingLabel,
        elementName: 'scratchBacking_outline',
        bounds: backingBounds,
        element: null
    });

    if (scratchAreaGraphics) {
        scene.scratchBackingGridDebug.push({
            graphics: scratchAreaGraphics,
            labelText: null,
            elementName: 'scratchBacking_scratchArea_inset',
            bounds: { x: gridAreaX, y: gridAreaY, width: availableWidth, height: availableHeight },
            element: null
        });
    }

    if (cols <= 0 || rows <= 0) {
        log('ScratchBackingGridDebug: Outline + scratchArea rect only (game-config columns/rows missing or invalid)', 'layout');
        appendScratchIconAndPrizeTextDebug(scene, scoreCard);
        return;
    }

    const gridSquareWidth = availableWidth / cols;
    const gridSquareHeight = availableHeight / rows;

    const gridGraphics = scene.add.graphics();
    gridGraphics.lineStyle(1, 0xff0000, 0.65);

    for (let col = 1; col < cols; col++) {
        const x = gridAreaX + col * gridSquareWidth;
        gridGraphics.lineBetween(x, gridAreaY, x, gridAreaY + availableHeight);
    }
    for (let row = 1; row < rows; row++) {
        const y = gridAreaY + row * gridSquareHeight;
        gridGraphics.lineBetween(gridAreaX, y, gridAreaX + availableWidth, y);
    }

    gridGraphics.setDepth(100011);
    gridGraphics.setVisible(true);

    scene.scratchBackingGridDebug.push({
        graphics: gridGraphics,
        labelText: null,
        elementName: 'card_icon_grid_on_backing',
        bounds: { x: gridAreaX, y: gridAreaY, width: availableWidth, height: availableHeight },
        element: null
    });

    appendScratchIconAndPrizeTextDebug(scene, scoreCard);

    log(`ScratchBackingGridDebug: Card grid ${cols}×${rows} on backing (scratchArea ${scratchArea})`, 'layout');
}
