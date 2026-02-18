import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

/** Include base pattern but exclude any path under a directory named 'archive' */
const excludeArchive = (base) => [base, '!**/archive/**'];

/** Match only files (with extensions) to avoid directory copy race conditions with structured mode */
const assetsFilesOnly = () => excludeArchive('assets/**/*.*');

export default defineConfig({
  base: './',
  server: {
    port: 5502,
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
