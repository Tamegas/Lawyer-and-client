import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development the API runs on :4000 and Vite proxies /api to it, so the session cookie is same-origin.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': { target: process.env.VITE_API_TARGET || 'http://localhost:4000', changeOrigin: false } } },
  build: { outDir: 'dist', sourcemap: false },
  test: { environment: 'node', include: ['src/**/*.test.js'] },
});
