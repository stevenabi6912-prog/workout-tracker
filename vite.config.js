import { defineConfig } from 'vite';

// GitHub Pages serves a project site from /<repo-name>/.
// Override with BASE_PATH=/ for a user/org site or a custom domain.
const base = process.env.BASE_PATH || '/workout-tracker/';

export default defineConfig({
  base,
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
