let db;

const DATABASE_NAME = "d2";
const STORE_NAME = "s";

const openDatabase = () => {
  return new Promise((resolve, reject) => {
    if (db) resolve();

    if (!window.indexedDB) return reject("IndexedDB is not supported");
    const request = window.indexedDB.open(DATABASE_NAME);

    request.onsuccess = event => {
      db = event.target.result;
      resolve();
    };

    request.onerror = event => {
      console.error("IndexedDB request error");
      reject();
    };

    request.onupgradeneeded = event => {
      db = event.target.result;
      const objectStore = db.createObjectStore(STORE_NAME, {keyPath: "key"});
      objectStore.transaction.oncomplete = () => {
        db = event.target.result;
      };
    };
  });
};

const ldb = {
  get: key => {
    return new Promise((resolve, reject) => {
      openDatabase().then(() => {
        const hasStore = Array.from(db.objectStoreNames).includes(STORE_NAME);
        if (!hasStore) return reject("IndexedDB: no store found");

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

  set: (keyName, value) => {
    return new Promise(resolve => {
      openDatabase().then(() => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const objectStore = transaction.objectStore([STORE_NAME]);
        const putRequest = objectStore.put({key: keyName, value});

        putRequest.onsuccess = () => {
          resolve();
        };
      });
    });
  }
};
