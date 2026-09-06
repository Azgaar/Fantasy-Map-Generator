import { describe, expect, it } from "vitest";
import { Layers } from "@/components/layers";
import { ITEM_CAPS, MAX_DEPTH } from "./geometry";
import { LAYER_GROUPS, menuRoot } from "./menu-tree";
import { childrenOf, nodeKind, type WheelNode } from "./types";

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
