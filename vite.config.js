import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { viteStaticCopy } from 'vite-plugin-static-copy';

/** Normalize dist/assets/Videos → dist/assets/videos after static-copy (matches runtime URLs). */
function normalizeDistVideosFolderCase() {
	return {
		name: 'normalize-dist-videos-folder-case',
		closeBundle() {
			const base = path.resolve('dist/assets');
			if (!fs.existsSync(base)) return;
			const hit = fs.readdirSync(base, { withFileTypes: true }).find(
				(d) => d.isDirectory() && d.name.toLowerCase() === 'videos'
			);
			if (!hit || hit.name === 'videos') return;

			const wrong = path.join(base, hit.name);
			const tmp = path.join(base, `_videos_dist_tmp_${Date.now()}`);
			const rightPath = path.join(base, 'videos');
			try {
				fs.renameSync(wrong, tmp);
				fs.renameSync(tmp, rightPath);
			} catch (e) {
				console.warn('[vite] Could not rename dist %s → videos: %s', hit.name, e.message);
			}
		},
	};
}

const require = createRequire(import.meta.url);

let PORT_CORS_PROXY = 3005;
let PORT_VITE = 5502;
try {
  const portsConfig = require('./scripts/local-testing/ports.config.js');
  PORT_CORS_PROXY = portsConfig.PORT_CORS_PROXY ?? PORT_CORS_PROXY;
  PORT_VITE = portsConfig.PORT_VITE ?? PORT_VITE;
} catch (_) {}

/** Include base pattern but exclude any path under a directory named 'archive' */
const excludeArchive = (base) => [base, '!**/archive/**'];

/** Match only files (with extensions) to avoid directory copy race conditions with structured mode */
const assetsFilesOnly = () => excludeArchive('assets/**/*.*');

export default defineConfig({
  base: './',
  define: {
    __CORS_PROXY_PORT__: JSON.stringify(String(PORT_CORS_PROXY)),
  },
  server: {
    port: PORT_VITE,
    strictPort: false,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: true,
    rollupOptions: {
      input: {
        main: 'index.html',
      },
      output: {
        entryFileNames: 'js/game-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  plugins: [
    viteStaticCopy({
      structured: true,
      targets: [
        {
          src: assetsFilesOnly(),
          dest: '.',
        },
        {
          src: 'test.html',
          dest: '.',
        },
        {
          src: excludeArchive('src/config/themes/**/*'),
          dest: '.',
        },
        {
          src: excludeArchive('src/config/game/**/*'),
          dest: '.',
        },
      ],
    }),
    normalizeDistVideosFolderCase(),
  ],
});
