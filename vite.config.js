import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

/** Include base pattern but exclude any path under a directory named 'archive' */
const excludeArchive = (base) => [base, '!**/archive/**'];

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
      targets: [
        {
          src: excludeArchive('assets/**/*'),
          dest: 'assets',
          structured: true,
        },
        {
          src: 'test.html',
          dest: '.',
        },
        {
          src: excludeArchive('src/config/themes/**/*'),
          dest: 'src/config/themes',
          structured: true,
        },
        {
          src: excludeArchive('src/config/game/**/*'),
          dest: 'src/config/game',
          structured: true,
        },
      ],
    }),
  ],
});
