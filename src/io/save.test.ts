import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifySaveOutcome } from "./save";

describe("notifySaveOutcome", () => {
  let tipMock: ReturnType<typeof vi.fn>;
  let store: Record<string, string>;

  beforeEach(() => {
    tipMock = vi.fn();
    (globalThis as any).tip = tipMock;

    store = {};
    (globalThis as any).localStorage = {
      getItem: (key: string) => (key in store ? store[key] : null),
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      }
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a success tip naming the file the user saved to", () => {
    notifySaveOutcome({ type: "saved", filename: "MyWorld.map" });

    expect(tipMock).toHaveBeenCalledTimes(1);
    expect(tipMock).toHaveBeenCalledWith(expect.stringContaining("MyWorld.map"), true, "success", 8000);
  });

  it("shows no tip and no error when the picker was cancelled", () => {
    notifySaveOutcome({ type: "cancelled" });

    expect(tipMock).not.toHaveBeenCalled();
  });

  it("on the first Downloads fallback shows a single tip that confirms the save and explains the missing picker", () => {
    notifySaveOutcome({ type: "downloaded-fallback", filename: "MyWorld.map" });

    // Exactly one tip — a second tip() would overwrite the first in the tooltip.
    expect(tipMock).toHaveBeenCalledTimes(1);
    const [message] = tipMock.mock.calls[0];
    expect(message.includes("Downloads")).toBe(true);
    expect(message.includes("save-location picker")).toBe(true);
  });

  it("on later fallback saves shows only the success tip, not the explanation", () => {
    notifySaveOutcome({ type: "downloaded-fallback", filename: "MyWorld.map" });
    tipMock.mockClear();

    notifySaveOutcome({ type: "downloaded-fallback", filename: "MyWorld.map" });

    expect(tipMock).toHaveBeenCalledTimes(1);
    const [message] = tipMock.mock.calls[0];
    expect(message.includes("Downloads")).toBe(true);
    expect(message.includes("save-location picker")).toBe(false);
  });

  it("still saves (no throw, success tip) when localStorage is unavailable", () => {
    (globalThis as any).localStorage = {
      getItem: () => {
        throw new Error("storage disabled");
      },
      setItem: () => {
        throw new Error("storage disabled");
      },
      removeItem: () => {}
    };

    expect(() => notifySaveOutcome({ type: "downloaded-fallback", filename: "MyWorld.map" })).not.toThrow();
    expect(tipMock).toHaveBeenCalledTimes(1);
  });
});
