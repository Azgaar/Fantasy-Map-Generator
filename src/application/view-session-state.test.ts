import { afterEach, describe, expect, test, vi } from "vitest";
import {
  endViewSession,
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
    startViewSession(
      new Map([
        ["toggleStates", true],
        ["toggleRivers", false]
      ])
    );
    setViewSessionLayerVisibility("toggleStates", false);

    endViewSession(restore);

    expect(restore).toHaveBeenCalledWith("toggleStates", true);
    expect(restore).toHaveBeenCalledWith("toggleRivers", false);
    expect(isViewSessionActive()).toBe(false);
  });
});
