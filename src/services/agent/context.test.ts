import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { buildSystemPrompt } from "./context";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

test("the static prompt allows notes to change only through write_note", () => {
  const [staticBlock] = buildSystemPrompt();
  expect(staticBlock.text).toContain("write_note");
  expect(staticBlock.text).toContain("# Notes");
  expect(staticBlock.cache_control).toEqual({ type: "ephemeral" });
});

test("per-turn context is appended to the dynamic block, never the cached one", () => {
  const blocks = buildSystemPrompt("# Notes editor\n\nopen on burg1");
  expect(blocks).toHaveLength(2);
  expect(blocks[0].text).not.toContain("open on burg1");
  expect(blocks[1].text).toContain("# Current map");
  expect(blocks[1].text).toContain("open on burg1");
  expect(buildSystemPrompt()[1].text).not.toContain("# Notes editor");
});

// The generated half of the system prompt mirrors global declarations, the registries and the data
// model doc. If any of those moved, the model would be told about a codebase that no longer exists.
test("context.generated.ts is current", () => {
  expect(() =>
    execFileSync("node", ["scripts/generate-agent-context.mjs", "--check"], { cwd: root, encoding: "utf8" })
  ).not.toThrow();
});
