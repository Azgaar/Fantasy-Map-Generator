// @ts-ignore unimplemented historical interfaces
const indexedDBfactory = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
if (!indexedDBfactory) console.error("indexedDB not supported");

let database: IDBDatabase | null = null;
const databaseRequest = indexedDBfactory.open("d2", 1);

databaseRequest.onsuccess = function () {
  database = this.result;
};

databaseRequest.onerror = e => {
  console.error("indexedDB request error", e);
};

databaseRequest.onupgradeneeded = () => {
  database = null;
  const store = databaseRequest.result.createObjectStore("s", {keyPath: "k"});
  store.transaction.oncomplete = event => {
    database = (event.target as IDBTransaction)?.db;
  };
};

function getValue(key: string, callback: (value: unknown) => void) {
  if (!database) {
    setTimeout(() => getValue(key, callback), 100);
    return;
  }

  database.transaction("s").objectStore("s").get(key).onsuccess = event => {
    const target = event.target as IDBRequest<IDBDatabase>;
    const value = target.result || null;
    callback(value);
  };
}

function setValue(key: string, value: unknown) {
  if (!database) {
    setTimeout(() => setValue(key, value), 100);
    return;
  }

  database
    .transaction("s", "readwrite")
    .objectStore("s")
    .put({[key]: value});
}

export const ldb = {get: getValue, set: setValue};
