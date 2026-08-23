// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { highlightEmblemElement } from "./highlight";

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
