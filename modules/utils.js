// FMG helper functions
"use strict";

// add boundary points to pseudo-clip voronoi cells
function getBoundaryPoints(width, height, spacing) {
  const offset = rn(-1 * spacing);
  const bSpacing = spacing * 2;
  const w = width - offset * 2;
  const h = height - offset * 2;
  const numberX = Math.ceil(w / bSpacing) - 1;
  const numberY = Math.ceil(h / bSpacing) - 1;
  let points = [];
  for (let i = 0.5; i < numberX; i++) {
    let x = Math.ceil((w * i) / numberX + offset);
    points.push([x, offset], [x, h + offset]);
  }
  for (let i = 0.5; i < numberY; i++) {
    let y = Math.ceil((h * i) / numberY + offset);
    points.push([offset, y], [w + offset, y]);
  }
  return points;
}

// get points on a regular square grid and jitter them a bit
function getJitteredGrid(width, height, spacing) {
  const radius = spacing / 2; // square radius
  const jittering = radius * 0.9; // max deviation
  const doubleJittering = jittering * 2;
  const jitter = () => Math.random() * doubleJittering - jittering;

  let points = [];
  for (let y = radius; y < height; y += spacing) {
    for (let x = radius; x < width; x += spacing) {
      const xj = Math.min(rn(x + jitter(), 2), width);
      const yj = Math.min(rn(y + jitter(), 2), height);
      points.push([xj, yj]);
    }
  }
  return points;
}

// return cell index on a regular square grid
function findGridCell(x, y) {
  return Math.floor(Math.min(y / grid.spacing, grid.cellsY - 1)) * grid.cellsX + Math.floor(Math.min(x / grid.spacing, grid.cellsX - 1));
}

// return array of cell indexes in radius on a regular square grid
function findGridAll(x, y, radius) {
  const c = grid.cells.c;
  let r = Math.floor(radius / grid.spacing);
  let found = [findGridCell(x, y)];
  if (!r || radius === 1) return found;
  if (r > 0) found = found.concat(c[found[0]]);
  if (r > 1) {
    let frontier = c[found[0]];
    while (r > 1) {
      let cycle = frontier.slice();
      frontier = [];
      cycle.forEach(function (s) {
        c[s].forEach(function (e) {
          if (found.indexOf(e) !== -1) return;
          found.push(e);
          frontier.push(e);
        });
      });
      r--;
    }
  }

  return found;
}

// return closest pack points quadtree datum
function find(x, y, radius = Infinity) {
  return pack.cells.q.find(x, y, radius);
}

// return closest cell index
function findCell(x, y, radius = Infinity) {
  const found = pack.cells.q.find(x, y, radius);
  return found ? found[2] : undefined;
}

// return array of cell indexes in radius
function findAll(x, y, radius) {
  const found = pack.cells.q.findAll(x, y, radius);
  return found.map(r => r[2]);
}

// get polygon points for packed cells knowing cell id
function getPackPolygon(i) {
  return pack.cells.v[i].map(v => pack.vertices.p[v]);
}

// get polygon points for initial cells knowing cell id
function getGridPolygon(i) {
  return grid.cells.v[i].map(v => grid.vertices.p[v]);
}

// mbostock's poissonDiscSampler
function* poissonDiscSampler(x0, y0, x1, y1, r, k = 3) {
  if (!(x1 >= x0) || !(y1 >= y0) || !(r > 0)) throw new Error();

  const width = x1 - x0;
  const height = y1 - y0;
  const r2 = r * r;
  const r2_3 = 3 * r2;
  const cellSize = r * Math.SQRT1_2;
  const gridWidth = Math.ceil(width / cellSize);
  const gridHeight = Math.ceil(height / cellSize);
  const grid = new Array(gridWidth * gridHeight);
  const queue = [];

  function far(x, y) {
    const i = (x / cellSize) | 0;
    const j = (y / cellSize) | 0;
    const i0 = Math.max(i - 2, 0);
    const j0 = Math.max(j - 2, 0);
    const i1 = Math.min(i + 3, gridWidth);
    const j1 = Math.min(j + 3, gridHeight);
    for (let j = j0; j < j1; ++j) {
      const o = j * gridWidth;
      for (let i = i0; i < i1; ++i) {
        const s = grid[o + i];
        if (s) {
          const dx = s[0] - x;
          const dy = s[1] - y;
          if (dx * dx + dy * dy < r2) return false;
        }
      }
    }
    return true;
  }

  function sample(x, y) {
    queue.push((grid[gridWidth * ((y / cellSize) | 0) + ((x / cellSize) | 0)] = [x, y]));
    return [x + x0, y + y0];
  }

  yield sample(width / 2, height / 2);

  pick: while (queue.length) {
    const i = (Math.random() * queue.length) | 0;
    const parent = queue[i];

    for (let j = 0; j < k; ++j) {
      const a = 2 * Math.PI * Math.random();
      const r = Math.sqrt(Math.random() * r2_3 + r2);
      const x = parent[0] + r * Math.cos(a);
      const y = parent[1] + r * Math.sin(a);
      if (0 <= x && x < width && 0 <= y && y < height && far(x, y)) {
        yield sample(x, y);
        continue pick;
      }
    }

    const r = queue.pop();
    if (i < queue.length) queue[i] = r;
  }
}

