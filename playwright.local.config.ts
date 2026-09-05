import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Runs against this worktree's own dev server on 5211. Port 5173 belongs to the user's session.
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: "http://localhost:5211" },
  webServer: {
    command: "npx vite --port 5211 --strictPort",
    url: "http://localhost:5211",
    reuseExistingServer: true,
    timeout: 120000
  }
});
