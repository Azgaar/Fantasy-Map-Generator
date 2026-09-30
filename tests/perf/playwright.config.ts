import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PERF_BASE_URL || "http://localhost:4173";

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 180_000 },
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
