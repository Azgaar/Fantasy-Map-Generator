import { describe, expect, test } from "vitest";
import { getDialogPlacementOverride, withDomDialogPlacement } from "./dialog-placement-context";

describe("dialog placement context", () => {
  test("keeps a placement override active while a lazy dialog opens", async () => {
    expect(getDialogPlacementOverride()).toBeUndefined();

    await withDomDialogPlacement("center", async () => {
      expect(getDialogPlacementOverride()).toBe("center");
      await Promise.resolve();
      expect(getDialogPlacementOverride()).toBe("center");
    });

    expect(getDialogPlacementOverride()).toBeUndefined();
  });
});
