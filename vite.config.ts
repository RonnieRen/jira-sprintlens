import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest.json';

export default defineConfig({
  plugins: [
    crx({ manifest }),
  ],
  build: {
    // Output to dist/
    outDir: 'dist',
    minify: 'oxc',
    rollupOptions: {
      // crxjs handles entry points via manifest; no manual input needed
    },
  },
});
