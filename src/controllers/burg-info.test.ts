import { describe, expect, test } from "vitest";
import { getBurgFeatures } from "./burg-info";

describe("Burg Info", () => {
  test("lists enabled burg features without changing the burg", () => {
    const burg = { capital: 1, port: 1, temple: 1 };

    expect(getBurgFeatures(burg)).toEqual(["Capital", "Port", "Temple"]);
    expect(burg).toEqual({ capital: 1, port: 1, temple: 1 });
  });
});
