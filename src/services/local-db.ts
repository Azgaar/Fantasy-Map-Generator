// A key-value store over IndexedDB, for blobs too large for localStorage
const DATABASE_NAME = "d2";
const STORE_NAME = "s";

let opening: Promise<IDBDatabase> | undefined;

const isSupported = (): boolean => typeof indexedDB !== "undefined";

function openDatabase(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    if (!isSupported()) return reject(new Error("IndexedDB is not supported"));
    const request = indexedDB.open(DATABASE_NAME);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      opening = undefined;
      reject(request.error ?? new Error("IndexedDB request error"));
    };
  });
  return opening;
}

/** Any value IndexedDB can clone; null when the key is missing */
async function get<T = Blob>(key: string): Promise<T | null> {
  const db = await openDatabase();
  if (!db.objectStoreNames.contains(STORE_NAME)) throw new Error("IndexedDB: no store found");
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result?.value || null);
    request.onerror = () => reject(request.error);
  });
}

async function set(key: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({ key, value });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export const LocalDB = { isSupported, get, set };
