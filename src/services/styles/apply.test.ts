import { beforeEach, describe, expect, test } from "vitest";
import { applyStyleNode, buildAttributeOps } from "./apply";

// minimal Element stand-in covering exactly what applyStyleNode calls: querySelector for the two
// ":scope > [attr=...]" forms it uses, setAttribute/getAttribute/removeAttribute, appendChild.
// No jsdom dependency in this repo (see project memory) - this is intentionally hand-rolled.
class FakeElement {
  attrs = new Map<string, string>();
  children: FakeElement[] = [];

  setAttribute(name: string, value: string) {
    this.attrs.set(name, value);
  }
  getAttribute(name: string) {
    return this.attrs.has(name) ? this.attrs.get(name)! : null;
  }
  removeAttribute(name: string) {
    this.attrs.delete(name);
  }
  appendChild(child: FakeElement) {
    this.children.push(child);
  }
  querySelector(selector: string): FakeElement | null {
    const match = selector.match(/^:scope > \[(id|data-group)="([^"]+)"\]$/);
    if (!match) throw new Error(`unsupported selector in test double: ${selector}`);
    const [, attr, value] = match;
    return this.children.find(child => child.getAttribute(attr) === value) ?? null;
  }
}

beforeEach(() => {
  (globalThis as any).document = {
    createElementNS: () => new FakeElement()
  };
});

describe("buildAttributeOps", () => {
  test("flattens presentation and children into pathed ops, stringifying numbers", () => {
    const ops = buildAttributeOps({
      presentation: { opacity: 0.9, mask: "url(#land)" },
      children: {
        roads: { presentation: { "stroke-width": 0.7 } },
        trails: { presentation: { filter: null }, children: { inner: { presentation: { stroke: "#fff" } } } }
      }
    });
    expect(ops).toEqual([
      { path: [], attr: "opacity", value: "0.9" },
      { path: [], attr: "mask", value: "url(#land)" },
      { path: ["roads"], attr: "stroke-width", value: "0.7" },
      { path: ["trails"], attr: "filter", value: null },
      { path: ["trails", "inner"], attr: "stroke", value: "#fff" }
    ]);
  });

  test("options never produce attribute ops", () => {
    expect(buildAttributeOps({ options: { set: "simple", size: 2 } })).toEqual([]);
  });

  test("empty node produces no ops", () => {
    expect(buildAttributeOps({})).toEqual([]);
  });
});

describe("applyStyleNode", () => {
  test("creates a missing child by default and writes its attrs", () => {
    const root = new FakeElement();
    applyStyleNode(root as unknown as Element, { children: { roads: { presentation: { stroke: "#000" } } } });
    expect(root.children).toHaveLength(1);
    expect(root.children[0].getAttribute("id")).toBe("roads");
    expect(root.children[0].getAttribute("stroke")).toBe("#000");
  });

  test("matches an existing child by data-group before creating one (label group id scheme)", () => {
    const root = new FakeElement();
    const labelsCapital = new FakeElement();
    labelsCapital.setAttribute("id", "labels-capital");
    labelsCapital.setAttribute("data-group", "capital");
    root.appendChild(labelsCapital);

    applyStyleNode(root as unknown as Element, { children: { capital: { presentation: { fill: "#fff" } } } });

    expect(root.children).toHaveLength(1); // no stray id="capital" sibling created
    expect(labelsCapital.getAttribute("fill")).toBe("#fff");
  });

  test("prefers an id match over a data-group match when both exist", () => {
    const root = new FakeElement();
    const byId = new FakeElement();
    byId.setAttribute("id", "capital");
    const byDataGroup = new FakeElement();
    byDataGroup.setAttribute("id", "labels-capital");
    byDataGroup.setAttribute("data-group", "capital");
    root.appendChild(byId);
    root.appendChild(byDataGroup);

    applyStyleNode(root as unknown as Element, { children: { capital: { presentation: { fill: "#fff" } } } });

    expect(byId.getAttribute("fill")).toBe("#fff");
    expect(byDataGroup.getAttribute("fill")).toBeNull();
  });

  test("createMissing:false skips writes for a child that doesn't exist yet, without creating one", () => {
    const root = new FakeElement();
    applyStyleNode(
      root as unknown as Element,
      { children: { capital: { presentation: { fill: "#fff" } } } },
      { createMissing: false }
    );
    expect(root.children).toHaveLength(0);
  });

  test("createMissing:false still writes onto a child that does exist", () => {
    const root = new FakeElement();
    const labelsCapital = new FakeElement();
    labelsCapital.setAttribute("id", "labels-capital");
    labelsCapital.setAttribute("data-group", "capital");
    root.appendChild(labelsCapital);

    applyStyleNode(
      root as unknown as Element,
      { children: { capital: { presentation: { fill: "#fff" } } } },
      { createMissing: false }
    );

    expect(root.children).toHaveLength(1);
    expect(labelsCapital.getAttribute("fill")).toBe("#fff");
  });
});
