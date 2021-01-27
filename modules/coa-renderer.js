(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.COArenderer = factory());
}(this, (function () {'use strict';
  const colors = {
    argent: "#fafafa",
    or: "#ffe066",
    gules: "#d7374a",
    sable: "#333333",
    azure: "#377cd7",
    vert: "#26c061",
    purpure: "#522d5b",
    murrey: "#85185b",
    sanguine: "#b63a3a",
    tenné: "#cc7f19"
  }

  const shieldPositions = {
    // shield-specific position: [x, y] (relative to center)
    heater: {
      a: [-43.75, -50], b: [0, -50], c: [43.75, -50],
      d: [-43.75, 0], e: [0, 0], f: [43.75, 0],
      g: [-32.25, 37.5], h: [0, 50], i: [32.25, 37.5],
      y: [-50, -50], z: [0, 62.5],
      j: [-37.5, -37.5], k: [0, -37.5], l: [37.5, -37.5],
      m: [-30, 30], n: [0, 42.5], o: [30, 30],
      p: [-37.5, 0], q: [37.5, 0],
      A: [-66.2, -66.6], B: [-22, -66.6], C: [22, -66.6], D: [66.2, -66.6],
      K: [-66.2, -20], E: [66.2, -20],
      J: [-55.5, 26], F: [55.5, 26],
      I: [-33, 62], G: [33, 62],
      H: [0, 89.5]
    },
    spanish: {
      a: [-43.75, -50], b: [0, -50], c: [43.75, -50],
      d: [-43.75, 0], e: [0, 0], f: [43.75, 0],
      g: [-43.75, 50], h: [0, 50], i: [43.75, 50],
      y: [-50, -50], z: [0, 50],
      j: [-37.5, -37.5], k: [0, -37.5], l: [37.5, -37.5],
      m: [-37.5, 37.5], n: [0, 37.5], o: [37.5, 37.5],
      p: [-37.5, 0], q: [37.5, 0],
      A: [-66.2, -66.6], B: [-22, -66.6], C: [22, -66.6], D: [66.2, -66.6],
      K: [-66.4, -20], E: [66.4, -20],
      J: [-66.4, 26], F: [66.4, 26],
      I: [-49, 70], G: [49, 70],
      H: [0, 92]
    },
    french: {
      a: [-43.75, -50], b: [0, -50], c: [43.75, -50],
      d: [-43.75, 0], e: [0, 0], f: [43.75, 0],
      g: [-43.75, 50], h: [0, 50], i: [43.75, 50],
      y: [-50, -50], z: [0, 65],
      j: [-37.5, -37.5], k: [0, -37.5], l: [37.5, -37.5],
      m: [-37.5, 37.5], n: [0, 37.5], o: [37.5, 37.5],
      p: [-37.5, 0], q: [37.5, 0],
      A: [-66.2, -66.6], B: [-22, -66.6], C: [22, -66.6], D: [66.2, -66.6],
      K: [-66.4, -20], E: [66.4, -20],
      J: [-66.4, 26], F: [66.4, 26],
      I: [-65.4, 70], G: [65.4, 70],
      H: [0, 89]
    },
    horsehead: {
      a: [-43.75, -47.5], b: [0, -50], c: [43.75, -47.5],
      d: [-35, 0], e: [0, 0], f: [35, 0],
      h: [0, 50],
      y: [-50, -50], z: [0, 55],
      j: [-35, -35], k: [0, -40], l: [35, -35],
      m: [-30, 30], n: [0, 40], o: [30, 30],
      p: [-27.5, 0], q: [27.5, 0],
      A: [-71, -52], B: [-24, -73], C: [24, -73], D: [71, -52],
      K: [-62, -16], E: [62, -16],
      J: [-39, 20], F: [39, 20],
      I: [-33.5, 60], G: [33.5, 60],
      H: [0, 91.5]
    },
    horsehead2: {
      a: [-37.5, -47.5], b: [0, -50], c: [37.5, -47.5],
      d: [-35, 0], e: [0, 0], f: [35, 0],
      g: [-35, -47.5], h: [0, 50], i: [35, -47.5],
      y: [-50, -50], z: [0, 55],
      j: [-30, -30], k: [0, -40], l: [30, -30],
      m: [-30, 30], n: [0, 40], o: [30, 30],
      p: [-27.5, 0], q: [27.5, 0],
      A: [-49, -39], B: [-22, -70], C: [22, -70], D: [49, -39],
      K: [-51, -2], E: [51, -2],
      J: [-38.5, 31], F: [38.5, 31],
      I: [-35, 67], G: [35, 67],
      H: [0, 85]
    },
    polish: {
      a: [-35, -50], b: [0, -50], c: [35, -50],
      d: [-40, 0], e: [0, 0], f: [40, 0],
      g: [-37.5, 50], h: [0, 50], i: [37.5, 50],
      y: [-50, -50], z: [0, 65],
      j: [-27.5, -27.5], k: [0, -45], l: [27.5, -27.5],
      m: [-27.5, 27.5], n: [0, 45], o: [27.5, 27.5],
      p: [-32.5, 0], q: [32.5, 0],
      A: [-48, -52], B: [-23, -80], C: [23, -80], D: [48, -52],
      K: [-47, -10], E: [47, -10],
      J: [-62, 32], F: [62, 32],
      I: [-37, 68], G: [37, 68],
      H: [0, 86]
    },
    hessen: {
      a: [-43.75, -50], b: [0, -50], c: [43.75, -50],
      d: [-43.75, 0], e: [0, 0], f: [43.75, 0],
      g: [-43.75, 50], h: [0, 50], i: [43.75, 50],
      y: [-50, -50], z: [0, 52.5],
      j: [-40, -40], k: [0, -40], l: [40, -40],
      m: [-40, 40], n: [0, 40], o: [40, 40],
      p: [-40, 0], q: [40, 0],
      A: [-69, -64], B: [-22, -76], C: [22, -76], D: [69, -64],
      K: [-66.4, -20], E: [66.4, -20],
      J: [-62, 26], F: [62, 26],
      I: [-46, 70], G: [46, 70],
      H: [0, 91.5]
    },
    swiss: {
      a: [-43.75, -50], b: [0, -50], c: [43.75, -50],
      d: [-43.75, 0], e: [0, 0], f: [43.75, 0],
      g: [-32, 37.5], h: [0, 50], i: [32, 37.5],
      y: [-50, -50], z: [0, 62.5],
      j: [-37.5, -37.5], k: [0, -37.5], l: [37.5, -37.5],
      m: [-32, 32.5], n: [0, 42.5], o: [32, 32.5],
      p: [-37.5, 0], q: [37.5, 0],
      A: [-66.2, -66.6], B: [-22, -66], C: [22, -66], D: [66.2, -66.6],
      K: [-63, -20], E: [63, -20],
      J: [-50, 26], F: [50, 26],
      I: [-29, 62], G: [29, 62],
      H: [0, 89.5]
    },
    boeotian: {
      a: [-37.5, -47.5], b: [0, -47.5], c: [37.5, -47.5],
      d: [-25, 0], e: [0, 0], f: [25, 0],
      g: [-37.5, 47.5], h: [0, 47.5], i: [37.5, 47.5],
      y: [-48, -48], z: [0, 60],
      j: [-32.5, -37.5], k: [0, -45], l: [32.5, -37.5],
      m: [-32.5, 37.5], n: [0, 45], o: [32.5, 37.5],
      p: [-20, 0], q: [20, 0],
      A: [-45, -55], B: [-20, -77], C: [20, -77], D: [45, -55],
      K: [-59, -25], E: [59, -25],
      J: [-58, 27], F: [58, 27],
      I: [-39, 63], G: [39, 63],
      H: [0, 81]
    },
    roman: {
      a: [-40, -52.5], b: [0, -52.5], c: [40, -52.5],
      d: [-40, 0], e: [0, 0], f: [40, 0],
      g: [-40, 52.5], h: [0, 52.5], i: [40, 52.5],
      y: [-42.5, -52.5], z: [0, 65],
      j: [-30, -37.5], k: [0, -37.5], l: [30, -37.5],
      m: [-30, 37.5], n: [0, 37.5], o: [30, 37.5],
      p: [-30, 0], q: [30, 0],
      A: [-51.5, -65], B: [-17, -75], C: [17, -75], D: [51.5, -65],
      K: [-51.5, -21], E: [51.5, -21],
      J: [-51.5, 21], F: [51.5, 21],
      I: [-51.5, 65], G: [51.5, 65],
      H: [-17, 75], L: [17, 75]
    },
    kite: {
      b: [0, -65], e: [0, -15], h: [0, 35],
      z: [0, 35], k: [0, -50], n: [0, 20],
      p: [-20, -15], q: [20, -15],
      A: [-38, -52], B: [-29, -78], C: [29, -78], D: [38, -52],
      K: [-33, -20], E: [33, -20],
      J: [-25, 11], F: [25, 11],
      I: [-15, 42], G: [15, 42],
      H: [0, 73], L: [0, -91]
    },
    oldFrench: {
      a: [-43.75, -50], b: [0, -50], c: [43.75, -50],
      d: [-43.75, 0], e: [0, 0], f: [43.75, 0],
      g: [-37.5, 50], h: [0, 50], i: [37.5, 50],
      y: [-50, -50], z: [0, 62.5],
      j: [-37.5, -37.5], k: [0, -37.5], l: [37.5, -37.5],
      m: [-37.5, 37.5], n: [0, 45], o: [37.5, 37.5],
      p: [-37.5, 0], q: [37.5, 0],
      A: [-66.2, -66.6], B: [-22, -66.6], C: [22, -66.6], D: [66.2, -66.6],
      K: [-66.2, -20], E: [66.2, -20],
      J: [-64, 26], F: [64, 26],
      I: [-45, 62], G: [45, 62],
      H: [0, 91],
    },
    renaissance: {
      a: [-43.75, -50], b: [0, -50], c: [43.75, -50],
      d: [-41.5, 0], e: [0, 0], f: [41.5, 0],
      g: [-43.75, 50], h: [0, 50], i: [43.75, 50],
      y: [-50, -50], z: [0, 62.5],
      j: [-37.5, -37.5], k: [0, -37.5], l: [37.5, -37.5],
      m: [-37.5, 37.5], n: [0, 37.5], o: [37.5, 37.5],
      p: [-37.5, 0], q: [37.5, 0],
      A: [-61, -55], B: [-23, -67], C: [23, -67], D: [61, -55],
      K: [-55, -11], E: [55, -11],
      J: [-65, 31], F: [65, 31],
      I: [-45, 76], G: [45, 76],
      H: [0, 87]
    },
    baroque: {
      a: [-43.75, -45], b: [0, -45], c: [43.75, -45],
      d: [-43.75, 0], e: [0, 0], f: [43.75, 0],
      g: [-43.75, 50], h: [0, 50], i: [43.75, 50],
      y: [-50, -50], z: [0, 60],
      j: [-37.5, -37.5], k: [0, -37.5], l: [37.5, -37.5],
      m: [-37.5, 37.5], n: [0, 37.5], o: [37.5, 37.5],
      p: [-37.5, 0], q: [37.5, 0],
      A: [-65, -54.5], B: [-22, -65], C: [22, -65], D: [65, -54.5],
      K: [-58.5, -15], E: [58.5, -15],
      J: [-65, 31], F: [66, 31],
      I: [-35, 73], G: [35, 73],
      H: [0, 89]
    },
    targe: {
      a: [-43.75, -50], b: [0, -50], c: [43.75, -50],
      d: [-43.75, 0], e: [0, 0], f: [43.75, 0],
      g: [-43.75, 50], h: [0, 50], i: [43.75, 50],
      y: [-50, -50], z: [0, 50],
      j: [-40, -40], k: [0, -40], l: [40, -40],
      m: [-40, 40], n: [0, 40], o: [40, 40],
      p: [-32.5, 0], q: [32.5, 0],
      A: [-66.2, -60], B: [-22, -77], C: [22, -86], D: [60, -66.6],
      K: [-28, -20], E: [57, -20],
      J: [-61, 26], F: [61, 26],
      I: [-49, 63], G: [49, 59],
      H: [0, 80]
    },
    targe2: {
      a: [-43.75, -50], b: [0, -50], c: [43.75, -50],
      d: [-40, 0], e: [0, 0], f: [40, 0],
      g: [-43.75, 50], h: [0, 50], i: [43.75, 50],
      y: [-50, -50], z: [0, 60],
      j: [-37.5, -37.5], k: [0, -37.5], l: [37.5, -37.5],
      m: [-37.5, 37.5], n: [0, 37.5], o: [37.5, 37.5],
      p: [-32.5, 0], q: [32.5, 0],
      A: [-55, -59], B: [-15, -59], C: [24, -79], D: [51, -58],
      K: [-40, -14], E: [51, -14],
      J: [-64, 26], F: [62, 26],
      I: [-46, 66], G: [48, 67],
      H: [0, 83]
    },
    pavise: {
      a: [-40, -52.5], b: [0, -52.5], c: [40, -52.5],
      d: [-40, 0], e: [0, 0], f: [40, 0],
      g: [-40, 52.5], h: [0, 52.5], i: [40, 52.5],
      y: [-42.5, -52.5], z: [0, 60],
      j: [-30, -35], k: [0, -37.5], l: [30, -35],
      m: [-30, 35], n: [0, 37.5], o: [30, 35],
      p: [-30, 0], q: [30, 0],
      A: [-57, -55], B: [-22, -74], C: [22, -74], D: [57, -55],
      K: [-54, -11], E: [54, -11],
      J: [-50, 36], F: [50, 36],
      I: [-46, 81], G: [46, 81],
      H: [0, 81]
    },
    wedged: {
      a: [-43.75, -50], b: [0, -50], c: [43.75, -50],
      d: [-43.75, 0], e: [0, 0], f: [43.75, 0],
      g: [-32.25, 37.5], h: [0, 50], i: [32.25, 37.5],
      y: [-50, -50], z: [0, 62.5],
      j: [-37.5, -37.5], k: [0, -37.5], l: [37.5, -37.5],
      m: [-32.5, 32.5], n: [0, 42.5], o: [32.5, 32.5],
      p: [-37.5, 0], q: [37.5, 0],
      A: [-66, -53], B: [-22, -72.5], C: [22, -72.5], D: [66, -53],
      K: [-62.6, -13], E: [62.6, -13],
      J: [-50, 26], F: [50, 26],
      I: [-27, 62], G: [27, 62],
      H: [0, 87]
    },
    flag: {
      a: [-60, -40], b: [0, -40], c: [60, -40],
      d: [-60, 0], e: [0, 0], f: [60, 0],
      g: [-60, 40], h: [0, 40], i: [60, 40],
      y: [-60, -42.5], z: [0, 40],
      j: [-45, -30], k: [0, -30], l: [45, -30],
      m: [-45, 30], n: [0, 30], o: [45, 30],
      p: [-45, 0], q: [45, 0],
      A: [-81, -51], B: [-27, -51], C: [27, -51], D: [81, -51],
      K: [-81, -17], E: [81, -17],
      J: [-81, 17], F: [81, 17],
      I: [-81, 51], G: [81, 51],
      H: [-27, 51], L: [27, 51]
    },
    pennon: {
      a: [-75, -40],
      d: [-75, 0], e: [-25, 0], f: [25, 0],
      g: [-75, 40],
      y: [-70, -42.5],
      j: [-60, -30],
      m: [-60, 30],
      p: [-60, 0], q: [5, 0],
      A: [-81, -48], B: [-43, -36], C: [-4.5, -24], D: [33, -12],
      E: [72, 0],
      F: [33, 12], G: [-4.5, 24], H: [-43, 36], I: [-81, 48],
      J: [-81, 17], K: [-81, -17]
    },
    guidon: {
      a: [-60, -40], b: [0, -40], c: [60, -40],
      d: [-60, 0], e: [0, 0],
      g: [-60, 40], h: [0, 40], i: [60, 40],
      y: [-60, -42.5], z: [0, 40],
      j: [-45, -30], k: [0, -30], l: [45, -30],
      m: [-45, 30], n: [0, 30], o: [45, 30],
      p: [-45, 0],
      A: [-81, -51], B: [-27, -51], C: [27, -51], D: [78, -51],
      K: [-81, -17], E: [40.5, -17],
      J: [-81, 17], F: [40.5, 17],
      I: [-81, 51], G: [78, 51],
      H: [-27, 51], L: [27, 51]
    },
    banner: {
      a: [-50, -50], b: [0, -50], c: [50, -50],
      d: [-50, 0], e: [0, 0], f: [50, 0],
      g: [-50, 40], h: [0, 40], i: [50, 40],
      y: [-50, -50], z: [0, 40],
      j: [-37.5, -37.5], k: [0, -37.5], l: [37.5, -37.5],
      m: [-37.5, 27.5], n: [0, 27.5], o: [37.5, 27.5],
      p: [-37.5, 0], q: [37.5, 0],
      A: [-66.5, -66.5], B: [-22, -66.5], C: [22, -66.5], D: [66.5, -66.5],
      K: [-66.5, -20], E: [66.5, -20],
      J: [-66.5, 26], F: [66.5, 26],
      I: [-66.5, 66.5], G: [66.5, 66.5],
      H: [-25, 75], L: [25, 75]
    },
    dovetail: {
      a: [-49.75, -50], b: [0, -50], c: [49.75, -50],
      d: [-49.75, 0], e: [0, 0], f: [49.75, 0],
      g: [-49.75, 50], i: [49.75, 50],
      y: [-50, -50], z: [0, 40],
      j: [-37.5, -37.5], k: [0, -37.5], l: [37.5, -37.5],
      m: [-37.5, 37.5], n: [0, 32.5], o: [37.5, 37.5],
      p: [-37.5, 0], q: [37.5, 0],
      A: [-66.5, -66.5], B: [-22, -66.5], C: [22, -66.5], D: [66.5, -66.5],
      K: [-66.5, -16.5], E: [66.5, -16.5],
      J: [-66.5, 34.5], F: [66.5, 34.5],
      I: [-66.5, 84.5], G: [66.5, 84.5],
      H: [-25, 64], L: [25, 64]
    },
    gonfalon: {
      a: [-49.75, -50], b: [0, -50], c: [49.75, -50],
      d: [-49.75, 0], e: [0, 0], f: [49.75, 0],
      g: [-49.75, 50], h: [0, 50], i: [49.75, 50],
      y: [-50, -50], z: [0, 50],
      j: [-37.5, -37.5], k: [0, -37.5], l: [37.5, -37.5],
      m: [-37.5, 37.5], n: [0, 37.5], o: [37.5, 37.5],
      p: [-37.5, 0], q: [37.5, 0],
      A: [-66.5, -66.5], B: [-22, -66.5], C: [22, -66.5], D: [66.5, -66.5],
      K: [-66.5, -20], E: [66.5, -20],
      J: [-66.5, 26], F: [66.5, 26],
      I: [-40, 63], G: [40, 63],
      H: [0, 88]
    },
    pennant: {
      a: [-45, -50], b: [0, -50], c: [45, -50],
      e: [0, 0], h: [0, 50],
      y: [-50, -50], z: [0, 50],
      j: [-32.5, -37.5], k: [0, -37.5], l: [32.5, -37.5],
      n: [0, 37.5],
      A: [-60, -76], B: [-22, -76], C: [22, -76], D: [60, -76],
      K: [-46, -38], E: [46, -38],
      J: [-31, 0], F: [31, 0],
      I: [-16, 38], G: [16, 38],
      H: [0, 76]
    },
    round: {
      a: [-40, -47.5], b: [0, -47.5], c: [40, -47.5],
      d: [-40, 0], e: [0, 0], f: [40, 0],
      g: [-32.5, 47.5], h: [0, 47.5], i: [32.5, 47.5],
      y: [-48, -48], z: [0, 57.5],
      j: [-35.5, -35.5], k: [0, -37.5], l: [35.5, -35.5],
      m: [-35.5, 35.5], n: [0, 37.5], o: [35.5, 35.5],
      p: [-36.5, 0], q: [36.5, 0],
      A: [-59, -48], B: [-23, -73], C: [23, -73], D: [59, -48],
      K: [-76, -10], E: [76, -10],
      J: [-70, 31], F: [70, 31],
      I: [-42, 64], G: [42, 64],
      H: [0, 77]
    },
    oval: {
      a: [-37.5, -50], b: [0, -50], c: [37.5, -50],
      d: [-43, 0], e: [0, 0], f: [43, 0],
      g: [-37.5, 50], h: [0, 50], i: [37.5, 50],
      y: [-48, -48], z: [0, 60],
      j: [-35.5, -37.5], k: [0, -37.5], l: [35.5, -37.5],
      m: [-35.5, 37.5], n: [0, 50], o: [35.5, 37.5],
      p: [-36.5, 0], q: [36.5, 0],
      A: [-48, -48], B: [-23, -78], C: [23, -78], D: [48, -48],
      K: [-59, -10], E: [59, -10],
      J: [-55, 31], F: [55, 31],
      I: [-36, 68], G: [36, 68],
      H: [0, 85]
    },
    vesicaPiscis: {
      a: [-32, -37], b: [0, -50], c: [32, -37],
      d: [-32, 0], e: [0, 0], f: [32, 0],
      g: [-32, 37], h: [0, 50], i: [32, 37],
      y: [-50, -50], z: [0, 62],
      j: [-27.5, -27.5], k: [0, -37], l: [27.5, -27.5],
      m: [-27.5, 27.5], n: [0, 42], o: [27.5, 27.5],
      p: [-27.5, 0], q: [27.5, 0],
      A: [-45, -32], B: [-29, -63], C: [29, -63], D: [45, -32],
      K: [-50, 0], E: [50, 0],
      J: [-45, 32], F: [45, 32],
      I: [-29, 63], G: [29, 63],
      H: [0, 89], L: [0, -89]
    },
    square: {
      a: [-49.75, -50], b: [0, -50], c: [49.75, -50],
      d: [-49.75, 0], e: [0, 0], f: [49.75, 0],
      g: [-49.75, 50], h: [0, 50], i: [49.75, 50],
      y: [-50, -50], z: [0, 50],
      j: [-37.5, -37.5], k: [0, -37.5], l: [37.5, -37.5],
      m: [-37.5, 37.5], n: [0, 37.5], o: [37.5, 37.5],
      p: [-37.5, 0], q: [37.5, 0],
      A: [-66.5, -66.5], B: [-22, -66.5], C: [22, -66.5], D: [66.5, -66.5],
      K: [-66.5, -20], E: [66.5, -20],
      J: [-66.5, 26], F: [66.5, 26],
      I: [-66.5, 66.5], G: [66.5, 66.5],
      H: [-22, 66.5], L: [22, 66.5]
    },
    diamond: {
      a: [-32, -37], b: [0, -50], c: [32, -37],
      d: [-43, 0], e: [0, 0], f: [43, 0],
      g: [-32, 37], h: [0, 50], i: [32, 37],
      y: [-50, -50], z: [0, 62],
      j: [-27.5, -27.5], k: [0, -37], l: [27.5, -27.5],
      m: [-27.5, 27.5], n: [0, 42], o: [27.5, 27.5],
      p: [-37, 0], q: [37, 0],
      A: [-43, -28], B: [-22, -56], C: [22, -56], D: [43, -28],
      K: [-63, 0], E: [63, 0],
      J: [-42, 28], F: [42, 28],
      I: [-22, 56], G: [22, 56],
      H: [0, 83], L: [0, -82]
    },
    no: {
      a: [-66.5, -66.5], b: [0, -66.5], c: [66.5, -66.5],
      d: [-66.5, 0], e: [0, 0], f: [66.5, 0],
      g: [-66.5, 66.5], h: [0, 66.5], i: [66.5, 66.5],
      y: [-50, -50], z: [0, 75],
      j: [-50, -50], k: [0, -50], l: [50, -50],
      m: [-50, 50], n: [0, 50], o: [50, 50],
      p: [-50, 0], q: [50, 0],
      A: [-91.5, -91.5], B: [-30.5, -91.5], C: [30.5, -91.5], D: [91.5, -91.5],
      K: [-91.5, -30.5], E: [91.5, -30.5],
      J: [-91.5, 30.5], F: [91.5, 30.5],
      I: [-91.5, 91.5], G: [91.5, 91.5],
      H: [-30.5, 91.5], L: [30.5, 91.5]
    },
    fantasy1: {
      a: [-45, -45], b: [0, -50], c: [45, -45],
      d: [-40, 0], e: [0, 0], f: [40, 0],
      g: [-36, 42.5], h: [0, 50], i: [36, 42.5],
      y: [-50, -50], z: [0, 60],
      j: [-37, -37], k: [0, -40], l: [37, -37],
      m: [-32, 32], n: [0, 40], o: [32, 32],
      p: [-28.5, 0], q: [28.5, 0],
      A: [-66, -55], B: [-22, -67], C: [22, -67], D: [66, -55],
      K: [-53, -20], E: [53, -20],
      J: [-46, 26], F: [46, 26],
      I: [-29, 62], G: [29, 62],
      H: [0, 84]
    },
    fantasy2: {
      a: [-45, -45], b: [0, -45], c: [45, -45],
      d: [-35, 0], e: [0, 0], f: [35, 0],
      g: [-36, 42.5], h: [0, 45], i: [36, 42.5],
      y: [-50, -50], z: [0, 55],
      j: [-32.5, -32.5], k: [0, -40], l: [32.5, -32.5],
      m: [-30, 30], n: [0, 40], o: [30, 30],
      p: [-27.5, 0], q: [27.5, 0],
      A: [-58, -35], B: [-44, -67], C: [44, -67], D: [58, -35],
      K: [-39, -5], E: [39, -5],
      J: [-57, 26], F: [57, 26],
      I: [-32, 58], G: [32, 58],
      H: [0, 83], L: [0, -72]
    },
    fantasy3: {
      a: [-40, -45], b: [0, -50], c: [40, -45],
      d: [-35, 0], e: [0, 0], f: [35, 0],
      g: [-36, 42.5], h: [0, 50], i: [36, 42.5],
      y: [-50, -50], z: [0, 55],
      j: [-32.5, -32.5], k: [0, -40], l: [32.5, -32.5],
      m: [-30, 30], n: [0, 40], o: [30, 30],
      p: [-27.5, 0], q: [27.5, 0],
      A: [-56, -42], B: [-22, -72], C: [22, -72], D: [56, -42],
      K: [-37, -11], E: [37, -11],
      J: [-60, 20], F: [60, 20],
      I: [-34, 56], G: [34, 56],
      H: [0, 83]
    },
    fantasy4: {
      a: [-50, -45], b: [0, -50], c: [50, -45],
      d: [-45, 0], e: [0, 0], f: [45, 0],
      g: [-40, 45], h: [0, 50], i: [40, 45],
      y: [-50, -50], z: [0, 62.5],
      j: [-37.5, -37.5], k: [0, -45], l: [37.5, -37.5],
      m: [-37.5, 37.5], n: [0, 45], o: [37.5, 37.5],
      p: [-35, 0], q: [35, 0],
      A: [-75, -56], B: [-36, -61], C: [36, -61], D: [75, -56],
      K: [-67, -12], E: [67, -12],
      J: [-63, 32], F: [63, 32],
      I: [-42, 75], G: [42, 75],
      H: [0, 91.5], L: [0, -79]
    },
    fantasy5: {
      a: [-45, -50], b: [0, -50], c: [45, -50],
      d: [-40, 0], e: [0, 0], f: [40, 0],
      g: [-30, 45], h: [0, 50], i: [30, 45],
      y: [-50, -50], z: [0, 60],
      j: [-37, -37], k: [0, -40], l: [37, -37],
      m: [-32, 32], n: [0, 40], o: [32, 32],
      p: [-28.5, 0], q: [28.5, 0],
      A: [-61, -67], B: [-22, -76], C: [22, -76], D: [61, -67],
      K: [-58, -25], E: [58, -25],
      J: [-48, 20], F: [48, 20],
      I: [-28.5, 60], G: [28.5, 60],
      H: [0, 89]
    },
    noldor: {
      b: [0, -65], e: [0, -15], h: [0, 35],
      z: [0, 35], k: [0, -50], n: [0, 30],
      p: [-20, -15], q: [20, -15],
      A: [-34, -47], B: [-20, -68], C: [20, -68], D: [34, -47],
      K: [-18, -20], E: [18, -20],
      J: [-26, 11], F: [26, 11],
      I: [-14, 43], G: [14, 43],
      H: [0, 74], L: [0, -85]
    },
    gondor: {
      a: [-32.5, -50], b: [0, -50], c: [32.5, -50],
      d: [-32.5, 0], e: [0, 0], f: [32.5, 0],
      g: [-32.5, 50], h: [0, 50], i: [32.5, 50],
      y: [-42.5, -52.5], z: [0, 65],
      j: [-25, -37.5], k: [0, -37.5], l: [25, -37.5],
      m: [-25, 30], n: [0, 37.5], o: [25, 30],
      p: [-25, 0], q: [25, 0],
      A: [-42, -52], B: [-17, -75], C: [17, -75], D: [42, -52],
      K: [-42, -15], E: [42, -15],
      J: [-42, 22], F: [42, 22],
      I: [-26, 60], G: [26, 60],
      H: [0, 87]
    },
    easterling: {
      a: [-40, -47.5], b: [0, -47.5], c: [40, -47.5],
      d: [-40, 0], e: [0, 0], f: [40, 0],
      g: [-40, 47.5], h: [0, 47.5], i: [40, 47.5],
      y: [-42.5, -52.5], z: [0, 65],
      j: [-30, -37.5], k: [0, -37.5], l: [30, -37.5],
      m: [-30, 37.5], n: [0, 37.5], o: [30, 37.5],
      p: [-30, 0], q: [30, 0],
      A: [-52, -72], B: [0, -65], D: [52, -72],
      K: [-52, -24], E: [52, -24],
      J: [-52, 24], F: [52, 24],
      I: [-52, 72], G: [52, 72],
      H: [0, 65]
    },
    erebor: {
      a: [-40, -40], b: [0, -55], c: [40, -40],
      d: [-40, 0], e: [0, 0], f: [40, 0],
      g: [-40, 40], h: [0, 55], i: [40, 40],
      y: [-50, -50], z: [0, 50],
      j: [-35, -35], k: [0, -45], l: [35, -35],
      m: [-35, 35], n: [0, 45], o: [35, 35],
      p: [-37.5, 0], q: [37.5, 0],
      A: [-47, -46], B: [-22, -81], C: [22, -81], D: [47, -46],
      K: [-66.5, 0], E: [66.5, 0],
      J: [-47, 46], F: [47, 46],
      I: [-22, 81], G: [22, 81]
    },
    ironHills: {
      a: [-43.75, -50], b: [0, -50], c: [43.75, -50],
      d: [-43.25, 0], e: [0, 0], f: [43.25, 0],
      g: [-42.5, 42.5], h: [0, 50], i: [42.5, 42.5],
      y: [-50, -50], z: [0, 62.5],
      j: [-32.5, -32.5], k: [0, -40], l: [32.5, -32.5],
      m: [-32.5, 32.5], n: [0, 40], o: [32.5, 32.5],
      p: [-37.5, 0], q: [37.5, 0],
      A: [-61, -67], B: [-22, -74], C: [22, -74], D: [61, -67],
      K: [-59, -20], E: [59, -20],
      J: [-57, 26], F: [57, 26],
      I: [-33, 64], G: [33, 64],
      H: [0, 88]
    },
    urukHai: {
      a: [-40, -45], b: [0, -45], c: [40, -45],
      d: [-36, 0], e: [0, 0], f: [36, 0],
      g: [-32.25, 40], h: [0, 40], i: [32.25, 40],
      y: [-50, -50], z: [0, 40],
      j: [-32.5, -32.5], k: [0, -37.5], l: [32.5, -32.5],
      m: [-27.5, 27.5], n: [0, 32.5], o: [27.5, 27.5],
      p: [-37.5, 0], q: [37.5, 0],
      A: [-31, -79], B: [-1, -90], C: [31, -74], D: [61, -57],
      K: [-55, -19], E: [53, -19],
      J: [-45, 19], F: [45, 19],
      I: [-33, 57], G: [35, 57],
      H: [0, 57], L: [-39, -50]
    },
    moriaOrc: {
      a: [-37.5, -37.5], b: [0, -37.5], c: [37.5, -37.5],
      d: [-37.5, 0], e: [0, 0], f: [37.5, 0],
      g: [-37.5, 37.5], h: [0, 37.5], i: [37.5, 37.5],
      y: [-50, -50], z: [0, 40],
      j: [-30, -30], k: [0, -30], l: [30, -30],
      m: [-30, 30], n: [0, 30], o: [30, 30],
      p: [-30, 0], q: [30, 0],
      A: [-48, -48], B: [-16, -50], C: [16, -46], D: [39, -61],
      K: [-52, -19], E: [52, -26],
      J: [-42, 9], F: [52, 9],
      I: [-31, 40], G: [40, 43],
      H: [4, 47]
    }
  };

  const shieldSize = {
    horsehead: .9, horsehead2: .9, polish: .85, swiss: .95,
    boeotian: .75, roman: .95, kite: .65, targe2: .9, pavise: .9, wedged: .95,
    flag: .7, pennon: .5, guidon: .65, banner: .8, dovetail: .8, pennant: .6,
    oval: .95, vesicaPiscis: .8, diamond: .8, no: 1.2,
    fantasy1: .8, fantasy2: .7, fantasy3: .7, fantasy5: .9,
    noldor: .5, gondor: .75, easterling: .8, erebor: .9, urukHai: .8, moriaOrc: .7
  }

  const shieldBox = {
    heater: "0 10 200 200",
    spanish: "0 10 200 200",
    french: "0 10 200 200",

    horsehead: "0 10 200 200",
    horsehead2: "0 10 200 200",
    polish: "0 0 200 200",
    hessen: "0 5 200 200",
    swiss: "0 10 200 200",

    boeotian: "0 0 200 200",
    roman: "0 0 200 200",
    kite: "0 0 200 200",
    oldFrench: "0 10 200 200",
    renaissance: "0 5 200 200",
    baroque: "0 10 200 200",

    targe: "0 0 200 200",
    targe2: "0 0 200 200",
    pavise: "0 0 200 200",
    wedged: "0 10 200 200",

    flag: "0 0 200 200",
    pennon: "2.5 0 200 200",
    guidon: "2.5 0 200 200",
    banner: "0 10 200 200",
    dovetail: "0 10 200 200",
    gonfalon: "0 10 200 200",
    pennant: "0 0 200 200",

    round: "0 0 200 200",
    oval: "0 0 200 200",
    vesicaPiscis: "0 0 200 200",
    square: "0 0 200 200",
    diamond: "0 0 200 200",
    no: "0 0 200 200",

    fantasy1: "0 0 200 200",
    fantasy2: "0 5 200 200",
    fantasy3: "0 5 200 200",
    fantasy4: "0 5 200 200",
    fantasy5: "0 0 200 200",

    noldor: "0 0 200 200",
    gondor: "0 5 200 200",
    easterling: "0 0 200 200",
    erebor: "0 0 200 200",
    ironHills: "0 5 200 200",
    urukHai: "0 0 200 200",
    moriaOrc: "0 0 200 200"
  }

  async function draw(id, coa) {
    const {division, ordinaries = [], charges = []} = coa;
    const ordinariesRegular = ordinaries.filter(o => !o.above);
    const ordinariesAboveCharges = ordinaries.filter(o => o.above);
    const shieldPath = document.getElementById(coa.shield).querySelector("path").getAttribute("d");
    const tDiv = division ? division.t.includes("-") ? division.t.split("-")[1] : division.t : null;
    const positions = shieldPositions[coa.shield];
    const sizeModifier = shieldSize[coa.shield] || 1;
    const viewBox = shieldBox[coa.shield] || "0 0 200 200";

    const coaDefs = document.getElementById("coaDefs");
    const chargesGroup = coaDefs.querySelector("#charges");

    let svg = `
      <svg id="${id}" xmlns="http://www.w3.org/2000/svg" width=200 height=200 viewBox="${viewBox}">
        <defs>
          ${division ? `<clipPath id="divisionClip_${id}">${getTemplate(division.division, division.line)}</clipPath>` : ''}
        </defs>
        <g clip-path="url(#${coa.shield})">
          <rect x=0 y=0 width=200 height=200 fill="${clr(coa.t1)}"/>
          ${templateDivision()}
          ${templateAboveAll()}
        </g>
        <path d="${shieldPath}" fill="url(#backlight)" stroke="#333"/>
      </svg>
    `;

    // insert coa svg to coaDefs
    coaDefs.querySelector("#coas").insertAdjacentHTML("beforeend", svg);

    // fetch charges
    if (charges.length) {
      const defs = document.getElementById(id).querySelector("defs");
      const uniqueCharges = [...new Set(charges.map(charge => charge.charge))];
      uniqueCharges.forEach(charge => fetchCharge(charge, defs));
    }

    function templateDivision() {
      if (!division) return "";
      let svg = "";

      // In field part
      for (const ordinary of ordinariesRegular) {
        if (ordinary.divided === "field") svg += templateOrdinary(ordinary, ordinary.t); else
        if (ordinary.divided === "counter") svg += templateOrdinary(ordinary, tDiv);
      }

      for (const charge of charges) {
        if (charge.divided === "field") svg += templateCharge(charge, charge.t); else
        if (charge.divided === "counter") svg += templateCharge(charge, tDiv);
      }

      for (const ordinary of ordinariesAboveCharges) {
        if (ordinary.divided === "field") svg += templateOrdinary(ordinary, ordinary.t); else
        if (ordinary.divided === "counter") svg += templateOrdinary(ordinary, tDiv);
      }

      // In division part
      svg += `
        <g clip-path="url(#divisionClip_${id})">
          <rect x=0 y=0 width=200 height=200 fill="${clr(division.t)}"/>
      `;

      for (const ordinary of ordinariesRegular) {
        if (ordinary.divided === "division") svg += templateOrdinary(ordinary, ordinary.t); else
        if (ordinary.divided === "counter") svg += templateOrdinary(ordinary, coa.t1);
      }

      for (const charge of charges) {
        if (charge.divided === "division") svg += templateCharge(charge, charge.t); else
        if (charge.divided === "counter") svg += templateCharge(charge, coa.t1);
      }

      for (const ordinary of ordinariesAboveCharges) {
        if (ordinary.divided === "division") svg += templateOrdinary(ordinary, ordinary.t); else
        if (ordinary.divided === "counter") svg += templateOrdinary(ordinary, coa.t1);
      }

      return svg += `</g>`
    }

    function templateAboveAll() {
      let svg = "";

      ordinariesRegular.filter(o => !o.divided).forEach(ordinary => {
        svg += templateOrdinary(ordinary, ordinary.t);
      });

      charges.filter(o => !o.divided || !division).forEach(charge => {
        svg += templateCharge(charge, charge.t);
      });

      ordinariesAboveCharges.filter(o => !o.divided).forEach(ordinary => {
        svg += templateOrdinary(ordinary, ordinary.t);
      })

      return svg;
    }

    function templateOrdinary(ordinary, tincture) {
      const fill = clr(tincture);
      let svg = `<g fill="${fill}" stroke="none">`;
      if (ordinary.ordinary === "bordure") svg += `<path d="${shieldPath}" fill="none" stroke="${fill}" stroke-width="16.7%"/>`;
      else if (ordinary.ordinary === "orle") svg += `<path d="${shieldPath}" fill="none" stroke="${fill}" stroke-width="5%" transform="scale(.85)" transform-origin="center">`;
      else svg += getTemplate(ordinary.ordinary, ordinary.line);
      return svg + `</g>`;
    }

    function templateCharge(charge, tincture) {
      const fill = clr(tincture);
      const chargePositions = [...new Set(charge.p)].filter(position => positions[position]);

      let svg = "";
      svg += `<g fill="${fill}" stroke="#000">`;
      for (const p of chargePositions) {
        const transform = getElTransform(charge, p);
        svg += `<use href="#${charge.charge}_${id}" transform="${transform}" transform-origin="center"></use>`;
      }
      return svg + `</g>`;

      function getElTransform(c, p) {
        const [x, y] = positions[p];
        const s = (c.size || 1) * sizeModifier;
        const scale = c.sinister || c.reversed ? `${c.sinister ? "-" : ""}${s}, ${c.reversed ? "-" : ""}${s}` : s;
        return `translate(${x} ${y}) scale(${scale})`;
      }
    }

    // get color or link to pattern
    function clr(tincture) {
      if (colors[tincture]) return colors[tincture];
      const pattern = document.getElementById(tincture);
      if (!pattern) renderPattern(tincture);
      return "url(#"+tincture+")";
    }

    function renderPattern(tincture) {
      const [pattern, t1, t2, size] = tincture.split("-");
      const semy = pattern.slice(0, 4) === "semy";

      const template = document.getElementById(semy ? "semy" : pattern);
      let html = template.innerHTML.replace(/{id}/, tincture);

      const width = template.querySelector("pattern").getAttribute("width");
      const height = template.querySelector("pattern").getAttribute("height");

      if (t1) html = html.replace(/{c1}/g, clr(t1));
      if (t2) html = html.replace(/{c2}/g, clr(t2));

      document.getElementById("patterns").insertAdjacentHTML("beforeend", html);

      if (semy) {
        const charge = pattern.split("_of_")[1];
        const el = document.getElementById(tincture);

        fetch("https://azgaar.github.io/Armoria/charges/"+charge+".svg").then(res => {
          if (res.ok) return res.text();
          else throw new Error('Cannot fetch charge');
        }).then(text => {
          const html = document.createElement("html");
          html.innerHTML = text;
          el.innerHTML = el.innerHTML.replace(/<charge>/g, html.querySelector("g").outerHTML);
        });
      }

      if (size) {
        let mod = 1;
        if (size === "small") mod = .5;
        if (size === "smaller") mod = .25;
        if (size === "smallest") mod = .125;
        if (size === "big") mod = 2;

        const el = document.getElementById(tincture);
        el.setAttribute("width", width * mod);
        el.setAttribute("height", height * mod);
      }
    }

    function getTemplate(templateId, lineId) {
      if (!lineId) return document.getElementById(templateId)?.innerHTML;
      const template = document.getElementById(templateId);
      const line = document.getElementById(lineId) ? document.getElementById(lineId) : document.getElementById("straight");
      return template.innerHTML.replace(/{line}/g, line.getAttribute("d")).replace(/dpath/g, "d");
    }

    function fetchCharge(charge, defs) {
      if (charge === "inescutcheon") {
        const g = `<g id="inescutcheon_${id}"><path transform="scale(.33)" transform-origin="center" d="${shieldPath}"/></g>`;
        defs.insertAdjacentHTML("beforeend", g);
        return;
      }

      fetch("https://azgaar.github.io/Armoria/charges/"+charge+".svg").then(res => {
        if (res.ok) return res.text();
        else throw new Error('Cannot fetch charge');
      }).then(text => {
        const el = document.createElement("html");
        el.innerHTML = text;
        const g = el.querySelector("g");
        g.id = charge + "_" + id;
        defs.insertAdjacentHTML("beforeend", g.outerHTML);
      });
    }
  }

  // async render coa if it does not exist
  const trigger = function(id, coa) {
    if (!document.getElementById(id)) draw(id, coa);
  }

  return {trigger};

})));