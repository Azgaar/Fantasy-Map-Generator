import { describe, expect, it } from "vitest";
import { list } from "./language-utils";

describe("list", () => {
  it("joins in English", () => {
    expect(list(["coal", "leather", "arms"])).toBe("coal, leather, and arms");
  });
});
