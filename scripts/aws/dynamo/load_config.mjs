#!/usr/bin/env node
/**
 * Load a game config file and output its contents as JSON.
 * Used by sync_game_catalog.py to parse ES module configs.
 *
 * Usage: node load_config.mjs <gameId>
 * Example: node load_config.mjs disco-kitty
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const gameId = process.argv[2];
if (!gameId) {
  console.error('Usage: node load_config.mjs <gameId>');
  process.exit(1);
}

const projectRoot = join(__dirname, '..', '..', '..');
const configPath = join(projectRoot, 'src', 'config', 'game', `${gameId}.js`);

try {
  const config = await import(`file://${configPath.replace(/\\/g, '/')}`);
  const data = config.default || config;
  console.log(JSON.stringify(data));
} catch (err) {
  console.error(`Failed to load config for ${gameId}:`, err.message);
  process.exit(1);
}
