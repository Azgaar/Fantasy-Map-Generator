import { describe, expect, it } from "vitest";
import { getRequestedMapSize } from "./map-size";

describe("getRequestedMapSize", () => {
  it("leaves missing dimensions unresolved", () => {
    expect(getRequestedMapSize(new URLSearchParams("seed=test"))).toEqual({ width: undefined, height: undefined });
  });

  it("takes positive dimensions from a shared-map URL", () => {
    expect(getRequestedMapSize(new URLSearchParams("width=900&height=600"))).toEqual({ width: 900, height: 600 });
  });

  it("ignores dimensions that cannot produce a graph", () => {
    expect(getRequestedMapSize(new URLSearchParams("width=0&height=invalid"))).toEqual({
      width: undefined,
      height: undefined
    });
  });
});
