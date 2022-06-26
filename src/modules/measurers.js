import {findCell} from "/src/utils/graphUtils";
import {last} from "/src/utils/arrayUtils";
import {getSegmentId} from "@/utils/lineUtils";
import {rn} from "/src/utils/numberUtils";
import {round, parseTransform} from "@/utils/stringUtils";
import {si} from "@/utils/unitUtils";

export class Rulers {
  constructor() {
    this.data = [];
  }

  create(Type, points) {
    const ruler = new Type(points);
    this.data.push(ruler);
    return ruler;
  }

  toString() {
    return this.data.map(ruler => ruler.toString()).join("; ");
  }

  fromString(string) {
    this.data = [];

    const typeMap = {
      Ruler: Ruler,
      Opisometer: Opisometer,
      RouteOpisometer: RouteOpisometer,
      Planimeter: Planimeter
    };

    const rulers = string.split("; ");
    for (const rulerString of rulers) {
      const [type, pointsString] = rulerString.split(": ");
      if (!type || !pointsString) continue;

      const points = pointsString.split(" ").map(el => el.split(",").map(n => +n));
      this.create(typeMap[type], points);
    }
  }

  draw() {
    this.data.forEach(ruler => ruler.draw());
  }

  undraw() {
    this.data.forEach(ruler => ruler.undraw());
  }

  remove(id) {
    if (id === undefined) return;

    const ruler = this.data.find(ruler => ruler.id === id);
    ruler.undraw();
    const rulerIndex = this.data.indexOf(ruler);
    rulers.data.splice(rulerIndex, 1);
  }
}

class Measurer {
  constructor(points) {
    this.points = points;
    this.id = rulers.data.length;
  }

  toString() {
    return this.constructor.name + ": " + this.points.join(" ");
  }

  getSize() {
    return rn((1 / scale ** 0.3) * 2, 2);
  }

  getDash() {
    return rn(30 / distanceScaleInput.value, 2);
  }

  drag() {
    const tr = parseTransform(this.getAttribute("transform"));
    const x = +tr[0] - d3.event.x,
      y = +tr[1] - d3.event.y;

    d3.event.on("drag", function () {
      const transform = `translate(${x + d3.event.x},${y + d3.event.y})`;
      this.setAttribute("transform", transform);
    });
  }

  addPoint(point) {
    const MIN_DIST = d3.event.sourceEvent.shiftKey ? 9 : 100;
    const prev = last(this.points);
    point = [point[0] | 0, point[1] | 0];
    const dist2 = (prev[0] - point[0]) ** 2 + (prev[1] - point[1]) ** 2;
    if (dist2 < MIN_DIST) return;
    this.points.push(point);
    this.updateCurve();
    this.updateLabel();
  }

  optimize() {
    const MIN_DIST2 = 900;
    const optimized = [];

    for (let i = 0, p1 = this.points[0]; i < this.points.length; i++) {
      const p2 = this.points[i];
      const dist2 = !i || i === this.points.length - 1 ? Infinity : (p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2;
      if (dist2 < MIN_DIST2) continue;
      optimized.push(p2);
      p1 = p2;
    }

    this.points = optimized;
    this.updateCurve();
    this.updateLabel();
  }

  undraw() {
    this.el?.remove();
  }
}

export class Ruler extends Measurer {
  constructor(points) {
    super(points);
  }

  getPointsString() {
    return this.points.join(" ");
  }

  updatePoint(index, x, y) {
    this.points[index] = [x, y];
  }

  getPointId(x, y) {
    return this.points.findIndex(el => el[0] == x && el[1] == y);
  }

  pushPoint(i) {
    const [x, y] = this.points[i];
    i ? this.points.push([x, y]) : this.points.unshift([x, y]);
  }

  draw() {
    if (this.el) this.el.selectAll("*").remove();
    const points = this.getPointsString();
    const size = this.getSize();
    const dash = this.getDash();

    const el = (this.el = ruler
      .append("g")
      .attr("class", "ruler")
      .call(d3.drag().on("start", this.drag))
      .attr("font-size", 10 * size));
    el.append("polyline")
      .attr("points", points)
      .attr("class", "white")
      .attr("stroke-width", size)
      .call(d3.drag().on("start", () => this.addControl(this)));
    el.append("polyline")
      .attr("points", points)
      .attr("class", "gray")
      .attr("stroke-width", rn(size * 1.2, 2))
      .attr("stroke-dasharray", dash);
    el.append("g")
      .attr("class", "rulerPoints")
      .attr("stroke-width", 0.5 * size)
      .attr("font-size", 2 * size);
    el.append("text")
      .attr("dx", ".35em")
      .attr("dy", "-.45em")
      .on("click", () => rulers.remove(this.id));
    this.drawPoints(el);
    this.updateLabel();
    return this;
  }

