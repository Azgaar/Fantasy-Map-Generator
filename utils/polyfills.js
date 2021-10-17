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
