import { afterEach, describe, expect, it, vi } from "vitest";
import { bindRendererCommands, type RendererCommandTarget, rendererCommands } from "./renderer-commands";

const createTarget = (): RendererCommandTarget => ({
  clear: vi.fn(async () => undefined),
  invalidateLayer: vi.fn(),
  queueRebuild: vi.fn()
});

let release: (() => void) | undefined;

afterEach(() => release?.());

describe("renderer commands", () => {
  it("forwards typed commands to the active renderer controller", async () => {
    const target = createTarget();
    release = bindRendererCommands(target);

    await rendererCommands.clear();
    rendererCommands.invalidateLayer("states", [3, 8]);
    rendererCommands.queueRebuild();

    expect(target.clear).toHaveBeenCalledOnce();
    expect(target.invalidateLayer).toHaveBeenCalledWith("states", [3, 8]);
    expect(target.queueRebuild).toHaveBeenCalledOnce();
  });

  it("detaches deterministically", async () => {
    const target = createTarget();
    release = bindRendererCommands(target);
    release();

    await rendererCommands.clear();
    rendererCommands.invalidateLayer("emblems");
    rendererCommands.queueRebuild();

    expect(target.clear).not.toHaveBeenCalled();
    expect(target.invalidateLayer).not.toHaveBeenCalled();
    expect(target.queueRebuild).not.toHaveBeenCalled();
  });
});
