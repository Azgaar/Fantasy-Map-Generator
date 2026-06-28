import { afterEach, describe, expect, it, vi } from "vitest";
import { saveToFileSystem } from "./save-to-file";

// A fake FileSystemFileHandle: records what was written.
function makeHandle(name: string) {
  const writes: string[] = [];
  const handle = {
    name,
    writes,
    createWritable: vi.fn(async () => ({
      write: async (data: string) => {
        writes.push(data);
      },
      close: async () => {}
    }))
  };
  return handle;
}

describe("saveToFileSystem", () => {
  afterEach(() => {
    delete (globalThis as any).showSaveFilePicker;
    delete (globalThis as any).downloadFile;
    vi.restoreAllMocks();
  });

  it("opens the picker and reports saved with the chosen filename", async () => {
    const handle = makeHandle("Chosen.map");
    const picker = vi.fn(async () => handle);
    (globalThis as any).showSaveFilePicker = picker;

    const outcome = await saveToFileSystem("map-data", "Suggested.map");

    expect(picker).toHaveBeenCalledTimes(1);
    expect(handle.writes).toEqual(["map-data"]);
    expect(outcome).toEqual({ type: "saved", filename: "Chosen.map" });
  });

  it("offers the suggested name and constrains the picker to .map files", async () => {
    const picker = vi.fn(async (_options?: any) => makeHandle("Chosen.map"));
    (globalThis as any).showSaveFilePicker = picker;

    await saveToFileSystem("map-data", "Suggested.map");

    const options = picker.mock.calls[0][0];
    expect(options.suggestedName).toBe("Suggested.map");
    const acceptedExtensions = options.types.flatMap((t: any) => Object.values(t.accept).flat());
    expect(acceptedExtensions.includes(".map")).toBe(true);
  });

  it("opens the picker on every save so the user can choose a different file each time", async () => {
    const first = makeHandle("First.map");
    const second = makeHandle("Second.map");
    const picker = vi
      .fn(async () => first)
      .mockImplementationOnce(async () => first)
      .mockImplementationOnce(async () => second);
    (globalThis as any).showSaveFilePicker = picker;

    const a = await saveToFileSystem("a", "Suggested.map");
    const b = await saveToFileSystem("b", "Suggested.map");

    expect(picker).toHaveBeenCalledTimes(2);
    expect(a).toEqual({ type: "saved", filename: "First.map" });
    expect(b).toEqual({ type: "saved", filename: "Second.map" });
  });

  it("treats a cancelled picker as a no-op", async () => {
    const picker = vi.fn(async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    });
    (globalThis as any).showSaveFilePicker = picker;

    const outcome = await saveToFileSystem("map-data", "Suggested.map");
    expect(outcome).toEqual({ type: "cancelled" });
  });

  it("treats a cancelled picker (DOMException-style AbortError) as a no-op", async () => {
    // DOMException is not reliably instanceof Error across engines.
    const abort = { name: "AbortError", message: "aborted" };
    (globalThis as any).showSaveFilePicker = vi.fn(async () => {
      throw abort;
    });

    const outcome = await saveToFileSystem("data", "Suggested.map");
    expect(outcome).toEqual({ type: "cancelled" });
  });

  it("propagates non-cancel picker errors to the caller", async () => {
    const securityError = new Error("denied");
    securityError.name = "SecurityError";
    (globalThis as any).showSaveFilePicker = vi.fn(async () => {
      throw securityError;
    });

    await expect(saveToFileSystem("map-data", "Suggested.map")).rejects.toThrow("denied");
  });

  it("propagates a write failure to the caller", async () => {
    const handle = makeHandle("Chosen.map");
    handle.createWritable.mockImplementationOnce(async () => {
      throw new Error("write failed");
    });
    (globalThis as any).showSaveFilePicker = vi.fn(async () => handle);

    await expect(saveToFileSystem("data", "Suggested.map")).rejects.toThrow("write failed");
  });

  it("falls back to the shared downloadFile helper when the picker API is unavailable", async () => {
    delete (globalThis as any).showSaveFilePicker;
    const downloadFile = vi.fn();
    (globalThis as any).downloadFile = downloadFile;

    const outcome = await saveToFileSystem("map-data", "Suggested.map");

    expect(downloadFile).toHaveBeenCalledWith("map-data", "Suggested.map");
    expect(outcome).toEqual({ type: "downloaded-fallback", filename: "Suggested.map" });
  });
});
