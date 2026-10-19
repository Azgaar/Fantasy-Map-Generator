import { describe, expect, it } from "vitest";
import { Tags } from "./tags";

describe("Tags", () => {
  describe("parse", () => {
    it("returns empty array for empty string, null, undefined or whitespace", () => {
      expect(Tags.parse("")).toEqual([]);
      expect(Tags.parse(null)).toEqual([]);
      expect(Tags.parse(undefined)).toEqual([]);
      expect(Tags.parse("   ")).toEqual([]);
      expect(Tags.parse(" , , ")).toEqual([]);
    });

    it("parses and normalizes tags from comma- and semicolon-separated strings", () => {
      expect(Tags.parse("Empire")).toEqual(["empire"]);
      expect(Tags.parse(" coastal, naval ; trade ")).toEqual(["coastal", "naval", "trade"]);
      expect(Tags.parse("#coastal, #naval; #trade")).toEqual(["coastal", "naval", "trade"]);
    });

    it("parses and normalizes tags from array", () => {
      expect(Tags.parse(["Coastal", "NAVAL ", "#naval", "trade; commercial"])).toEqual([
        "coastal",
        "naval",
        "trade",
        "commercial"
      ]);
    });

    it("deduplicates tags and discards empty values", () => {
      expect(Tags.parse("trade, Trade, #TRADE, other")).toEqual(["trade", "other"]);
      expect(Tags.parse("one,,two,  ,three; ;four")).toEqual(["one", "two", "three", "four"]);
    });
  });

  describe("format", () => {
    it("formats array into comma-separated string", () => {
      expect(Tags.format(["coastal", "trade"])).toBe("coastal, trade");
      expect(Tags.format([])).toBe("");
      expect(Tags.format(undefined)).toBe("");
    });
  });

  describe("matches", () => {
    it("matches all when query is empty or whitespace", () => {
      expect(Tags.matches("", "France", ["coastal"])).toBe(true);
      expect(Tags.matches("   ", "France", ["coastal"])).toBe(true);
    });

    it("matches name case-insensitively", () => {
      expect(Tags.matches("fra", "France", ["coastal"])).toBe(true);
      expect(Tags.matches("FRANCE", "France")).toBe(true);
      expect(Tags.matches("spain", "France")).toBe(false);
    });

    it("matches alias or full name", () => {
      expect(Tags.matches("kingdom", "France", [], ["Kingdom of France"])).toBe(true);
      expect(Tags.matches("empire", "France", [], ["Kingdom of France"])).toBe(false);
    });

    it("matches tag substring case-insensitively", () => {
      expect(Tags.matches("coast", "France", ["coastal", "trade"])).toBe(true);
      expect(Tags.matches("TRADE", "France", ["coastal", "trade"])).toBe(true);
      expect(Tags.matches("naval", "France", ["coastal", "trade"])).toBe(false);
    });

    it("matches only tags when search query starts with #", () => {
      expect(Tags.matches("#coastal", "France", ["coastal"])).toBe(true);
      expect(Tags.matches("#france", "France", ["coastal"])).toBe(false);
      expect(Tags.matches("#", "France", ["coastal"])).toBe(true);
      expect(Tags.matches("#", "France", [])).toBe(false);
      expect(Tags.matches("#", "France", undefined)).toBe(false);
    });
  });

  describe("entity operations", () => {
    it("gets tags from an entity", () => {
      const entity = { tags: ["coastal", "trade"] };
      expect(Tags.get(entity)).toEqual(["coastal", "trade"]);
      expect(Tags.get({})).toEqual([]);
    });

    it("sets tags on an entity", () => {
      const entity: { tags?: string[] } = {};
      expect(Tags.set(entity, "Empire, Trade, trade")).toEqual(["empire", "trade"]);
      expect(entity.tags).toEqual(["empire", "trade"]);
    });

    it("adds tags to an entity without duplicates", () => {
      const entity = { tags: ["coastal"] };
      expect(Tags.add(entity, "naval", "COASTAL", "trade")).toEqual(["coastal", "naval", "trade"]);
      expect(entity.tags).toEqual(["coastal", "naval", "trade"]);
    });

    it("removes tags from an entity", () => {
      const entity = { tags: ["coastal", "naval", "trade"] };
      expect(Tags.remove(entity, "naval", "other")).toEqual(["coastal", "trade"]);
      expect(entity.tags).toEqual(["coastal", "trade"]);
    });

    it("checks if an entity has a tag", () => {
      const entity = { tags: ["coastal", "trade"] };
      expect(Tags.has(entity, "coastal")).toBe(true);
      expect(Tags.has(entity, "#coastal")).toBe(true);
      expect(Tags.has(entity, "TRADE")).toBe(true);
      expect(Tags.has(entity, "naval")).toBe(false);
      expect(Tags.has(null, "naval")).toBe(false);
      expect(Tags.has(undefined, "naval")).toBe(false);
      expect(Tags.has(entity, "")).toBe(false);
      expect(Tags.has(entity, null)).toBe(false);
    });

    it("handles primitives and null safely in resolve and get", () => {
      expect(Tags.get(null)).toEqual([]);
      expect(Tags.get(undefined)).toEqual([]);
      expect(Tags.get(0 as any)).toEqual([]);
      expect(Tags.get("string" as any)).toEqual([]);
    });

    it("collects all unique tags across items", () => {
      const items = [
        { tags: ["coastal", "naval"] },
        { tags: ["trade", "coastal"] },
        { tags: [] },
        {},
        null,
        undefined,
        0 as any
      ];
      expect(Tags.all(items)).toEqual(["coastal", "naval", "trade"]);
    });
  });
});
