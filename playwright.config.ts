import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI
const skipBuild = !!process.env.SKIP_BUILD
const baseURL = isCI ? 'http://localhost:4173' : 'http://localhost:5173'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  workers: isCI ? 2 : undefined,
  reporter: 'html',
  // Use OS-independent snapshot names (HTML content is the same across platforms)
  snapshotPathTemplate: '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}',
  use: {
    baseURL,
    // a first visit opens the update notice in #alert 6s after load, over whatever dialog a test is using
    storageState: { cookies: [], origins: [{ origin: baseURL, localStorage: [{ name: 'version', value: '99.0.0' }] }] },
    trace: 'on-first-retry',
    // Fixed viewport to ensure consistent map rendering
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // CHROMIUM_PATH: point at a system-installed browser (e.g. NixOS, where Playwright's own
        // downloaded chromium is dynamically linked against libs the sandbox doesn't have).
        // Unset elsewhere (CI, other machines) so Playwright uses its own managed browser.
        ...(process.env.CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } } : {}),
      },
    },
  ],
  webServer: {
    // In CI: build (done as a separate cached step) and preview for production-like testing
    // In dev: use vite dev server (faster, no rebuild needed)
    command: isCI ? (skipBuild ? 'npm run preview' : 'npm run build && npm run preview') : 'npm run dev',
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120000,
  },
})
