import { describe, expect, it, vi } from "vitest";
import { bindStylePresets, StylePresets, type StylePresetsApi } from "./style-presets-controller";

describe("style presets facade", () => {
  it("forwards bundled callers to the initialized runtime", async () => {
    const runtime = {
      add: vi.fn(),
      applyOnLoad: vi.fn(async () => undefined),
      requestChange: vi.fn(),
      requestRemove: vi.fn()
    } satisfies StylePresetsApi;
    const release = bindStylePresets(runtime);

    await StylePresets.applyOnLoad();
    StylePresets.requestChange("atlas");

    expect(runtime.applyOnLoad).toHaveBeenCalledOnce();
    expect(runtime.requestChange).toHaveBeenCalledWith("atlas");
    release();
  });
});