  drawPoints(el) {
    const g = el.select(".rulerPoints");
    g.selectAll("circle").remove();

    for (let i = 0; i < this.points.length; i++) {
      const [x, y] = this.points[i];
      this.drawPoint(g, x, y, i);
    }
  }

  drawPoint(el, x, y, i) {
    const context = this;
    el.append("circle")
      .attr("r", "1em")
      .attr("cx", x)
      .attr("cy", y)
      .attr("class", this.isEdge(i) ? "edge" : "control")
      .on("click", function () {
        context.removePoint(context, i);
      })
      .call(
        d3
          .drag()
          .clickDistance(3)
          .on("start", function () {
            context.dragControl(context, i);
          })
      );
  }

  isEdge(i) {
    return i === 0 || i === this.points.length - 1;
  }

  updateLabel() {
    const length = this.getLength();
    const text = rn(length * distanceScaleInput.value) + " " + distanceUnitInput.value;
    const [x, y] = last(this.points);
    this.el.select("text").attr("x", x).attr("y", y).text(text);
  }

  getLength() {
    let length = 0;
    for (let i = 0; i < this.points.length - 1; i++) {
      const [x1, y1] = this.points[i];
      const [x2, y2] = this.points[i + 1];
      length += Math.hypot(x1 - x2, y1 - y2);
    }
    return length;
  }

  dragControl(context, pointId) {
    let addPoint = context.isEdge(pointId) && d3.event.sourceEvent.ctrlKey;
    let circle = context.el.select(`circle:nth-child(${pointId + 1})`);
    const line = context.el.selectAll("polyline");

    let x0 = rn(d3.event.x, 1);
    let y0 = rn(d3.event.y, 1);
    let axis;

    d3.event.on("drag", function () {
      if (addPoint) {
        if (d3.event.dx < 0.1 && d3.event.dy < 0.1) return;
        context.pushPoint(pointId);
        context.drawPoints(context.el);
        if (pointId) pointId++;
        circle = context.el.select(`circle:nth-child(${pointId + 1})`);
        addPoint = false;
      }

      const shiftPressed = d3.event.sourceEvent.shiftKey;
      if (shiftPressed && !axis) axis = Math.abs(d3.event.dx) > Math.abs(d3.event.dy) ? "x" : "y";

      const x = axis === "y" ? x0 : rn(d3.event.x, 1);
      const y = axis === "x" ? y0 : rn(d3.event.y, 1);

      if (!shiftPressed) {
        axis = null;
        x0 = x;
        y0 = y;
      }

      context.updatePoint(pointId, x, y);
      line.attr("points", context.getPointsString());
      circle.attr("cx", x).attr("cy", y);
      context.updateLabel();
    });
  }

  addControl(context) {
    const x = rn(d3.event.x, 1);
    const y = rn(d3.event.y, 1);
    const pointId = getSegmentId(context.points, [x, y]);

    context.points.splice(pointId, 0, [x, y]);
    context.drawPoints(context.el);
    context.dragControl(context, pointId);
  }

  removePoint(context, pointId) {
    if (this.points.length < 3) return;
    this.points.splice(pointId, 1);
    context.draw();
  }
}

export class Opisometer extends Measurer {
  constructor(points) {
    super(points);
  }

  draw() {
    if (this.el) this.el.selectAll("*").remove();
    const size = this.getSize();
    const dash = this.getDash();
    const context = this;

    const el = (this.el = ruler
      .append("g")
      .attr("class", "opisometer")
      .call(d3.drag().on("start", this.drag))
      .attr("font-size", 10 * size));
    el.append("path").attr("class", "white").attr("stroke-width", size);
    el.append("path").attr("class", "gray").attr("stroke-width", size).attr("stroke-dasharray", dash);
    const rulerPoints = el
      .append("g")
      .attr("class", "rulerPoints")
      .attr("stroke-width", 0.5 * size)
      .attr("font-size", 2 * size);
    rulerPoints
      .append("circle")
      .attr("r", "1em")
      .call(
        d3.drag().on("start", function () {
          context.dragControl(context, 0);
        })
      );
    rulerPoints
      .append("circle")
      .attr("r", "1em")
      .call(
        d3.drag().on("start", function () {
          context.dragControl(context, 1);
        })
      );
    el.append("text")
      .attr("dx", ".35em")
      .attr("dy", "-.45em")
      .on("click", () => rulers.remove(this.id));

    this.updateCurve();
    this.updateLabel();
    return this;
  }

  updateCurve() {
    lineGen.curve(d3.curveCatmullRom.alpha(0.5));
    const path = round(lineGen(this.points));
    this.el.selectAll("path").attr("d", path);

    const left = this.points[0];
    const right = last(this.points);
    this.el.select(".rulerPoints > circle:first-child").attr("cx", left[0]).attr("cy", left[1]);
    this.el.select(".rulerPoints > circle:last-child").attr("cx", right[0]).attr("cy", right[1]);
  }

