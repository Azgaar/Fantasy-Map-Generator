import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['src/regression/regression.setup.ts'], 
    include: ['src/**/*regression.test.ts'], 
    exclude: ['src/e2e/**', 'node_modules', 'dist'],
  },
});