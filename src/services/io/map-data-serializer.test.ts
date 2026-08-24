import { describe, expect, it } from "vitest";
import { serializeMapSections } from "./map-data-serializer";

describe("serializeMapSections", () => {
  it("preserves the legacy CRLF format without temporary numeric arrays", () => {
    expect(
      serializeMapSections([
        { kind: "text", value: "header" },
        { kind: "json", value: { seed: "42" } },
        { kind: "csv", value: new Uint16Array([1, 2, 3]) },
        { kind: "rounded-csv", value: new Float32Array([1.23456, 0]) }
      ])
    ).toBe('header\r\n{"seed":"42"}\r\n1,2,3\r\n1.2346,0');
  });
});