// filter land cells
function isLand(i) {
  return pack.cells.h[i] >= 20;
}

// filter water cells
function isWater(i) {
  return pack.cells.h[i] < 20;
}

// convert RGB color string to HEX without #
function toHEX(rgb) {
  if (rgb.charAt(0) === "#") {
    return rgb;
  }
  rgb = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
  return rgb && rgb.length === 4
    ? "#" +
        ("0" + parseInt(rgb[1], 10).toString(16)).slice(-2) +
        ("0" + parseInt(rgb[2], 10).toString(16)).slice(-2) +
        ("0" + parseInt(rgb[3], 10).toString(16)).slice(-2)
    : "";
}

// return array of standard shuffled colors
function getColors(number) {
  const c12 = ["#dababf", "#fb8072", "#80b1d3", "#fdb462", "#b3de69", "#fccde5", "#c6b9c1", "#bc80bd", "#ccebc5", "#ffed6f", "#8dd3c7", "#eb8de7"];
  const cRB = d3.scaleSequential(d3.interpolateRainbow);
  const colors = d3.shuffle(d3.range(number).map(i => (i < 12 ? c12[i] : d3.color(cRB((i - 12) / (number - 12))).hex())));
  return colors;
}

function getRandomColor() {
  return d3.color(d3.scaleSequential(d3.interpolateRainbow)(Math.random())).hex();
}

// mix a color with a random color
function getMixedColor(color, mix = 0.2, bright = 0.3) {
  const c = color && color[0] === "#" ? color : getRandomColor(); // if provided color is not hex (e.g. harching), generate random one
  return d3.color(d3.interpolate(c, getRandomColor())(mix)).brighter(bright).hex();
}

// conver temperature from °C to other scales
function convertTemperature(c) {
  switch (temperatureScale.value) {
    case "°C":
      return c + "°C";
    case "°F":
      return rn((c * 9) / 5 + 32) + "°F";
    case "K":
      return rn(c + 273.15) + "K";
    case "°R":
      return rn(((c + 273.15) * 9) / 5) + "°R";
    case "°De":
      return rn(((100 - c) * 3) / 2) + "°De";
    case "°N":
      return rn((c * 33) / 100) + "°N";
    case "°Ré":
      return rn((c * 4) / 5) + "°Ré";
    case "°Rø":
      return rn((c * 21) / 40 + 7.5) + "°Rø";
    default:
      return c + "°C";
  }
}

