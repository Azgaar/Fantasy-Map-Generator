const byId = document.getElementById.bind(document);

Node.prototype.on = function (name, fn, options) {
  this.addEventListener(name, fn, options);
  return this;
};

Node.prototype.off = function (name, fn) {
  this.removeEventListener(name, fn);
  return this;
};
