#!/usr/bin/env node
/**
 * Game Config Audit Script
 * ------------------------
 * Audits game-config.js to verify that all referenced config files actually exist.
 * 
 * Usage:
 *   node scripts/audit/audit-game-config.js
 */

const fs = require('fs');
const path = require('path');

// Constants
const CONFIG_DIR = path.join(__dirname, '..', '..', 'src', 'config');
const GAME_CONFIG_FILE = path.join(CONFIG_DIR, 'game-config.js');

/**
 * Read and parse game-config.js file
 */
function readGameConfigFile() {
    if (!fs.existsSync(GAME_CONFIG_FILE)) {
        console.error(`Error: game-config.js not found at ${GAME_CONFIG_FILE}`);
        process.exit(1);
    }

    try {
        return fs.readFileSync(GAME_CONFIG_FILE, 'utf8');
    } catch (error) {
        console.error(`Error reading game-config.js:`, error.message);
        process.exit(1);
    }
}

/**
 * Extract import statements from game-config.js
 * Returns array of { importName, fileName, configKey }
 */
function extractImports(content) {
    const imports = [];
    
    // Match import statements: import nameConfig from './name.js';
    const importRegex = /import\s+(\w+Config)\s+from\s+['"]\.\/([\w-]+)\.js['"];?/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
        const importName = match[1]; // e.g., "piggyConfig"
        const fileName = match[2];   // e.g., "piggy"
        imports.push({
            importName,
            fileName,
            filePath: path.join(CONFIG_DIR, `${fileName}.js`)
        });
    }
    
    return imports;
}

/**
 * Extract AVAILABLE_CONFIGS object keys
 * Returns array of config keys
 */
