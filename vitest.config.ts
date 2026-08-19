import { fileURLToPath, URL } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

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
    // *.dom.test.ts needs a real DOM (querySelector, createElementNS, ...) that the node
    // environment's minimal document/Element stubs (test-setup.ts) don't provide - those run
    // only under vitest.browser.config.ts.
    exclude: [...configDefaults.exclude, "**/*.dom.test.ts"]
  },
  // keep in sync with vite.config.ts, or an `@/…` import resolves in the app but not under test
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  }
});
