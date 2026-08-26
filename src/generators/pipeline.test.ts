import { describe, expect, test, vi } from "vitest";
import { Pipeline } from "./pipeline";

describe("Pipeline", () => {
  test("runs steps in registration order", async () => {
    const calls: string[] = [];
    const pipeline = new Pipeline("test", [
      { id: "a", run: () => calls.push("a") },
      { id: "b", run: () => calls.push("b") },
      { id: "c", run: () => calls.push("c") }
    ]);

    await pipeline.run(undefined);

    expect(calls).toEqual(["a", "b", "c"]);
  });

  test("awaits an async step before starting the next one", async () => {
    const order: string[] = [];
    const pipeline = new Pipeline("test", [
      {
        id: "a",
        run: async () => {
          order.push("a:start");
          await new Promise(resolve => setTimeout(resolve, 5));
          order.push("a:end");
        }
      },
      { id: "b", run: () => order.push("b") }
    ]);

    await pipeline.run(undefined);

    expect(order).toEqual(["a:start", "a:end", "b"]);
  });

  test("passes the context through to every step", async () => {
    const seen: number[] = [];
    const pipeline = new Pipeline<string, { value: number }>("test", [
      { id: "a", run: context => seen.push(context.value) },
      { id: "b", run: context => seen.push(context.value) }
    ]);

    await pipeline.run({ value: 42 });

    expect(seen).toEqual([42, 42]);
  });

  test("names the failed step and keeps the original error as cause", async () => {
    const original = new Error("boom");
    const pipeline = new Pipeline("test-pipeline", [
      {
        id: "a",
        run: () => {
          throw original;
        }
      }
    ]);

    const error = (await pipeline.run(undefined).catch(error => error)) as Error;

    expect(error.message).toBe('test-pipeline failed at step "a": boom');
    expect(error.cause).toBe(original);
  });

  test("stops on the first failed step", async () => {
    const next = vi.fn();
    const pipeline = new Pipeline("test", [
      {
        id: "a",
        run: () => {
          throw new Error("boom");
        }
      },
      { id: "b", run: next }
    ]);

    await expect(pipeline.run(undefined)).rejects.toThrow();
    expect(next).not.toHaveBeenCalled();
  });

  test("reports a rejected async step", async () => {
    const pipeline = new Pipeline("test", [{ id: "a", run: () => Promise.reject(new Error("boom")) }]);

    await expect(pipeline.run(undefined)).rejects.toThrow('test failed at step "a": boom');
  });
});
