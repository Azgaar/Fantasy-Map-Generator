import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'], 
    exclude: ['src/**/*regression.test.ts', 'src/e2e/**', 'node_modules', 'dist'],
  },
});