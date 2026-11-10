// Maps kept in the browser: one quick save plus rotating autosaves. A backup, never a replacement for the .map file
import { formatTimestamp } from "@/services/io/file-name";
import { LocalDB } from "@/services/local-db";
import { downloadFile } from "@/utils/file-utils";

const QUICK_SLOT = "lastMap"; // predates the slots: may still hold a bare plain-text Blob
const AUTO_SLOTS = ["autosave-1", "autosave-2", "autosave-3", "autosave-4", "autosave-5"];
const SLOTS = [QUICK_SLOT, ...AUTO_SLOTS];

export interface MapSnapshot {
  name: string;
  mapId: number;
  version: string;
  data: string;
}

export interface BrowserSave {
  id: string;
  kind: "quick" | "auto";
  name: string;
  mapId: number;
  version: string;
  savedAt: number; // 0 for a save made before the slots
  size: number;
}

interface StoredSave extends Omit<BrowserSave, "id" | "kind" | "size"> {
  blob: Blob; // gzip
}

/** Everything stored, newest first */
async function list(): Promise<BrowserSave[]> {
  const stored = await Promise.all(SLOTS.map(id => LocalDB.get<StoredSave | Blob>(id)));
  const saves = stored.flatMap((record, index) => (record ? [describe(SLOTS[index], record)] : []));
  return saves.sort((a, b) => b.savedAt - a.savedAt);
}

async function latest(): Promise<BrowserSave | null> {
  return (await list())[0] ?? null;
}

const writeQuick = (snapshot: MapSnapshot): Promise<void> => write(QUICK_SLOT, snapshot);

async function writeAuto(snapshot: MapSnapshot): Promise<void> {
  const autosaves = (await list()).filter(save => save.kind === "auto");
  await write(pickAutosaveSlot(autosaves, snapshot.mapId), snapshot);
}

/** The stored file as the loader takes it: gzip, or plain text for a save made before the slots */
async function read(id: string): Promise<Blob | null> {
  const record = await get(id);
  if (!record) return null;
  return record instanceof Blob ? record : record.blob;
}

async function remove(id: string): Promise<void> {
  if (SLOTS.includes(id)) await LocalDB.remove(id);
}

/** Download a stored map as a plain-text .map file */
async function download(id: string): Promise<void> {
  const record = await get(id);
  if (!record) return;

  const { name, savedAt } = describe(id, record);
  const file = record instanceof Blob ? record : await gunzip(record.blob);
  downloadFile(file, `${name || "map"} ${formatTimestamp(new Date(savedAt || Date.now()))}.map`);
}

/** An empty slot, else the oldest autosave that is not the last one left of another map */
export function pickAutosaveSlot(autosaves: BrowserSave[], mapId: number): string {
  const free = AUTO_SLOTS.find(id => !autosaves.some(save => save.id === id));
  if (free) return free;

  const oldestFirst = [...autosaves].sort((a, b) => a.savedAt - b.savedAt);
  const newestOfMap = new Map(oldestFirst.map(save => [save.mapId, save.id]));
  const isProtected = (save: BrowserSave) => save.mapId !== mapId && newestOfMap.get(save.mapId) === save.id;
  return (oldestFirst.find(save => !isProtected(save)) ?? oldestFirst[0]).id;
}

const get = async (id: string) => (SLOTS.includes(id) ? LocalDB.get<StoredSave | Blob>(id) : null);

async function write(id: string, { data, ...meta }: MapSnapshot): Promise<void> {
  const record: StoredSave = { ...meta, savedAt: Date.now(), blob: await gzip(data) };
  await LocalDB.set(id, record);
}

function describe(id: string, record: StoredSave | Blob): BrowserSave {
  const kind = id === QUICK_SLOT ? "quick" : "auto";
  if (record instanceof Blob) return { id, kind, name: "", mapId: 0, version: "", savedAt: 0, size: record.size };

  const { blob, ...meta } = record;
  return { id, kind, ...meta, size: blob.size };
}

const gzip = (data: string): Promise<Blob> => pipe(new Blob([data]), new CompressionStream("gzip"));
const gunzip = (blob: Blob): Promise<Blob> => pipe(blob, new DecompressionStream("gzip"));
const pipe = (blob: Blob, transform: CompressionStream | DecompressionStream): Promise<Blob> =>
  new Response(blob.stream().pipeThrough(transform)).blob();

export const BrowserSaves = { list, latest, writeQuick, writeAuto, read, remove, download };
