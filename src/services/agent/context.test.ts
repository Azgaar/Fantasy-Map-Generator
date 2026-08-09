import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

// The generated half of the system prompt mirrors global declarations, the registries and the data
// model doc. If any of those moved, the model would be told about a codebase that no longer exists.
test("context.generated.ts is current", () => {
  expect(() =>
    execFileSync("node", ["scripts/generate-agent-context.mjs", "--check"], { cwd: root, encoding: "utf8" })
  ).not.toThrow();
});
