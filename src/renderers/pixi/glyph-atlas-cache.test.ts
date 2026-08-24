import { describe, expect, it, vi } from "vitest";
import type { LabelSceneGroup, ResolvedLabelGroupStyle } from "../scene/layers/label-scene";
import { collectGlyphCharacters, createGlyphAtlasDescriptor, GlyphAtlasCache } from "./glyph-atlas-cache";

describe("GlyphAtlasCache", () => {
  it("builds deterministic DPR-aware atlases from the exact straight and curved character set", () => {
    const group = labelGroup("North\nRealm", ["R", "ø", "a", "d"]);
    const first = createGlyphAtlasDescriptor(group, 1.75, "Almendra SC");
    const second = createGlyphAtlasDescriptor(group, 1.75, "Almendra SC");

    expect(collectGlyphCharacters(group)).toBe(" ?NRadehlmortø");
    expect(first).toEqual(second);
    expect(first.name).toMatch(/^fm-label-/);
    expect(first.installOptions).toMatchObject({
      chars: " ?NRadehlmortø",
      name: first.name,
      resolution: 1.75,
      style: { fontFamily: "Almendra SC" }
    });
    expect(first.bytes).toBeGreaterThan(0);
  });

  it("keeps referenced atlases and evicts the least-recently-used released atlas over budget", async () => {
    const installer = { install: vi.fn(), uninstall: vi.fn() };
    const firstGroup = labelGroup("abc");
    const secondGroup = labelGroup("xyz");
    const bytes = createGlyphAtlasDescriptor(firstGroup, 1, "Arial").bytes;
    const cache = new GlyphAtlasCache({ budgetBytes: bytes, installer });

    const first = await cache.acquire(firstGroup, 1, "Arial");
    const second = await cache.acquire(secondGroup, 1, "Arial");
    expect(cache.getSnapshot()).toMatchObject({ entries: 2, referenced: 2 });

    first.release();
    expect(cache.getSnapshot()).toMatchObject({ entries: 1, referenced: 1 });
    expect(installer.uninstall).toHaveBeenCalledWith(first.value.name);

    second.release();
    cache.clear();
    expect(cache.getSnapshot()).toEqual({ bytes: 0, entries: 0, referenced: 0 });
    expect(installer.uninstall).toHaveBeenCalledWith(second.value.name);
  });
});

function labelGroup(text: string, curvedCharacters: string[] = []): LabelSceneGroup {
  return {
    active: true,
    dependency: null,
    labels: [
      {
        anchorX: 0,
        anchorY: 0,
        curvedGlyphs: curvedCharacters.map((character, index) => ({ angle: 0, character, x: index, y: 0 })),
        domainId: "label:1",
        entityId: 1,
        fontSize: 18,
        letterSpacing: 0,
        text,
        type: "state"
      }
    ],
    maxScale: null,
    minScale: null,
    name: "state",
    style: labelStyle()
  };
}

function labelStyle(): ResolvedLabelGroupStyle {
  return {
    fill: "#333333",
    fontFamily: "Almendra SC",
    fontSize: 18,
    letterSpacing: 0,
    offsetXEm: 0,
    offsetYEm: 0,
    opacity: 1,
    shadow: null,
    stroke: "#ffffff",
    strokeWidth: 0
  };
}
