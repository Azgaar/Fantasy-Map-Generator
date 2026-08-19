import fs from "node:fs";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import { isLegacyPreset, upgradeLegacyPreset } from "./legacy";
import { parseStyleData } from "./schema";

// The fidelity guarantee behind tools/convert-style-presets.mjs: whatever the converter is
// pointed at, the 12 shipped presets go through the upgrader whole. Nothing here writes to
// public/styles - the conversion is proved on the shipped files, not applied to them.
const STYLES_DIR = path.join(__dirname, "../../public/styles");
const PRESETS = fs
  .readdirSync(STYLES_DIR)
  .map(file => [file, JSON.parse(fs.readFileSync(path.join(STYLES_DIR, file), "utf8"))] as const);

// The only two keys with no slot in the schema, dropped on purpose: `auto-filter` (all 12 files,
// on #sea_island/#lake_island) is not an SVG attribute, and #provs' `data-size` has no reader -
// every data-size a renderer does read is renamed into options before it reaches the schema.
const KNOWN_DROPS = /dropping unknown attr "(auto-filter|data-size)"/;

/** Collects console.warn output for the duration of one call, restoring the spy either way. */
function warnings(run: () => void): string[] {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    run();
    return warn.mock.calls.map(([message]) => String(message));
  } finally {
    warn.mockRestore();
  }
}

describe("the shipped style presets convert losslessly", () => {
  test("there are presets to convert", () => {
    expect(PRESETS.length).toBeGreaterThan(0);
  });

  test.each(PRESETS)("%s: every selector is consumed, and only known-dead keys are dropped", (_file, json) => {
    expect(isLegacyPreset(json)).toBe(true);

    let converted!: ReturnType<typeof upgradeLegacyPreset>;
    for (const message of warnings(() => (converted = upgradeLegacyPreset(json)))) {
      expect(message).toMatch(KNOWN_DROPS);
    }

    expect(isLegacyPreset(converted)).toBe(false);
  });

  test.each(PRESETS)("%s: the converted document re-parses unchanged and without a warning", (_file, json) => {
    let converted!: ReturnType<typeof upgradeLegacyPreset>;
    warnings(() => (converted = upgradeLegacyPreset(json)));

    let reparsed!: ReturnType<typeof parseStyleData>;
    const messages = warnings(() => (reparsed = parseStyleData(JSON.parse(JSON.stringify(converted)))));

    expect(messages).toEqual([]);
    expect(reparsed).toEqual(converted);
  });
});
