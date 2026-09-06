import { afterEach, describe, expect, it } from "vitest";
import {
  ALPHA_FLOOR,
  applyPalette,
  contrast,
  EDGE,
  EDGE_DIM,
  FILLS,
  INKS,
  readable,
  readPalette,
  withAlpha
} from "./palette";

/**
 * changeDialogsTheme() derives the whole palette from one colour through d3.hsl, so a fixture is a
 * theme colour plus the offsets that function applies: --light-solid is l+0.05, --dark-solid l-0.2,
 * --header-active l-0.09, --bg-lighter l+0.02, --bg-light l+0.06 (with s-0.02).
 */
const THEME_VARS = ["--light-solid", "--dark-solid", "--header-active", "--bg-lighter", "--bg-light", "--bg-opacity"];

/**
 * Values reproduced from changeDialogsTheme across the lightness range, at the default transparency
 * of 5 (so alpha .95, and alphaReduced saturates at 1). Generated with the same d3.hsl offsets that
 * function applies, not by eye.
 *
 * --bg-lighter and --bg-light are still published here because the app publishes them, but the
 * wheel deliberately no longer paints anything with them: they carry FMG's own alpha, which is how
 * half the dial came to follow the transparency slider while the other half did not.
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
      // the one ink the fallback moves: the accent is painted on the drawer's head, which is the
      // dimmed fill, and the handoff's #6b5535 is 4.36:1 there
      accent: "rgba(103,81,51,1)"
    });
    expect(pal.edge).toBe(EDGE);
    expect(pal.edgeDim).toBe(EDGE_DIM);
  });

  it("follows the app's theme variables when they are set", () => {
    applyTheme({ ...THEMES.default });
    const pal = readPalette();
    expect(pal.fills.base).toBe("rgb(165, 133, 148)");
    // the dimmed sibling is --light-solid carried a quarter of the way to --dark-solid, opaque
    expect(pal.fills.dim).toBe("rgb(148,118,132)");
    expect(pal.fills.chosen).toBe("rgb(97, 73, 84)");
    // --header-active's own alphaReduced is stripped: the wheel applies one alpha of its own
    expect(pal.fills.hot).toBe("rgba(129,97,112,1)");
    expect(pal.edge).toBe("rgb(143,114,128)");
    expect(pal.edgeDim).toBe("rgb(140,111,124)");
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
});

// The user decided the dial should carry their transparency like every other panel in the app. What
// shows through it is the MAP, though, which is arbitrary and at full contrast - so the alpha stops
// at ALPHA_FLOOR, and the contrast guard above (which reads the nominal opaque pair, since the map
// has no fixed colour) stays a true statement about what is on screen.
describe("transparency", () => {
  const alphaOf = (fill: string): number => Number(/,\s*([\d.]+)\)$/.exec(fill)?.[1] ?? 1);

  it("leaves every fill exactly as designed when the user asked for none", () => {
    applyTheme({ ...THEMES.default, "--bg-opacity": "1" });
    const opaque = readPalette().fills;
    applyTheme({ ...THEMES.default });
    expect(opaque).toEqual(readPalette().fills);
  });

  // the slider's whole range is mapped onto [ALPHA_FLOOR, 1]: clamping instead made everything past
  // 20% transparency identical, so most of the control did nothing to the dial
  it("carries the user's transparency onto every sector fill", () => {
    applyTheme({ ...THEMES.default, "--bg-opacity": "0.5" });
    const pal = readPalette();
    // the dimmed sibling is in this list now: it used to hold a baked .82 the veil could not raise
    for (const color of [pal.fills.chosen, pal.fills.hot, pal.fills.base, pal.fills.dim, pal.edge, pal.edgeDim]) {
      expect(alphaOf(color), color).toBeCloseTo(0.9, 6);
    }
  });

  it("moves monotonically with the slider", () => {
    const baseAt = (opacity: string): number => {
      applyTheme({ ...THEMES.default, "--bg-opacity": opacity });
      return alphaOf(readPalette().fills.chosen);
    };
    expect(baseAt("1")).toBeGreaterThan(baseAt("0.75"));
    expect(baseAt("0.75")).toBeGreaterThan(baseAt("0.25"));
    expect(baseAt("0.25")).toBeGreaterThan(baseAt("0"));
  });

  it("stops at the legibility floor however far the slider is pushed", () => {
    applyTheme({ ...THEMES.default, "--bg-opacity": "0" });
    const pal = readPalette();
    for (const name of ["chosen", "hot", "dim", "base"] as const) {
      expect(alphaOf(pal.fills[name]), `${name}: ${pal.fills[name]}`).toBeCloseTo(ALPHA_FLOOR, 6);
    }
    expect(alphaOf(pal.edge), pal.edge).toBeCloseTo(ALPHA_FLOOR, 6);
    expect(alphaOf(pal.edgeDim), pal.edgeDim).toBeCloseTo(ALPHA_FLOOR, 6);
  });

  // exempt for the same reason they are exempt from the hue: they carry meaning, not style - and the
  // green is the one pair the veil could push under 4:1 over a dark map
  it("leaves the danger red and the layer-on green opaque at any transparency", () => {
    for (const opacity of ["1", "0.5", "0"]) {
      applyTheme({ ...THEMES.default, "--bg-opacity": opacity });
      const { fills } = readPalette();
      expect(fills.hotDanger).toBe(FILLS.hotDanger);
      expect(fills.layerOn).toBe(FILLS.layerOn);
    }
  });

  it("ignores an unpublished or unreadable opacity rather than veiling for nothing", () => {
    applyTheme({ ...THEMES.default, "--bg-opacity": "wat" });
    expect(readPalette().fills.chosen).toBe(THEMES.default["--dark-solid"]);
  });
});

// The contrast guard reads the NOMINAL opaque pair, per the spec: the fills carry the user transparency
// and what shows through them is the map, which has no fixed colour. ALPHA_FLOOR is what keeps the
// verdict below true of what is actually rendered.
describe("contrast", () => {
  // The universal this test names has to be exercised as a universal. A single ink shared across
  // the chosen fill, the hover fill and the danger red passed at the default theme and failed badly
  // at either end of the lightness range - 1.18:1 for light ink on the danger red at a white theme.
  describe.each(Object.keys(THEMES) as (keyof typeof THEMES)[])("under the %s theme", name => {
    /**
     * Every ink the wheel paints, against the ground it is actually painted on. Those grounds are
     * all the wheel's OWN fills now: the breadcrumb and the drawer body take the base fill and the
     * drawer's head the dimmed one, where they used to take FMG's --bg-lighter / --bg-light.
     */
    const pairs = (): [string, string, string][] => {
      const { fills, inks } = readPalette();
      return [
        ["base ink on the default fill", inks.base, fills.base],
        ["dimmed ink on the dimmed fill", inks.dim, fills.dim],
        ["danger ink on the default fill", inks.danger, fills.base],
        ["light ink on the chosen fill", inks.onChosen, fills.chosen],
        ["light ink on the hover fill", inks.onHot, fills.hot],
        ["light ink on the danger fill", inks.onDanger, fills.hotDanger],
        ["layer-on ink on the layer-on fill", inks.layerOn, fills.layerOn],
        ["accent on the hub tab and the breadcrumb", inks.accent, fills.base],
        ["accent on the drawer head", inks.accent, fills.dim]
      ];
    };

    it("holds every ink to 4.5:1 over the ground it is painted on", () => {
      applyTheme({ ...THEMES[name] });
      for (const [what, ink, ground] of pairs()) {
        expect(contrast(ink, ground), `${what}: ${ink} on ${ground}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    // De-emphasis is a colour step, so it has to BE one: an opaque dimmed fill that came out equal
    // to the default fill would be no dimming at all, and the old alpha is not there to hide behind.
    it("keeps a dimmed sibling visibly recessed next to a full-strength one", () => {
      applyTheme({ ...THEMES[name] });
      const { fills } = readPalette();
      expect(fills.dim).not.toBe(fills.base);
      expect(contrast(fills.dim, fills.base)!, `${fills.dim} beside ${fills.base}`).toBeGreaterThan(1.05);
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

/**
 * The user's bug: with FMG's Transparency slider at 0 the dial was still see-through - map labels
 * read straight through the sectors - and moving the slider changed some of the wheel's surfaces
 * and not others. The cause was absolute baked-in alphas (.97 on the default fill, .82 on a dimmed
 * sibling, .32/.16 on the strokes) that the veil could only ever lower, next to chrome that took
 * FMG's own --bg-* alpha instead. Nothing in the suite had ever asserted an alpha, so it survived.
 *
 * The invariant: de-emphasis is a COLOUR difference, and the user's transparency is the only source
 * of translucency there is - one alpha, on every surface, at once.
 */
describe("opacity", () => {
  /** hex and rgb() are opaque by definition; only an rgba() can carry anything else */
  const alphaOf = (color: string): number => {
    const rgba = /^rgba\(([^)]+)\)$/i.exec(color.trim());
    if (!rgba) return 1;
    const parts = rgba[1].split(/[\s,/]+/).filter(Boolean);
    return parts.length > 3 ? Number(parts[3]) : 1;
  };

  /** every surface the user's transparency is supposed to move, as name -> colour */
  const surfaces = (): Record<string, string> => {
    const { fills, edge, edgeDim } = readPalette();
    return { base: fills.base, dim: fills.dim, chosen: fills.chosen, hot: fills.hot, edge, edgeDim };
  };

  // "no theme" is in the list on purpose: the design handoff's own constants carried the .97/.82
  const grounds = [["no theme", null], ...Object.entries(THEMES)] as [string, Record<string, string> | null][];

  describe.each(grounds)("under the %s theme", (_name, theme) => {
    it("paints every fill and every stroke fully opaque when transparency is off", () => {
      if (theme) applyTheme({ ...theme, "--bg-opacity": "1" });
      else document.documentElement.style.setProperty("--bg-opacity", "1");
      const { fills } = readPalette();
      for (const [what, color] of Object.entries({ ...surfaces(), ...fills })) {
        expect(alphaOf(color), `${what}: ${color}`).toBe(1);
      }
    });

    it("gives every veiled surface the same alpha at any transparency", () => {
      for (const opacity of ["0.5", "0"]) {
        if (theme) applyTheme({ ...theme, "--bg-opacity": opacity });
        else document.documentElement.style.setProperty("--bg-opacity", opacity);
        const painted = Object.entries(surfaces());
        const [, first] = painted[0];
        for (const [what, color] of painted) {
          expect(alphaOf(color), `at ${opacity}, ${what}: ${color}`).toBeCloseTo(alphaOf(first), 6);
        }
      }
    });

    // the half a "simplification" would collapse: a dimmed sibling that is only a lower alpha of the
    // default fill reads as see-through over a map, which is the bug. It has to be its own COLOUR.
    it("recesses a dimmed sibling by colour rather than by alpha", () => {
      if (theme) applyTheme({ ...theme });
      const { fills } = readPalette();
      const rgbOf = (color: string): string => color.replace(/^rgba?\(/i, "").replace(/,\s*[\d.]+\)$/, "");
      expect(rgbOf(fills.dim)).not.toBe(rgbOf(fills.base));
      expect(alphaOf(fills.dim)).toBe(alphaOf(fills.base));
    });
  });
});
