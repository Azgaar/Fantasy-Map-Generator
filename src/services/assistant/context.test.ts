import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { buildSystemPrompt } from "./context";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

test("cached instructions contain the map rules, operations and data fields", () => {
  const [cached] = buildSystemPrompt();
  expect(cached.text).toContain("read_help");
  expect(cached.text).toContain("read_docs");
  expect(cached.text).toContain("propose_change");
  expect(cached.text).toContain("Burgs.rename(burgId: number, name: string)");
  expect(cached.text).toContain("Notes.write(key: string, html: string)");
  expect(cached.text).toMatch(/^Burgs: i, name, cell/m);
  expect(cached.cache_control).toEqual({ type: "ephemeral" });
});

// About 3.5 characters per token: keeps the fixed prompt near 3k tokens, well inside the 5k budget
test("cached instructions stay compact", () => {
  const [cached] = buildSystemPrompt();
  expect(cached.text.length).toBeLessThan(12_000);
});

test("per-question context stays outside the cached block", () => {
  const [cached, dynamic] = buildSystemPrompt("# Current map\n\nname: Test");
  expect(cached.text).not.toContain("name: Test");
  expect(dynamic.text).toContain("name: Test");
});

test("generated context matches the codebase and Knowledge Base", () => {
  expect(() =>
    execFileSync("node", ["scripts/generate-assistant-context.mjs", "--check"], { cwd: root })
  ).not.toThrow();
});
