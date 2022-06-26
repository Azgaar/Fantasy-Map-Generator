// indexedDB support: ldb object

// @ts-ignore unimplemented historical interfaces
const indexedDBfactory = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
if (!indexedDBfactory) console.error("indexedDB not supported");

let database;
const databaseRequest = indexedDBfactory.open("d2", 1);

databaseRequest.onsuccess = function () {
  database = this.result;
};

databaseRequest.onerror = function (e) {
  console.error("indexedDB request error", e);
};

databaseRequest.onupgradeneeded = function (event) {
  database = null;
  const store = databaseRequest.result.createObjectStore("s", {keyPath: "k"});
  store.transaction.oncomplete = function (e) {
    database = e.target.db;
  };
};

function getValue(key, callback) {
  if (!database) {
    setTimeout(() => getValue(key, callback), 100);
    return;
  }

  database.transaction("s").objectStore("s").get(key).onsuccess = function (e) {
    const value = (e.target.result && e.target.result.v) || null;
    callback(value);
  };
}

function setValue(key) {
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
