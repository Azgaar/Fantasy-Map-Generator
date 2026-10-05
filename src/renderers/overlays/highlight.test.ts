// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { highlightElement, highlightEmblemElement } from "./highlight";

describe("highlightEmblemElement", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("handles coordinate tuples returned from typed cell arrays", () => {
    document.body.innerHTML = `<svg><g id="debug"></g></svg>`;
    globalThis.pack = {
      cells: {
        i: Uint16Array.from([0]),
        p: [[0, 0]],
        state: Uint16Array.from([1]),
        province: Uint16Array.from([0]),
        c: [[1]]
      }
    } as unknown as typeof globalThis.pack;

    expect(() => highlightEmblemElement("state", { i: 1, center: 0 })).not.toThrow();
    expect(document.querySelector("#debug line")).not.toBeNull();
  });
});

describe("highlightElement", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("outlines an element where its ancestors' transforms put it", () => {
    document.body.innerHTML = `<svg><g id="debug"></g><g style="transform: translate(-0.6px, -0.6px)"><use id="burg1"></use></g></svg>`;
    const icon = document.getElementById("burg1") as unknown as SVGGraphicsElement;
    const shifted = { a: 1, b: 0, c: 0, d: 1, e: -0.6, f: -0.6 };
    Object.assign(icon, { getBBox: () => ({ x: 10, y: 20, width: 1.2, height: 1.2 }), getScreenCTM: () => shifted });
    Object.assign(document.getElementById("debug")!, {
      getScreenCTM: () => ({ inverse: () => ({ multiply: (m: unknown) => m }) })
    });

    highlightElement(icon);
    expect(document.querySelector("#debug rect")?.getAttribute("transform")).toBe("matrix(1 0 0 1 -0.6 -0.6)");
  });
});
