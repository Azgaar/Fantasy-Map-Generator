import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/benchmarks",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["./tests/benchmarks/renderer-benchmark-reporter.ts"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: isCI ? "http://localhost:4173" : "http://localhost:5173",
    trace: "retain-on-failure",
    viewport: { height: 720, width: 1280 }
  },
  projects: [{ name: "reference-chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: isCI ? "npm run build && npm run preview" : "npm run dev",
    reuseExistingServer: !isCI,
    timeout: 120_000,
    url: isCI ? "http://localhost:4173" : "http://localhost:5173"
  }
});
