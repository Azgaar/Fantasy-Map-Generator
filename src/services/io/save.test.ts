// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/fonts", () => ({ getUsedFonts: vi.fn(() => []) }));
vi.mock("@/services", () => ({ Services: { Cloud: { save: vi.fn() } } }));

import { DIALOGS_MARKUP, dialogButton } from "@/ui/dialog/dialog-testing";
import { notifySaveOutcome, Save } from "./save";

beforeEach(() => {
  window.dispatchEvent(new Event("map:generated"));
  document.body.innerHTML = `<div id="tooltip"></div>${DIALOGS_MARKUP}`;
  localStorage.clear();
  options.app.mode = null;
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
  it("refuses a view-only map before opening the picker", async () => {
    vi.stubGlobal("options", { app: { mode: null }, map: { viewOnly: true } });
    const picker = vi.fn();
    vi.stubGlobal("showSaveFilePicker", picker);
    await Save.toMachine();
    expect(picker).not.toHaveBeenCalled();
    expect(document.getElementById("tooltip")!.textContent).toContain("view-only");
  });

  it("suggests a view-only copy its own filename", async () => {
    vi.stubGlobal("options", { app: { mode: null }, map: { lore: { name: "Ovis" } } });
    const picker = vi.fn().mockRejectedValue(Object.assign(new Error("cancelled"), { name: "AbortError" }));
    vi.stubGlobal("showSaveFilePicker", picker);
    await Save.toMachine(false, true);
    expect(picker.mock.calls[0][0].suggestedName).toMatch(/ view\.map$/);
  });

  it("rejects saving in edit mode before opening the picker", async () => {
    options.app.mode = "heightmap";
    const picker = vi.fn();
    vi.stubGlobal("showSaveFilePicker", picker);
    await Save.toMachine();
    expect(picker).not.toHaveBeenCalled();
    expect(document.getElementById("tooltip")!.textContent).toContain("EDIT mode");
  });

  it("cancels without attempting serialization or showing an error dialog", async () => {
    vi.stubGlobal("showSaveFilePicker", vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")));
    await Save.toMachine();
    expect(window.showSaveFilePicker).toHaveBeenCalledOnce();
    expect(document.querySelector(".message")).toBeNull();
    expect(document.getElementById("tooltip")!.textContent).toBe("");
  });

  it("shows the existing error dialog for a picker failure and retries with a new picker", async () => {
    const picker = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("Permission denied", "SecurityError"))
      .mockRejectedValueOnce(new DOMException("Cancelled", "AbortError"));
    vi.stubGlobal("showSaveFilePicker", picker);
    await Save.toMachine();
    expect(document.querySelector(".dialog-message")!.textContent).toContain("Permission denied");
    expect(document.querySelector(".dialog-window:has(.message) .dialog-title")?.textContent).toBe("Saving error");
    dialogButton("Retry").click();
    await Promise.resolve();
    expect(picker).toHaveBeenCalledTimes(2);
  });
});
