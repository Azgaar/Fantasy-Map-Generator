import { afterEach, describe, expect, it } from "vitest";
import {
  getMarkerRenderState,
  resetMarkerRenderState,
  setMarkerPinnedOnly,
  setMarkerRenderFilter
} from "./marker-render-state";

afterEach(resetMarkerRenderState);

describe("marker render state", () => {
  it("keeps transient filters outside marker domain data", () => {
    setMarkerRenderFilter([2, 7]);
    setMarkerPinnedOnly(true);

    const state = getMarkerRenderState();
    expect(state.pinnedOnly).toBe(true);
    expect([...state.visibleIds!]).toEqual([2, 7]);
  });
});
