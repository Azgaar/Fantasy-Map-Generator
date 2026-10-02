import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { SYSTEM_PROMPT } from "./context";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

test("cached instructions contain the map rules, operations and data fields", () => {
  const [cached] = SYSTEM_PROMPT;
  expect(cached.text).toContain("read_help");
  expect(cached.text).toContain("read_docs");
  expect(cached.text).toContain("propose_change");
  expect(cached.text).toMatch(/^Burgs: rename, setPopulation, /m);
  expect(cached.text).toContain("Notes: write");
  expect(cached.text).toMatch(/^Burgs: i, name, cell/m);
  expect(cached.cache_control).toEqual({ type: "ephemeral" });
});

// About 3.5 characters per token: keeps the fixed prompt under about 4k tokens
test("cached instructions stay compact", () => {
  const [cached] = SYSTEM_PROMPT;
  expect(cached.text.length).toBeLessThan(14_500);
});

test("generated context matches the codebase and Knowledge Base", () => {
  expect(() =>
    execFileSync("node", ["scripts/generate-assistant-context.mjs", "--check"], { cwd: root })
  ).not.toThrow();
});
