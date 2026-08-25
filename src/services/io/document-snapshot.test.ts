import { describe, expect, test } from "vitest";
import { createCanonicalDocumentSnapshot } from "./document-snapshot";

describe("canonical document snapshot", () => {
  test("normalizes object ordering and typed arrays without mutating the source", () => {
    const document = {
      style: { visibility: { rivers: true, states: false } },
      grid: { heights: new Uint8Array([20, 40]) },
      metadata: { saveDate: "2026-08-25T12:00:00.000Z", name: "Eldoria" }
    };

    const snapshot = createCanonicalDocumentSnapshot(document, ["saveDate"]);

    expect(snapshot).toBe(
      '{"grid":{"heights":[20,40]},"metadata":{"name":"Eldoria"},"style":{"visibility":{"rivers":true,"states":false}}}'
    );
    expect(document.grid.heights).toEqual(new Uint8Array([20, 40]));
    expect(document.metadata.saveDate).toBe("2026-08-25T12:00:00.000Z");
  });
});
