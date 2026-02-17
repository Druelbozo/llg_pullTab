import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

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
          src: 'assets/**/*',
          dest: 'assets',
          structured: true,
        },
        {
          src: 'test.html',
          dest: '.',
        },
        {
          src: 'src/config/themes/**/*',
          dest: 'src/config/themes',
          structured: true,
        },
        {
          src: 'src/config/game/**/*',
          dest: 'src/config/game',
          structured: true,
        },
      ],
    }),
  ],
});
