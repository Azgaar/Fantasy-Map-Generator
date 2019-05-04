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
    let x = Math.ceil(w * i / numberX + offset);
    points.push([x, offset], [x, h + offset]);
  }
  for (let i = 0.5; i < numberY; i++) {
    let y = Math.ceil(h * i / numberY + offset);
    points.push([offset, y], [w + offset, y]);
  }
  return points;
}

// get points on a regular square grid and jitter them a bit
function getJitteredGrid(width, height, spacing) {
  const radius = spacing / 2; // square radius
  const jittering = radius * 0.9; // max deviation
  const jitter = function() {return Math.random() * 2 * jittering - jittering;};
  let points = [];
  for (let y = radius; y < height; y += spacing) {
    for (let x = radius; x < width; x += spacing) {
      let xj = rn(x + jitter(), 2);
      let yj = rn(y + jitter(), 2);
      points.push([xj, yj]);
    }
  }
  return points;
}

// return cell index on a regular square grid
function findGridCell(x, y) {
  return Math.floor(Math.min(y / grid.spacing, grid.cellsY -1)) * grid.cellsX + Math.floor(Math.min(x / grid.spacing, grid.cellsX-1));
}

// return array of cell indexes in radius  on a regular square grid
function findGridAll(x, y, radius) {
  const c = grid.cells.c;
  let found = [findGridCell(x, y)];
  let r = Math.floor(radius / grid.spacing);
  if (r > 0) found = found.concat(c[found[0]]); 
  if (r > 1) {
    let frontier = c[found[0]];
    while (r > 1) {
      let cycle = frontier.slice();
      frontier = [];
      cycle.forEach(function(s) {

        c[s].forEach(function(e) {
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
  if (!(x1 >= x0) || !(y1 >= y0) || !(r > 0)) throw new Error;

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
    const i = x / cellSize | 0;
    const j = y / cellSize | 0;
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
    queue.push(grid[gridWidth * (y / cellSize | 0) + (x / cellSize | 0)] = [x, y]);
    return [x + x0, y + y0];
  }

  yield sample(width / 2, height / 2);

  pick: while (queue.length) {
    const i = Math.random() * queue.length | 0;
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

// sort cells by height: highest go first
function highest(a, b) {
  return pack.cells.h[b] - pack.cells.h[a];
}

// convert RGB color string to HEX without #
function toHEX(rgb){
  if (rgb.charAt(0) === "#") {return rgb;}
  rgb = rgb.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);
    return (rgb && rgb.length === 4) ? "#" +
    ("0" + parseInt(rgb[1],10).toString(16)).slice(-2) +
    ("0" + parseInt(rgb[2],10).toString(16)).slice(-2) +
    ("0" + parseInt(rgb[3],10).toString(16)).slice(-2) : '';
}

// return array of standard shuffled colors
function getColors(number) {
  const c12 = d3.scaleOrdinal(d3.schemeSet3);
  const cRB = d3.scaleSequential(d3.interpolateRainbow);
  const colors = d3.shuffle(d3.range(number).map(i => i < 12 ? c12(i) : d3.color(cRB((i-12)/(number-12))).hex()));
  //debug.selectAll("circle").data(colors).enter().append("circle").attr("r", 15).attr("cx", (d,i) => 60 + i * 40).attr("cy", 20).attr("fill", d => d);
  return colors;
}

// conver temperature from °C to other scales
function convertTemperature(c) {
  switch(temperatureScale.value) {
    case "°C": return c + "°C";
    case "°F": return rn(c * 9 / 5 + 32) + "°F";
    case "K": return rn(c + 273.15) + "K";
    case "°R": return rn((c + 273.15) * 9 / 5) + "°R";
    case "°De": return rn((100 - c) * 3 / 2) + "°De";
    case "°N": return rn(c * 33 / 100) + "°N";
    case "°Ré": return rn(c * 4 / 5) + "°Ré";
    case "°Rø": return rn(c * 21 / 40 + 7.5) + "°Rø";
    default: return c + "°C";
  }
}

// random number in a range
function rand(min, max) {
  if (min === undefined && !max === undefined) return Math.random();
  if (max === undefined) {max = min; min = 0;}
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function gauss(expected = 100, deviation = 30, min = 0, max = 300, round = 0) {
  return rn(Math.max(Math.min(d3.randomNormal(expected, deviation)(), max), min), round);
}

// round value to d decimals
function rn(v, d = 0) {
  const m = Math.pow(10, d);
  return Math.round(v * m) / m;
}

// round string to d decimals
function round(s, d = 1) {
   return s.replace(/[\d\.-][\d\.e-]*/g, function(n) {return rn(n, d);})
}

// corvent number to short string with SI postfix
function si(n) {
  if (n >= 1e9) {return rn(n / 1e9, 1) + "B";}
  if (n >= 1e8) {return rn(n / 1e6) + "M";}
  if (n >= 1e6) {return rn(n / 1e6, 1) + "M";}
  if (n >= 1e4) {return rn(n / 1e3) + "K";}
  if (n >= 1e3) {return rn(n / 1e3, 1) + "K";}
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
  if (!string) {return [0,0,0,0,0,1];}
  const a = string.replace(/[a-z()]/g, "").replace(/[ ]/g, ",").split(",");
  return [a[0] || 0, a[1] || 0, a[2] || 0, a[3] || 0, a[4] || 0, a[5] || 1];
}

// findAll d3.quandtree search from https://bl.ocks.org/lwthatcher/b41479725e0ff2277c7ac90df2de2b5e
void function addFindAll() {
  const Quad = function(node, x0, y0, x1, y1) {
    this.node = node;
    this.x0 = x0;
    this.y0 = y0;
    this.x1 = x1;
    this.y1 = y1;
  }

  const tree_filter = function(x, y, radius) {
    var t = {x, y, x0: this._x0, y0: this._y0, x3: this._x1, y3: this._y1, quads: [], node: this._root};
    if (t.node) {t.quads.push(new Quad(t.node, t.x0, t.y0, t.x3, t.y3))};
    radiusSearchInit(t, radius);

    var i = 0;
    while (t.q = t.quads.pop()) {
      i++;

      // Stop searching if this quadrant can’t contain a closer node.
      if (!(t.node = t.q.node)
          || (t.x1 = t.q.x0) > t.x3
          || (t.y1 = t.q.y0) > t.y3
          || (t.x2 = t.q.x1) < t.x0
          || (t.y2 = t.q.y1) < t.y0) continue;

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
        if (t.i = (y >= ym) << 1 | (x >= xm)) {
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
  }
  d3.quadtree.prototype.findAll = tree_filter;

  var radiusSearchInit = function(t, radius) {
    t.result = [];
    t.x0 = t.x - radius, t.y0 = t.y - radius;
    t.x3 = t.x + radius, t.y3 = t.y + radius;
    t.radius = radius * radius;
  }

  var radiusSearchVisit = function(t, d2) {
    t.node.data.scanned = true;
    if (d2 < t.radius) {
      do {t.result.push(t.node.data); t.node.data.selected = true;} while (t.node = t.node.next);
    }
  }  
}()

// normalization function
function normalize(val, min, max) {
  return Math.min(Math.max((val - min) / (max - min), 0), 1);
}

// return a random integer from min to max biased towards one end based on exponent distribution (the bigger ex the higher bias towards min)
// from https://gamedev.stackexchange.com/a/116875
function biased(min, max, ex) {
  return Math.round(min + (max - min) * Math.pow(Math.random(), ex));
}

// return array of values common for both array a and array b
function intersect(a, b) {
  const setB = new Set(b);
  return [...new Set(a)].filter(a => setB.has(a));
}

// check if char is vowel
function vowel(c) {
  return "aeiouy".includes(c);
}

// return the last element of array
function last(array) {
  return array[array.length - 1];
}

// return value in range [0, 100] (height range)
function lim(v) {
  return Math.max(Math.min(v, 100), 0);
}

// get number from string in format "1-3" or "2" or "0.5"
function getNumberInRange(r) {
  if (typeof r !== "string") {console.error("The value should be a string", r); return 0;}
  if (!isNaN(+r)) return +r;
  const sign = r[0] === "-" ? -1 : 1;
  if (isNaN(+r[0])) r = r.slice(1);  
  const range = r.includes("-") ? r.split("-") : null;
  if (!range) {console.error("Cannot parse the number. Check the format", r); return 0;}
  const count = rand(range[0] * sign, +range[1]);
  if (isNaN(count) || count < 0) {console.error("Cannot parse number. Check the format", r); return 0;}
  return count;
}

function analizeNamesbase() {
  const result = [];
  nameBases.forEach((b,i) => {
    const d = nameBase[i];
    const size = d.length;
    const ar = d.map(n => n.length);
    const min = d3.min(ar);
    const max = d3.max(ar);
    const mean = rn(d3.mean(ar), 1);
    const median = d3.median(ar);
    const lengths = new Uint8Array(max);
    ar.forEach(l => lengths[l]++);
    const common = d3.scan(lengths, (a,b) => b-a);
    const string = d.join("");
    const doubleArray = [];
    let double = "";
    for (let i=0; i<string.length; i++) {
      if (!doubleArray[string[i]]) doubleArray[string[i]] = 0;
      if (string[i] === string[i-1]) doubleArray[string[i]]++;
    }
    for (const l in doubleArray) {if(doubleArray[l] > size/35) double += l;}
    const multi = rn(d3.mean(d.map(n => (n.match(/ /g)||[]).length)),2);
    result.push({name:b.name, size, min, max, mean, median, common, double, multi});
  });
  console.table(result);
}

// polyfill for composedPath
function getComposedPath(node) {
  let parent;
  if (node.parentNode) parent = node.parentNode;
  else if (node.host) parent = node.host;
  else if (node.defaultView) parent = node.defaultView;
  if (parent !== undefined) return [node].concat(getComposedPath(parent));
  return [node];
};

// get next unused id
function getNextId(core, i = 1) {
  while (document.getElementById(core+i)) i++;
  return core + i;
}

function getAbsolutePath(href) {
  if (!href) return "";
  var link = document.createElement("a");
  link.href = href;
  return link.href;
}

// from https://davidwalsh.name/javascript-debounce-function
function debounce(func, wait, immediate) {
  var timeout;
  return function() {
    var context = this, args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    }
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  }
};