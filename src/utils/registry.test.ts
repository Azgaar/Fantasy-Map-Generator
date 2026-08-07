import { describe, expect, test, vi } from "vitest";
import { createRegistry, eager } from "./registry";

describe("createRegistry", () => {
  test("dispatches a method call to the resolved module with the given args", async () => {
    const add = vi.fn((a: number, b: number) => a + b);
    const registry = createRegistry({ Math: () => Promise.resolve({ add }) });

    const result = await registry.Math.add(2, 3);

    expect(result).toBe(5);
    expect(add).toHaveBeenCalledWith(2, 3);
  });

  test("returns a Promise even when the entry is eager", async () => {
    const registry = createRegistry({ Greeter: eager({ hi: () => "hello" }) });

    const call = registry.Greeter.hi();

    expect(call).toBeInstanceOf(Promise);
    expect(await call).toBe("hello");
  });

  test("loads each module once across repeated calls", async () => {
    const loader = vi.fn(() => Promise.resolve({ open: vi.fn() }));
    const registry = createRegistry({ Dialog: loader });

    await registry.Dialog.open();
    await registry.Dialog.open();
    await registry.Dialog.open();

    expect(loader).toHaveBeenCalledTimes(1);
  });

  test("an unknown entry name resolves to undefined", () => {
    const registry = createRegistry({ Known: eager({ run: () => 1 }) }) as Record<string, unknown>;
    expect(registry.Missing).toBeUndefined();
  });

  test("an entry is not thenable, so awaiting it is a no-op rather than a phantom call", async () => {
    const loader = vi.fn(() => Promise.resolve({ open: vi.fn() }));
    const registry = createRegistry({ Dialog: loader });

    // `then` must not dispatch — otherwise `await registry.Dialog` would call it.
    expect((registry.Dialog as { then?: unknown }).then).toBeUndefined();
    const awaited = await registry.Dialog;

    expect(awaited).toBe(registry.Dialog);
    expect(loader).not.toHaveBeenCalled();
  });

  test("symbol access on an entry resolves to undefined", () => {
    const registry = createRegistry({ Dialog: eager({ open: () => 1 }) });
    expect((registry.Dialog as Record<symbol, unknown>)[Symbol.iterator]).toBeUndefined();
  });
});
