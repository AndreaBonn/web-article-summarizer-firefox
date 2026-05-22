import { defineConfig } from 'vite';
import { resolve } from 'path';

// Separate build for content script: IIFE format
// Firefox content scripts don't support ES modules
export default defineConfig({
  define: {
    'import.meta.env': JSON.stringify({ MODE: 'production' }),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        'content-script': resolve(import.meta.dirname, 'src/content/content-script.js'),
      },
      output: {
        format: 'iife',
        entryFileNames: 'src/content/content-script.js',
        inlineDynamicImports: true,
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
});
