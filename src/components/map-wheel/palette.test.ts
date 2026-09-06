import { afterEach, describe, expect, it } from "vitest";
import { applyPalette, contrast, EDGE, EDGE_DIM, FILLS, INKS, readable, readPalette, withAlpha } from "./palette";

/**
 * changeDialogsTheme() derives the whole palette from one colour through d3.hsl, so a fixture is a
 * theme colour plus the offsets that function applies: --light-solid is l+0.05, --dark-solid l-0.2,
 * --header-active l-0.09, --bg-lighter l+0.02, --bg-light l+0.06 (with s-0.02).
 */
const THEME_VARS = ["--light-solid", "--dark-solid", "--header-active", "--bg-lighter", "--bg-light"];

/**
 * Values reproduced from changeDialogsTheme across the lightness range, at the default transparency
 * of 5 (so alpha .95, and alphaReduced saturates at 1). Generated with the same d3.hsl offsets that
 * function applies, not by eye.
 */
const THEMES = {
  // FMG's own default, #997787 - where a hue-slider-only change stays, since the hue slider keeps l
  default: {
    "--light-solid": "rgb(165, 133, 148)",
    "--dark-solid": "rgb(97, 73, 84)",
    "--header-active": "rgb(129, 97, 112)",
    "--bg-lighter": "rgba(157, 125, 140, 0.95)",
    "--bg-light": "rgba(164, 139, 151, 0.95)"
  },
  // #ffffff: --light-solid saturates at white and even --dark-solid is pale
  white: {
    "--light-solid": "rgb(255, 255, 255)",
    "--dark-solid": "rgb(204, 204, 204)",
    "--header-active": "rgb(232, 232, 232)",
    "--bg-lighter": "rgba(255, 255, 255, 0.95)",
    "--bg-light": "rgba(255, 255, 255, 0.95)"
  },
  // #dfe9f5: a pale blue, the shade a user picking "a light theme" actually lands on
  pale: {
    "--light-solid": "rgb(242, 246, 251)",
    "--dark-solid": "rgb(145, 180, 221)",
    "--header-active": "rgb(188, 209, 234)",
    "--bg-lighter": "rgba(231, 238, 247, 0.95)",
    "--bg-light": "rgba(246, 249, 252, 0.95)"
  },
  // #221a20: every ground is near-black, so the light ink has almost nothing left to gain
  dark: {
    "--light-solid": "rgb(49, 37, 46)",
    "--dark-solid": "rgb(0, 0, 0)",
    "--header-active": "rgb(8, 6, 8)",
    "--bg-lighter": "rgba(40, 30, 37, 0.95)",
    "--bg-light": "rgba(50, 40, 48, 0.95)"
  }
} as const;

const applyTheme = (theme: Record<string, string>): void => {
  for (const [name, value] of Object.entries(theme)) document.documentElement.style.setProperty(name, value);
};

afterEach(() => {
  for (const name of THEME_VARS) document.documentElement.style.removeProperty(name);
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

  // the direction depends entirely on the background, which is why one ink cannot serve several
  it("moves the same ink opposite ways for a light and a dark background", () => {
    expect(readable("#808080", "#ffffff")).not.toBe(readable("#808080", "#000000"));
  });
});

describe("readPalette", () => {
  it("falls back to the design handoff exactly when the app has published no theme", () => {
    const pal = readPalette();
    expect(pal.fills).toEqual({ ...FILLS });
    expect(pal.inks).toEqual({
      onChosen: INKS.light,
      onHot: INKS.light,
      onDanger: INKS.light,
      layerOn: INKS.layerOn,
      danger: INKS.danger,
      dim: INKS.dim,
      base: INKS.base,
      accent: FILLS.hot
    });
    expect(pal.edge).toBe(EDGE);
    expect(pal.edgeDim).toBe(EDGE_DIM);
  });

  it("follows the app's theme variables when they are set", () => {
    applyTheme({ ...THEMES.default });
    const pal = readPalette();
    expect(pal.fills.base).toBe("rgba(165,133,148,0.97)");
    expect(pal.fills.dim).toBe("rgba(165,133,148,0.82)");
    expect(pal.fills.chosen).toBe("rgb(97, 73, 84)");
    expect(pal.fills.hot).toBe("rgb(129, 97, 112)");
    expect(pal.edge).toBe("rgba(97,73,84,0.32)");
  });

  // danger and layer-on carry meaning, not style: a hue slider must not be able to turn "this
  // deletes things" into the same colour as everything else
  it("keeps the danger red and the layer-on green literal", () => {
    applyTheme({ ...THEMES.default });
    const pal = readPalette();
    expect(pal.fills.hotDanger).toBe(FILLS.hotDanger);
    expect(pal.fills.layerOn).toBe(FILLS.layerOn);
    expect(pal.inks.layerOn).toBe(INKS.layerOn);
  });

  // The universal this test names has to be exercised as a universal. A single ink shared across
  // the chosen fill, the hover fill and the danger red passed at the default theme and failed badly
  // at either end of the lightness range - 1.18:1 for light ink on the danger red at a white theme.
  describe.each(Object.keys(THEMES) as (keyof typeof THEMES)[])("under the %s theme", name => {
    /** Every ink the wheel paints, against the ground it is actually painted on */
    const pairs = (theme: Record<string, string>): [string, string, string][] => {
      const { fills, inks } = readPalette();
      return [
        ["base ink on the default fill", inks.base, fills.base],
        ["dimmed ink on the dimmed fill", inks.dim, fills.dim],
        ["danger ink on the default fill", inks.danger, fills.base],
        ["light ink on the chosen fill", inks.onChosen, fills.chosen],
        ["light ink on the hover fill", inks.onHot, fills.hot],
        ["light ink on the danger fill", inks.onDanger, fills.hotDanger],
        ["layer-on ink on the layer-on fill", inks.layerOn, fills.layerOn],
        ["accent on the hub tab", inks.accent, fills.base],
        ["accent on the breadcrumb", inks.accent, theme["--bg-lighter"]],
        ["accent on the drawer", inks.accent, theme["--bg-light"]]
      ];
    };

    it("holds every ink to 4.5:1 over the ground it is painted on", () => {
      const theme: Record<string, string> = { ...THEMES[name] };
      applyTheme(theme);
      for (const [what, ink, ground] of pairs(theme)) {
        expect(contrast(ink, ground), `${what}: ${ink} on ${ground}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("does not fade a dimmed sibling further than the .82 pair the spec allows", () => {
      applyTheme({ ...THEMES[name] });
      const { fills, inks } = readPalette();
      expect(fills.dim.endsWith(",0.82)")).toBe(true);
      expect(inks.dim.endsWith(",0.82)")).toBe(true);
    });
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

  // the stylesheet paints the light ink on one ground only - the hub's active tab, on the hot fill
  it("publishes the light ink resolved for the ground the stylesheet uses it on", () => {
    applyTheme({ ...THEMES.white });
    const el = document.createElement("div");
    const pal = readPalette();
    applyPalette(el, pal);
    expect(el.style.getPropertyValue("--mw-ink-light")).toBe(pal.inks.onHot);
    expect(contrast(el.style.getPropertyValue("--mw-ink-light"), pal.fills.hot)!).toBeGreaterThanOrEqual(4.5);
  });
});
