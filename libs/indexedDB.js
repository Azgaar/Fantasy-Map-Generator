function getValue(key) {
  return new Promise(function (resolve) {
    if (db) {
      var transaction = db.transaction("store", "readonly");
      var objectStore = transaction.objectStore("store");
      var getRequest = objectStore.get(key);
      getRequest.onsuccess = function (event) {
        var result = event.target.result ? event.target.result.value : null;
        resolve(result);
      };
    } else {
      setTimeout(function () {
        getValue(key).then(resolve);
      }, 100);
    }
  });
}

var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
if (!indexedDB) console.error("indexedDB not supported");

var db;
var request = indexedDB.open("myDatabase", 1);

request.onsuccess = function (event) {
  db = event.target.result;
};

request.onerror = function (event) {
  console.error("indexedDB request error");
  console.log(event);
};

request.onupgradeneeded = function (event) {
  db = null;
  var dbRequest = event.target.result;
  var objectStore = dbRequest.createObjectStore("store", {keyPath: "key"});
  objectStore.transaction.oncomplete = function () {
    db = dbRequest;
  };
};

window.ldb = {
  get: getValue,
  set: function (key, value) {
    var transaction = db.transaction("store", "readwrite");
    var objectStore = transaction.objectStore("store");
    objectStore.put({key: key, value: value});
  }
};
