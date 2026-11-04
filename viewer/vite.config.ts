import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Relative asset paths: the bundle makes no assumption about where it is served (the site serves it
// at /view/; a toolkit command could serve it elsewhere).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1200 },
  test: { include: ['test/**/*.test.{ts,tsx}'], environment: 'node' },
});
