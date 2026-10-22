// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "./options-model";
import { ICONS_STORAGE_KEY } from "./options-model";
import { OPTIONS_STORAGE_KEY as STORAGE_KEY } from "./options-storage";

const icon = {
  id: "custom-1a2b3c4d",
  kind: "image" as const,
  content: "data:image/png;base64,AA",
  viewBox: "0 0 100 100"
};
let stored: Map<string, unknown>;

beforeEach(() => {
  localStorage.clear();
  stored = new Map();
  vi.stubGlobal("ldb", {
    get: vi.fn(async (key: string) => stored.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => void stored.set(key, structuredClone(value)))
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");

it("keeps custom icons in IndexedDB and never in localStorage", async () => {
  stored.set(ICONS_STORAGE_KEY, [icon, { id: "broken" }]);
  Options.restore();
  await Options.restoreIcons();

  expect(options.map.customIcons).toEqual([icon]); // the broken one is dropped on its own
  expect(saved().map.customIcons).toBeUndefined();

  options.map.customIcons.push({ ...icon, id: "custom-5e6f7a8b" });
  Options.iconsChanged();
  Options.persist();
  expect(stored.get(ICONS_STORAGE_KEY)).toHaveLength(2);
  expect(saved().map.customIcons).toBeUndefined();
});

it("moves icons an earlier version kept in localStorage to IndexedDB", async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ map: { customIcons: [icon] } }));
  Options.restore();
  expect(stored.has(ICONS_STORAGE_KEY)).toBe(false); // restore writes nothing before the stored icons are read
  await Options.restoreIcons();

  expect(stored.get(ICONS_STORAGE_KEY)).toEqual([icon]);
  expect(saved().map.customIcons).toBeUndefined();
});

it("writes no icons in a session whose IndexedDB never answers, so none there are lost", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("ldb", { get: vi.fn(() => new Promise(() => {})), set: vi.fn() });
  Options.restore();
  const restoring = Options.restoreIcons();
  await vi.advanceTimersByTimeAsync(5000);
  await restoring;

  Options.iconsChanged();
  Options.persist();
  expect(ldb.set).not.toHaveBeenCalled();
});
