import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadFile } from "@/utils/fileUtils";
import { saveToFileSystem } from "./save-to-file";

vi.mock("@/utils/fileUtils", () => ({ downloadFile: vi.fn() }));

function makeHandle(name = "Chosen.map") {
  const stream = {
    write: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined)
  };
  const handle = { name, createWritable: vi.fn().mockResolvedValue(stream) };
  return { handle, stream };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("saveToFileSystem", () => {
  it("picks a destination before preparing data and waits for close before reporting success", async () => {
    const { handle, stream } = makeHandle();
    let choose!: (handle: unknown) => void;
    const picker = vi.fn(
      () =>
        new Promise(resolve => {
          choose = resolve;
        })
    );
    vi.stubGlobal("showSaveFilePicker", picker);
    const prepare = vi.fn(() => "world\r\n世界 🌍");
    let close!: () => void;
    stream.close.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          close = resolve;
        })
    );

    const result = saveToFileSystem(prepare, "Suggested.map");
    expect(picker).toHaveBeenCalledWith({
      suggestedName: "Suggested.map",
      types: [{ description: "Fantasy Map Generator map", accept: { "application/octet-stream": [".map"] } }]
    });
    expect(prepare).not.toHaveBeenCalled();
    choose(handle);
    await vi.waitFor(() => expect(stream.close).toHaveBeenCalledOnce());
    expect(prepare).toHaveBeenCalledOnce();
    expect(stream.write).toHaveBeenCalledWith("world\r\n世界 🌍");
    let settled = false;
    void result.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    close();
    await expect(result).resolves.toEqual({ type: "saved", filename: "Chosen.map" });
  });

  it("opens a fresh picker for every save, including overwriting the same file", async () => {
    const first = makeHandle("First.map");
    const second = makeHandle("Second.map");
    const picker = vi
      .fn()
      .mockResolvedValueOnce(first.handle)
      .mockResolvedValueOnce(first.handle)
      .mockResolvedValueOnce(second.handle);
    vi.stubGlobal("showSaveFilePicker", picker);
    await saveToFileSystem(() => "one", "Suggested.map");
    await saveToFileSystem(() => "two", "Suggested.map");
    await saveToFileSystem(() => "three", "Suggested.map");
    expect(picker).toHaveBeenCalledTimes(3);
    expect(first.stream.write.mock.calls).toEqual([["one"], ["two"]]);
    expect(second.stream.write).toHaveBeenCalledWith("three");
  });

  it.each([new DOMException("Cancelled", "AbortError"), { name: "AbortError" }])(
    "cancels without preparing data or downloading (%s)",
    async error => {
      vi.stubGlobal("showSaveFilePicker", vi.fn().mockRejectedValue(error));
      const prepare = vi.fn(() => "data");
      await expect(saveToFileSystem(prepare, "Map.map")).resolves.toEqual({ type: "cancelled" });
      expect(prepare).not.toHaveBeenCalled();
      expect(downloadFile).not.toHaveBeenCalled();
    }
  );

  it("uses the existing download helper when the API is absent", async () => {
    vi.stubGlobal("showSaveFilePicker", undefined);
    await expect(saveToFileSystem(() => "data", "Map.map")).resolves.toEqual({ type: "downloaded-fallback" });
    expect(downloadFile).toHaveBeenCalledExactlyOnceWith("data", "Map.map");
  });

  it("propagates picker permission errors without silently downloading", async () => {
    const error = new DOMException("Permission denied", "SecurityError");
    vi.stubGlobal("showSaveFilePicker", vi.fn().mockRejectedValue(error));
    const prepare = vi.fn(() => "data");
    await expect(saveToFileSystem(prepare, "Map.map")).rejects.toBe(error);
    expect(prepare).not.toHaveBeenCalled();
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it("prepares data before opening the writable stream", async () => {
    const { handle } = makeHandle();
    vi.stubGlobal("showSaveFilePicker", vi.fn().mockResolvedValue(handle));
    const error = new Error("Serialization failed");
    await expect(
      saveToFileSystem(() => {
        throw error;
      }, "Map.map")
    ).rejects.toBe(error);
    expect(handle.createWritable).not.toHaveBeenCalled();
  });

  it("propagates createWritable permission errors", async () => {
    const { handle } = makeHandle();
    const error = new DOMException("Permission denied", "NotAllowedError");
    handle.createWritable.mockRejectedValue(error);
    vi.stubGlobal("showSaveFilePicker", vi.fn().mockResolvedValue(handle));
    await expect(saveToFileSystem(() => "data", "Map.map")).rejects.toBe(error);
  });

  it.each(["write", "close"] as const)("aborts and propagates a %s failure, even an AbortError", async operation => {
    const { handle, stream } = makeHandle();
    const error = new DOMException("Disk write failed", "AbortError");
    stream[operation].mockRejectedValue(error);
    stream.abort.mockRejectedValue(new Error("Already closed"));
    vi.stubGlobal("showSaveFilePicker", vi.fn().mockResolvedValue(handle));
    await expect(saveToFileSystem(() => "data", "Map.map")).rejects.toBe(error);
    expect(stream.abort).toHaveBeenCalledOnce();
    if (operation === "write") expect(stream.close).not.toHaveBeenCalled();
  });
});
