import { describe, expect, it } from "vitest";
import { deepMerge } from "./objectUtils";

describe("deepMerge", () => {
  it("merges nested objects key by key, keeping what the source does not carry", () => {
    const target = { burgs: { limit: 1000, groups: ["a"], showMapPreview: true }, seed: "1" };
    deepMerge(target, { burgs: { limit: 500 } });
    expect(target).toEqual({ burgs: { limit: 500, groups: ["a"], showMapPreview: true }, seed: "1" });
  });

  it("replaces arrays instead of merging them element by element", () => {
    const target = { winds: [225, 45, 225, 315, 135, 315], groups: [{ name: "old" }, { name: "gone" }] };
    deepMerge(target, { winds: [0, 45], groups: [{ name: "new" }] });
    expect(target).toEqual({ winds: [0, 45], groups: [{ name: "new" }] });
  });

  it("treats undefined as 'not carried', so it never erases a value", () => {
    const target = { unit: "mi", scale: 3 };
    deepMerge(target, { unit: undefined, scale: 5 });
    expect(target).toEqual({ unit: "mi", scale: 5 });
  });

  it("copies nested objects rather than sharing them with the source", () => {
    const source = { calendar: { year: 500 } };
    const target: Record<string, any> = {};
    deepMerge(target, source);
    target.calendar.year = 600;
    expect(source.calendar.year).toBe(500);
  });

  it("takes non-plain values whole", () => {
    const date = new Date(0);
    const target: Record<string, unknown> = { date: new Date(1), fn: null };
    deepMerge(target, { date, fn: Math.max });
    expect(target.date).toBe(date);
    expect(target.fn).toBe(Math.max);
  });

  it("ignores keys that would reach the prototype chain", () => {
    const target: Record<string, any> = { safe: 1 };
    deepMerge(target, JSON.parse('{"__proto__": {"polluted": true}, "constructor": {"x": 1}, "safe": 2}'));
    expect(target.safe).toBe(2);
    expect(Object.getPrototypeOf(target)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("returns the target, so it can be used to build a value", () => {
    expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });
});
