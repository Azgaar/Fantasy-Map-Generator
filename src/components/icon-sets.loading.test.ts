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
  const { IconSets } = await import("./icon-sets");
  const error = new Error("injection failed");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const append = vi.spyOn(document.querySelector("#defElements defs")!, "appendChild").mockImplementationOnce(() => {
    throw error;
  });
  const first = IconSets.load("goods");
  expect(IconSets.retry("goods")).toBe(first); // a live attempt stays shared
  await first; // never rejects: the failure is reported by the chunk itself
  expect(document.querySelector("#icons-goods")).toBeNull();
  expect(IconSets.isLoaded("goods")).toBe(false);

  // redraws reuse the cached failure and never start a second attempt
  await IconSets.load("goods");
  await IconSets.load("goods");
  expect(log).toHaveBeenCalledExactlyOnceWith("Failed to load goods icons", error);
  expect(tip).toHaveBeenCalledTimes(1);
  expect(tip).toHaveBeenCalledWith(expect.stringContaining("goods"), false, "error", 8000);
  expect(append).toHaveBeenCalledTimes(1);

  // an explicit demand starts a fresh attempt
  const retry = IconSets.retry("goods");
  expect(IconSets.retry("goods")).toBe(retry);
  await retry;
  expect(IconSets.isLoaded("goods")).toBe(true);
  expect(document.querySelectorAll("#icons-goods")).toHaveLength(1);
  log.mockRestore();
});
