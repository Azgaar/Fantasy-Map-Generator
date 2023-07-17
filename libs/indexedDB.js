let db;

const DATABASE_NAME = "d2";
const STORE_NAME = "s";
const KEY_PATH = "key";

const openDatabase = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve();
    } else {
      const request = window.indexedDB.open(DATABASE_NAME, 1);

      request.onsuccess = event => {
        db = event.target.result;
        resolve();
      };

      request.onerror = event => {
        console.error("indexedDB request error");
        console.log(event);
        reject();
      };

      request.onupgradeneeded = event => {
        db = event.target.result;
        const objectStore = db.createObjectStore(STORE_NAME, {keyPath: KEY_PATH});
        objectStore.transaction.oncomplete = () => {
          db = event.target.result;
        };
      };
    }
  });
};

const ldb = {
  get: key => {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject("indexedDB not supported");

      openDatabase().then(() => {
        const hasStore = Array.from(db.objectStoreNames).includes(STORE_NAME);
        if (!hasStore) return reject("no store found");

        const transaction = db.transaction(STORE_NAME, "readonly");
        const objectStore = transaction.objectStore(STORE_NAME);
        const getRequest = objectStore.get(key);

        getRequest.onsuccess = event => {
          const result = event.target.result?.value || null;
          resolve(result);
        };
      });
    });
  },

  set: (key, value) => {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject("indexedDB not supported");

      openDatabase().then(() => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const objectStore = transaction.objectStore(STORE_NAME);
        const putRequest = objectStore.put({key, value});

        putRequest.onsuccess = () => {
          resolve();
        };
      });
    });
  }
};
