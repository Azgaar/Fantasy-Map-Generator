import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test, vi } from "vitest";
import { buildSystemPrompt } from "./context";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

afterEach(() => vi.unstubAllGlobals());

test("describes the map from v1.154 configuration without legacy globals", () => {
  vi.stubGlobal("pack", { cells: { i: [0, 1] }, burgs: [0, { i: 1 }, { i: 2, removed: true }] });
  vi.stubGlobal("options", {
    map: { seed: "123", graph: { width: 800, height: 600 }, lore: { name: "Test", calendar: { year: 42, era: "AD" } } }
  });
  const [staticBlock, dynamicBlock] = buildSystemPrompt();
  expect(dynamicBlock.text).toContain("name: Test");
  expect(dynamicBlock.text).toContain("seed: 123");
  expect(dynamicBlock.text).toContain("size: 800 × 600 map units");
  expect(dynamicBlock.text).toContain("burgs: 1");
  expect(dynamicBlock.text).toContain("year: 42 AD");
  expect(staticBlock.text).toContain("pack.burgs[12].note");
  expect(staticBlock.text).toContain("options.map.units.population.scale");
});

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
    execFileSync("node", ["scripts/generate-assistant-context.mjs", "--check"], { cwd: root, encoding: "utf8" })
  ).not.toThrow();
});
