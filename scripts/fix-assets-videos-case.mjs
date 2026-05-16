/**
 * Normalize asset directory named Videos (mixed case) to lowercase "videos".
 * Uses a two-step rename for Windows NTFS default (case-insensitive) volumes.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '..', 'assets');

if (!fs.existsSync(assetsDir)) {
	console.error('[fix-assets-videos-case] Missing assets dir.');
	process.exit(1);
}

const hit = fs.readdirSync(assetsDir, { withFileTypes: true }).find(
	(d) => d.isDirectory() && d.name.toLowerCase() === 'videos'
);

if (!hit || hit.name === 'videos') {
	console.log('[fix-assets-videos-case] Already lowercase assets/videos; nothing to do.');
	process.exit(0);
}

const wrong = path.join(assetsDir, hit.name);
const tmp = path.join(assetsDir, `_videos_case_tmp_${Date.now()}`);
const right = path.join(assetsDir, 'videos');

try {
	fs.renameSync(wrong, tmp);
	fs.renameSync(tmp, right);
	console.log('[fix-assets-videos-case] Renamed assets/%s → assets/videos.', hit.name);
	process.exit(0);
} catch (e) {
	console.error('[fix-assets-videos-case]', e.message);
	console.error(
		'Tip: Stop Vite/start-servers/Cursor previews using these files, then rerun: npm run fix:assets-videos-case'
	);
	process.exit(1);
}
