import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: "./src",
    setupFiles: ["./test-setup.ts"],
    environment: "node"
  },
  // keep in sync with vite.config.ts, or an `@/…` import resolves in the app but not under test
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  }
});
