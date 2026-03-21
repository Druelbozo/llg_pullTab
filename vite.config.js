import { defineConfig } from 'vite';
import { createRequire } from 'module';
import { viteStaticCopy } from 'vite-plugin-static-copy';

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
  ],
});
