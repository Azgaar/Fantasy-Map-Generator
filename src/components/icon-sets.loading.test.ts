// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { tip } from "@/components/tooltips";
import "@/generators/relief-generator"; // installs the Relief global the loader resolves slots against

vi.mock("@/components/tooltips", () => ({ tip: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  document.body.innerHTML =
    '<svg id="defElements"><defs><g id="good-icons"><svg id="good-custom-saved"><path id="nested-custom"/></svg></g></defs></svg>';
});

test("concurrent callers share a load; subsequent calls never inject again or remove custom goods", async () => {
  const { GOOD_ICON_ROOTS, IconSets } = await import("./icon-sets");
  const first = IconSets.load("goods");
  expect(IconSets.load("goods")).toBe(first);
  expect(IconSets.isLoaded("goods")).toBe(false);
  await first;
  expect(IconSets.isLoaded("goods")).toBe(true);
  await IconSets.load("goods", { retry: true });
  expect(document.querySelectorAll("#icons-goods")).toHaveLength(1);
  expect(document.querySelectorAll("#icons-goods > symbol")).toHaveLength(72);
  document.querySelector("#icons-goods > symbol")!.insertAdjacentHTML("beforeend", '<g id="artwork-internal"/>');
  const entries = Array.from(document.querySelectorAll(GOOD_ICON_ROOTS), el => el.id);
  expect(entries).toHaveLength(73);
  expect(entries).toContain("good-custom-saved");
  expect(entries).not.toContain("icons-goods");
  expect(entries).not.toContain("nested-custom");
  expect(entries).not.toContain("artwork-internal");
});

test("failure is atomic, reported once, cached across redraws, and explicitly retryable", async () => {
  const { IconSets } = await import("./icon-sets");
  const error = new Error("injection failed");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const append = vi.spyOn(document.querySelector("#good-icons")!, "appendChild").mockImplementationOnce(() => {
    throw error;
  });
  const first = IconSets.load("goods");
  expect(IconSets.load("goods", { retry: true })).toBe(first);
  await expect(first).rejects.toBe(error);
  expect(document.querySelector("#icons-goods")).toBeNull();
  expect(IconSets.isLoaded("goods")).toBe(false);

  // renderers keep drawing without icons and never start a second attempt
  await IconSets.ensure("goods");
  await IconSets.ensure("goods");
  await expect(IconSets.load("goods")).rejects.toBe(error);
  expect(log).toHaveBeenCalledExactlyOnceWith("Failed to load goods icons", error);
  expect(tip).toHaveBeenCalledTimes(1);
  expect(tip).toHaveBeenCalledWith(expect.stringContaining("goods"), false, "error", 8000);
  expect(append).toHaveBeenCalledTimes(1);

  const retry = IconSets.load("goods", { retry: true });
  expect(IconSets.load("goods", { retry: true })).toBe(retry);
  await retry;
  expect(IconSets.isLoaded("goods")).toBe(true);
  expect(document.querySelectorAll("#icons-goods")).toHaveLength(1);
  log.mockRestore();
});
