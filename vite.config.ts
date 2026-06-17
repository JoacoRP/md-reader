import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// El frontend vive en web/ y se compila a web/dist, que es lo que server.js
// sirve en producción (y lo que Electron empaqueta). En dev, Vite levanta su
// propio server con HMR y proxea las llamadas al backend Node (server.js).
const BACKEND = 'http://127.0.0.1:4321';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'web/src') },
  },
  build: {
    outDir: 'dist', // -> web/dist
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500, // mermaid + hljs son grandes; es una app local
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': BACKEND,
      '/mock': BACKEND,
    },
  },
});
