import { describe, expect, test, vi } from "vitest";
import { Pipeline } from "./pipeline";

describe("Pipeline", () => {
  test("runs steps in registration order", async () => {
    const calls: string[] = [];
    const pipeline = new Pipeline([
      { id: "a", run: () => void calls.push("a") },
      { id: "b", run: () => void calls.push("b") },
      { id: "c", run: () => void calls.push("c") }
    ]);

    await pipeline.run();

    expect(calls).toEqual(["a", "b", "c"]);
  });

  test("throws at construction on a duplicate step id", () => {
    expect(
      () =>
        new Pipeline([
          { id: "a", run: () => {} },
          { id: "a", run: () => {} }
        ])
    ).toThrow(/duplicate step id "a"/);
  });

  test("runFrom runs the given step and everything after it", async () => {
    const calls: string[] = [];
    const pipeline = new Pipeline([
      { id: "a", run: () => void calls.push("a") },
      { id: "b", run: () => void calls.push("b") },
      { id: "c", run: () => void calls.push("c") }
    ]);

    await pipeline.runFrom("b");

    expect(calls).toEqual(["b", "c"]);
  });

  test("runFrom throws on an unknown step id", async () => {
    const pipeline = new Pipeline([{ id: "a", run: () => {} }]);
    await expect(pipeline.runFrom("nope" as "a")).rejects.toThrow(/unknown step "nope"/);
  });

  test("runFrom's assume set removes steps from the executed set", async () => {
    const calls: string[] = [];
    const pipeline = new Pipeline([
      { id: "a", run: () => void calls.push("a") },
      { id: "b", run: () => void calls.push("b") },
      { id: "c", run: () => void calls.push("c") }
    ]);

    await pipeline.runFrom("a", { assume: ["b"] });

    expect(calls).toEqual(["a", "c"]);
  });

  test("awaits an async step before starting the next one", async () => {
    const order: string[] = [];
    const pipeline = new Pipeline([
      {
        id: "a",
        run: async () => {
          order.push("a:start");
          await new Promise(resolve => setTimeout(resolve, 5));
          order.push("a:end");
        }
      },
      { id: "b", run: () => void order.push("b") }
    ]);

    await pipeline.run();

    expect(order).toEqual(["a:start", "a:end", "b"]);
  });

  test("has narrows an untrusted string to a registered id", () => {
    const pipeline = new Pipeline([{ id: "a", run: () => {} }]);
    expect(pipeline.has("a")).toBe(true);
    expect(pipeline.has("nope")).toBe(false);
  });

  test("ids exposes registration order", () => {
    const pipeline = new Pipeline([
      { id: "a", run: () => {} },
      { id: "b", run: () => {} }
    ]);
    expect(pipeline.ids).toEqual(["a", "b"]);
  });

  test("run propagates a step's error and stops before the next step", async () => {
    const calls: string[] = [];
    const pipeline = new Pipeline([
      {
        id: "a",
        run: () => {
          throw new Error("boom");
        }
      },
      { id: "b", run: () => void calls.push("b") }
    ]);

    await expect(pipeline.run()).rejects.toThrow("boom");
    expect(calls).toEqual([]);
  });

  test("real steps are exercised through vi.fn spies", async () => {
    const runA = vi.fn();
    const pipeline = new Pipeline([{ id: "a", run: runA }]);
    await pipeline.run();
    expect(runA).toHaveBeenCalledTimes(1);
  });
});