  updateLabel() {
    const length = this.el.select("path").node().getTotalLength();
    const text = rn(length * distanceScaleInput.value) + " " + distanceUnitInput.value;
    const [x, y] = last(this.points);
    this.el.select("text").attr("x", x).attr("y", y).text(text);
  }

  dragControl(context, rigth) {
    const MIN_DIST = d3.event.sourceEvent.shiftKey ? 9 : 100;
    let prev = rigth ? last(context.points) : context.points[0];

    d3.event.on("drag", function () {
      const point = [d3.event.x | 0, d3.event.y | 0];

      const dist2 = (prev[0] - point[0]) ** 2 + (prev[1] - point[1]) ** 2;
      if (dist2 < MIN_DIST) return;

      rigth ? context.points.push(point) : context.points.unshift(point);
      prev = point;

      context.updateCurve();
      context.updateLabel();
    });

    d3.event.on("end", function () {
      if (!d3.event.sourceEvent.shiftKey) context.optimize();
    });
  }
}

export class RouteOpisometer extends Measurer {
  constructor(points) {
    super(points);
    if (pack.cells) {
      this.cellStops = points.map(p => findCell(p[0], p[1]));
    } else {
      this.cellStops = null;
    }
  }

  checkCellStops() {
    if (!this.cellStops) {
      this.cellStops = this.points.map(p => findCell(p[0], p[1]));
    }
  }

  trackCell(cell, rigth) {
    this.checkCellStops();
    const cellStops = this.cellStops;
    const foundIndex = cellStops.indexOf(cell);
    if (rigth) {
      if (last(cellStops) === cell) {
        return;
      } else if (cellStops.length > 1 && foundIndex != -1) {
        cellStops.splice(foundIndex + 1);
        this.points.splice(foundIndex + 1);
      } else {
        cellStops.push(cell);
        this.points.push(this.getCellRouteCoord(cell));
      }
    } else {
      if (cellStops[0] === cell) {
        return;
      } else if (cellStops.length > 1 && foundIndex != -1) {
        cellStops.splice(0, foundIndex);
        this.points.splice(0, foundIndex);
      } else {
        cellStops.unshift(cell);
        this.points.unshift(this.getCellRouteCoord(cell));
      }
    }
    this.updateCurve();
    this.updateLabel();
  }

  getCellRouteCoord(c) {
    const cells = pack.cells;
    const burgs = pack.burgs;
    const b = cells.burg[c];
    const x = b ? burgs[b].x : cells.p[c][0];
    const y = b ? burgs[b].y : cells.p[c][1];
    return [x, y];
  }

  draw() {
    if (this.el) this.el.selectAll("*").remove();
    const size = this.getSize();
    const dash = this.getDash();
    const context = this;

    const el = (this.el = ruler
      .append("g")
      .attr("class", "opisometer")
      .attr("font-size", 10 * size));
    el.append("path").attr("class", "white").attr("stroke-width", size);
    el.append("path").attr("class", "gray").attr("stroke-width", size).attr("stroke-dasharray", dash);
    const rulerPoints = el
      .append("g")
      .attr("class", "rulerPoints")
      .attr("stroke-width", 0.5 * size)
      .attr("font-size", 2 * size);
    rulerPoints
      .append("circle")
      .attr("r", "1em")
      .call(
        d3.drag().on("start", function () {
          context.dragControl(context, 0);
        })
      );
    rulerPoints
      .append("circle")
      .attr("r", "1em")
      .call(
        d3.drag().on("start", function () {
          context.dragControl(context, 1);
        })
      );
    el.append("text")
      .attr("dx", ".35em")
      .attr("dy", "-.45em")
      .on("click", () => rulers.remove(this.id));

    this.updateCurve();
    this.updateLabel();
    return this;
  }

  updateCurve() {
    lineGen.curve(d3.curveCatmullRom.alpha(0.5));
    const path = round(lineGen(this.points));
    this.el.selectAll("path").attr("d", path);

    const left = this.points[0];
    const right = last(this.points);
    this.el.select(".rulerPoints > circle:first-child").attr("cx", left[0]).attr("cy", left[1]);
    this.el.select(".rulerPoints > circle:last-child").attr("cx", right[0]).attr("cy", right[1]);
  }

  updateLabel() {
    const length = this.el.select("path").node().getTotalLength();
    const text = rn(length * distanceScaleInput.value) + " " + distanceUnitInput.value;
    const [x, y] = last(this.points);
    this.el.select("text").attr("x", x).attr("y", y).text(text);
  }

