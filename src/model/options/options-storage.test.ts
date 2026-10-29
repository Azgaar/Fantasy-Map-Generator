// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { OPTIONS_STORAGE_KEY, readStoredOptions } from "./options-storage";

beforeEach(() => localStorage.clear());

it("reads the stored options object", () => {
  localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify({ app: { language: "ru" } }));
  expect(readStoredOptions()).toEqual({ app: { language: "ru" } });
});

it("is empty when nothing readable is stored", () => {
  expect(readStoredOptions()).toEqual({});
  localStorage.setItem(OPTIONS_STORAGE_KEY, "{not json");
  expect(readStoredOptions()).toEqual({});
  localStorage.setItem(OPTIONS_STORAGE_KEY, "42");
  expect(readStoredOptions()).toEqual({});
});

it("never stores the edit mode, so a reload starts outside it", async () => {
  const { Options } = await import("./options-model");
  Options.restore();
  options.app.mode = "heightmap";
  Options.persist();
  expect(readStoredOptions().app).not.toHaveProperty("mode");
  Options.restore();
  expect(options.app.mode).toBeNull();
});
