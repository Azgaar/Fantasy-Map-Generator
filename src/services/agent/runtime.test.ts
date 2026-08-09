import { expect, it, describe as suite, test } from "vitest";
import { describe, runScript, serialize } from "./runtime";

suite("runScript", () => {
  test("returns the script's value", async () => {
    const result = await runScript("return 1 + 1");
    expect(result.ok).toBe(true);
    expect(result.value).toBe("2");
  });

  test("sees page globals and supports top-level await", async () => {
    (globalThis as Record<string, unknown>).answerForTest = 42;
    const result = await runScript("const value = await Promise.resolve(answerForTest); return value");
    expect(result.value).toBe("42");
  });

  test("reports the error and stack instead of throwing", async () => {
    const result = await runScript("pack.burgs.map(b => b.name)");
    expect(result.ok).toBe(false);
    expect(result.error?.message).toMatch(/pack/);
    expect(result.error?.stack).not.toBe("");
  });

  test("captures console output", async () => {
    const result = await runScript("console.log('checked', 3); console.warn('careful'); return null");
    expect(result.logs).toEqual(["checked 3", "[warn] careful"]);
  });

  test("restores console after the run", async () => {
    const original = console.log;
    await runScript("console.log('once'); return 1");
    expect(console.log).toBe(original);
  });

  test("exposes describe to the script", async () => {
    const result = await runScript("return describe([1, 2, 3])");
    expect(result.value).toContain('"type": "Array"');
  });
});

suite("serialize", () => {
  it("summarizes typed arrays instead of expanding them", () => {
    expect(serialize(new Uint8Array([1, 2, 3]))).toBe('"[Uint8Array(3) 1, 2, 3]"');
  });

  it("clips long arrays", () => {
    const text = serialize(Array.from({ length: 250 }, (_, index) => index));
    expect(text).toContain("… 50 more items");
  });

  it("breaks cycles", () => {
    const node: Record<string, unknown> = { name: "root" };
    node.self = node;
    expect(serialize(node)).toContain("[Circular]");
  });

  it("labels functions and undefined", () => {
    expect(serialize(undefined)).toBe("undefined");
    expect(serialize({ draw: function drawStates() {} })).toContain("[Function drawStates]");
  });

  it("truncates oversized results with a hint", () => {
    const text = serialize("x".repeat(20000));
    expect(text).toContain("truncated");
    expect(text.length).toBeLessThan(8100);
  });
});

suite("describe", () => {
  it("resolves an expression string", () => {
    expect(describe("1 + 1")).toEqual({ path: "1 + 1", type: "number", value: 2 });
  });

  it("falls back to describing the string when it is not an expression", () => {
    expect(describe("not an expression!!")).toEqual({ type: "string", value: "not an expression!!" });
  });

  it("lists keys with their type labels", () => {
    const described = describe({ name: "Kelmora", cells: [1, 2, 3], heights: new Uint8Array(9) }) as {
      keys: Record<string, string>;
    };
    expect(described.keys).toEqual({ name: "string(7)", cells: "Array(3)", heights: "Uint8Array(9)" });
  });

  it("lists prototype methods of class instances", () => {
    class StatesModule {
      collectTaxes(): void {}
    }
    const described = describe(new StatesModule()) as { type: string; methods: string[] };
    expect(described.type).toBe("StatesModule");
    expect(described.methods).toEqual(["collectTaxes"]);
  });

  it("samples typed arrays", () => {
    expect(describe(new Uint16Array([5, 6, 7]))).toEqual({ type: "Uint16Array", length: 3, sample: [5, 6, 7] });
  });
});
