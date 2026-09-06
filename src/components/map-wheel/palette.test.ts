import { afterEach, describe, expect, it } from "vitest";
import { applyPalette, contrast, EDGE, EDGE_DIM, FILLS, INKS, readable, readPalette, withAlpha } from "./palette";

/** The theme FMG publishes at its default colour (#997787), as changeDialogsTheme() computes it */
const themed = (): void => {
  const style = document.documentElement.style;
  style.setProperty("--light-solid", "rgb(165, 133, 148)");
  style.setProperty("--dark-solid", "rgb(97, 73, 84)");
  style.setProperty("--header-active", "rgba(125, 96, 109, 0.8)");
};

afterEach(() => {
  for (const name of ["--light-solid", "--dark-solid", "--header-active"]) {
    document.documentElement.style.removeProperty(name);
  }
});

describe("withAlpha", () => {
  it("re-emits a hex colour at the alpha it is given", () => {
    expect(withAlpha("#fbf7ec", 0.82)).toBe("rgba(251,247,236,0.82)");
  });

  it("replaces the alpha of an rgba colour rather than compounding it", () => {
    expect(withAlpha("rgba(10, 20, 30, 0.5)", 0.97)).toBe("rgba(10,20,30,0.97)");
  });

  it("leaves a colour it cannot parse alone", () => {
    expect(withAlpha("wheat", 0.5)).toBe("wheat");
  });
});

describe("readable", () => {
  it("leaves an ink that already clears AA untouched", () => {
    expect(readable("#3b3226", "rgba(251,247,236,.97)")).toBe("#3b3226");
  });

  // FMG's own --dark-solid on --light-solid is 2.5:1 at the default theme colour: the hue is the
  // user's to choose, but a 9.5px label has to stay legible at any of them.
  it("darkens an ink that does not, keeping its alpha", () => {
    const fixed = readable("rgba(97,73,84,0.82)", "rgb(165, 133, 148)");
    expect(fixed).not.toBe("rgba(97,73,84,0.82)");
    expect(fixed.endsWith(",0.82)")).toBe(true);
    expect(contrast(fixed, "rgb(165, 133, 148)")!).toBeGreaterThanOrEqual(4.5);
  });

  it("lightens instead when the background is dark", () => {
    const fixed = readable("#6b5535", "#4a3a22");
    expect(contrast(fixed, "#4a3a22")!).toBeGreaterThanOrEqual(4.5);
  });
});

describe("readPalette", () => {
  it("falls back to the design handoff exactly when the app has published no theme", () => {
    const pal = readPalette();
    expect(pal.fills).toEqual({ ...FILLS });
    expect(pal.inks).toEqual({ ...INKS, accent: FILLS.hot });
    expect(pal.edge).toBe(EDGE);
    expect(pal.edgeDim).toBe(EDGE_DIM);
  });

  it("follows the app's theme variables when they are set", () => {
    themed();
    const pal = readPalette();
    expect(pal.fills.base).toBe("rgba(165,133,148,0.97)");
    expect(pal.fills.dim).toBe("rgba(165,133,148,0.82)");
    expect(pal.fills.chosen).toBe("rgb(97, 73, 84)");
    expect(pal.fills.hot).toBe("rgba(125, 96, 109, 0.8)");
    expect(pal.edge).toBe("rgba(97,73,84,0.32)");
  });

  // danger and layer-on carry meaning, not style: a hue slider must not be able to turn "this
  // deletes things" into the same colour as everything else
  it("keeps the danger red and the layer-on green literal", () => {
    themed();
    const pal = readPalette();
    expect(pal.fills.hotDanger).toBe(FILLS.hotDanger);
    expect(pal.fills.layerOn).toBe(FILLS.layerOn);
    expect(pal.inks.layerOn).toBe(INKS.layerOn);
  });

  it("holds every ink to 4.5:1 over the fill it sits on, dimmed siblings included", () => {
    themed();
    const { fills, inks } = readPalette();
    const pairs: [string, string][] = [
      [inks.base, fills.base],
      [inks.dim, fills.dim],
      [inks.danger, fills.base],
      [inks.accent, fills.base],
      [inks.light, fills.hot],
      [inks.light, fills.chosen],
      [inks.layerOn, fills.layerOn]
    ];
    for (const [ink, fill] of pairs) expect(contrast(ink, fill)!).toBeGreaterThanOrEqual(4.5);
  });

  it("does not fade a dimmed sibling further than the .82 pair the spec allows", () => {
    themed();
    const { fills, inks } = readPalette();
    expect(fills.dim.endsWith(",0.82)")).toBe(true);
    expect(inks.dim.endsWith(",0.82)")).toBe(true);
  });
});

describe("applyPalette", () => {
  // SVG presentation attributes cannot take var(), so the fills are resolved in JS - but the hub,
  // breadcrumb and drawer are plain CSS, and they read the same sampled palette back off here.
  it("publishes the sampled palette to the stylesheet as custom properties", () => {
    const el = document.createElement("div");
    applyPalette(el, readPalette());
    expect(el.style.getPropertyValue("--mw-fill-base")).toBe(FILLS.base);
    expect(el.style.getPropertyValue("--mw-ink-light")).toBe(INKS.light);
    expect(el.style.getPropertyValue("--mw-edge-dim")).toBe(EDGE_DIM);
  });
});
