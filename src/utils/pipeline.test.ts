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

  describe("derive", () => {
    const base = () =>
      new Pipeline([
        { id: "a", run: vi.fn() },
        { id: "b", run: vi.fn() },
        { id: "c", run: vi.fn() }
      ]);

    test("omit drops a step while keeping the rest in order", async () => {
      const calls: string[] = [];
      const pipeline = new Pipeline([
        { id: "a", run: () => void calls.push("a") },
        { id: "b", run: () => void calls.push("b") },
        { id: "c", run: () => void calls.push("c") }
      ]).derive({ omit: ["b"] });

      expect(pipeline.ids).toEqual(["a", "c"]);
      await pipeline.run();
      expect(calls).toEqual(["a", "c"]);
    });

    test("replace swaps a step's run() but keeps its id and position", async () => {
      const calls: string[] = [];
      const pipeline = new Pipeline([
        { id: "a", run: () => void calls.push("a") },
        { id: "b", run: () => void calls.push("b:original") },
        { id: "c", run: () => void calls.push("c") }
      ]).derive({ replace: { b: () => void calls.push("b:replaced") } });

      expect(pipeline.ids).toEqual(["a", "b", "c"]);
      await pipeline.run();
      expect(calls).toEqual(["a", "b:replaced", "c"]);
    });

    test("the base pipeline is unaffected by a derived one", async () => {
      const calls: string[] = [];
      const b = new Pipeline([
        { id: "a", run: () => void calls.push("a") },
        { id: "b", run: () => void calls.push("b") }
      ]);
      const derived = b.derive({ omit: ["b"] });

      await b.run();
      await derived.run();

      expect(calls).toEqual(["a", "b", "a"]);
    });

    test("static Pipeline.derive and the instance method are equivalent", async () => {
      const p = base();
      expect(Pipeline.derive(p, { omit: ["a"] }).ids).toEqual(p.derive({ omit: ["a"] }).ids);
    });

    test("deriving from a derived pipeline composes", async () => {
      const calls: string[] = [];
      const pipeline = new Pipeline([
        { id: "a", run: () => void calls.push("a") },
        { id: "b", run: () => void calls.push("b") },
        { id: "c", run: () => void calls.push("c") }
      ])
        .derive({ omit: ["b"] })
        .derive({ replace: { c: () => void calls.push("c:replaced") } });

      await pipeline.run();
      expect(calls).toEqual(["a", "c:replaced"]);
    });
  });
});
