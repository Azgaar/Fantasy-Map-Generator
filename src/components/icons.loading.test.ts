// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { tip } from "@/components/tooltips";
import "@/generators/relief-generator"; // the models own the set definitions the loader resolves
import "@/generators/burgs-generator";
import "@/generators/goods-generator";

vi.mock("@/components/tooltips", () => ({ tip: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  document.body.innerHTML =
    '<svg id="defElements"><defs><svg id="custom-goods-saved"><path id="nested-custom"/></svg></defs></svg>';
});

test("failure is atomic, reported once, cached across redraws, and explicitly retryable", async () => {
  const { Icons } = await import("./icons");
  const error = new Error("injection failed");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const container = document.createElementNS("http://www.w3.org/2000/svg", "g");
  container.id = "icons-library";
  document.querySelector("#defElements defs")!.append(container);
  const append = vi.spyOn(container, "appendChild").mockImplementationOnce(() => {
    throw error;
  });
  const first = Icons.load("goods");
  expect(Icons.retry("goods")).toBe(first); // a live attempt stays shared
  await first; // never rejects: the failure is reported by the chunk itself
  expect(Icons.group("goods")).toBeNull();
  expect(Icons.isLoaded("goods")).toBe(false);

  // redraws reuse the cached failure and never start a second attempt
  await Icons.load("goods");
  await Icons.load("goods");
  expect(log).toHaveBeenCalledExactlyOnceWith("Failed to load goods icons", error);
  expect(tip).toHaveBeenCalledTimes(1);
  expect(tip).toHaveBeenCalledWith(expect.stringContaining("goods"), false, "error", 8000);
  expect(append).toHaveBeenCalledTimes(1);

  // an explicit demand starts a fresh attempt
  const retry = Icons.retry("goods");
  expect(Icons.retry("goods")).toBe(retry);
  await retry;
  expect(Icons.isLoaded("goods")).toBe(true);
  expect(document.querySelectorAll("#icons-library > [data-set=goods]")).toHaveLength(1);
  log.mockRestore();
});

test("custom icons are rebuilt from the map's list, beside the loaded sets and never scripted", async () => {
  const { Icons } = await import("./icons");
  const defs = document.querySelector("#defElements defs")!;
  defs.insertAdjacentHTML("beforeend", '<g id="icons-library"><g data-set="goods"><symbol id="goods-wood"/></g></g>');
  Icons.syncCustom([
    { id: "custom-a", kind: "svg", content: '<g fill="red"><path d="M0 0"/></g>', viewBox: "0 0 10 10" },
    { id: "custom-b", kind: "image", content: "https://a.b/c.png", viewBox: "0 0 100 100" }
  ]);
  expect(document.querySelector("#custom-a")?.getAttribute("viewBox")).toBe("0 0 10 10");
  expect(document.querySelector("#custom-a g")?.getAttribute("fill")).toBe("red");
  expect(document.querySelector("#custom-b image")?.getAttribute("href")).toBe("https://a.b/c.png");

  Icons.syncCustom([
    { id: "custom-a", kind: "svg", content: '<script>alert(1)</script><g onclick="x()"/>', viewBox: "0 0 1 1" },
    { id: "custom-c", kind: "image", content: "javascript:alert(1)", viewBox: "0 0 100 100" }
  ]);
  expect(document.querySelector("#custom-b")).toBeNull(); // removed from the list, gone from the page
  expect(document.querySelector("#custom-a script")).toBeNull();
  expect(document.querySelector("#custom-a g")?.hasAttribute("onclick")).toBe(false);
  expect(document.querySelector("#custom-c")).toBeNull();
  expect(document.querySelector("#goods-wood")).not.toBeNull(); // the loaded sets are left alone
});

test("a glyph symbol is built once, on first use; a set starts loading when first referenced", async () => {
  const { Icons } = await import("./icons");
  expect(Icons.href("glyph-58-49-56")).toBe("#glyph-58-49-56");
  expect(Icons.href("glyph-58-49-56")).toBe("#glyph-58-49-56");
  const glyphs = document.querySelectorAll("#icons-library > [data-set=glyph] > symbol");
  expect(glyphs).toHaveLength(1);
  expect(glyphs[0].textContent?.trim()).toBe("XIV");
  expect(Icons.href("")).toBe("");

  const load = vi.spyOn(Icons, "load").mockResolvedValue();
  expect(Icons.href("goods-wood")).toBe("#goods-wood");
  expect(load).toHaveBeenCalledWith("goods");
});
