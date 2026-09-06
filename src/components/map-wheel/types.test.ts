import { describe, expect, it } from "vitest";
import { childrenOf, nodeKind, type WheelNode } from "./types";

const node = (extra: Partial<WheelNode>): WheelNode => ({ label: "x", icon: "icon-star", ...extra });

describe("nodeKind", () => {
  it("ranks toggle first so a layer sector never falls through to another branch", () => {
    expect(nodeKind(node({ toggle: "borders", run: () => {} }))).toBe("toggle");
  });

  it("identifies each remaining kind", () => {
    expect(nodeKind(node({ pick: 2 }))).toBe("pick");
    expect(nodeKind(node({ panel: { host: "aboutContent", title: "About" } }))).toBe("panel");
    expect(nodeKind(node({ children: [] }))).toBe("children");
    expect(nodeKind(node({ run: () => {} }))).toBe("run");
  });

  it("treats a node with nothing to do as inert", () => {
    expect(nodeKind(node({}))).toBe("inert");
  });
});

describe("childrenOf", () => {
  it("returns a static child list", () => {
    const kid = node({ label: "kid" });
    expect(childrenOf(node({ children: [kid] }))).toEqual([kid]);
  });

  it("calls a thunk so live state is read at open time, not at definition time", () => {
    let calls = 0;
    const parent = node({
      children: () => {
        calls++;
        return [node({ label: `call ${calls}` })];
      }
    });
    expect(childrenOf(parent)[0].label).toBe("call 1");
    expect(childrenOf(parent)[0].label).toBe("call 2");
  });

  it("returns an empty list for a childless node", () => {
    expect(childrenOf(node({ run: () => {} }))).toEqual([]);
  });
});
