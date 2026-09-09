/// <reference types="node" />
import { readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyRouteLineStyle,
  ROUTE_GROUP_DEFAULTS,
  ROUTE_TYPE_DEFAULTS,
  readPresetAttrs,
  routeGroupStyle,
  routeTypeStyle
} from "./route-styles";

// The shipped defaults live in the style store's bundled JSON (src/generators/default-styles.json).
// Read via fs with node:url's URL (not the jsdom-patched global URL, which resolves file:// bases
// against window.location instead of the given base) to resolve the path.
const defaultStyles = JSON.parse(
  readFileSync(fileURLToPath(new NodeURL("../generators/default-styles.json", import.meta.url)), "utf8")
) as { routes: { groups: Record<string, { attrs: Record<string, unknown> }> } };

// Every overland type the generator can emit (routes-generator.ts assigns these).
const EMITTED_TYPES = ["royal", "main", "market", "town", "trail", "footpath"];
// Sea-trade tiers; the generator tags every sea route with one of them.
const SEA_TYPES = ["feeder", "coastal"];
const GROUPS = ["roads", "trails", "searoutes", "airroutes", "traderoutes"];

describe("ROUTE_TYPE_DEFAULTS", () => {
  it("styles every type the generator can emit, so none renders unstyled", () => {
    for (const t of [...EMITTED_TYPES, ...SEA_TYPES]) {
      const s = routeTypeStyle(t);
      expect(s, t).toBeDefined();
      expect(s!["stroke-width"], t).toBeGreaterThan(0);
      expect(s!, t).toHaveProperty("stroke-dasharray");
    }
  });

  it("orders width by importance: royal > main > market > town > trail > footpath", () => {
    const w = EMITTED_TYPES.map(t => ROUTE_TYPE_DEFAULTS[t]["stroke-width"]);
    for (let i = 1; i < w.length; i++) expect(w[i]).toBeLessThan(w[i - 1]);
  });

  it("keeps the trunk roads solid and the paths dotted with a round cap", () => {
    expect(ROUTE_TYPE_DEFAULTS.royal["stroke-dasharray"]).toBeNull();
    expect(ROUTE_TYPE_DEFAULTS.main["stroke-dasharray"]).toBeNull();
    for (const dotted of ["trail", "footpath"]) {
      expect(ROUTE_TYPE_DEFAULTS[dotted]["stroke-linecap"]).toBe("round");
      // a near-zero dash length renders as a dot only with a round cap
      expect(ROUTE_TYPE_DEFAULTS[dotted]["stroke-dasharray"]!.startsWith("0.5")).toBe(true);
    }
  });

  it("gives market/town/trail distinct dashes, not one shared pattern", () => {
    const dashes = ["market", "town", "trail"].map(t => ROUTE_TYPE_DEFAULTS[t]["stroke-dasharray"]);
    expect(new Set(dashes).size).toBe(3);
  });

  it("draws the sea tiers with the sea lane dash, not an overland one", () => {
    for (const t of SEA_TYPES) {
      expect(ROUTE_TYPE_DEFAULTS[t]["stroke-dasharray"], t).toBe(ROUTE_GROUP_DEFAULTS.searoutes["stroke-dasharray"]);
      expect(ROUTE_TYPE_DEFAULTS[t]["stroke-linecap"], t).toBe(ROUTE_GROUP_DEFAULTS.searoutes["stroke-linecap"]);
    }
    expect(ROUTE_TYPE_DEFAULTS.feeder["stroke-width"]).toBeGreaterThan(ROUTE_TYPE_DEFAULTS.coastal["stroke-width"]);
  });

  it("leaves a legacy sea route type unstyled so it inherits its group", () => {
    expect(routeTypeStyle("local")).toBeUndefined();
  });
});

