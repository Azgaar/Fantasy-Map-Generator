import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI
const skipBuild = !!process.env.SKIP_BUILD

/** Dedicated port avoids reuseExistingServer attaching to another project on the default Vite port. */
const devPort = process.env.PLAYWRIGHT_DEV_PORT ?? '5199'
const devOrigin = `http://127.0.0.1:${devPort}`
const previewOrigin = 'http://127.0.0.1:4173'
/** Matches vite.config.ts base (NETLIFY uses '/' for deploy previews). */
const appPath = process.env.NETLIFY ? '' : '/Fantasy-Map-Generator'
/** Trailing slash required so relative navigations resolve under the app path. */
const baseURL = appPath
  ? `${isCI ? previewOrigin : devOrigin}${appPath}/`
  : `${isCI ? previewOrigin : devOrigin}/`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 0,
  workers: isCI ? 2 : undefined,
  reporter: 'html',
  // Keeps toMatchSnapshot('_layer_.html') paths stable (no browser/OS suffix in filename).
  snapshotPathTemplate: '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}',
  use: {
    baseURL,
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
    // In CI: build (done as a separate cached step) and preview for production-like testing
    // In dev: use vite dev server (faster, no rebuild needed)
    command: isCI
      ? skipBuild
        ? 'npm run preview -- --host 127.0.0.1'
        : 'npm run build && npm run preview -- --host 127.0.0.1'
      : `npm run dev -- --host 127.0.0.1 --port ${devPort}`,
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120000,
  },
})
