import { describe, expect, test } from "vitest";
import {
  getDialogPlacementOverride,
  getDialogPresentationOverride,
  withDomDialogPlacement,
  withDomDialogPresentation
} from "./dialog-placement-context";

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

  test("keeps a presentation override active while a lazy dialog opens", async () => {
    expect(getDialogPresentationOverride()).toBeUndefined();

    await withDomDialogPresentation("panel", async () => {
      expect(getDialogPresentationOverride()).toBe("panel");
      await Promise.resolve();
      expect(getDialogPresentationOverride()).toBe("panel");
    });

    expect(getDialogPresentationOverride()).toBeUndefined();
  });
});
