import {defineConfig, devices} from "@playwright/test";
export default defineConfig({
  testDir: ".", fullyParallel: false, workers: 1, reporter: "list", timeout: 300000,
  use: {baseURL: "http://localhost:4173/fantasia/", viewport: {width: 1280, height: 720}},
  projects: [{name: "chromium", use: {...devices["Desktop Chrome"]}}]
});
