/**
 * config-store.ts — the culture-group config library, persisted in IndexedDB.
 *
 * The Config dialog (ui/content/config.ts) authors a *library*: the culture
 * groups and their units, buildings and technology. This module is where that
 * library lives — the browser's own storage, so a player's groups survive map
 * switches, reloads and sessions without touching any world file.
 *
 * The library is the *authoring* home, not the runtime truth. Applying it
 * merges it over the shipped ruleset into the page's live rules (content/store.ts),
 * and from there the rules behave like any edit: validated, replayed, and carried
 * inside the `.map` file. A shared map therefore plays identically on machines
 * that never had this library — the map carries the resolved result.
 *
 * Everything here is best-effort, mirroring mirror.ts: IndexedDB can refuse
 * (private windows, quota); a failure is logged and the game continues on the
 * shipped baseline rather than breaking the page.
 */

import type { RawContentDocs } from "../engine/common/content";
import { twWarn } from "../ui/fmg";

/** The library subset of the content docs — what the Config dialog authors. */
export interface LibraryDocs {
  rosterDocs: { file: string; doc: unknown }[];
  culturesDocs: { file: string; doc: unknown }[];
  buildingsDocs: { file: string; doc: unknown }[];
  techDocs: { file: string; doc: unknown }[];
}

export interface ConfigLibrary extends LibraryDocs {
  /** Single-record key; also lets a future schema version the payload. */
  id: "library";
  version: 1;
  savedAt: number;
}

/** Extract the library subset from any live docs (the rest is not config). */
export function libraryOf(docs: RawContentDocs): LibraryDocs {
  return {
    rosterDocs: structuredClone(docs.rosterDocs),
    culturesDocs: structuredClone(docs.culturesDocs ?? []),
    buildingsDocs: structuredClone(docs.buildingsDocs ?? []),
    techDocs: structuredClone(docs.techDocs ?? [])
  };
}

const DB_NAME = "total-war";
const DB_VERSION = 2;
const STORE = "config";
const KEY = "library";

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
        // v2 adds the config store next to the campaign mirror (v1).
        if (!db.objectStoreNames.contains("campaigns")) db.createObjectStore("campaigns", { keyPath: "mapPackId" });
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
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
          twWarn("config store transaction failed", error);
          resolve(null);
        }
      })
  );
}

/** The saved library, or null when none was ever saved (or storage refused). */
export async function loadConfigLibrary(): Promise<ConfigLibrary | null> {
  const record = await run("readonly", store => store.get(KEY) as IDBRequest<ConfigLibrary | undefined>);
  return record ?? null;
}

/** Save the library. Returns false when storage refused — the UI says so. */
export async function saveConfigLibrary(docs: LibraryDocs): Promise<boolean> {
  const record: ConfigLibrary = { id: KEY, version: 1, savedAt: Date.now(), ...structuredClone(docs) };
  const written = await run("readwrite", store => store.put(record) as IDBRequest<IDBValidKey>);
  if (written === null) twWarn("config library unavailable — IndexedDB refused the write");
  return written !== null;
}

export async function clearConfigLibrary(): Promise<void> {
  await run("readwrite", store => store.delete(KEY) as unknown as IDBRequest<undefined>);
}
