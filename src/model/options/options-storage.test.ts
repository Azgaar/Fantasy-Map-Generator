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

it("keeps the battle options, a bad stored one falling back to its default", async () => {
  const { Options } = await import("./options-model");
  const { DEFAULT_BATTLE_OPTIONS } = await import("@/data/battle-options");
  Options.restore();
  expect(options.app.battle).toEqual(DEFAULT_BATTLE_OPTIONS);
  options.app.battle.view.speed = 4;
  options.app.battle.simulation.maxBattalions = 20;
  Options.persist();
  const stored = readStoredOptions() as { app: { battle: { view: { speed: number }; simulation: object } } };
  stored.app.battle.view.speed = 3; // not a speed of the screen
  stored.app.battle.simulation = { ...stored.app.battle.simulation, minBattalions: 30 }; // more than the most
  localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(stored));
  Options.restore();
  expect(options.app.battle.view.speed).toBe(DEFAULT_BATTLE_OPTIONS.view.speed);
  expect(options.app.battle.simulation).toEqual(DEFAULT_BATTLE_OPTIONS.simulation);
});