  dragControl(context, rigth) {
    d3.event.on("drag", function () {
      const mousePoint = [d3.event.x | 0, d3.event.y | 0];
      const cells = pack.cells;

      const c = findCell(mousePoint[0], mousePoint[1]);
      if (!cells.road[c] && !d3.event.sourceEvent.shiftKey) {
        return;
      }

      context.trackCell(c, rigth);
    });
  }
}

export class Planimeter extends Measurer {
  constructor(points) {
    super(points);
  }

  draw() {
    if (this.el) this.el.selectAll("*").remove();
    const size = this.getSize();

    const el = (this.el = ruler
      .append("g")
      .attr("class", "planimeter")
      .call(d3.drag().on("start", this.drag))
      .attr("font-size", 10 * size));
    el.append("path").attr("class", "planimeter").attr("stroke-width", size);
    el.append("text").on("click", () => rulers.remove(this.id));

    this.updateCurve();
    this.updateLabel();
    return this;
  }

  updateCurve() {
    lineGen.curve(d3.curveCatmullRomClosed.alpha(0.5));
    const path = round(lineGen(this.points));
    this.el.selectAll("path").attr("d", path);
  }

  updateLabel() {
    if (this.points.length < 3) return;

    const polygonArea = rn(Math.abs(d3.polygonArea(this.points)));
    const area = si(getArea(polygonArea)) + " " + getAreaUnit();
    const c = polylabel([this.points], 1.0);
    this.el.select("text").attr("x", c[0]).attr("y", c[1]).text(area);
  }
}

export function drawScaleBar(scaleLevel) {
  if (scaleBar.style("display") === "none") return; // no need to re-draw hidden element
  scaleBar.selectAll("*").remove(); // fully redraw every time

  const distanceScale = +distanceScaleInput.value;
  const unit = distanceUnitInput.value;
  const size = +barSizeInput.value;

  // calculate size
  const init = 100;
  let val = (init * size * distanceScale) / scaleLevel; // bar length in distance unit
  if (val > 900) val = rn(val, -3);
  // round to 1000
  else if (val > 90) val = rn(val, -2);
  // round to 100
  else if (val > 9) val = rn(val, -1);
  // round to 10
  else val = rn(val); // round to 1
  const length = (val * scaleLevel) / distanceScale; // actual length in pixels on this scale

  scaleBar
    .append("line")
    .attr("x1", 0.5)
    .attr("y1", 0)
    .attr("x2", length + size - 0.5)
    .attr("y2", 0)
    .attr("stroke-width", size)
    .attr("stroke", "white");
  scaleBar
    .append("line")
    .attr("x1", 0)
    .attr("y1", size)
    .attr("x2", length + size)
    .attr("y2", size)
    .attr("stroke-width", size)
    .attr("stroke", "#3d3d3d");
  const dash = size + " " + rn(length / 5 - size, 2);
  scaleBar
    .append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", length + size)
    .attr("y2", 0)
    .attr("stroke-width", rn(size * 3, 2))
    .attr("stroke-dasharray", dash)
    .attr("stroke", "#3d3d3d");

  const fontSize = rn(5 * size, 1);
  scaleBar
    .selectAll("text")
    .data(d3.range(0, 6))
    .enter()
    .append("text")
    .attr("x", d => rn((d * length) / 5, 2))
    .attr("y", 0)
    .attr("dy", "-.5em")
    .attr("font-size", fontSize)
    .text(d => rn((((d * length) / 5) * distanceScale) / scaleLevel) + (d < 5 ? "" : " " + unit));

  if (barLabel.value !== "") {
    scaleBar
      .append("text")
      .attr("x", (length + 1) / 2)
      .attr("y", 2 * size)
      .attr("dominant-baseline", "text-before-edge")
      .attr("font-size", fontSize)
      .text(barLabel.value);
  }

  const bbox = scaleBar.node().getBBox();
  // append backbround rectangle
  scaleBar
    .insert("rect", ":first-child")
    .attr("x", -10)
    .attr("y", -20)
    .attr("width", bbox.width + 10)
    .attr("height", bbox.height + 15)
    .attr("stroke-width", size)
    .attr("stroke", "none")
    .attr("filter", "url(#blur5)")
    .attr("fill", barBackColor.value)
    .attr("opacity", +barBackOpacity.value);

  fitScaleBar();
}

// fit ScaleBar to canvas size
export function fitScaleBar() {
  if (!scaleBar.select("rect").size() || scaleBar.style("display") === "none") return;
  const px = isNaN(+barPosX.value) ? 0.99 : barPosX.value / 100;
  const py = isNaN(+barPosY.value) ? 0.99 : barPosY.value / 100;
  const bbox = scaleBar.select("rect").node().getBBox();
  const x = rn(svgWidth * px - bbox.width + 10),
    y = rn(svgHeight * py - bbox.height + 20);
  scaleBar.attr("transform", `translate(${x},${y})`);
}
