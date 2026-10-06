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
 *   node scripts/deploy/deploy.js --sync-catalog
 *   node scripts/deploy/deploy.js --sync-mega-monster
 *   node scripts/deploy/deploy.js --no-build --sync-crazy-banana --yes
 *   node scripts/deploy/deploy.js --raw
 *   node scripts/deploy/deploy.js src/config/themes --yes
 *
 * Behavior:
 *   - Default: Runs build, then sync_to_s3.py with --production (dist/ output).
 *   - Default production sync uploads index.html, assets, and js only.
 *     GameCatalog (DynamoDB), src/config/themes, and src/config/game are skipped unless --sync-catalog is set.
 *   - With --sync-catalog: Also syncs src/config/themes and src/config/game to S3, then runs sync_game_catalog.py.
 *   - With --sync-<gameId>: Syncs one game's config, theme JSON, theme assets, thumbnails, and GameCatalog entry.
 *     Can be repeated (e.g. --sync-mega-monster --sync-crazy-banana).
 *   - S3 objects under NO_DELETE_SUBPATHS (e.g. assets/images/) are never deleted during sync.
 *   - Orphaned remote files are not deleted unless DELETE_ORPHANED_S3_FILES is enabled in aws_config.py (default: off).
 *   - With --raw: Syncs raw source (no build, DEFAULT_PATHS from project root).
 *   - Afterwards runs invalidate_cloudfront.py with the same paths (uses default domain).
 *
 * Flags forwarded to upload script:
 *   --dry-run, --force, --yes, --preview-paths, --bucket <value>, --prefix <value>, --region <value>
 *
 * Helper-specific flags:
 *   --python-path <value>, --invalidate-all, --preview-paths, --raw, --no-build
 *   --sync-catalog, --sync-<gameId> (repeatable)
 */

const SYNC_GAME_FLAG_RE = /^--sync-([a-zA-Z0-9][a-zA-Z0-9-]*)$/;

const PRODUCTION_PATHS_MINIMAL = [
  'index.html',
  'assets',
  'js',
];

const { spawnSync } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const UPLOAD_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'aws', 's3', 'sync_to_s3.py');
const GAME_CATALOG_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'aws', 'dynamo', 'sync_game_catalog.py');
const RESOLVE_GAME_PATHS_SCRIPT = path.join(__dirname, 'resolveGameSyncPaths.mjs');
const INVALIDATE_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'aws', 'cloudfront', 'invalidate_cloudfront.py');

function getS3PrefixFromConfig() {
  const fs = require('fs');
  const configPath = path.join(PROJECT_ROOT, 'scripts', 'aws', 'aws_config.py');

  if (!fs.existsSync(configPath)) {
    console.error(`❌ Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const categoryMatch = configContent.match(/CATEGORY\s*=\s*['"]([^'"]+)['"]/);
    const legacyMatch = configContent.match(/S3_PREFIX\s*=\s*['"]([^'"]+)['"]/);

    let prefix;
    if (categoryMatch && categoryMatch[1]) {
      prefix = `games/${categoryMatch[1].trim()}/`;
    } else if (legacyMatch && legacyMatch[1]) {
      prefix = legacyMatch[1].trim();
    } else {
      console.error(`❌ CATEGORY (or legacy quoted S3_PREFIX) not found in ${configPath}`);
      process.exit(1);
    }
    if (!prefix.endsWith('/')) {
      prefix += '/';
    }
    console.log(`✅ Read S3_PREFIX from config: ${prefix}`);
    return prefix;
  } catch (error) {
    console.error(`❌ Failed to read deploy prefix from ${configPath}: ${error.message}`);
    process.exit(1);
  }
}

const DEFAULT_S3_PREFIX = getS3PrefixFromConfig();

const BOOLEAN_FLAGS = new Set(['--dry-run', '--force', '--yes', '--preview-paths']);
const VALUE_FLAGS = new Set(['--bucket', '--prefix', '--region', '--python-path']);
const INVALIDATION_BOOLEAN_FLAGS = new Set(['--skip-watch']);
const INVALIDATION_VALUE_FLAGS = new Set(['--interval']);
const HELPER_BOOLEAN_FLAGS = new Set(['--invalidate-all', '--no-build', '--raw', '--sync-catalog']);

function extractSyncGameIds(rawArgs) {
  const gameIds = [];
  const filteredArgs = [];

  for (const arg of rawArgs) {
    if (arg === '--sync-catalog') {
      filteredArgs.push(arg);
      continue;
    }

    const match = arg.match(SYNC_GAME_FLAG_RE);
    if (match && match[1] !== 'catalog') {
      gameIds.push(match[1]);
      continue;
    }

    filteredArgs.push(arg);
  }

  return {
    syncGameIds: [...new Set(gameIds)],
    filteredArgs,
  };
}

function mergeUniquePaths(...pathLists) {
  return [...new Set(pathLists.flat())];
}

function resolveGameSyncPaths(gameIds) {
  if (!gameIds.length) {
    return [];
  }

  const result = spawnSync('node', [RESOLVE_GAME_PATHS_SCRIPT, ...gameIds], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  });

  if (result.error) {
    console.error(`❌ Failed to resolve game sync paths: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
    if (output) {
      console.error(output);
    }
    process.exit(result.status ?? 1);
  }

  try {
    const paths = JSON.parse(result.stdout.trim());
    return Array.isArray(paths) ? paths : [];
  } catch (err) {
    console.error(`❌ Failed to parse game sync paths: ${err.message}`);
    process.exit(1);
  }
}

function parseArgs(rawArgs) {
  const paths = [];
  const uploadArgs = [];
  const invalidationArgs = [];
  let pythonPath = process.env.PYTHON || 'python';
  let invalidateAll = false;
  let noBuild = false;
  let raw = false;
  let syncCatalog = false;
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
        } else if (arg === '--sync-catalog') {
          syncCatalog = true;
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

  return {
    paths,
    uploadArgs,
    invalidationArgs,
    pythonPath,
    invalidateAll,
    noBuild,
    raw,
    syncCatalog,
    s3Prefix,
  };
}

function normalizeInvalidationPaths(paths, s3Prefix) {
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
    const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
    const isFile = /\.\w+$/.test(cleanPath) && !trimmed.endsWith('/');
    return `${prefixPath}/${cleanPath}${isFile ? '' : '/*'}`;
  });

  const hasIndexHtml = paths.some((p) => {
    const trimmed = p.trim().toLowerCase();
    return trimmed === 'index.html' || trimmed === '/index.html' || trimmed.endsWith('/index.html');
  });

  if (hasIndexHtml) {
    const result = new Set(normalized);
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
    return (result.stdout || '') + (result.stderr || '');
  }
  return null;
}

