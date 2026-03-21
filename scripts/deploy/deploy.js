#!/usr/bin/env node
/**
 * Sync & Invalidate Helper
 * ------------------------
 * This script runs the S3 upload sync script first, then triggers a CloudFront
 * invalidation for the same paths (or /* when no paths were provided).
 *
 * Default: Runs Vite build pipeline (npm run build), then syncs dist/ to S3.
 *
 * Usage examples:
 *   node scripts/deploy/deploy.js
 *   node scripts/deploy/deploy.js --dry-run
 *   node scripts/deploy/deploy.js --no-build
 *   node scripts/deploy/deploy.js --raw
 *   node scripts/deploy/deploy.js /Themes /css --yes
 *   node scripts/deploy/deploy.js /Themes --preview-paths
 *
 * Behavior:
 *   - Default: Runs build, then sync_to_s3.py with --production (dist/ output).
 *   - With --raw: Syncs raw source (no build, DEFAULT_PATHS from project root).
 *   - Then runs sync_game_catalog.py (DynamoDB GameCatalog from src/config/game).
 *   - Afterwards runs invalidate_cloudfront.py with the same paths (uses default domain).
 *     When no paths were provided it invalidates /*.
 *   - If index.html or /index.html is included in the paths, it always invalidates both / and /index.html.
 *
 * Flags forwarded to upload script:
 *   --dry-run, --force, --yes, --preview-paths, --bucket <value>, --prefix <value>, --region <value>
 *
 * Flags forwarded to invalidation script:
 *   --skip-watch, --interval <value>
 *
 * Helper-specific flags:
 *   --python-path <value>   Use a specific python executable (default: python)
 *   --invalidate-all        Invalidate everything in the S3 prefix folder (e.g., /games/pull-tabs/*)
 *                           instead of using the same paths as sync phase
 *   --preview-paths         Show detailed preview for each path before summary (forwarded to sync script)
 *   --raw                   Sync raw source (no build, no Vite). Uses DEFAULT_PATHS from project root.
 *   --no-build              Skip build step when using default Vite deploy (sync existing dist/ only).
 *                           Ignored when --raw is used.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const UPLOAD_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'aws', 's3', 'sync_to_s3.py');
const GAME_CATALOG_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'aws', 'dynamo', 'sync_game_catalog.py');
const INVALIDATE_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'aws', 'cloudfront', 'invalidate_cloudfront.py');

// Default S3 prefix - read from aws_config.py
// This function extracts S3_PREFIX from the Python config file
function getS3PrefixFromConfig() {
  const fs = require('fs');
  const path = require('path');
  const configPath = path.join(PROJECT_ROOT, 'scripts', 'aws', 'aws_config.py');
  
  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    // Extract S3_PREFIX value using regex
    const match = configContent.match(/S3_PREFIX\s*=\s*['"]([^'"]+)['"]/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (error) {
    console.warn(`⚠️  Could not read aws_config.py, using fallback: ${error.message}`);
  }
  
  // Fallback if we can't read the config
  return 'games/pull-tabs/';
}

const DEFAULT_S3_PREFIX = getS3PrefixFromConfig();

const BOOLEAN_FLAGS = new Set(['--dry-run', '--force', '--yes', '--preview-paths']);
const VALUE_FLAGS = new Set(['--bucket', '--prefix', '--region', '--python-path']);

// Flags that should be forwarded to the invalidation script
const INVALIDATION_BOOLEAN_FLAGS = new Set(['--skip-watch']);
const INVALIDATION_VALUE_FLAGS = new Set(['--interval']);

// Helper-specific flags (not forwarded to either script)
const HELPER_BOOLEAN_FLAGS = new Set(['--invalidate-all', '--no-build', '--raw']);

function parseArgs(rawArgs) {
  const paths = [];
  const uploadArgs = [];
  const invalidationArgs = [];
  let pythonPath = process.env.PYTHON || 'python';
  let invalidateAll = false;
  let noBuild = false;
  let raw = false;
  let s3Prefix = DEFAULT_S3_PREFIX;

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];

    if (arg.startsWith('--')) {
      if (HELPER_BOOLEAN_FLAGS.has(arg)) {
        if (arg === '--invalidate-all') {
          invalidateAll = true;
        } else if (arg === '--no-build') {
          noBuild = true;
        } else if (arg === '--raw') {
          raw = true;
        }
      } else if (BOOLEAN_FLAGS.has(arg)) {
        uploadArgs.push(arg);
      } else if (VALUE_FLAGS.has(arg)) {
        const value = rawArgs[i + 1];
        if (value === undefined) {
          console.error(`❌ Missing value for flag: ${arg}`);
          process.exit(1);
        }
        if (arg === '--python-path') {
          pythonPath = value;
        } else if (arg === '--prefix') {
          s3Prefix = value;
          uploadArgs.push(arg, value);
        } else {
          uploadArgs.push(arg, value);
        }
        i += 1;
      } else if (INVALIDATION_BOOLEAN_FLAGS.has(arg)) {
        invalidationArgs.push(arg);
      } else if (INVALIDATION_VALUE_FLAGS.has(arg)) {
        const value = rawArgs[i + 1];
        if (value === undefined) {
          console.error(`❌ Missing value for flag: ${arg}`);
          process.exit(1);
        }
        invalidationArgs.push(arg, value);
        i += 1;
      } else {
        console.error(`❌ Unknown flag: ${arg}`);
        process.exit(1);
      }
    } else {
      paths.push(arg);
    }
  }

  return { paths, uploadArgs, invalidationArgs, pythonPath, invalidateAll, noBuild, raw, s3Prefix };
}

function normalizeInvalidationPaths(paths, s3Prefix) {
  // Convert S3 prefix to CloudFront path format
  // e.g., 'games/video-poker/' -> '/games/video-poker/'
  let prefixPath = s3Prefix.trim();
  if (prefixPath.endsWith('/')) {
    prefixPath = prefixPath.slice(0, -1);
  }
  if (!prefixPath.startsWith('/')) {
    prefixPath = `/${prefixPath}`;
  }

  if (!paths.length) {
    return [`${prefixPath}/*`];
  }

  const normalized = paths.map((p) => {
    if (!p) {
      return `${prefixPath}/*`;
    }
    const trimmed = p.trim();
    // Remove leading slash if present (we'll add it with the prefix)
    const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
    
    // Build the full CloudFront path: /games/video-poker/{path}/*
    // For files (have file extension like .html, .js, .json), don't add /*, but for directories, add /*
    // Check if path ends with a file extension (dot followed by letters/numbers)
    const isFile = /\.\w+$/.test(cleanPath) && !trimmed.endsWith('/');
    const fullPath = `${prefixPath}/${cleanPath}${isFile ? '' : '/*'}`;
    return fullPath;
  });

  // Check if any normalized path includes index.html (covers both 'index.html' and '/index.html' input)
  const hasIndexHtml = paths.some(p => {
    const trimmed = p.trim().toLowerCase();
    return trimmed === 'index.html' || trimmed === '/index.html' || trimmed.endsWith('/index.html');
  });

  // If index.html is included, always add both the prefix root (without wildcard) and index.html
  if (hasIndexHtml) {
    const result = new Set(normalized);
    
    // Ensure both prefix root (/) and index.html are present
    result.add(`${prefixPath}/`);
    result.add(`${prefixPath}/index.html`);
    
    return Array.from(result);
  }

  return normalized;
}

function runCommand(command, args, label, captureOutput = false) {
  if (!captureOutput) {
    console.log(`\n▶️  ${label}: ${command} ${args.join(' ')}`);
  }
  const result = spawnSync(command, args, {
    stdio: captureOutput ? 'pipe' : 'inherit',
    cwd: PROJECT_ROOT,
    shell: false,
    encoding: 'utf8',
  });

  if (result.error) {
    console.error(`❌ Failed to run ${label}:`, result.error.message);
    process.exit(result.status ?? 1);
  }

  if (result.status !== 0) {
    console.error(`❌ ${label} exited with code ${result.status}`);
    // Show error output if available
    if (captureOutput) {
      const errorOutput = (result.stdout || '') + (result.stderr || '');
      if (errorOutput) {
        console.error('\nError output:');
        console.error(errorOutput);
      }
    }
    process.exit(result.status);
  }

  if (captureOutput) {
    const output = (result.stdout || '') + (result.stderr || '');
    return output;
  }
  
  return null;
}

/** Build argv for sync_game_catalog.py from flags shared with the S3 upload step. */
function buildGameCatalogArgs(uploadArgs, yesFlagProvided) {
  const args = [GAME_CATALOG_SCRIPT];
  if (uploadArgs.includes('--dry-run')) {
    args.push('--dry-run');
  }
  if (yesFlagProvided || uploadArgs.includes('--yes')) {
    args.push('--yes');
  }
  const regionIdx = uploadArgs.indexOf('--region');
  if (regionIdx !== -1 && uploadArgs[regionIdx + 1]) {
    args.push('--region', uploadArgs[regionIdx + 1]);
  }
  return args;
}

