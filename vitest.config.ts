import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  test: {
    root: "./src",
    setupFiles: ["./test-setup.ts"],
    environment: "node",
    // Shared CI runners are noisy; run each benchmark longer than the 500ms
    // default so a slow neighbor doesn't skew the mean into a false regression.
    benchmark: {
      time: 1500
    }
  },
  // keep in sync with vite.config.ts, or an `@/…` import resolves in the app but not under test
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  }
});
