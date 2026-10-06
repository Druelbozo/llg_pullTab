#!/usr/bin/env node
/**
 * Resolve project-relative paths to upload when syncing individual pull-tab games.
 * Outputs a JSON array of paths (stdout).
 *
 * Usage: node resolveGameSyncPaths.mjs <gameId> [gameId...]
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const LOAD_CONFIG_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'aws', 'dynamo', 'load_config.mjs');
const GAME_DIR = path.join(PROJECT_ROOT, 'src', 'config', 'game');
const THEMES_DIR = path.join(PROJECT_ROOT, 'src', 'config', 'themes');
const THUMBNAILS_DIR = path.join(PROJECT_ROOT, 'assets', 'images', 'thumbnails');

const GAME_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*$/;

function loadGameConfig(gameId) {
  const configPath = path.join(GAME_DIR, `${gameId}.js`);
  if (!fs.existsSync(configPath)) {
    return null;
  }

  const result = spawnSync('node', [LOAD_CONFIG_SCRIPT, gameId], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    console.error(`Failed to load game config for ${gameId}: ${result.stderr || result.stdout}`);
    process.exit(1);
  }

  try {
    return JSON.parse(result.stdout.trim());
  } catch (err) {
    console.error(`Invalid JSON from game config ${gameId}: ${err.message}`);
    process.exit(1);
  }
}

function addIfExists(paths, relativePath) {
  const absolutePath = path.join(PROJECT_ROOT, relativePath);
  if (fs.existsSync(absolutePath)) {
    paths.push(relativePath.replace(/\\/g, '/'));
  }
}

function collectThemeMediaPaths(themeData) {
  const paths = [];

  const addThemeAsset = (folder, value, extensions) => {
    if (!value || typeof value !== 'string') {
      return;
    }
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return;
    }
    for (const ext of extensions) {
      addIfExists(paths, `assets/images/theme/${folder}/${value}${ext}`);
    }
  };

  if (themeData?.imageKeys) {
    for (const [folder, value] of Object.entries(themeData.imageKeys)) {
      addThemeAsset(folder, value, ['.png', '.jpg', '.jpeg', '.webp']);
    }
  }

  if (themeData?.videoKeys) {
    for (const [folder, value] of Object.entries(themeData.videoKeys)) {
      addThemeAsset(folder, value, ['.mp4', '.webm']);
    }
  }

  const audioKey = themeData?.music?.audioKey;
  if (audioKey && typeof audioKey === 'string') {
    addIfExists(paths, `assets/audio/music/${audioKey}`);
  }

  return paths;
}

function collectThumbnailPaths(gameId) {
  if (!fs.existsSync(THUMBNAILS_DIR)) {
    return [];
  }

  const prefix = gameId.toLowerCase();
  const paths = [];

  for (const file of fs.readdirSync(THUMBNAILS_DIR)) {
    const absolutePath = path.join(THUMBNAILS_DIR, file);
    if (!fs.statSync(absolutePath).isFile()) {
      continue;
    }
    if (file.toLowerCase().startsWith(prefix)) {
      paths.push(`assets/images/thumbnails/${file}`.replace(/\\/g, '/'));
    }
  }

  return paths;
}

function resolveGamePaths(gameId) {
  if (!GAME_ID_RE.test(gameId)) {
    console.error(`Invalid game ID "${gameId}". Use letters, numbers, and hyphens only.`);
    process.exit(1);
  }

  const paths = [];
  const config = loadGameConfig(gameId);
  const themeName = config?.theme || gameId;

  if (config) {
    addIfExists(paths, `src/config/game/${gameId}.js`);
  }

  const themePath = path.join(THEMES_DIR, `${themeName}.json`);
  if (fs.existsSync(themePath)) {
    addIfExists(paths, `src/config/themes/${themeName}.json`);
    try {
      const themeData = JSON.parse(fs.readFileSync(themePath, 'utf8'));
      paths.push(...collectThemeMediaPaths(themeData));
    } catch (err) {
      console.error(`Failed to read theme ${themeName}: ${err.message}`);
      process.exit(1);
    }
  } else if (!config) {
    console.error(`No game config or theme found for "${gameId}".`);
    process.exit(1);
  } else {
    console.error(`Warning: theme file not found for ${gameId} (expected ${themeName}.json)`);
  }

  paths.push(...collectThumbnailPaths(gameId));

  return [...new Set(paths)];
}

function main() {
  const gameIds = process.argv.slice(2);
  if (!gameIds.length) {
    console.error('Usage: node resolveGameSyncPaths.mjs <gameId> [gameId...]');
    process.exit(1);
  }

  const allPaths = [];
  for (const gameId of gameIds) {
    allPaths.push(...resolveGamePaths(gameId));
  }

  process.stdout.write(`${JSON.stringify([...new Set(allPaths)])}\n`);
}

main();