function getInvalidateAllPath(s3Prefix) {
  // Convert S3 prefix (e.g., 'games/video-poker/') to CloudFront path (e.g., '/games/video-poker/*')
  // Remove trailing slash if present, ensure leading slash, then add /*
  let prefix = s3Prefix.trim();
  if (prefix.endsWith('/')) {
    prefix = prefix.slice(0, -1);
  }
  if (!prefix.startsWith('/')) {
    prefix = `/${prefix}`;
  }
  return `${prefix}/*`;
}

function main() {
  const rawArgs = process.argv.slice(2);
  const { paths, uploadArgs, invalidationArgs, pythonPath, invalidateAll, noBuild, raw, s3Prefix } = parseArgs(rawArgs);
  console.log(`\n📦 Using S3_PREFIX: ${s3Prefix}`);
  const isProduction = !raw;
  const invalidationPaths = invalidateAll ? [getInvalidateAllPath(s3Prefix)] : normalizeInvalidationPaths(paths, s3Prefix);
  console.log(`🔄 CloudFront invalidation paths: ${invalidationPaths.join(', ')}`);
  const yesFlagProvided = uploadArgs.includes('--yes');

  // Step 0: run build when deploying production (unless --no-build)
  if (isProduction && !noBuild) {
    console.log('\n▶️  Building production bundle (npm run build)...');
    const result = spawnSync('npm', ['run', 'build'], {
      stdio: 'inherit',
      cwd: PROJECT_ROOT,
      shell: true,
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      console.error('❌ Build failed');
      process.exit(result.status ?? 1);
    }
    console.log('✅ Build completed successfully.\n');
  }

  // Step 1: run the upload script
  const syncArgs = [...uploadArgs];
  if (isProduction) {
    syncArgs.push('--production');
  }
  const uploadCommandArgs = [UPLOAD_SCRIPT, ...paths, ...syncArgs];
  console.log(`\n▶️  S3 Upload Sync: ${pythonPath} ${uploadCommandArgs.join(' ')}`);
  // Don't capture output - allow user interaction when --yes is not provided
  // When --yes is provided, the sync script will auto-proceed without prompting
  runCommand(pythonPath, uploadCommandArgs, 'S3 Upload Sync', false);

  // Step 2: sync game catalog to DynamoDB (before CloudFront invalidation)
  const catalogArgs = buildGameCatalogArgs(uploadArgs, yesFlagProvided);
  runCommand(pythonPath, catalogArgs, 'DynamoDB GameCatalog sync', false);

  // Step 3: run the invalidation script
  const invalidateArgs = [
    INVALIDATE_SCRIPT,
    ...invalidationPaths,
    ...invalidationArgs,
  ];

  if (yesFlagProvided) {
    invalidateArgs.push('--yes');
  }

  runCommand(pythonPath, invalidateArgs, 'CloudFront Invalidation');

  console.log('\n✅ Sync and invalidation completed successfully.');
}

main();

