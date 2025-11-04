"use strict";
// FMG helper functions

// extracted d3 code to bypass version conflicts
// https://github.com/d3/d3-array/blob/main/src/group.js
function rollups(values, reduce, ...keys) {
  return nest(values, Array.from, reduce, keys);
}

function nest(values, map, reduce, keys) {
  return (function regroup(values, i) {
    if (i >= keys.length) return reduce(values);
    const groups = new Map();
    const keyof = keys[i++];
    let index = -1;
    for (const value of values) {
      const key = keyof(value, ++index, values);
      const group = groups.get(key);
      if (group) group.push(value);
      else groups.set(key, [value]);
    }
    for (const [key, values] of groups) {
      groups.set(key, regroup(values, i));
    }
    return map(groups);
  })(values, 0);
}

function dist2([x1, y1], [x2, y2]) {
  return (x1 - x2) ** 2 + (y1 - y2) ** 2;
}
