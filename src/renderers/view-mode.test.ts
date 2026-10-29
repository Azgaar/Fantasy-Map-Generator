import { describe, expect, it, vi } from "vitest";
import { isAstralView, setAstralView, subscribeAstralView } from "./view-mode";

describe("the Astral view flag", () => {
  it("notifies subscribers only when the mode changes", () => {
    setAstralView(false);
    const listener = vi.fn();
    const unsubscribe = subscribeAstralView(listener);

    setAstralView(true);
    expect(isAstralView()).toBe(true);
    expect(listener).toHaveBeenCalledOnce();

    setAstralView(true);
    expect(listener).toHaveBeenCalledOnce();

    setAstralView(false);
    expect(isAstralView()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setAstralView(true);
    expect(listener).toHaveBeenCalledTimes(2);
    setAstralView(false);
  });
});