import { afterEach, describe, expect, test, vi } from "vitest";
import {
  endViewSession,
  getDocumentLayerOrder,
  getDocumentLayerVisibility,
  getEffectiveLayerVisibility,
  isViewSessionActive,
  resetViewSessionForTests,
  setViewSessionLayerVisibility,
  startViewSession
} from "./view-session-state";

afterEach(() => resetViewSessionForTests());

describe("view session state", () => {
  test("keeps layer overrides outside the captured document presentation", () => {
    startViewSession(new Map([["toggleStates", true]]));
    setViewSessionLayerVisibility("toggleStates", false);

    expect(getEffectiveLayerVisibility("toggleStates", true)).toBe(false);
    expect(getDocumentLayerVisibility("toggleStates", false)).toBe(true);
  });

  test("restores the captured presentation and clears overrides when the session ends", () => {
    const restore = vi.fn();
    const restoreOrder = vi.fn();
    startViewSession(
      new Map([
        ["toggleStates", true],
        ["toggleRivers", false]
      ]),
      ["states", "rivers"]
    );
    setViewSessionLayerVisibility("toggleStates", false);

    endViewSession(restore, restoreOrder);

    expect(restore).toHaveBeenCalledWith("toggleStates", true);
    expect(restore).toHaveBeenCalledWith("toggleRivers", false);
    expect(restoreOrder).toHaveBeenCalledWith(["states", "rivers"]);
    expect(isViewSessionActive()).toBe(false);
  });

  test("retains the original layer order as the document value during View-mode reordering", () => {
    startViewSession(new Map(), ["states", "rivers"]);

    expect(getDocumentLayerOrder(["rivers"])).toEqual(["states", "rivers"]);
  });
});
