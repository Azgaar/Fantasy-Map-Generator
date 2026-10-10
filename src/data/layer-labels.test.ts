import { describe, expect, it } from "vitest";
import { LAYER_TOGGLES, layerLabel, underlineHotkey } from "./layer-labels";

describe("underlineHotkey", () => {
  it("underlines the first occurrence of the hotkey letter, in any case", () => {
    expect(underlineHotkey({ label: "Heightmap", shortcut: "KeyH" })).toBe("<u>H</u>eightmap");
    expect(underlineHotkey({ label: "Precipitation", shortcut: "KeyA" })).toBe("Precipit<u>a</u>tion");
  });

  it("leaves a label without the hotkey letter plain, as a translated label may be", () => {
    expect(underlineHotkey({ label: "Lakes", shortcut: "KeyQ" })).toBe("Lakes");
    expect(underlineHotkey({ label: "Рельеф", shortcut: "KeyF" })).toBe("Рельеф");
  });

  it("underlines nothing for a non-letter shortcut or none", () => {
    expect(underlineHotkey({ label: "Scale Bar", shortcut: "Slash" })).toBe("Scale Bar");
    expect(underlineHotkey({ label: "Markets" })).toBe("Markets");
  });

  it("keeps every layer button's label as plain text", () => {
    for (const { label } of LAYER_TOGGLES.values()) expect(label).not.toMatch(/[<>]/);
  });
});

describe("layerLabel", () => {
  it("names a layer by its button label, a permanent layer by its id", () => {
    expect(layerLabel("compass")).toBe("Wind Rose");
    expect(layerLabel("map")).toBe("Map");
    expect(layerLabel("debug")).toBe("Debug");
  });
});
