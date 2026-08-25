const DATABASE_NAME = "d2";
const STORE_NAME = "s";

/** Browser-backed storage for the last map, preserving the legacy IndexedDB schema. */
export const LocalMapStorage = {
  async get(key: string): Promise<Blob | undefined> {
    const store = await getStore("readonly");
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
    });
  },

  async set(key: string, value: Blob): Promise<void> {
    const store = await getStore("readwrite");
    await new Promise<void>((resolve, reject) => {
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("IndexedDB write failed"));
    });
  }
};

let database: IDBDatabase | undefined;

async function getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDatabase();
  if (!db.objectStoreNames.contains(STORE_NAME)) throw new Error("IndexedDB: no store found");
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function openDatabase(): Promise<IDBDatabase> {
  if (database) return Promise.resolve(database);
  if (!window.indexedDB) return Promise.reject(new Error("IndexedDB is not supported"));

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => {
      database = request.result;
      resolve(database);
    };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request error"));
  });
}
