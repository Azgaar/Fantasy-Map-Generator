import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { parseSections } from "./schemaUtils";

const schema = z.strictObject({
  scalar: z.string(),
  section: z.strictObject({ a: z.number(), b: z.string() }),
  list: z.array(z.number())
});
type Data = z.infer<typeof schema>;

const defaults = (): Data => ({ scalar: "default", section: { a: 1, b: "b" }, list: [1, 2] });

describe("parseSections", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("adopts a valid object unchanged", () => {
    const input = { scalar: "x", section: { a: 9, b: "y" }, list: [3] };
    expect(parseSections<Data>(schema, defaults(), input, "test")).toEqual(input);
  });

  it("fills in a missing section from the defaults", () => {
    const parsed = parseSections<Data>(schema, defaults(), { scalar: "x" }, "test");
    expect(parsed.section).toEqual({ a: 1, b: "b" });
    expect(parsed.scalar).toBe("x");
  });

  it("repairs one invalid value and keeps the rest of its section", () => {
    const input = { scalar: "x", section: { a: "not a number", b: "kept" }, list: [3] };
    const parsed = parseSections<Data>(schema, defaults(), input, "test");
    expect(parsed.section).toEqual({ a: 1, b: "kept" });
  });

  it("falls back to the whole section when repair is impossible", () => {
    const parsed = parseSections<Data>(schema, defaults(), { section: "not an object" }, "test");
    expect(parsed.section).toEqual({ a: 1, b: "b" });
  });

  it("replaces an invalid scalar section with its default", () => {
    const parsed = parseSections<Data>(schema, defaults(), { scalar: 42 }, "test");
    expect(parsed.scalar).toBe("default");
  });

  it("strips unknown keys", () => {
    const input = { scalar: "x", section: { a: 1, b: "b", stale: true }, list: [], extra: 1 };
    const parsed = parseSections<Data>(schema, defaults(), input, "test") as Record<string, unknown>;
    expect(parsed.extra).toBeUndefined();
    expect(parsed.section).toEqual({ a: 1, b: "b" });
  });

  it("names the offending section in the warning", () => {
    parseSections<Data>(schema, defaults(), { section: "bad" }, "MyLabel");
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("MyLabel"));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("section"));
  });

  it("does not share structure with the defaults it fell back to", () => {
    const source = defaults();
    const parsed = parseSections<Data>(schema, source, {}, "test");
    parsed.section.a = 99;
    expect(source.section.a).toBe(1);
  });

  it("treats a non-object input as empty", () => {
    expect(parseSections<Data>(schema, defaults(), null, "test")).toEqual(defaults());
  });
});
