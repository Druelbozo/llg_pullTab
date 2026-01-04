#!/usr/bin/env node
/**
 * Sync & Invalidate Helper
 * ------------------------
 * This script runs the S3 upload sync script first, then triggers a CloudFront
 * invalidation for the same paths (or /* when no paths were provided).
 *
 * Usage examples:
 *   node scripts/deploy/deploy.js /Themes
 *   node scripts/deploy/deploy.js /index.html
 *   node scripts/deploy/deploy.js /Themes /css --yes
 *   node scripts/deploy/deploy.js /Themes --preview-paths
 *   node scripts/deploy/deploy.js --dry-run
 *
 * Behavior:
 *   - Runs sync_to_s3.py with the provided paths (or defaults when none).
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
 *   --invalidate-all        Invalidate everything in the S3 prefix folder (e.g., /games/scratch-cards/*)
 *                           instead of using the same paths as sync phase
 *   --preview-paths         Show detailed preview for each path before summary (forwarded to sync script)
 */

const { spawnSync } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const UPLOAD_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'aws', 's3', 'sync_to_s3.py');
const INVALIDATE_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'aws', 'cloudfront', 'invalidate_cloudfront.py');

// Default S3 prefix (must match sync_to_s3.py DEFAULT_S3_PREFIX)
const DEFAULT_S3_PREFIX = 'games/scratch-cards/';

const BOOLEAN_FLAGS = new Set(['--dry-run', '--force', '--yes', '--preview-paths']);
const VALUE_FLAGS = new Set(['--bucket', '--prefix', '--region', '--python-path']);

// Flags that should be forwarded to the invalidation script
const INVALIDATION_BOOLEAN_FLAGS = new Set(['--skip-watch']);
const INVALIDATION_VALUE_FLAGS = new Set(['--interval']);

// Helper-specific flags (not forwarded to either script)
const HELPER_BOOLEAN_FLAGS = new Set(['--invalidate-all']);

function parseArgs(rawArgs) {
  const paths = [];
  const uploadArgs = [];
  const invalidationArgs = [];
  let pythonPath = process.env.PYTHON || 'python';
  let invalidateAll = false;
  let s3Prefix = DEFAULT_S3_PREFIX;

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];

    if (arg.startsWith('--')) {
      if (BOOLEAN_FLAGS.has(arg)) {
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
      } else if (HELPER_BOOLEAN_FLAGS.has(arg)) {
        if (arg === '--invalidate-all') {
          invalidateAll = true;
        }
      } else {
        console.error(`❌ Unknown flag: ${arg}`);
        process.exit(1);
      }
    } else {
      paths.push(arg);
    }
  }

  return { paths, uploadArgs, invalidationArgs, pythonPath, invalidateAll, s3Prefix };
}

function normalizeInvalidationPaths(paths, s3Prefix) {
  // Convert S3 prefix to CloudFront path format
  // e.g., 'games/scratch-cards/' -> '/games/scratch-cards/'
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
    
    // Build the full CloudFront path: /games/scratch-cards/{path}/*
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

function getInvalidateAllPath(s3Prefix) {
  // Convert S3 prefix (e.g., 'games/scratch-cards/') to CloudFront path (e.g., '/games/scratch-cards/*')
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
  const { paths, uploadArgs, invalidationArgs, pythonPath, invalidateAll, s3Prefix } = parseArgs(rawArgs);
  const invalidationPaths = invalidateAll ? [getInvalidateAllPath(s3Prefix)] : normalizeInvalidationPaths(paths, s3Prefix);
  const yesFlagProvided = uploadArgs.includes('--yes');

  // Step 1: run the upload script
  const uploadCommandArgs = [UPLOAD_SCRIPT, ...paths, ...uploadArgs];
  console.log(`\n▶️  S3 Upload Sync: ${pythonPath} ${uploadCommandArgs.join(' ')}`);
  // Don't capture output - allow user interaction when --yes is not provided
  // When --yes is provided, the sync script will auto-proceed without prompting
  runCommand(pythonPath, uploadCommandArgs, 'S3 Upload Sync', false);

  // Step 2: run the invalidation script
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

