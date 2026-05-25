import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['src/regression/regression.setup.ts'], 
    include: ['src/**/*regression.test.ts'],
  },
});