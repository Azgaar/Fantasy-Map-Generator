import { beforeEach, describe, expect, it } from "vitest";
import { readBurgLabelStyles } from "./label-style";
import { REST_PX, START_PX } from "./tier-table";

// Group style is data, not DOM, so most of these mount no DOM at all.

interface GroupSpec {
  name: string;
  fontSize: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  minZoom?: number | null;
}

function setGroups(specs: GroupSpec[]): void {
  (globalThis as any).options = {
    map: {
      labels: {
        groups: specs.map(spec => ({
          name: spec.name,
          type: "burg",
          zoom: { min: spec.minZoom ?? null, max: null }
        }))
      }
    }
  };
  (globalThis as any).styles = {
    labels: {
      groups: Object.fromEntries(
        specs.map(spec => [
          spec.name,
          {
            attrs: {
              "font-size": spec.fontSize,
              fill: spec.fill ?? "#3e3e4b",
              stroke: spec.stroke ?? "",
              "stroke-width": spec.strokeWidth ?? 0
            }
          }
        ])
      )
    }
  };
}

function mountShells(shells: Record<string, Record<string, string>>): void {
  const inner = Object.entries(shells)
    .map(([name, attrs]) => {
      const a = Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");
      return `<g id="labels-${name}" ${a}></g>`;
    })
    .join("");
  document.body.innerHTML = `<svg><g id="labels">${inner}</g></svg>`;
}

beforeEach(() => {
  document.body.innerHTML = "";
  setGroups([]);
});

describe("readBurgLabelStyles", () => {
  it("reads the authored size from the group's percentage font-size", () => {
    setGroups([{ name: "capital", fontSize: "4.98%" }]);
    expect(readBurgLabelStyles().capital.fontSize).toBeCloseTo(4.98, 5);
  });

  it("falls back to a default size when the group has no usable font-size", () => {
    setGroups([{ name: "capital", fontSize: "" }]);
    expect(readBurgLabelStyles().capital.fontSize).toBeGreaterThan(0);
  });

  it("takes rank, min-zoom and size bounds from the tier table", () => {
    // 4.98 is capital's reference d (factor 1); 1 is far below hamlet's reference (1.66), clamped
    // to the 0.75 factor floor, but capital's startPx is still far larger in absolute terms.
    setGroups([
      { name: "capital", fontSize: "4.98%" },
      { name: "hamlet", fontSize: "1%" }
    ]);
    const s = readBurgLabelStyles();
    expect(s.capital.rank).toBeLessThan(s.hamlet.rank);
    expect(s.capital.minZoom).toBe(3);
    expect(s.hamlet.minZoom).toBe(14);
    expect(s.capital.startPx).toBeGreaterThan(s.hamlet.startPx);
    expect(s.capital.restPx).toBeGreaterThan(s.hamlet.restPx);
  });

  it("honours the group's configured min zoom over the tier default", () => {
    setGroups([{ name: "capital", fontSize: "4%", minZoom: 7 }]);
    expect(readBurgLabelStyles().capital.minZoom).toBe(7);
  });

  it("multiplies startPx/restPx by the authored-size factor, clamped", () => {
    // huge authored size clamps the factor at 1.5. Derived from the tier table rather than
    // hardcoded so that tuning START_PX/REST_PX doesn't fail this test for the wrong reason —
    // what is under test is the clamped multiplication, not the constants themselves.
    setGroups([{ name: "capital", fontSize: "1000%" }]);
    const s = readBurgLabelStyles();
    expect(s.capital.startPx).toBeCloseTo(START_PX.capital * 1.5, 10);
    expect(s.capital.restPx).toBeCloseTo(REST_PX.capital * 1.5, 10);
  });

  it("reads fill and halo, and falls back to a modest default halo width when no stroke is set", () => {
    // No preset sets a `stroke` on a burg-label group, so a 0-width fallback here would silently
    // disable the halo everywhere — a small capital label needs it to stay readable over a big
    // state name (see webgl-burg-labels.ts's uHaloEdge).
    setGroups([
      { name: "capital", fontSize: "4%", fill: "#112233", stroke: "#ffffff", strokeWidth: 2 },
      { name: "hamlet", fontSize: "1%", fill: "#445566" }
    ]);
    const s = readBurgLabelStyles();
    expect(s.capital.fill).toBe("#112233");
    expect(s.capital.halo).toBe("#ffffff");
    expect(s.capital.haloWidth).toBe(2);
    expect(s.hamlet.haloWidth).toBeGreaterThan(0);
  });

  it("records a layer-switched-off group as hidden", () => {
    setGroups([
      { name: "capital", fontSize: "4%" },
      { name: "hamlet", fontSize: "1%" }
    ]);
    mountShells({ capital: { "data-layer-off": "true" }, hamlet: {} });
    const s = readBurgLabelStyles();
    expect(s.capital.hidden).toBe(true);
    expect(s.hamlet.hidden).toBe(false);
  });

  it("does NOT treat the per-tier zoom gate as hidden", () => {
    // The zoom gate hides shells via the .hidden class / display. The GL renderers gate by zoom
    // themselves, so baking that into a rebuild would cull whole tiers until the next rebuild —
    // labels/icons vanishing until the layer is toggled.
    setGroups([
      { name: "hamlet", fontSize: "1%" },
      { name: "city", fontSize: "2%" }
    ]);
    mountShells({ hamlet: { class: "hidden" }, city: { style: "display:none" } });
    const s = readBurgLabelStyles();
    expect(s.hamlet.hidden).toBe(false);
    expect(s.city.hidden).toBe(false);
  });

  it("returns an empty map when no burg groups are configured", () => {
    setGroups([]);
    expect(readBurgLabelStyles()).toEqual({});
  });

  it("ignores non-burg label groups", () => {
    setGroups([{ name: "capital", fontSize: "4%" }]);
    (globalThis as any).options.map.labels.groups.push({ name: "river", type: "river", zoom: { min: 6, max: 40 } });
    expect(Object.keys(readBurgLabelStyles())).toEqual(["capital"]);
  });

  // Regression: shells are appended in SVG paint order (least important first, so capitals paint
  // on top), which is the exact inverse of collision priority. Deriving rank from order once let
  // hamlets outrank capitals and monopolise the screen.
  it("ranks groups by importance, not by declaration order", () => {
    setGroups(["hamlet", "village", "city", "capital"].map(name => ({ name, fontSize: "2%" })));
    const s = readBurgLabelStyles();
    expect(s.capital.rank).toBeLessThan(s.city.rank);
    expect(s.city.rank).toBeLessThan(s.village.rank);
    expect(s.village.rank).toBeLessThan(s.hamlet.rank);
  });
});
