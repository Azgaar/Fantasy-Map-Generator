import { afterEach, describe, expect, it, vi } from "vitest";
import { getCultureGenerationSettings } from "./culture-generation-settings";

const originalGetElementById = document.getElementById;

afterEach(() => {
  document.getElementById = originalGetElementById;
});

describe("getCultureGenerationSettings", () => {
  it("reads the existing emblem control without requiring a neutral-rate control", () => {
    const getElementById = vi.fn((id: string) => (id === "emblemShape" ? { value: "random" } : null));
    document.getElementById = getElementById as typeof document.getElementById;

    expect(getCultureGenerationSettings()).toEqual({ emblemShape: "random" });
    expect(getElementById).toHaveBeenCalledOnce();
    expect(getElementById).toHaveBeenCalledWith("emblemShape");
  });
});
