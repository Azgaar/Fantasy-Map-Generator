import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
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
    include: ['**/*.dom.test.ts'],
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