function extractConfigKeys(content) {
    const configKeys = [];
    
    // Match entries in AVAILABLE_CONFIGS object
    // Pattern: 'key-name': configName,
    const configKeyRegex = /['"]([\w-]+)['"]\s*:\s*(\w+Config)/g;
    let match;
    
    while ((match = configKeyRegex.exec(content)) !== null) {
        const configKey = match[1];      // e.g., "piggy"
        const configValue = match[2];    // e.g., "piggyConfig"
        configKeys.push({
            key: configKey,
            value: configValue
        });
    }
    
    return configKeys;
}

/**
 * Check if a config file exists
 */
function checkConfigFileExists(filePath) {
    return fs.existsSync(filePath);
}

/**
 * Audit game-config.js and referenced config files
 */
function auditGameConfig() {
    const content = readGameConfigFile();
    const imports = extractImports(content);
    const configKeys = extractConfigKeys(content);
    
    const auditResults = {
        importsFound: imports.length,
        configKeysFound: configKeys.length,
        missingFiles: [],
        orphanedImports: [], // imports that don't have a corresponding config key
        orphanedKeys: [],    // config keys that don't have a corresponding import
        mismatchedKeys: []   // config keys where key name doesn't match import file name
    };
    
    console.log(`\n🔍 Scanning game-config.js...\n`);
    console.log(`Found ${imports.length} import statements`);
    console.log(`Found ${configKeys.length} config keys\n`);
    
    // Create maps for easier lookup
    const importsByFileName = new Map();
    const importsByImportName = new Map();
    const configKeysByKey = new Map();
    const configKeysByValue = new Map();
    
    imports.forEach(imp => {
        importsByFileName.set(imp.fileName, imp);
        importsByImportName.set(imp.importName, imp);
    });
    
    configKeys.forEach(ck => {
        configKeysByKey.set(ck.key, ck);
        configKeysByValue.set(ck.value, ck);
    });
    
    // Check if imported files exist
    for (const imp of imports) {
        if (!checkConfigFileExists(imp.filePath)) {
            auditResults.missingFiles.push({
                importName: imp.importName,
                fileName: imp.fileName,
                expectedPath: imp.filePath,
                relativePath: `src/config/${imp.fileName}.js`
            });
        }
        
        // Check if import has a corresponding config key
        const configKey = configKeysByKey.get(imp.fileName);
        if (!configKey) {
            auditResults.orphanedImports.push({
                importName: imp.importName,
                fileName: imp.fileName,
                reason: 'No corresponding key in AVAILABLE_CONFIGS'
            });
        } else if (configKey.value !== imp.importName) {
            auditResults.mismatchedKeys.push({
                fileName: imp.fileName,
                importName: imp.importName,
                configKey: configKey.key,
                configValue: configKey.value,
                expectedValue: imp.importName
            });
        }
    }
    
    // Check if config keys have corresponding imports
    for (const ck of configKeys) {
        const importMatch = importsByFileName.get(ck.key);
        if (!importMatch) {
            auditResults.orphanedKeys.push({
                key: ck.key,
                value: ck.value,
                reason: 'No corresponding import statement'
            });
        }
    }
    
    return auditResults;
}

/**
 * Display audit report
 */
function displayReport(auditResults) {
    console.log('='.repeat(70));
    console.log('Game Config Audit Report');
    console.log('='.repeat(70));
    console.log(`Import statements found: ${auditResults.importsFound}`);
    console.log(`Config keys found: ${auditResults.configKeysFound}`);
    console.log('');
    
    let hasIssues = false;
    
    // Report missing files
    if (auditResults.missingFiles.length > 0) {
        hasIssues = true;
        console.log('❌ Missing Config Files:');
        console.log('-'.repeat(70));
        for (const missing of auditResults.missingFiles) {
            console.log(`  - ${missing.importName} (${missing.fileName}.js)`);
            console.log(`    Expected: ${missing.relativePath}`);
        }
        console.log('');
    }
    
    // Report orphaned imports
    if (auditResults.orphanedImports.length > 0) {
        hasIssues = true;
        console.log('⚠️  Orphaned Imports (no corresponding config key):');
        console.log('-'.repeat(70));
        for (const orphaned of auditResults.orphanedImports) {
            console.log(`  - ${orphaned.importName} (${orphaned.fileName}.js)`);
            console.log(`    ${orphaned.reason}`);
        }
        console.log('');
    }
    
    // Report orphaned keys
    if (auditResults.orphanedKeys.length > 0) {
        hasIssues = true;
        console.log('⚠️  Orphaned Config Keys (no corresponding import):');
        console.log('-'.repeat(70));
        for (const orphaned of auditResults.orphanedKeys) {
            console.log(`  - '${orphaned.key}': ${orphaned.value}`);
            console.log(`    ${orphaned.reason}`);
        }
        console.log('');
    }
    
    // Report mismatched keys
    if (auditResults.mismatchedKeys.length > 0) {
        hasIssues = true;
        console.log('⚠️  Mismatched Config Keys (key name doesn\'t match import):');
        console.log('-'.repeat(70));
        for (const mismatch of auditResults.mismatchedKeys) {
            console.log(`  - Config key: '${mismatch.configKey}'`);
            console.log(`    Import name: ${mismatch.importName}`);
            console.log(`    Config value: ${mismatch.configValue} (expected: ${mismatch.expectedValue})`);
        }
        console.log('');
    }
    
    if (!hasIssues) {
        console.log('✅ All config files exist and are properly referenced!');
        console.log('✅ All imports have corresponding config keys!');
        console.log('✅ All config keys have corresponding imports!');
        console.log('');
    }
    
    console.log('='.repeat(70));
    console.log(`Summary:`);
    console.log(`  - Missing files: ${auditResults.missingFiles.length}`);
    console.log(`  - Orphaned imports: ${auditResults.orphanedImports.length}`);
    console.log(`  - Orphaned keys: ${auditResults.orphanedKeys.length}`);
    console.log(`  - Mismatched keys: ${auditResults.mismatchedKeys.length}`);
    console.log('='.repeat(70) + '\n');
}

/**
 * Main execution
 */
function main() {
    console.log('Game Config Audit Script');
    console.log('========================\n');
    
    // Check if config directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
        console.error(`Error: Config directory not found at ${CONFIG_DIR}`);
        process.exit(1);
    }
    
    // Perform audit
    const auditResults = auditGameConfig();
    
    // Display report
    displayReport(auditResults);
    
    // Exit with error code if issues found
    if (auditResults.missingFiles.length > 0 || 
        auditResults.orphanedImports.length > 0 || 
        auditResults.orphanedKeys.length > 0 ||
        auditResults.mismatchedKeys.length > 0) {
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = {
    readGameConfigFile,
    extractImports,
    extractConfigKeys,
    checkConfigFileExists,
    auditGameConfig
};

