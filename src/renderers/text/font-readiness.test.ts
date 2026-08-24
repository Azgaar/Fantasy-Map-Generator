import { describe, expect, it, vi } from "vitest";
import { ensureFontFamiliesReady } from "./font-readiness";

describe("font readiness", () => {
  it("deduplicates families and reports individual load failures", async () => {
    const load = vi.fn((font: string) =>
      font.includes("Missing") ? Promise.reject(new Error("missing")) : Promise.resolve([])
    );

    await expect(ensureFontFamiliesReady(["Ready", "Missing", "Ready"], { load })).resolves.toEqual([
      { family: "Missing", ready: false },
      { family: "Ready", ready: true }
    ]);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
