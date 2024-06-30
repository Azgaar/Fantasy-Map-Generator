!(function (t, s) {
  "object" == typeof exports && "undefined" != typeof module
    ? (module.exports = s())
    : "function" == typeof define && define.amd
    ? define(s)
    : ((t = "undefined" != typeof globalThis ? globalThis : t || self).FlatQueue = s());
})(this, function () {
  "use strict";
  return class {
    constructor() {
      (this.ids = []), (this.values = []), (this.length = 0);
    }
    clear() {
      this.length = 0;
    }
    push(t, s) {
      let i = this.length++;
      for (; i > 0; ) {
        const t = (i - 1) >> 1,
          e = this.values[t];
        if (s >= e) break;
        (this.ids[i] = this.ids[t]), (this.values[i] = e), (i = t);
      }
      (this.ids[i] = t), (this.values[i] = s);
    }
    pop() {
      if (0 === this.length) return;
      const t = this.ids[0];
      if ((this.length--, this.length > 0)) {
        const t = (this.ids[0] = this.ids[this.length]),
          s = (this.values[0] = this.values[this.length]),
          i = this.length >> 1;
        let e = 0;
        for (; e < i; ) {
          let t = 1 + (e << 1);
          const i = t + 1;
          let h = this.ids[t],
            l = this.values[t];
          const n = this.values[i];
          if ((i < this.length && n < l && ((t = i), (h = this.ids[i]), (l = n)), l >= s)) break;
          (this.ids[e] = h), (this.values[e] = l), (e = t);
        }
        (this.ids[e] = t), (this.values[e] = s);
      }
      return t;
    }
    peek() {
      if (0 !== this.length) return this.ids[0];
    }
    peekValue() {
      if (0 !== this.length) return this.values[0];
    }
    shrink() {
      this.ids.length = this.values.length = this.length;
    }
  };
});
