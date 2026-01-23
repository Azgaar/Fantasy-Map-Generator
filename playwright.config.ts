import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: 'html',
  // Use OS-independent snapshot names (HTML content is the same across platforms)
  snapshotPathTemplate: '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}',
  use: {
    baseURL: isCI ? 'http://localhost:4173' : 'http://localhost:5173',
    trace: 'on-first-retry',
    // Fixed viewport to ensure consistent map rendering
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // In CI: build and preview for production-like testing
    // In dev: use vite dev server (faster, no rebuild needed)
    command: isCI ? 'npm run build && npm run preview' : 'npm run dev',
    url: isCI ? 'http://localhost:4173' : 'http://localhost:5173',
    reuseExistingServer: !isCI,
    timeout: 120000,
  },
})
