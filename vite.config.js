import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

function firefoxExtensionPlugin() {
  return {
    name: 'firefox-extension',
    writeBundle() {
      const dist = resolve(import.meta.dirname, 'dist');

      // Copy manifest.json
      copyFileSync(resolve(import.meta.dirname, 'manifest.json'), resolve(dist, 'manifest.json'));

      // Copy content-script.css
      const cssDir = resolve(dist, 'src/content');
      if (!existsSync(cssDir)) {
        mkdirSync(cssDir, { recursive: true });
      }
      copyFileSync(
        resolve(import.meta.dirname, 'src/content/content-script.css'),
        resolve(cssDir, 'content-script.css'),
      );
    },
  };
}

export default defineConfig({
  plugins: [firefoxExtensionPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'service-worker': resolve(import.meta.dirname, 'src/background/service-worker.js'),
        popup: resolve(import.meta.dirname, 'src/pages/popup/popup.html'),
        options: resolve(import.meta.dirname, 'src/pages/options/options.html'),
        'reading-mode': resolve(import.meta.dirname, 'src/pages/reading-mode/reading-mode.html'),
        history: resolve(import.meta.dirname, 'src/pages/history/history.html'),
        'multi-analysis': resolve(
          import.meta.dirname,
          'src/pages/multi-analysis/multi-analysis.html',
        ),
        'pdf-analysis': resolve(import.meta.dirname, 'src/pages/pdf-analysis/pdf-analysis.html'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') {
            return 'src/background/service-worker.js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, '.'),
      '@utils': resolve(import.meta.dirname, 'src/utils'),
      '@pages': resolve(import.meta.dirname, 'src/pages'),
      '@shared': resolve(import.meta.dirname, 'src/shared'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
});
