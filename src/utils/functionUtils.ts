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

export function debounce<T extends (...args: any[]) => any>(func: T, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>): ReturnType<T> => {
    let result: any;
    timeout && clearTimeout(timeout);
    timeout = setTimeout(() => {
      result = func(...args);
    }, waitFor);
    return result;
  };
}

export function throttle(func: Function, waitFor: number = 300) {
  let inThrottle: boolean;
  let lastFn: ReturnType<typeof setTimeout>;
  let lastTime: number;

  return function (this: any) {
    const context = this;
    const args = arguments;

    if (!inThrottle) {
      func.apply(context, args);
      lastTime = Date.now();
      inThrottle = true;
    } else {
      clearTimeout(lastFn);
      lastFn = setTimeout(() => {
        if (Date.now() - lastTime >= waitFor) {
          func.apply(context, args);
          lastTime = Date.now();
        }
      }, Math.max(waitFor - (Date.now() - lastTime), 0));
    }
  };
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
