"use strict";

// replaceAll
if (String.prototype.replaceAll === undefined) {
  String.prototype.replaceAll = function (str, newStr) {
    if (Object.prototype.toString.call(str).toLowerCase() === "[object regexp]") return this.replace(str, newStr);
    return this.replace(new RegExp(str, "g"), newStr);
  };
}

// flat
if (Array.prototype.flat === undefined) {
  Array.prototype.flat = function () {
    return this.reduce((acc, val) => (Array.isArray(val) ? acc.concat(val.flat()) : acc.concat(val)), []);
  };
}

// at
if (Array.prototype.at === undefined) {
  Array.prototype.at = function (index) {
    if (index < 0) index += this.length;
    if (index < 0 || index >= this.length) return undefined;
    return this[index];
  };
}

// readable stream iterator: https://bugs.chromium.org/p/chromium/issues/detail?id=929585#c10
if (ReadableStream.prototype[Symbol.asyncIterator] === undefined) {
  ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
    const reader = this.getReader();
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  };
}