describe("ROUTE_GROUP_DEFAULTS", () => {
  it("styles every route group, including the special sea/air/trade lanes", () => {
    for (const g of GROUPS) {
      const s = routeGroupStyle(g);
      expect(s, g).toBeDefined();
      expect(s!["stroke-width"], g).toBeGreaterThan(0);
    }
  });

  it("makes trade lanes bolder than a town road", () => {
    expect(ROUTE_GROUP_DEFAULTS.traderoutes["stroke-width"]).toBeGreaterThan(ROUTE_TYPE_DEFAULTS.town["stroke-width"]);
  });
});

describe("accessors", () => {
  it("return undefined for an unknown type/group rather than throwing", () => {
    expect(routeTypeStyle("nonsense")).toBeUndefined();
    expect(routeGroupStyle("nonsense")).toBeUndefined();
  });
});

describe("applyRouteLineStyle (preset wins, defaults fill gaps)", () => {
  it("applies the default hierarchy when the preset supplies nothing", () => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
    applyRouteLineStyle(el, ROUTE_TYPE_DEFAULTS.market, undefined);
    expect(el.getAttribute("stroke-width")).toBe("1.1");
    expect(el.getAttribute("stroke-dasharray")).toBe("6 4");
    expect(el.getAttribute("stroke-linecap")).toBe("butt");
  });

  it("lets a preset value override the default", () => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
    applyRouteLineStyle(el, ROUTE_TYPE_DEFAULTS.market, { "stroke-width": 3, stroke: "#abcdef" });
    expect(el.getAttribute("stroke-width")).toBe("3"); // preset wins
    expect(el.getAttribute("stroke")).toBe("#abcdef"); // preset-only attr passes through
    expect(el.getAttribute("stroke-dasharray")).toBe("6 4"); // default fills the gap
  });

  it("removes stroke-dasharray for a solid default (null)", () => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
    el.setAttribute("stroke-dasharray", "2"); // stale value from a prior render
    applyRouteLineStyle(el, ROUTE_TYPE_DEFAULTS.royal, undefined);
    expect(el.hasAttribute("stroke-dasharray")).toBe(false);
  });
});

describe("default styles match the group hierarchy (width, not colour)", () => {
  // route types have no place in the style store, so only the groups are cross-checked
  it("sets every route group to its default width", () => {
    for (const group of GROUPS) {
      const attrs = defaultStyles.routes.groups[group]?.attrs;
      expect(attrs, group).toBeDefined();
      expect(attrs["stroke-width"], group).toBe(ROUTE_GROUP_DEFAULTS[group]["stroke-width"]);
    }
  });
});

describe("readPresetAttrs", () => {
  it("returns only present attributes, omitting absent ones", () => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
    el.setAttribute("stroke-width", "0.35");
    const attrs = readPresetAttrs(el, ["stroke-width", "stroke-dasharray", "stroke-linecap"]);
    expect(attrs).toEqual({ "stroke-width": "0.35" });
    expect(attrs).not.toHaveProperty("stroke-dasharray");
  });
});

describe("preset group style survives applyRouteLineStyle via readPresetAttrs (drawRoutes regression)", () => {
  const attrNames = ["stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "opacity", "filter", "mask"];

  it("keeps a preset's group-level width/dash instead of letting the default clobber them", () => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
    el.setAttribute("stroke-width", "0.35");
    el.setAttribute("stroke-dasharray", "1 2");

    applyRouteLineStyle(el, ROUTE_GROUP_DEFAULTS.searoutes, readPresetAttrs(el, attrNames));

    expect(el.getAttribute("stroke-width")).toBe("0.35");
    expect(el.getAttribute("stroke-dasharray")).toBe("1 2");
  });

  it("falls back to the default when the element has no line attributes set", () => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "g");

    applyRouteLineStyle(el, ROUTE_GROUP_DEFAULTS.searoutes, readPresetAttrs(el, attrNames));

    expect(el.getAttribute("stroke-width")).toBe(String(ROUTE_GROUP_DEFAULTS.searoutes["stroke-width"]));
    expect(el.getAttribute("stroke-dasharray")).toBe(ROUTE_GROUP_DEFAULTS.searoutes["stroke-dasharray"]);
  });
});
