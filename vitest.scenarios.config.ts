import { configDefaults, defineConfig } from "vitest/config";
import base from "./vitest.config";

// the slow real-map suites that vitest.config.ts leaves out
export default defineConfig({
  ...base,
  test: { ...base.test, include: ["**/*.scenarios.test.ts"], exclude: configDefaults.exclude }
});