// random number in a range
function rand(min, max) {
  if (min === undefined && max === undefined) return Math.random();
  if (max === undefined) {
    max = min;
    min = 0;
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// probability shorthand
function P(probability) {
  if (probability >= 1) return true;
  if (probability <= 0) return false;
  return Math.random() < probability;
}

function each(n) {
  return i => i % n === 0;
}

// random number (normal or gaussian distribution)
function gauss(expected = 100, deviation = 30, min = 0, max = 300, round = 0) {
  return rn(minmax(d3.randomNormal(expected, deviation)(), min, max), round);
}

// probability shorthand for floats
function Pint(float) {
  return ~~float + +P(float % 1);
}

// round value to d decimals
function rn(v, d = 0) {
  const m = Math.pow(10, d);
  return Math.round(v * m) / m;
}

// round string to d decimals
function round(s, d = 1) {
  return s.replace(/[\d\.-][\d\.e-]*/g, function (n) {
    return rn(n, d);
  });
}

// corvent number to short string with SI postfix
function si(n) {
  if (n >= 1e9) return rn(n / 1e9, 1) + "B";
  if (n >= 1e8) return rn(n / 1e6) + "M";
  if (n >= 1e6) return rn(n / 1e6, 1) + "M";
  if (n >= 1e4) return rn(n / 1e3) + "K";
  if (n >= 1e3) return rn(n / 1e3, 1) + "K";
  return rn(n);
}

// getInteger number from user input data
function getInteger(value) {
  const metric = value.slice(-1);
  if (metric === "K") return parseInt(value.slice(0, -1) * 1e3);
  if (metric === "M") return parseInt(value.slice(0, -1) * 1e6);
  if (metric === "B") return parseInt(value.slice(0, -1) * 1e9);
  return parseInt(value);
}

// remove parent element (usually if child is clicked)
function removeParent() {
  this.parentNode.parentNode.removeChild(this.parentNode);
}

// return string with 1st char capitalized
function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// transform string to array [translateX,translateY,rotateDeg,rotateX,rotateY,scale]
function parseTransform(string) {
  if (!string) {
    return [0, 0, 0, 0, 0, 1];
  }
  const a = string
    .replace(/[a-z()]/g, "")
    .replace(/[ ]/g, ",")
    .split(",");
  return [a[0] || 0, a[1] || 0, a[2] || 0, a[3] || 0, a[4] || 0, a[5] || 1];
}

// findAll d3.quandtree search from https://bl.ocks.org/lwthatcher/b41479725e0ff2277c7ac90df2de2b5e
void (function addFindAll() {
  const Quad = function (node, x0, y0, x1, y1) {
    this.node = node;
    this.x0 = x0;
    this.y0 = y0;
    this.x1 = x1;
    this.y1 = y1;
  };

  const tree_filter = function (x, y, radius) {
    var t = {x, y, x0: this._x0, y0: this._y0, x3: this._x1, y3: this._y1, quads: [], node: this._root};
    if (t.node) {
      t.quads.push(new Quad(t.node, t.x0, t.y0, t.x3, t.y3));
    }
    radiusSearchInit(t, radius);

    var i = 0;
    while ((t.q = t.quads.pop())) {
      i++;

      // Stop searching if this quadrant can’t contain a closer node.
      if (!(t.node = t.q.node) || (t.x1 = t.q.x0) > t.x3 || (t.y1 = t.q.y0) > t.y3 || (t.x2 = t.q.x1) < t.x0 || (t.y2 = t.q.y1) < t.y0) continue;

      // Bisect the current quadrant.
      if (t.node.length) {
        t.node.explored = true;
        var xm = (t.x1 + t.x2) / 2,
          ym = (t.y1 + t.y2) / 2;

        t.quads.push(
          new Quad(t.node[3], xm, ym, t.x2, t.y2),
          new Quad(t.node[2], t.x1, ym, xm, t.y2),
          new Quad(t.node[1], xm, t.y1, t.x2, ym),
          new Quad(t.node[0], t.x1, t.y1, xm, ym)
        );

        // Visit the closest quadrant first.
        if ((t.i = ((y >= ym) << 1) | (x >= xm))) {
          t.q = t.quads[t.quads.length - 1];
          t.quads[t.quads.length - 1] = t.quads[t.quads.length - 1 - t.i];
          t.quads[t.quads.length - 1 - t.i] = t.q;
        }
      }

      // Visit this point. (Visiting coincident points isn’t necessary!)
      else {
        var dx = x - +this._x.call(null, t.node.data),
          dy = y - +this._y.call(null, t.node.data),
          d2 = dx * dx + dy * dy;
        radiusSearchVisit(t, d2);
      }
    }
    return t.result;
  };
  d3.quadtree.prototype.findAll = tree_filter;

  var radiusSearchInit = function (t, radius) {
    t.result = [];
    (t.x0 = t.x - radius), (t.y0 = t.y - radius);
    (t.x3 = t.x + radius), (t.y3 = t.y + radius);
    t.radius = radius * radius;
  };

  var radiusSearchVisit = function (t, d2) {
    t.node.data.scanned = true;
    if (d2 < t.radius) {
      do {
        t.result.push(t.node.data);
        t.node.data.selected = true;
      } while ((t.node = t.node.next));
    }
  };
})();

// get segment of any point on polyline
function getSegmentId(points, point, step = 10) {
  if (points.length === 2) return 1;
  const d2 = (p1, p2) => (p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2;

  let minSegment = 1;
  let minDist = Infinity;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const length = Math.sqrt(d2(p1, p2));
    const segments = Math.ceil(length / step);
    const dx = (p2[0] - p1[0]) / segments;
    const dy = (p2[1] - p1[1]) / segments;

    for (let s = 0; s < segments; s++) {
      const x = p1[0] + s * dx;
      const y = p1[1] + s * dy;
      const dist2 = d2(point, [x, y]);

      if (dist2 >= minDist) continue;
      minDist = dist2;
      minSegment = i + 1;
    }
  }

  return minSegment;
}

function minmax(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// normalization function
function normalize(val, min, max) {
  return minmax((val - min) / (max - min), 0, 1);
}

// return a random integer from min to max biased towards one end based on exponent distribution (the bigger ex the higher bias towards min)
// from https://gamedev.stackexchange.com/a/116875
function biased(min, max, ex) {
  return Math.round(min + (max - min) * Math.pow(Math.random(), ex));
}

// return array of values common for both array a and array b
function common(a, b) {
  const setB = new Set(b);
  return [...new Set(a)].filter(a => setB.has(a));
}

// clip polygon by graph bbox
function clipPoly(points, secure = 0) {
  return polygonclip(points, [0, 0, graphWidth, graphHeight], secure);
}

// check if char is vowel or can serve as vowel
function vowel(c) {
  return `aeiouyɑ'əøɛœæɶɒɨɪɔɐʊɤɯаоиеёэыуюяàèìòùỳẁȁȅȉȍȕáéíóúýẃőűâêîôûŷŵäëïöüÿẅãẽĩõũỹąęįǫųāēīōūȳăĕĭŏŭǎěǐǒǔȧėȯẏẇạẹịọụỵẉḛḭṵṳ`.includes(c);
}

// remove vowels from the end of the string
function trimVowels(string) {
  while (string.length > 3 && vowel(last(string))) {
    string = string.slice(0, -1);
  }
  return string;
}

// get adjective form from noun
function getAdjective(string) {
  // special cases for some suffixes
  if (string.length > 8 && string.slice(-6) === "orszag") return string.slice(0, -6);
  if (string.length > 6 && string.slice(-4) === "stan") return string.slice(0, -4);
  if (P(0.5) && string.slice(-4) === "land") return string + "ic";
  if (string.slice(-4) === " Guo") string = string.slice(0, -4);

  // don't change is name ends on suffix
  if (string.slice(-2) === "an") return string;
  if (string.slice(-3) === "ese") return string;
  if (string.slice(-1) === "i") return string;

  const end = string.slice(-1); // last letter of string
  if (end === "a") return (string += "n");
  if (end === "o") return (string = trimVowels(string) + "an");
  if (vowel(end) || end === "c") return (string += "an"); // ceiuy
  if (end === "m" || end === "n") return (string += "ese");
  if (end === "q") return (string += "i");
  return trimVowels(string) + "ian";
}

// get ordinal out of integer: 1 => 1st
const nth = n => n + (["st", "nd", "rd"][((((n + 90) % 100) - 10) % 10) - 1] || "th");

// get two-letters code (abbreviation) from string
function abbreviate(name, restricted = []) {
  const parsed = name.replace("Old ", "O ").replace(/[()]/g, ""); // remove Old prefix and parentheses
  const words = parsed.split(" ");
  const letters = words.join("");

  let code = words.length === 2 ? words[0][0] + words[1][0] : letters.slice(0, 2);
  for (let i = 1; i < letters.length - 1 && restricted.includes(code); i++) {
    code = letters[0] + letters[i].toUpperCase();
  }
  return code;
}

// conjunct array: [A,B,C] => "A, B and C"
function list(array) {
  if (!Intl.ListFormat) return array.join(", ");
  const conjunction = new Intl.ListFormat(window.lang || "en", {style: "long", type: "conjunction"});
  return conjunction.format(array);
}

// split string into 2 almost equal parts not breaking words
function splitInTwo(str) {
  const half = str.length / 2;
  const ar = str.split(" ");
  if (ar.length < 2) return ar; // only one word
  let first = "",
    last = "",
    middle = "",
    rest = "";

  ar.forEach((w, d) => {
    if (d + 1 !== ar.length) w += " ";
    rest += w;
    if (!first || rest.length < half) first += w;
    else if (!middle) middle = w;
    else last += w;
  });

  if (!last) return [first, middle];
  if (first.length < last.length) return [first + middle, last];
  return [first, middle + last];
}

// return the last element of array
function last(array) {
  return array[array.length - 1];
}

// return random value from the array
function ra(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// return random value from weighted array {"key1":weight1, "key2":weight2}
function rw(object) {
  const array = [];
  for (const key in object) {
    for (let i = 0; i < object[key]; i++) {
      array.push(key);
    }
  }
  return array[Math.floor(Math.random() * array.length)];
}

// return value in range [0, 100] (height range)
function lim(v) {
  return minmax(v, 0, 100);
}

// get number from string in format "1-3" or "2" or "0.5"
function getNumberInRange(r) {
  if (typeof r !== "string") {
    ERROR && console.error("The value should be a string", r);
    return 0;
  }
  if (!isNaN(+r)) return ~~r + +P(r - ~~r);
  const sign = r[0] === "-" ? -1 : 1;
  if (isNaN(+r[0])) r = r.slice(1);
  const range = r.includes("-") ? r.split("-") : null;
  if (!range) {
    ERROR && console.error("Cannot parse the number. Check the format", r);
    return 0;
  }
  const count = rand(range[0] * sign, +range[1]);
  if (isNaN(count) || count < 0) {
    ERROR && console.error("Cannot parse number. Check the format", r);
    return 0;
  }
  return count;
}

// return center point of common edge of 2 pack cells
function getMiddlePoint(cell1, cell2) {
  const {cells, vertices} = pack;

  const commonVertices = cells.v[cell1].filter(vertex => vertices.c[vertex].some(cell => cell === cell2));
  const [x1, y1] = vertices.p[commonVertices[0]];
  const [x2, y2] = vertices.p[commonVertices[1]];

  const x = (x1 + x2) / 2;
  const y = (y1 + y2) / 2;

  return [x, y];
}

// helper function non-used for the generation
function drawCellsValue(data) {
  debug.selectAll("text").remove();
  debug
    .selectAll("text")
    .data(data)
    .enter()
    .append("text")
    .attr("x", (d, i) => pack.cells.p[i][0])
    .attr("y", (d, i) => pack.cells.p[i][1])
    .text(d => d);
}

// helper function non-used for the generation
function drawPolygons(data) {
  const max = d3.max(data),
    min = d3.min(data),
    scheme = getColorScheme();
  data = data.map(d => 1 - normalize(d, min, max));

  debug.selectAll("polygon").remove();
  debug
    .selectAll("polygon")
    .data(data)
    .enter()
    .append("polygon")
    .attr("points", (d, i) => getPackPolygon(i))
    .attr("fill", d => scheme(d))
    .attr("stroke", d => scheme(d));
}

// polyfill for composedPath
function getComposedPath(node) {
  let parent;
  if (node.parentNode) parent = node.parentNode;
  else if (node.host) parent = node.host;
  else if (node.defaultView) parent = node.defaultView;
  if (parent !== undefined) return [node].concat(getComposedPath(parent));
  return [node];
}

// polyfill for replaceAll
if (!String.prototype.replaceAll) {
  String.prototype.replaceAll = function (str, newStr) {
    if (Object.prototype.toString.call(str).toLowerCase() === "[object regexp]") return this.replace(str, newStr);
    return this.replace(new RegExp(str, "g"), newStr);
  };
}

// get next unused id
function getNextId(core, i = 1) {
  while (document.getElementById(core + i)) i++;
  return core + i;
}

function debounce(func, ms) {
  let isCooldown = false;

  return function () {
    if (isCooldown) return;
    func.apply(this, arguments);
    isCooldown = true;
    setTimeout(() => (isCooldown = false), ms);
  };
}

function throttle(func, ms) {
  let isThrottled = false;
  let savedArgs;
  let savedThis;

  function wrapper() {
    if (isThrottled) {
      savedArgs = arguments;
      savedThis = this;
      return;
    }

    func.apply(this, arguments);
    isThrottled = true;

    setTimeout(function () {
      isThrottled = false;
      if (savedArgs) {
        wrapper.apply(savedThis, savedArgs);
        savedArgs = savedThis = null;
      }
    }, ms);
  }

  return wrapper;
}

// parse error to get the readable string in Chrome and Firefox
function parseError(error) {
  const isFirefox = navigator.userAgent.toLowerCase().indexOf("firefox") > -1;
  const errorString = isFirefox ? error.toString() + " " + error.stack : error.stack;
  const regex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
  const errorNoURL = errorString.replace(regex, url => "<i>" + last(url.split("/")) + "</i>");
  const errorParsed = errorNoURL.replace(/at /gi, "<br>&nbsp;&nbsp;at ");
  return errorParsed;
}

// polyfills
if (Array.prototype.flat === undefined) {
  Array.prototype.flat = function () {
    return this.reduce((acc, val) => (Array.isArray(val) ? acc.concat(val.flat()) : acc.concat(val)), []);
  };
}

// check if string is a valid for JSON parse
JSON.isValid = str => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
};

function getBase64(url, callback) {
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

function getAbsolutePath(href) {
  if (!href) return "";
  const link = document.createElement("a");
  link.href = href;
  return link.href;
}

// open URL in a new tab or window
function openURL(url) {
  window.open(url, "_blank");
}

// open project wiki-page
function wiki(page) {
  window.open("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/" + page, "_blank");
}

// wrap URL into html a element
function link(URL, description) {
  return `<a href="${URL}" rel="noopener" target="_blank">${description}</a>`;
}

function isCtrlClick(event) {
  // meta key is cmd key on MacOs
  return event.ctrlKey || event.metaKey;
}

function generateDate(from = 100, to = 1000) {
  return new Date(rand(from, to), rand(12), rand(31)).toLocaleDateString("en", {year: "numeric", month: "long", day: "numeric"});
}

function getQGIScoordinates(x, y) {
  const cx = mapCoordinates.lonW + (x / graphWidth) * mapCoordinates.lonT;
  const cy = mapCoordinates.latN - (y / graphHeight) * mapCoordinates.latT; // this is inverted in QGIS otherwise
  return [cx, cy];
}

// prompt replacer (prompt does not work in Electron)
void (function () {
  const prompt = document.getElementById("prompt");
  const form = prompt.querySelector("#promptForm");

  window.prompt = function (promptText = "Please provide an input", options = {default: 1, step: 0.01, min: 0, max: 100}, callback) {
    if (options.default === undefined) {
      ERROR && console.error("Prompt: options object does not have default value defined");
      return;
    }
    const input = prompt.querySelector("#promptInput");
    prompt.querySelector("#promptText").innerHTML = promptText;
    const type = typeof options.default === "number" ? "number" : "text";
    input.type = type;
    if (options.step !== undefined) input.step = options.step;
    if (options.min !== undefined) input.min = options.min;
    if (options.max !== undefined) input.max = options.max;
    input.placeholder = "type a " + type;
    input.value = options.default;
    prompt.style.display = "block";

    form.addEventListener(
      "submit",
      event => {
        prompt.style.display = "none";
        const v = type === "number" ? +input.value : input.value;
        event.preventDefault();
        if (callback) callback(v);
      },
      {once: true}
    );
  };

  const cancel = prompt.querySelector("#promptCancel");
  cancel.addEventListener("click", () => (prompt.style.display = "none"));
})();

// indexedDB; ldb object
!(function () {
  function e(t, o) {
    return n
      ? void (n.transaction("s").objectStore("s").get(t).onsuccess = function (e) {
          var t = (e.target.result && e.target.result.v) || null;
          o(t);
        })
      : void setTimeout(function () {
          e(t, o);
        }, 100);
  }
  var t = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
  if (!t) return void ERROR && console.error("indexedDB not supported");
  var n,
    o = {k: "", v: ""},
    r = t.open("d2", 1);
  (r.onsuccess = function (e) {
    n = this.result;
  }),
    (r.onerror = function (e) {
      ERROR && console.error("indexedDB request error"), INFO && console.log(e);
    }),
    (r.onupgradeneeded = function (e) {
      n = null;
      var t = e.target.result.createObjectStore("s", {keyPath: "k"});
      t.transaction.oncomplete = function (e) {
        n = e.target.db;
      };
    }),
    (window.ldb = {
      get: e,
      set: function (e, t) {
        (o.k = e), (o.v = t), n.transaction("s", "readwrite").objectStore("s").put(o);
      }
    });
})();
