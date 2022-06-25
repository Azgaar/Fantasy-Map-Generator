export const byId = document.getElementById.bind(document);

Node.prototype.on = function (name, fn, options) {
  this.addEventListener(name, fn, options);
};

Node.prototype.off = function (name, fn) {
  this.removeEventListener(name, fn);
};

export function stored(key: string) {
  return localStorage.getItem(key) || null;
}

export function store(key: string, value: string) {
  return localStorage.setItem(key, value);
}
