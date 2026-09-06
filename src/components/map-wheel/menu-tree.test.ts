import { readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";
import { describe, expect, it } from "vitest";
import { Layers } from "@/components/layers";
import { ITEM_CAPS, MAX_DEPTH } from "./geometry";
import {
  BOUND_BUTTON_IDS,
  LAYER_GROUPS,
  menuRoot,
  OPTION_GROUPS,
  STYLE_PRESETS,
  TOOL_EDITORS,
  TOOL_MORE,
  TOOL_OVERVIEWS,
  TOOL_REGENERATE
} from "./menu-tree";
import { childrenOf, nodeKind, type WheelNode } from "./types";

// node:url's URL (not the jsdom-patched global, which resolves file:// bases against
// window.location instead of the given base) - see src/renderers/route-styles.test.ts
const INDEX_HTML = readFileSync(fileURLToPath(new NodeURL("../../index.html", import.meta.url)), "utf8");
const hasId = (id: string) => INDEX_HTML.includes(`id="${id}"`);

const walk = (nodes: WheelNode[], level = 0, out: Array<{ node: WheelNode; level: number }> = []) => {
  for (const node of nodes) {
    out.push({ node, level });
    walk(childrenOf(node), level + 1, out);
  }
  return out;
};

describe("menu root", () => {
  it("is the five global menus", () => {
    expect(menuRoot().map(n => n.label)).toEqual(["Layers", "Style", "Options", "Tools", "About"]);
  });
});

describe("geometry budget", () => {
  it("keeps every ring inside its level's item cap", () => {
    const check = (nodes: WheelNode[], level: number): void => {
      expect(nodes.length, `level ${level} ring of ${nodes.length}`).toBeLessThanOrEqual(ITEM_CAPS[level]);
      for (const node of nodes) {
        const kids = childrenOf(node);
        if (kids.length) check(kids, level + 1);
      }
    };
    check(menuRoot(), 0);
  });

  it("never nests deeper than the four rings the wheel has", () => {
    for (const { level } of walk(menuRoot())) expect(level).toBeLessThan(MAX_DEPTH);
  });
});

describe("node shape", () => {
  it("gives every node exactly one thing to do", () => {
    for (const { node } of walk(menuRoot())) {
      expect(nodeKind(node), `"${node.label}" does nothing`).not.toBe("inert");
    }
  });

  it("gives every node an icon", () => {
    for (const { node } of walk(menuRoot())) expect(node.icon).toMatch(/^icon-/);
  });
});

describe("layers branch", () => {
  const layers = () => menuRoot().find(n => n.label === "Layers")!;

  it("offers an escape hatch to the list UI, since order cannot be expressed radially", () => {
    expect(childrenOf(layers()).some(n => n.label.startsWith("Reorder"))).toBe(true);
  });

  it("covers every toggleable layer exactly once", () => {
    const toggles = walk(menuRoot())
      .map(({ node }) => node.toggle)
      .filter(Boolean);
    const expected = Layers.all.filter(l => !l.params.permanent).map(l => l.id);

    expect([...toggles].sort()).toEqual([...expected].sort());
  });

  it("never offers a permanent layer, which has no off state", () => {
    const permanent = new Set(Layers.all.filter(l => l.params.permanent).map(l => l.id));
    for (const group of LAYER_GROUPS) {
      for (const id of group.layers) expect(permanent.has(id)).toBe(false);
    }
  });

  it("names only registered layers", () => {
    for (const group of LAYER_GROUPS) {
      for (const id of group.layers) expect(Layers.has(id)).toBe(true);
    }
  });
});

describe("options branch", () => {
  const options = () => menuRoot().find(n => n.label === "Options")!;

  it("offers six themed drawers plus the non-form entries", () => {
    expect(childrenOf(options()).map(n => n.label)).toEqual([
      "World",
      "Realms",
      "Peoples",
      "Identity",
      "Interface",
      "Behaviour",
      "Units",
      "World configuration",
      "File",
      "Reset options"
    ]);
  });

  it("assigns every setting row exactly once across the six themes", () => {
    // the expected count is DERIVED from the real markup, never hardcoded: a hardcoded number
    // silently passes when an upstream sync adds a row, leaving that setting unreachable
    const block = INDEX_HTML.slice(INDEX_HTML.indexOf('id="optionsContent"'), INDEX_HTML.indexOf('id="toolsContent"'));
    const rowCount = block.split(/<tr\b/).length - 1;

    const rows = OPTION_GROUPS.flatMap(g => g.rows);
    expect(new Set(rows).size).toBe(rows.length); // no row claimed twice
    expect(rows.length).toBe(rowCount); // no row left unclaimed
  });

  it("puts each anchor in a distinct row, so no theme silently swallows two settings", () => {
    const block = INDEX_HTML.slice(INDEX_HTML.indexOf('id="optionsContent"'), INDEX_HTML.indexOf('id="toolsContent"'));
    const rows = block.split(/<tr\b/).slice(1);
    const claimed = OPTION_GROUPS.flatMap(g => g.rows).map(id => rows.findIndex(row => row.includes(`id="${id}"`)));
    expect(claimed).not.toContain(-1);
    expect(new Set(claimed).size).toBe(claimed.length);
  });

  it("anchors every theme on controls that exist in index.html", () => {
    for (const group of OPTION_GROUPS) {
      for (const id of group.rows) expect(hasId(id), `${group.label} -> #${id}`).toBe(true);
    }
  });

  it("routes each theme to the options form rather than duplicating it", () => {
    for (const child of childrenOf(options()).slice(0, 6)) {
      expect(child.panel?.host).toBe("optionsContent");
      expect(child.panel?.only?.length).toBeGreaterThan(0);
    }
  });

  it("marks resetting options as destructive", () => {
    expect(childrenOf(options()).find(n => n.label === "Reset options")!.danger).toBe(true);
  });
});

describe("style branch", () => {
  const style = () => menuRoot().find(n => n.label === "Style")!;

  it("lists the style presets that actually ship", () => {
    expect(STYLE_PRESETS).toEqual([
      "ancient",
      "atlas",
      "clean",
      "cyberpunk",
      "darkSeas",
      "gloom",
      "light",
      "monochrome",
      "night",
      "pale",
      "watercolor"
    ]);
  });

  it("opens the real style form in the drawer", () => {
    expect(childrenOf(style()).find(n => n.label === "Style editor")!.panel?.host).toBe("styleContent");
  });
});

describe("about", () => {
  it("opens in the drawer rather than the tab", () => {
    expect(menuRoot().find(n => n.label === "About")!.panel?.host).toBe("aboutContent");
  });
});

describe("bindings", () => {
  it("resolves every button-backed leaf to an id present in index.html", () => {
    for (const id of BOUND_BUTTON_IDS) expect(hasId(id), `#${id}`).toBe(true);
  });
});

describe("tools branch", () => {
  const tools = () => menuRoot().find(n => n.label === "Tools")!;

  it("splits into five branches", () => {
    expect(childrenOf(tools()).map(n => n.label)).toEqual(["Edit", "Overview", "Add", "Regenerate", "More"]);
  });

  it("keeps the editor ring at the level-2 cap, not over it", () => {
    expect(TOOL_EDITORS.length).toBe(15);
    expect(TOOL_EDITORS.length).toBeLessThanOrEqual(ITEM_CAPS[2]);
  });

  it("keeps the heightmap editor under Edit, where the heightmap is actually edited", () => {
    expect(TOOL_EDITORS.some(([label]) => label === "Heightmap")).toBe(true);
  });

  it("holds every regenerate command, grouped so no single ring overflows", () => {
    // count DERIVED from the real markup, never hardcoded: a hardcoded number passes silently
    // when an upstream sync adds a command, leaving it unreachable from the wheel
    const block = INDEX_HTML.slice(INDEX_HTML.indexOf('id="regenerateFeature"'), INDEX_HTML.indexOf('id="addFeature"'));
    const inMarkup = [...block.matchAll(/<button[^>]*id="(regenerate[A-Za-z]+)"/g)].map(m => m[1]);
    const claimed = TOOL_REGENERATE.flatMap(g => g.items).map(([, , id]) => id);

    expect([...claimed].sort()).toEqual([...inMarkup].sort());
    for (const group of TOOL_REGENERATE) expect(group.items.length).toBeLessThanOrEqual(ITEM_CAPS[3]);
  });

  it("leaves no tool button unreachable from the wheel", () => {
    // Any edit*/overview*/open* button in the Tools tab must be claimed by the tree, or listed
    // here as deliberately reached from somewhere else. An upstream sync that adds a tool then
    // fails this test instead of quietly shipping a tool the wheel cannot open.
    const block = INDEX_HTML.slice(
      INDEX_HTML.indexOf('id="toolsContent"'),
      INDEX_HTML.indexOf('id="customizationMenu"')
    );
    const inMarkup = [...block.matchAll(/<button[^>]*id="((?:edit|overview|open)[A-Za-z]+)"/g)].map(m => m[1]);

    const ELSEWHERE = ["editUnitsButton"]; // moved to Options, where units belong
    const claimed = new Set([
      ...[...TOOL_EDITORS, ...TOOL_OVERVIEWS, ...TOOL_MORE].map(([, , id]) => id),
      ...ELSEWHERE
    ]);

    expect(inMarkup.filter(id => !claimed.has(id))).toEqual([]);
  });

  it("marks every regenerate command destructive", () => {
    const regenerate = childrenOf(tools()).find(n => n.label === "Regenerate")!;
    for (const group of childrenOf(regenerate)) {
      for (const item of childrenOf(group)) expect(item.danger, item.label).toBe(true);
    }
  });

  it("does not list Units, which now lives under Options", () => {
    expect(TOOL_EDITORS.some(([label]) => label === "Units")).toBe(false);
  });

  it("binds every tool to a button that exists", () => {
    for (const [, , id] of [...TOOL_EDITORS, ...TOOL_OVERVIEWS]) expect(hasId(id), `#${id}`).toBe(true);
    for (const group of TOOL_REGENERATE) {
      for (const [, , id] of group.items) expect(hasId(id), `#${id}`).toBe(true);
    }
  });
});
