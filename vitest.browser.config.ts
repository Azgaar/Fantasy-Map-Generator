import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

// vite.config.ts builds this module from docs/updates. Without it the dependency scan fails, deps get found
// mid-run and Vite reloads the test iframes, so files randomly never start
const latestUpdateStub = {
  name: 'latest-update-stub',
  resolveId: (id: string) => (id === 'virtual:latest-update' ? '\0virtual:latest-update' : undefined),
  load: (id: string) =>
    id === '\0virtual:latest-update' ? 'export default { version: "0.0.0", title: "", image: "" }' : undefined
}

export default defineConfig({
  plugins: [latestUpdateStub],
  // keep in sync with vite.config.ts/vitest.config.ts, or an `@/…` import resolves in the app
  // but not under this browser test run
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    // this config runs the DOM tests only, the mirror of vitest.config.ts's
    // `exclude: [..., "**/*.dom.test.ts"]`. Without it a bare run of this config also drags the
    // node-environment suites into the browser, where their node-only imports fail.
    include: ['src/**/*.dom.test.ts'],
    browser: {
      enabled: true,
      // CHROMIUM_PATH: point at a system-installed browser (e.g. NixOS, where Playwright's own
      // downloaded chromium is dynamically linked against libs the sandbox doesn't have).
      // Unset elsewhere (CI, other machines) so Playwright uses its own managed browser.
      provider: playwright(
        process.env.CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } } : {}
      ),
      // https://vitest.dev/config/browser/playwright
      instances: [
        { name: 'chromium', browser: 'chromium' },
      ],
      locators: {
        testIdAttribute: 'id',
      },
    },
  },
})
