#!/usr/bin/env node
/**
 * Theme Image Audit Script
 * -------------------------
 * Audits all theme JSON files to verify that referenced images actually exist.
 * Optionally removes references to missing images after user confirmation.
 * 
 * Usage:
 *   node scripts/audit-theme-images.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Constants
const THEMES_DIR = path.join(__dirname, '..', 'Themes');
const ASSETS_DIR = path.join(__dirname, '..', 'assets', 'Images');
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

// Create readline interface for user prompts
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

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
 * Extract image definitions from theme JSON object
 * Supports both old format (images at top level) and new format (images in images block)
 */
function extractImageDefinitions(themeData) {
    const images = [];
    
    if (!themeData || typeof themeData !== 'object') {
        return images;
    }

    // Check if theme uses new format with images block
    const imageSource = themeData.images && typeof themeData.images === 'object' 
        ? themeData.images 
        : themeData;

    for (const [entryKey, entryValue] of Object.entries(imageSource)) {
        // Check if this entry is an image definition
        if (entryValue && typeof entryValue === 'object' && entryValue.type === 'image') {
            images.push({
                entryKey: entryKey,
                key: entryValue.key || '',
                imageKey: entryValue.imageKey || '',
                imageWidth: entryValue.imageWidth,
                imageHeight: entryValue.imageHeight,
                description: entryValue.description || ''
            });
        }
    }

    return images;
}

/**
 * Check if an image file exists at the expected path
 */
function checkImageExists(imageDef) {
    // Skip if imageKey is empty (already handled by loader)
    if (!imageDef.imageKey || imageDef.imageKey === '') {
        return { exists: true, skipped: true, reason: 'empty imageKey' };
    }

    // Skip remote URLs (external resources)
    if (imageDef.imageKey.startsWith('http://') || imageDef.imageKey.startsWith('https://')) {
        return { exists: true, skipped: true, reason: 'remote URL' };
    }

    // Build the expected path: assets/Images/${key}/${imageKey}.png
    const imageDir = path.join(ASSETS_DIR, imageDef.key);
    
    // Check for different file extensions
    for (const ext of IMAGE_EXTENSIONS) {
        const imagePath = path.join(imageDir, `${imageDef.imageKey}${ext}`);
        if (fs.existsSync(imagePath)) {
            return { exists: true, path: imagePath };
        }
    }

    // If not found, return the expected path for reporting
    const expectedPath = path.join(ASSETS_DIR, imageDef.key, `${imageDef.imageKey}.png`);
    return { 
        exists: false, 
        path: expectedPath,
        relativePath: `assets/Images/${imageDef.key}/${imageDef.imageKey}.png`
    };
}

/**
 * Audit all theme files
 */
function auditThemeFiles() {
    const themeFiles = findThemeFiles();
    const auditResults = {
        themesChecked: 0,
        totalImagesChecked: 0,
        totalImagesSkipped: 0,
        totalMissingImages: 0,
        missingByTheme: {}
    };

    console.log(`\n🔍 Scanning ${themeFiles.length} theme files...\n`);

    for (const themeFile of themeFiles) {
        const themeName = path.basename(themeFile);
        const themeData = parseThemeFile(themeFile);
        
        if (!themeData) {
            continue;
        }

        auditResults.themesChecked++;
        const images = extractImageDefinitions(themeData);
        const missingImages = [];

        for (const imageDef of images) {
            auditResults.totalImagesChecked++;
            const checkResult = checkImageExists(imageDef);

            if (checkResult.skipped) {
                auditResults.totalImagesSkipped++;
                continue;
            }

            if (!checkResult.exists) {
                auditResults.totalMissingImages++;
                missingImages.push({
                    ...imageDef,
                    expectedPath: checkResult.relativePath
                });
            }
        }

        if (missingImages.length > 0) {
            auditResults.missingByTheme[themeName] = missingImages;
        }
    }

    return auditResults;
}

/**
 * Display audit report
 */
