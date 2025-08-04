// src/engine/utils/alea.js (Refactored into a clean ES Module)
/*
  Original code ©2010 Johannes Baagøe, MIT license; Derivative ©2017-2020 W. Mac" McMeans, BSD license.
  Refactored for ES Module compatibility.
*/

"use strict";

// This is the single, exported function that takes arguments.
export function aleaPRNG(...args) {
  // --- Start of original inner function logic ---
  var r, t, e, o, a;
  var i = ""; // for storing Mash version

  function c(n) {
    var mash = (function () {
      var n = 4022871197;
      var r = function (r) {
        r = r.toString();
        for (var t = 0, e = r.length; t < e; t++) {
          var o = 0.02519603282416938 * (n += r.charCodeAt(t));
          (o -= n = o >>> 0), (n = (o *= n) >>> 0), (n += 4294967296 * (o -= n));
        }
        return 2.3283064365386963e-10 * (n >>> 0);
      };
      r.version = "Mash 0.9";
      return r;
    })();

    r = mash(" ");
    t = mash(" ");
    e = mash(" ");
    o = 1;

    for (var u = 0; u < n.length; u++) {
      (r -= mash(n[u])) < 0 && (r += 1);
      (t -= mash(n[u])) < 0 && (t += 1);
      (e -= mash(n[u])) < 0 && (e += 1);
    }

    i = mash.version;
    mash = null;
  }

  function f(n) {
    return parseInt(n, 10) === n;
  }

  var l = function () {
    var n = 2091639 * r + 2.3283064365386963e-10 * o;
    r = t;
    t = e;
    e = n - (o = 0 | n);
    return e;
  };

  l.fract53 = function () {
    return l() + 1.1102230246251565e-16 * ((2097152 * l()) | 0);
  };
  l.int32 = function () {
    return 4294967296 * l();
  };
  l.cycle = function (n) {
    (n = void 0 === n ? 1 : +n) < 1 && (n = 1);
    for (var r = 0; r < n; r++) l();
  };
  l.range = function () {
    var n, r;
    1 === arguments.length ? ((n = 0), (r = arguments[0])) : ((n = arguments[0]), (r = arguments[1]));
    arguments[0] > arguments[1] && ((n = arguments[1]), (r = arguments[0]));
    return f(n) && f(r) ? Math.floor(l() * (r - n + 1)) + n : l() * (r - n) + n;
  };
  l.restart = function () {
    c(a);
  };
  l.seed = function () {
    c(Array.prototype.slice.call(arguments));
  };
  l.version = function () {
    return "aleaPRNG 1.1.0";
  };
  l.versions = function () {
    return "aleaPRNG 1.1.0, " + i;
  };

  // Replace browser-specific crypto with a simple fallback.
  // The orchestrator (engine/main.js) should be responsible for providing a good seed.
  if (args.length === 0) {
    args = [new Date().getTime()];
  }

  a = args; // Store original seed for restart
  c(args); // Seed the generator
  return l; // Return the generator function
  // --- End of original inner function logic ---
}
