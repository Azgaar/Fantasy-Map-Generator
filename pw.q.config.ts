import {defineConfig, devices} from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e-tmp", fullyParallel: false, workers: 1, reporter: "list", timeout: 300000,
  use: {baseURL: "http://localhost:4173/Fantasy-Map-Generator/", viewport: {width: 1280, height: 720}},
  projects: [{name: "chromium", use: {...devices["Desktop Chrome"]}}]
});