function displayReport(auditResults) {
    console.log('\n' + '='.repeat(60));
    console.log('Theme Image Audit Report');
    console.log('='.repeat(60));
    console.log(`Themes checked: ${auditResults.themesChecked}`);
    console.log(`Total images checked: ${auditResults.totalImagesChecked}`);
    console.log(`Images skipped (empty/remote): ${auditResults.totalImagesSkipped}`);
    console.log(`Missing images found: ${auditResults.totalMissingImages}`);
    console.log('');

    if (auditResults.totalMissingImages === 0) {
        console.log('✅ All theme images exist! No issues found.\n');
        return;
    }

    console.log('Missing Images by Theme:');
    console.log('-'.repeat(60));

    for (const [themeName, missingImages] of Object.entries(auditResults.missingByTheme)) {
        console.log(`\n${themeName}:`);
        for (const img of missingImages) {
            console.log(`  - ${img.entryKey} (key: "${img.key}"):`);
            console.log(`    Expected: ${img.expectedPath}`);
            if (img.description) {
                console.log(`    Description: ${img.description}`);
            }
        }
    }
    console.log('');
}

/**
 * Remove missing image references from theme files
 * Supports both old format (images at top level) and new format (images in images block)
 */
function removeMissingImages(auditResults) {
    const changesSummary = {
        filesModified: 0,
        entriesRemoved: 0
    };

    for (const [themeName, missingImages] of Object.entries(auditResults.missingByTheme)) {
        const themePath = path.join(THEMES_DIR, themeName);
        const themeData = parseThemeFile(themePath);
        
        if (!themeData) {
            continue;
        }

        let modified = false;
        
        // Determine if theme uses new format (images block) or old format (top level)
        const hasImagesBlock = themeData.images && typeof themeData.images === 'object';
        const imageSource = hasImagesBlock ? themeData.images : themeData;
        
        // Remove entries for missing images
        for (const missingImg of missingImages) {
            if (imageSource.hasOwnProperty(missingImg.entryKey)) {
                delete imageSource[missingImg.entryKey];
                modified = true;
                changesSummary.entriesRemoved++;
            }
        }

        if (modified) {
            // Write the modified theme file
            const updatedContent = JSON.stringify(themeData, null, 2) + '\n';
            fs.writeFileSync(themePath, updatedContent, 'utf8');
            changesSummary.filesModified++;
            console.log(`✅ Updated ${themeName}`);
        }
    }

    return changesSummary;
}

/**
 * Prompt user for confirmation
 */
function promptUser(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.toLowerCase().trim());
        });
    });
}

/**
 * Main execution
 */
async function main() {
    console.log('Theme Image Audit Script');
    console.log('========================\n');

    // Check if assets directory exists
    if (!fs.existsSync(ASSETS_DIR)) {
        console.error(`Error: Assets directory not found at ${ASSETS_DIR}`);
        process.exit(1);
    }

    // Perform audit
    const auditResults = auditThemeFiles();

    // Display report
    displayReport(auditResults);

    // If no missing images, exit
    if (auditResults.totalMissingImages === 0) {
        rl.close();
        process.exit(0);
    }

    // Prompt for cleanup
    const answer = await promptUser('Do you want to remove missing image references? (y/n): ');
    
    if (answer === 'y' || answer === 'yes') {
        console.log('\nRemoving missing image references...\n');
        const changes = removeMissingImages(auditResults);
        
        console.log('\n' + '='.repeat(60));
        console.log('Cleanup Summary');
        console.log('='.repeat(60));
        console.log(`Files modified: ${changes.filesModified}`);
        console.log(`Entries removed: ${changes.entriesRemoved}`);
        console.log('\n✅ Cleanup complete!\n');
    } else {
        console.log('\nCleanup cancelled. No changes made.\n');
    }

    rl.close();
}

// Run the script
if (require.main === module) {
    main().catch(error => {
        console.error('Error:', error);
        rl.close();
        process.exit(1);
    });
}

module.exports = {
    findThemeFiles,
    parseThemeFile,
    extractImageDefinitions,
    checkImageExists,
    auditThemeFiles,
    removeMissingImages
};

