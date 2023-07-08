function waitForIndexedDB() {
  return new Promise(resolve => {
    const timer = setInterval(() => {
      if (window.indexedDB) {
        clearInterval(timer);
        resolve();
      }
    }, 100);
  });
}

function getValue(key) {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("indexedDB not supported"));
      return;
    }

    waitForIndexedDB().then(() => {
      const request = window.indexedDB.open("d2", 1);

      request.onsuccess = event => {
        const db = event.target.result;
        const transaction = db.transaction("s", "readonly");
        const objectStore = transaction.objectStore("s");
        const getRequest = objectStore.get(key);

        getRequest.onsuccess = event => {
          const value = (event.target.result && event.target.result.v) || null;
          resolve(value);
        };

        getRequest.onerror = event => {
          reject(new Error("indexedDB request error"));
          console.error(event);
        };
      };

      request.onerror = event => {
        reject(new Error("indexedDB request error"));
        console.error(event);
      };
    });
  });
}

function setValue(key, value) {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("indexedDB not supported"));
      return;
    }

    waitForIndexedDB().then(() => {
      const request = window.indexedDB.open("d2", 1);

      request.onsuccess = event => {
        const db = event.target.result;
        const transaction = db.transaction("s", "readwrite");
        const objectStore = transaction.objectStore("s");

        objectStore.put({k: key, v: value});

        transaction.oncomplete = () => {
          resolve();
        };

        transaction.onerror = event => {
          reject(new Error("indexedDB request error"));
          console.error(event);
        };
      };

      request.onerror = event => {
        reject(new Error("indexedDB request error"));
        console.error(event);
      };
    });
  });
}

window.ldb = {get: getValue, set: setValue};
