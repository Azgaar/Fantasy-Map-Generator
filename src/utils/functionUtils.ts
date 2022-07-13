// extracted d3 code to bypass version conflicts
// https://github.com/d3/d3-array/blob/main/src/group.js
function nest<TObject, TKey, TReduce>(
  values: TObject[],
  map: <T>(arrayLike: Map<TKey, T>) => T[],
  reduce: (value: TObject[]) => TReduce,
  keys: ((value: TObject, index: number, values: TObject[]) => TKey)[]
) {
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

export function rollups<TObject, TKey, TReduce>(
  values: TObject[],
  reduce: (value: TObject[]) => TReduce,
  keys: ((value: TObject, index: number, values: TObject[]) => TKey)[]
) {
  return nest(values, Array.from, reduce, keys);
}

export function debounce(func: Function, ms: number) {
  let isCooldown = false;

  return function (this: unknown, ...args: unknown[]) {
    if (isCooldown) return;
    func.apply(this, args);
    isCooldown = true;
    setTimeout(() => (isCooldown = false), ms);
  };
}

export function throttle(func: Function, ms: number) {
  let isThrottled = false;
  let savedArgs: unknown[];
  let savedThis: unknown;

  function wrapper(this: unknown, ...args: unknown[]) {
    if (isThrottled) {
      savedArgs = args;
      savedThis = this;
      return;
    }

    func.apply(this, args);
    isThrottled = true;

    setTimeout(function () {
      isThrottled = false;
      if (savedArgs) {
        wrapper.apply(savedThis, savedArgs);
        savedArgs = [];
        savedThis = null;
      }
    }, ms);
  }

  return wrapper;
}

export function getBase64(url: string, callback: (base64: string | ArrayBuffer | null) => void) {
  const xhr = new XMLHttpRequest();
  xhr.onload = function () {
    const reader = new FileReader();
    reader.onloadend = function () {
      callback(reader.result);
    };
    reader.readAsDataURL(xhr.response);
  };
  xhr.open("GET", url);
  xhr.responseType = "blob";
  xhr.send();
}

export function pick<T, K extends keyof T>(obj: T, ...keys: K[]): Pick<T, K> {
  const ret = {} as Pick<T, K>;
  keys.forEach(key => {
    ret[key] = obj[key];
  });
  return ret;
}

export function dist2([x1, y1]: [number, number], [x2, y2]: [number, number]) {
  return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
}
