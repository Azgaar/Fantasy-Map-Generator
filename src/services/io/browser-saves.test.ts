import { beforeEach, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => new Map<string, unknown>());
const downloadFile = vi.hoisted(() => vi.fn());
vi.mock("@/services/local-db", () => ({
  LocalDB: {
    get: async (key: string) => storage.get(key) ?? null,
    set: async (key: string, value: unknown) => void storage.set(key, value),
    remove: async (key: string) => void storage.delete(key)
  }
}));
vi.mock("@/utils/file-utils", () => ({ downloadFile }));

import { BrowserSaves } from "./browser-saves";

const snapshot = (mapId: number, data = `map ${mapId}`) => ({ name: `Map ${mapId}`, mapId, version: "1.0.0", data });

beforeEach(() => {
  storage.clear();
  downloadFile.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
});

async function autosave(mapId: number, times = 1): Promise<void> {
  for (let index = 0; index < times; index++) {
    vi.advanceTimersByTime(60000);
    await BrowserSaves.writeAuto(snapshot(mapId));
  }
}

const autosavedMaps = async () => (await BrowserSaves.list()).filter(save => save.kind === "auto").map(s => s.mapId);

it("keeps five autosaves, newest first, and never touches the quick save", async () => {
  await BrowserSaves.writeQuick(snapshot(1));
  await autosave(1, 7);

  const saves = await BrowserSaves.list();
  expect(saves.filter(save => save.kind === "auto")).toHaveLength(5);
  expect(saves.filter(save => save.kind === "quick")).toHaveLength(1);
  expect(saves[0].savedAt).toBeGreaterThan(saves[1].savedAt);
  expect((await BrowserSaves.latest())?.kind).toBe("auto");
});

it("evicts the last autosave of another map only when nothing else is left", async () => {
  await autosave(1, 5);
  await autosave(2, 10);
  expect((await autosavedMaps()).sort()).toEqual([1, 2, 2, 2, 2]);

  await autosave(3, 10);
  expect((await autosavedMaps()).sort()).toEqual([1, 2, 3, 3, 3]);

  for (const mapId of [4, 5, 6]) await autosave(mapId);
  expect((await autosavedMaps()).sort()).toEqual([2, 3, 4, 5, 6]); // five other maps: the oldest goes
});

it("stores gzip and downloads the original text", async () => {
  const data = "1.0.0|header\r\n".repeat(500);
  await BrowserSaves.writeQuick({ ...snapshot(1, data), name: "Angria" });

  const [save] = await BrowserSaves.list();
  expect(save.size).toBeLessThan(data.length / 5);

  await BrowserSaves.download(save.id);
  const [file, name] = downloadFile.mock.calls[0];
  expect(await (file as Blob).text()).toBe(data);
  expect(name).toMatch(/^Angria \d{4}-\d\d-\d\d-\d\d-\d\d\.map$/);
});

it("reads a save made before the slots as it is", async () => {
  storage.set("lastMap", new Blob(["legacy map"]));

  const [save] = await BrowserSaves.list();
  expect(save).toMatchObject({ id: "lastMap", kind: "quick", name: "", savedAt: 0 });
  expect(await (await BrowserSaves.read(save.id))?.text()).toBe("legacy map");

  await BrowserSaves.download(save.id);
  expect(await (downloadFile.mock.calls[0][0] as Blob).text()).toBe("legacy map");
});

it("removes a save and ignores unknown keys", async () => {
  storage.set("fmg-custom-icons", "icons");
  await BrowserSaves.writeQuick(snapshot(1));

  await BrowserSaves.remove("fmg-custom-icons");
  await BrowserSaves.remove("lastMap");

  expect(storage.has("fmg-custom-icons")).toBe(true);
  expect(await BrowserSaves.list()).toEqual([]);
  expect(await BrowserSaves.read("fmg-custom-icons")).toBeNull();
});
