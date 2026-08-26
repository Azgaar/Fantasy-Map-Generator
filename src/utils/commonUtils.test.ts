// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { getBase64, getCoordinates, getLatitude, getLongitude, parseError } from "./commonUtils";

describe("getLongitude", () => {
  const mapCoordinates = { lonW: -10, lonT: 20 };
  const graphWidth = 1000;

  it("should calculate longitude at the left edge (x=0)", () => {
    expect(getLongitude(0, mapCoordinates, graphWidth, 2)).toBe(-10);
  });

  it("should calculate longitude at the right edge (x=graphWidth)", () => {
    expect(getLongitude(1000, mapCoordinates, graphWidth, 2)).toBe(10);
  });

  it("should calculate longitude at the center (x=graphWidth/2)", () => {
    expect(getLongitude(500, mapCoordinates, graphWidth, 2)).toBe(0);
  });

  it("should respect decimal precision", () => {
    // 333/1000 * 20 = 6.66, -10 + 6.66 = -3.34
    expect(getLongitude(333, mapCoordinates, graphWidth, 4)).toBe(-3.34);
  });

  it("should handle different map coordinate ranges", () => {
    const wideMap = { lonW: -180, lonT: 360 };
    expect(getLongitude(500, wideMap, graphWidth, 2)).toBe(0);
    expect(getLongitude(0, wideMap, graphWidth, 2)).toBe(-180);
    expect(getLongitude(1000, wideMap, graphWidth, 2)).toBe(180);
  });
});

describe("getLatitude", () => {
  const mapCoordinates = { latN: 60, latT: 40 };
  const graphHeight = 800;

  it("should calculate latitude at the top edge (y=0)", () => {
    expect(getLatitude(0, mapCoordinates, graphHeight, 2)).toBe(60);
  });

  it("should calculate latitude at the bottom edge (y=graphHeight)", () => {
    expect(getLatitude(800, mapCoordinates, graphHeight, 2)).toBe(20);
  });

  it("should calculate latitude at the center (y=graphHeight/2)", () => {
    expect(getLatitude(400, mapCoordinates, graphHeight, 2)).toBe(40);
  });

  it("should respect decimal precision", () => {
    // 60 - (333/800 * 40) = 60 - 16.65 = 43.35
    expect(getLatitude(333, mapCoordinates, graphHeight, 4)).toBe(43.35);
  });

  it("should handle equator-centered maps", () => {
    const equatorMap = { latN: 45, latT: 90 };
    expect(getLatitude(400, equatorMap, graphHeight, 2)).toBe(0);
  });
});

describe("getCoordinates", () => {
  const mapCoordinates = { lonW: -10, lonT: 20, latN: 60, latT: 40 };
  const graphWidth = 1000;
  const graphHeight = 800;

  it("should return [longitude, latitude] tuple", () => {
    const result = getCoordinates(500, 400, mapCoordinates, graphWidth, graphHeight, 2);
    expect(result).toEqual([0, 40]);
  });

  it("should calculate coordinates at top-left corner", () => {
    const result = getCoordinates(0, 0, mapCoordinates, graphWidth, graphHeight, 2);
    expect(result).toEqual([-10, 60]);
  });

  it("should calculate coordinates at bottom-right corner", () => {
    const result = getCoordinates(1000, 800, mapCoordinates, graphWidth, graphHeight, 2);
    expect(result).toEqual([10, 20]);
  });

  it("should respect decimal precision for both coordinates", () => {
    const result = getCoordinates(333, 333, mapCoordinates, graphWidth, graphHeight, 4);
    expect(result[0]).toBe(-3.34); // longitude
    expect(result[1]).toBe(43.35); // latitude
  });

  it("should use default precision of 2 decimals", () => {
    const result = getCoordinates(333, 333, mapCoordinates, graphWidth, graphHeight);
    expect(result[0]).toBe(-3.34);
    expect(result[1]).toBe(43.35);
  });

  it("should handle global map coordinates", () => {
    const globalMap = { lonW: -180, lonT: 360, latN: 90, latT: 180 };
    const result = getCoordinates(500, 400, globalMap, graphWidth, graphHeight, 2);
    expect(result).toEqual([0, 0]); // center of the world
  });
});

describe("parseError", () => {
  it("should report the error itself", () => {
    expect(parseError(new Error("boom")).includes("boom")).toBe(true);
  });

  it("should report the causes the error was wrapped over", () => {
    const original = new Error("cell 42 is not defined");
    const wrapped = new Error('Generation Pipeline failed at step "rivers"', { cause: original });

    const parsed = parseError(wrapped);

    expect(parsed.includes('step "rivers"')).toBe(true); // "at " is reformatted, so the message is matched in parts
    expect(parsed.includes("Caused by:")).toBe(true);
    expect(parsed.includes("cell 42 is not defined")).toBe(true);
  });

  it("should not follow a cause that is not an error", () => {
    expect(parseError(new Error("boom", { cause: "just a string" })).includes("Caused by:")).toBe(false);
  });
});

describe("getBase64", () => {
  type NextResponse = { status: number; blob: Blob } | { networkError: true };
  let next: NextResponse;

  class FakeXhr {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    status = 0;
    response: Blob | null = null;
    responseType = "";
    open() {}
    send() {
      queueMicrotask(() => {
        if ("networkError" in next) return this.onerror?.();
        this.status = next.status;
        this.response = next.blob;
        this.onload?.();
      });
    }
  }
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
  afterEach(() => vi.stubGlobal("XMLHttpRequest", FakeXhr));

  const call = () =>
    new Promise<string | ArrayBuffer | null>(resolve => getBase64("https://example.com/img.png", resolve));

  it("inlines a successful image response as a data URI", async () => {
    next = { status: 200, blob: new Blob(["fake-png-bytes"], { type: "image/png" }) };
    const result = await call();
    expect(typeof result).toBe("string");
    expect(result).toMatch(/^data:image\/png/);
  });

  it("returns null for a non-2xx response instead of inlining the error page", async () => {
    next = { status: 404, blob: new Blob(["<!DOCTYPE html><h1>404</h1>"], { type: "text/html" }) };
    expect(await call()).toBeNull();
  });

  it("returns null for a 2xx response that is not an image", async () => {
    next = { status: 200, blob: new Blob(["<!DOCTYPE html>"], { type: "text/html" }) };
    expect(await call()).toBeNull();
  });

  it("returns null on network error", async () => {
    next = { networkError: true };
    expect(await call()).toBeNull();
  });
});
