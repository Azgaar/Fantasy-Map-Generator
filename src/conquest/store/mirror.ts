/**
 * mirror.ts — a crash-proof copy of the campaign, outside the `.map` file.
 *
 * Why this exists: a `.map` saved by **stock FMG** silently drops our line (§3.3),
 * and a browser tab closed mid-campaign loses whatever was only in memory. Both are
 * ways to lose a campaign that took an hour to play, so the log is mirrored here
 * after every command (debounced) and can be restored on the next visit.
 *
 * It is insurance, not the source of truth: the `.map` file remains the canonical
 * copy, and a mirror whose `mapPackId`/`contentHash` do not match the compiled
 * world is never replayed automatically.
 *
 * Everything here is best-effort. IndexedDB can be unavailable (private windows,
 * storage pressure, an Electron profile with no quota); a failure is logged and
 * dropped, because a missing mirror must never stop a campaign from being played.
 */
import { twWarn } from "../ui/fmg";
import type { TotalWarSlot } from "./mod-slot";

const DB_NAME = "total-war";
// v2 adds the config store (config-store.ts). Both modules guard their store
// creation, so whichever opens first builds the schema for both.
const DB_VERSION = 2;
const STORE = "campaigns";

export interface MirrorRecord {
  /** key: the compiled pack id the campaign belongs to */
  mapPackId: string;
  mapName: string;
  slot: TotalWarSlot;
  /** ms since epoch — the UI shows "mirrored 3m ago" */
  savedAt: number;
  /** the state hash at mirror time, so a restore can be verified, not assumed */
  stateHash: string;
  turn: number;
}

/** Debounce for mirroring: fast enough to feel continuous, slow enough to be free. */
const MIRROR_DEBOUNCE_MS = 600;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    try {
      if (typeof indexedDB === "undefined") {
        resolve(null);
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "mapPackId" });
        if (!db.objectStoreNames.contains("config")) db.createObjectStore("config", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      // A blocked or denied database must degrade to "no mirror", never throw.
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then(
    db =>
      new Promise<T | null>(resolve => {
        if (!db) {
          resolve(null);
          return;
        }
        try {
          const request = work(db.transaction(STORE, mode).objectStore(STORE));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        } catch (error) {
          twWarn("mirror transaction failed", error);
          resolve(null);
        }
      })
  );
}

/** Write the campaign for this world. Overwrites any previous copy. */
async function putMirror(record: MirrorRecord): Promise<boolean> {
  const written = await run("readwrite", store => store.put(record) as IDBRequest<IDBValidKey>);
  if (written === null) twWarn("campaign mirror unavailable — IndexedDB refused the write");
  return written !== null;
}

/** The mirrored campaign for a world, or null. */
export async function getMirror(mapPackId: string): Promise<MirrorRecord | null> {
  if (!mapPackId) return null;
  return run("readonly", store => store.get(mapPackId) as IDBRequest<MirrorRecord>);
}

export async function deleteMirror(mapPackId: string): Promise<void> {
  await run("readwrite", store => store.delete(mapPackId) as unknown as IDBRequest<undefined>);
}

/**
 * Mirror on every change, debounced: the caller invokes `schedule()` after each
 * command, and the write lands once the log stops moving. Persistence triggers
 * (`pagehide`) are wired once in session.ts — worlds recompile, and a listener
 * per compile is a leak.
 */
export function mirrorOnChange(makeRecord: () => MirrorRecord | null): {
  schedule: () => void;
  flush: () => void;
  /** drop any pending write without writing it — a detached campaign must not resurrect */
  cancel: () => void;
} {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latest: MirrorRecord | null = null;

  const write = (): void => {
    timer = null;
    const record = latest;
    latest = null;
    if (!record) return;
    void putMirror(record).catch(error => twWarn("mirror write failed", error));
  };

  const schedule = (): void => {
    try {
      latest = makeRecord();
    } catch (error) {
      twWarn("could not build the mirror record", error);
      return;
    }
    if (!latest) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(write, MIRROR_DEBOUNCE_MS);
  };

  return {
    schedule,
    flush: () => timer && write(),
    cancel: () => {
      if (timer) clearTimeout(timer);
      timer = null;
      latest = null;
    }
  };
}

/** "just now" / "4m ago" — for the rail's mirror line. */
export function ageLabel(savedAt: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - savedAt) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
