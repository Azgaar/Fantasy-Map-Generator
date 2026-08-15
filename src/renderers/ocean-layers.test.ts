import { describe, expect, test } from "vitest";
import { DEFAULT_OCEAN_OUTLINE, parseOceanOutline } from "./ocean-layers";

describe("parseOceanOutline", () => {
  test("parses a stored outline list", () => {
    expect(parseOceanOutline("-6,-3,-1")).toEqual([-6, -3, -1]);
  });

  // a preset that omits the option no longer inherits the previous preset's dom attribute, so an
  // absent value must fall back to the stock outline instead of degrading to [0], which traces a
  // layer that does not exist ("Next vertex is not found")
  test("falls back to the default outline when the option is absent", () => {
    expect(parseOceanOutline(undefined)).toEqual(parseOceanOutline(DEFAULT_OCEAN_OUTLINE));
    expect(parseOceanOutline("")).toEqual(parseOceanOutline(DEFAULT_OCEAN_OUTLINE));
  });

  test("drops entries that are not ocean depth levels", () => {
    expect(parseOceanOutline("-6,abc,0,-1")).toEqual([-6, -1]);
    expect(parseOceanOutline("0")).toEqual(parseOceanOutline(DEFAULT_OCEAN_OUTLINE));
  });
});
