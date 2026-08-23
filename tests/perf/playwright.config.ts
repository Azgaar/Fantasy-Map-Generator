import { defineConfig, devices } from "@playwright/test";

// Perf specs are driven by tests/perf/ab.mjs, which builds each compared ref once and starts its
// own long-lived preview server (so 3 alternating rounds don't each pay a rebuild). Point at that
// server via PERF_BASE_URL instead of letting Playwright manage its own webServer per run.
const baseURL = process.env.PERF_BASE_URL || "http://localhost:4173";

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    viewport: { width: 1280, height: 720 }
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
