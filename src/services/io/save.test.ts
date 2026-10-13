// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/fonts", () => ({ getUsedFonts: vi.fn(() => []) }));
vi.mock("@/services", () => ({ Services: { Cloud: { save: vi.fn() } } }));

import { notifySaveOutcome, Save } from "./save";

beforeEach(() => {
  window.dispatchEvent(new Event("map:generated"));
  document.body.innerHTML = '<div id="tooltip"></div><div id="alertMessage"></div>';
  localStorage.clear();
  vi.stubGlobal("customization", 0);
  vi.stubGlobal("alertMessage", document.getElementById("alertMessage"));
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("save feedback", () => {
  it("renders the chosen filename as text", () => {
    const filename = "<img src=x onerror=alert(1)>&世界.map";
    notifySaveOutcome({ type: "saved", filename });
    const tooltip = document.getElementById("tooltip")!;
    expect(tooltip.textContent).toBe(`Map is saved to “${filename}”`);
    expect(tooltip.querySelector("img")).toBeNull();
  });

  it("keeps cancellation silent", () => {
    notifySaveOutcome({ type: "cancelled" });
    expect(document.getElementById("tooltip")!.textContent).toBe("");
  });

  it("explains the browser fallback once", () => {
    notifySaveOutcome({ type: "downloaded-fallback" });
    expect(document.getElementById("tooltip")!.textContent).toContain("download settings");
    notifySaveOutcome({ type: "downloaded-fallback" });
    expect(document.getElementById("tooltip")!.textContent).not.toContain("download settings");
    expect(document.getElementById("tooltip")!.textContent).toContain("Map is saved");
  });

  it("preserves desktop feedback without browser advice", () => {
    vi.stubGlobal("electron", { isElectron: true });
    notifySaveOutcome({ type: "downloaded-fallback" });
    expect(document.getElementById("tooltip")!.textContent).toBe("Map is saved");
    expect(localStorage.getItem("savePickerFallbackNoticeShown")).toBeNull();
  });

  it.each(["getItem", "setItem"] as const)("still reports the save when localStorage.%s throws", method => {
    vi.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    expect(() => notifySaveOutcome({ type: "downloaded-fallback" })).not.toThrow();
    expect(document.getElementById("tooltip")!.textContent).toContain("Map is saved");
  });
});

describe("Save.toMachine", () => {
  it("rejects saving in edit mode before opening the picker", async () => {
    vi.stubGlobal("customization", 1);
    const picker = vi.fn();
    vi.stubGlobal("showSaveFilePicker", picker);
    await Save.toMachine();
    expect(picker).not.toHaveBeenCalled();
    expect(document.getElementById("tooltip")!.textContent).toContain("EDIT mode");
  });

  it("cancels without attempting serialization or showing an error dialog", async () => {
    vi.stubGlobal("showSaveFilePicker", vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")));
    const dialog = vi.fn();
    vi.stubGlobal(
      "$",
      vi.fn(() => ({ dialog, not: () => ({ each: () => {} }) }))
    );
    await Save.toMachine();
    expect(window.showSaveFilePicker).toHaveBeenCalledOnce();
    expect(dialog).not.toHaveBeenCalled();
    expect(document.getElementById("tooltip")!.textContent).toBe("");
  });

  it("shows the existing error dialog for a picker failure and retries with a new picker", async () => {
    const picker = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("Permission denied", "SecurityError"))
      .mockRejectedValueOnce(new DOMException("Cancelled", "AbortError"));
    vi.stubGlobal("showSaveFilePicker", picker);
    const dialog = vi.fn();
    vi.stubGlobal(
      "$",
      vi.fn(() => ({ dialog, not: () => ({ each: () => {} }) }))
    );
    await Save.toMachine();
    expect(document.getElementById("alertMessage")!.textContent).toContain("Permission denied");
    const config = dialog.mock.calls[0][0];
    expect(config.title).toBe("Saving error");
    config.buttons.Retry.call(document.getElementById("alertMessage"));
    await Promise.resolve();
    expect(picker).toHaveBeenCalledTimes(2);
  });
});
