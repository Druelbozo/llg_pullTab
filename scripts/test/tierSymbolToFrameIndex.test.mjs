#!/usr/bin/env node
/**
 * Regression guard: tierSymbolToFrameIndex must parse symbol_NN without throwing.
 * Run: node scripts/test/tierSymbolToFrameIndex.test.mjs
 */

import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modulePath = path.resolve(__dirname, '../../src/utils/game/pullTabSymbolUtils.js');

const { tierSymbolToFrameIndex, SYMBOL_RE } = await import(pathToFileURL(modulePath).href);

/** @param {string} label @param {boolean} ok */
function assert(label, ok) {
	if (!ok) {
		console.error(`FAIL: ${label}`);
		process.exit(1);
	}
	console.log(`ok: ${label}`);
}

assert('SYMBOL_RE is defined', SYMBOL_RE instanceof RegExp);
assert('SYMBOL_RE matches symbol_01', SYMBOL_RE.test('symbol_01'));
assert('symbol_01 → 0', tierSymbolToFrameIndex('symbol_01') === 0);
assert('symbol_07 → 6', tierSymbolToFrameIndex('symbol_07') === 6);
assert('SYMBOL_03 → 2 (case insensitive)', tierSymbolToFrameIndex('SYMBOL_03') === 2);
assert('junk_x → 0', tierSymbolToFrameIndex('junk_x') === 0);
assert('empty → 0', tierSymbolToFrameIndex('') === 0);

console.log('\nAll tierSymbolToFrameIndex checks passed.');
