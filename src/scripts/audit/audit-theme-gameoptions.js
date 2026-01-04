#!/usr/bin/env node
/**
 * Theme Grid Dimensions Audit Script
 * -----------------------------------
 * Audits all theme JSON files and groups themes by iconAmountWidth x iconAmountHeight combinations.
 * 
 * Usage:
 *   node scripts/audit/audit-theme-gameoptions.js
 */

const fs = require('fs');
const path = require('path');

// Constants
const THEMES_DIR = path.join(__dirname, '..', '..', 'Themes');

/**
 * Find all theme JSON files in the Themes directory
 */
function findThemeFiles() {
    if (!fs.existsSync(THEMES_DIR)) {
        console.error(`Error: Themes directory not found at ${THEMES_DIR}`);
        process.exit(1);
    }

    const files = fs.readdirSync(THEMES_DIR);
    return files
        .filter(file => file.endsWith('.json'))
        .map(file => path.join(THEMES_DIR, file))
        .sort();
}

/**
 * Parse a theme JSON file
 */
function parseThemeFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`Error parsing ${path.basename(filePath)}:`, error.message);
        return null;
    }
}

/**
 * Create a key for grouping by iconAmountWidth x iconAmountHeight
 */
function getGridDimensionKey(gameOptions) {
    if (!gameOptions || typeof gameOptions !== 'object') {
        return null;
    }
    
    const width = gameOptions.iconAmountWidth;
    const height = gameOptions.iconAmountHeight;
    
    if (width === undefined || height === undefined) {
        return null;
    }
    
    return `${width}x${height}`;
}

/**
 * Audit all theme files and group by iconAmountWidth x iconAmountHeight
 */
function auditThemeGameOptions() {
    const themeFiles = findThemeFiles();
    const gridMap = new Map(); // Map<"widthxheight", {width, height, themes[]}>
    
    console.log(`\n🔍 Scanning ${themeFiles.length} theme files...\n`);

    for (const themeFile of themeFiles) {
        const themeName = path.basename(themeFile, '.json');
        const themeData = parseThemeFile(themeFile);
        
        if (!themeData) {
            continue;
        }

        const gameOptions = themeData.gameOptions;
        if (!gameOptions) {
            console.warn(`⚠️  Warning: ${themeName} has no gameOptions`);
            continue;
        }

        const gridKey = getGridDimensionKey(gameOptions);
        if (!gridKey) {
            console.warn(`⚠️  Warning: ${themeName} is missing iconAmountWidth or iconAmountHeight`);
            continue;
        }
        
        if (!gridMap.has(gridKey)) {
            gridMap.set(gridKey, {
                width: gameOptions.iconAmountWidth,
                height: gameOptions.iconAmountHeight,
                themes: []
            });
        }
        
        gridMap.get(gridKey).themes.push(themeName);
    }

    return gridMap;
}

/**
 * Display audit report
 */
function displayReport(gridMap) {
    console.log('='.repeat(70));
    console.log('Theme Grid Dimensions Audit Report');
    console.log('='.repeat(70));
    console.log(`Total unique grid dimension combinations: ${gridMap.size}\n`);

    // Sort by grid dimensions (width first, then height)
    const sortedEntries = Array.from(gridMap.entries())
        .sort((a, b) => {
            const [widthA, heightA] = a[0].split('x').map(Number);
            const [widthB, heightB] = b[0].split('x').map(Number);
            if (widthA !== widthB) {
                return widthA - widthB;
            }
            return heightA - heightB;
        });

    let groupNumber = 1;
    for (const [gridKey, { width, height, themes }] of sortedEntries) {
        console.log(`\n${'─'.repeat(70)}`);
        console.log(`Group ${groupNumber}: ${width}x${height} grid (${width} columns × ${height} rows)`);
        console.log(`${'─'.repeat(70)}`);
        console.log(`Themes (${themes.length}): ${themes.join(', ')}`);
        
        groupNumber++;
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`Summary: ${gridMap.size} unique grid dimension combinations found`);
    console.log(`         across ${Array.from(gridMap.values()).reduce((sum, group) => sum + group.themes.length, 0)} theme files`);
    console.log('='.repeat(70) + '\n');
}

/**
 * Main execution
 */
function main() {
    console.log('Theme Grid Dimensions Audit Script');
    console.log('===================================\n');

    // Perform audit
    const gridMap = auditThemeGameOptions();

    // Display report
    displayReport(gridMap);
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = {
    findThemeFiles,
    parseThemeFile,
    getGridDimensionKey,
    auditThemeGameOptions
};