function buildGameCatalogArgs(uploadArgs, yesFlagProvided, gameIds = null) {
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
  if (gameIds?.length) {
    for (const gameId of gameIds) {
      args.push('--game', gameId);
    }
  }
  return args;
}

function getInvalidateAllPath(s3Prefix) {
  let prefix = s3Prefix.trim();
  if (prefix.endsWith('/')) {
    prefix = prefix.slice(0, -1);
  }
  if (!prefix.startsWith('/')) {
    prefix = `/${prefix}`;
  }
  return `${prefix}/*`;
}

function resolveUploadPaths(paths, isProduction, syncCatalog, gameSyncPaths) {
  if (paths.length > 0) {
    return mergeUniquePaths(paths, gameSyncPaths);
  }
  if (!isProduction) {
    return gameSyncPaths.length ? gameSyncPaths : paths;
  }
  if (syncCatalog) {
    return paths;
  }
  return mergeUniquePaths(PRODUCTION_PATHS_MINIMAL, gameSyncPaths);
}

function main() {
  const rawArgs = process.argv.slice(2);
  const { syncGameIds: initialSyncGameIds, filteredArgs } = extractSyncGameIds(rawArgs);
  let syncGameIds = initialSyncGameIds;
  const {
    paths,
    uploadArgs,
    invalidationArgs,
    pythonPath,
    invalidateAll,
    noBuild,
    raw,
    syncCatalog,
    s3Prefix,
  } = parseArgs(filteredArgs);

  console.log(`\n📦 Using S3_PREFIX: ${s3Prefix}`);
  const isProduction = !raw;

  if (syncCatalog && syncGameIds.length) {
    console.log('ℹ️  --sync-catalog syncs all games; ignoring per-game --sync-* flags.');
    syncGameIds = [];
  }

  const gameSyncPaths = resolveGameSyncPaths(syncGameIds);
  const uploadPaths = resolveUploadPaths(paths, isProduction, syncCatalog, gameSyncPaths);

  if (isProduction && paths.length === 0) {
    if (syncCatalog) {
      console.log('📚 Catalog sync enabled: uploading full PRODUCTION_PATHS (themes + game configs) and syncing GameCatalog.');
    } else if (syncGameIds.length) {
      console.log(`🎮 Per-game sync: ${syncGameIds.join(', ')}`);
      console.log(`   Additional upload paths (${gameSyncPaths.length}): ${gameSyncPaths.join(', ') || '(none)'}`);
    } else {
      console.log(`📦 Default production sync (no catalog): ${PRODUCTION_PATHS_MINIMAL.join(', ')}`);
      console.log('   Use --sync-catalog for all games, or --sync-<gameId> for one game.');
    }
  } else if (syncGameIds.length) {
    console.log(`🎮 Per-game sync: ${syncGameIds.join(', ')}`);
    console.log(`   Additional upload paths (${gameSyncPaths.length}): ${gameSyncPaths.join(', ') || '(none)'}`);
  }

  const invalidationPaths = invalidateAll
    ? [getInvalidateAllPath(s3Prefix)]
    : normalizeInvalidationPaths(uploadPaths, s3Prefix);
  console.log(`🔄 CloudFront invalidation paths: ${invalidationPaths.join(', ')}`);
  const yesFlagProvided = uploadArgs.includes('--yes');

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

  const syncArgs = [...uploadArgs];
  if (isProduction) {
    syncArgs.push('--production');
  }
  const uploadCommandArgs = [UPLOAD_SCRIPT, ...uploadPaths, ...syncArgs];
  console.log(`\n▶️  S3 Upload Sync: ${pythonPath} ${uploadCommandArgs.join(' ')}`);
  runCommand(pythonPath, uploadCommandArgs, 'S3 Upload Sync', false);

  if (syncCatalog) {
    const catalogArgs = buildGameCatalogArgs(uploadArgs, yesFlagProvided);
    runCommand(pythonPath, catalogArgs, 'DynamoDB GameCatalog sync', false);
  } else if (syncGameIds.length) {
    const catalogArgs = buildGameCatalogArgs(uploadArgs, yesFlagProvided, syncGameIds);
    runCommand(pythonPath, catalogArgs, `DynamoDB GameCatalog sync (${syncGameIds.join(', ')})`, false);
  } else {
    console.log('\n⏭️  Skipping DynamoDB GameCatalog sync (pass --sync-catalog or --sync-<gameId> to enable).');
  }

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
