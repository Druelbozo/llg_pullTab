/**
 * Writes TexturePacker 3-compatible JSON next to each pull-tab icons PNG.
 * Frames: 100×100 tiles in a 300×300 sheet (indices 0..8 → "0.png" … "8.png").
 * Includes pullTabLayout for PeelIcons spacing (editable per atlas).
 *
 * Usage: node scripts/themes/generate-icons-atlas-json.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.resolve(__dirname, '../../assets/Images/theme/icons');

const SHEET_W = 300;
const SHEET_H = 300;
const FRAME_W = 100;
const FRAME_H = 100;
const COLS = SHEET_W / FRAME_W;
const ROWS = SHEET_H / FRAME_H;

const pullTabLayout = {
	iconSpacing: 130,
	iconOffsetX: 60,
	iconRowY: 50,
	crossY: 50,
};

function buildFrames() {
	const frames = [];
	let idx = 0;
	for (let r = 0; r < ROWS; r++) {
		for (let c = 0; c < COLS; c++) {
			const name = `${idx}.png`;
			frames.push({
				filename: name,
				rotated: false,
				trimmed: false,
				sourceSize: { w: FRAME_W, h: FRAME_H },
				spriteSourceSize: { x: 0, y: 0, w: FRAME_W, h: FRAME_H },
				frame: {
					x: c * FRAME_W,
					y: r * FRAME_H,
					w: FRAME_W,
					h: FRAME_H,
				},
			});
			idx++;
		}
	}
	return frames;
}

const frames = buildFrames();

const stems = fs
	.readdirSync(ICONS_DIR)
	.filter((f) => f.endsWith('.png'))
	.map((f) => path.basename(f, '.png'));

for (const stem of stems) {
	const png = `${stem}.png`;
	const outPath = path.join(ICONS_DIR, `${stem}.json`);
	const json = {
		textures: [
			{
				image: png,
				format: 'RGBA8888',
				size: { w: SHEET_W, h: SHEET_H },
				scale: 1,
				frames,
			},
		],
		meta: {
			app: 'llg_pulltab',
			version: '3.0',
			smartupdate: `pull-tab-icons-grid:${stem}`,
		},
		pullTabLayout,
	};
	fs.writeFileSync(outPath, JSON.stringify(json, null, '\t') + '\n', 'utf8');
	console.log('wrote', path.relative(process.cwd(), outPath));
}
