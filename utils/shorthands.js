const query = document.querySelector.bind(document);
const queryAll = document.querySelectorAll.bind(document);
const byId = document.getElementById.bind(document);
const byClass = document.getElementsByClassName.bind(document);
const byTag = document.getElementsByTagName.bind(document);

Node.prototype.query = function (selector) {
  return this.querySelector(selector);
};

Node.prototype.queryAll = function (selector) {
  return this.querySelectorAll(selector);
};

Node.prototype.on = function (name, fn, options) {
  this.addEventListener(name, fn, options);
};

Node.prototype.off = function (name, fn) {
  this.removeEventListener(name, fn);
};
