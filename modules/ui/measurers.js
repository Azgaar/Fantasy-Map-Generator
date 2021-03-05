class Rulers {
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

    const rulers = string.split("; ");
    for (const rulerString of rulers) {
      const [type, pointsString] = rulerString.split(": ");
      const points = pointsString.split(" ").map(el => el.split(",").map(n => +n));
      const Type = type === "Ruler" ? Ruler : 
                   type === "Opisometer" ? Opisometer :
                   type === "Planimeter" ? Planimeter : null;
      this.create(Type, points);
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
    return rn(1 / scale ** .3 * 2, 2);
  }

  getDash() {
    return rn(30 / distanceScaleInput.value, 2);
  }

  drag() {
    const tr = parseTransform(this.getAttribute("transform"));
    const x = +tr[0] - d3.event.x, y = +tr[1] - d3.event.y;

    d3.event.on("drag", function() {
      const transform = `translate(${(x + d3.event.x)},${(y + d3.event.y)})`;
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

    for (let i=0, p1 = this.points[0]; i < this.points.length; i++) {
      const p2 = this.points[i];
      const dist2 = !i || i === this.points.length-1 ? Infinity : (p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2;
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

class Ruler extends Measurer {
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

    const el = this.el = ruler.append("g").attr("class", "ruler").call(d3.drag().on("start", this.drag)).attr("font-size", 10 * size);
    el.append("polyline").attr("points", points).attr("class", "white").attr("stroke-width", size)
      .call(d3.drag().on("start", () => this.addControl(this)));
    el.append("polyline").attr("points", points).attr("class", "gray").attr("stroke-width", rn(size * 1.2, 2)).attr("stroke-dasharray", dash);
    el.append("g").attr("class", "rulerPoints").attr("stroke-width", .5 * size).attr("font-size", 2 * size);
    el.append("text").attr("dx", ".35em").attr("dy", "-.45em").on("click", () => rulers.remove(this.id));
    this.drawPoints(el);
    this.updateLabel();
    return this;
  }

  drawPoints(el) {
    const g = el.select(".rulerPoints");
    g.selectAll("circle").remove();

    for (let i=0; i < this.points.length; i++) {
      const [x, y] = this.points[i];
      this.drawPoint(g, x, y, i);
    }
  }

  drawPoint(el, x, y, i) {
    const context = this;
    const circle = el.append("circle")
      .attr("r", "1em").attr("cx", x).attr("cy", y)
      .on("click", function() {context.removePoint(context, i)})
      .call(d3.drag().clickDistance(3).on("start", function() {context.dragControl(context, i)}));

    if (!this.isEdge(i)) circle.attr("class", "control");
  }

  isEdge(i) {
    return i === 0 || i === this.points.length-1;
  }

  updateLabel() {
    const length = this.getLength();
    const text = rn(length * distanceScaleInput.value) + " " + distanceUnitInput.value;
    const [x, y] = last(this.points);
    this.el.select("text").attr("x", x).attr("y", y).text(text);
  }

  getLength() {
    let length = 0;
    for (let i=0; i < this.points.length - 1; i++) {
      const [x1, y1] = this.points[i];
      const [x2, y2] = this.points[i+1];
      length += Math.hypot(x1 - x2, y1 - y2);
    }
    return length;
  }

  dragControl(context, pointId) {
    let edge = context.isEdge(pointId)
    let circle = context.el.select(`circle:nth-child(${pointId+1})`);
    const line = context.el.selectAll("polyline");

    let x0 = rn(d3.event.x, 1);
    let y0 = rn(d3.event.y, 1);
    let axis;

    d3.event.on("drag", function() {
      if (edge) {
        if (d3.event.dx < .1 && d3.event.dy < .1) return;
        context.pushPoint(pointId);
        context.drawPoints(context.el);
        if (pointId) pointId++;
        circle = context.el.select(`circle:nth-child(${pointId+1})`);
        edge = false;
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
    this.points.splice(pointId, 1);
    if (this.points.length < 2) context.el.remove();
    else context.draw();
  }
}

class Opisometer extends Measurer {
  constructor(points) {
    super(points);
  }

  draw() {
    if (this.el) this.el.selectAll("*").remove();
    const size = this.getSize();
    const dash = this.getDash();
    const context = this;

    const el = this.el = ruler.append("g").attr("class", "opisometer").call(d3.drag().on("start", this.drag)).attr("font-size", 10 * size);
    el.append("path").attr("class", "white").attr("stroke-width", size);
    el.append("path").attr("class", "gray").attr("stroke-width", size).attr("stroke-dasharray", dash);
    const rulerPoints = el.append("g").attr("class", "rulerPoints").attr("stroke-width", .5 * size).attr("font-size", 2 * size);
    rulerPoints.append("circle").attr("r", "1em").call(d3.drag().on("start", function() {context.dragControl(context, 0)}));
    rulerPoints.append("circle").attr("r", "1em").call(d3.drag().on("start", function() {context.dragControl(context, 1)}));
    el.append("text").attr("dx", ".35em").attr("dy", "-.45em").on("click", () => rulers.remove(this.id));

    this.updateCurve();
    this.updateLabel();
    return this;
  }

  updateCurve() {
    lineGen.curve(d3.curveCatmullRom.alpha(.5));
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

    d3.event.on("drag", function() {
      const point = [d3.event.x | 0, d3.event.y | 0];

      const dist2 = (prev[0] - point[0]) ** 2 + (prev[1] - point[1]) ** 2;
      if (dist2 < MIN_DIST) return;

      rigth ? context.points.push(point) : context.points.unshift(point);
      prev = point;

      context.updateCurve();
      context.updateLabel();
    });

    d3.event.on("end", function() {
      if (!d3.event.sourceEvent.shiftKey) context.optimize();
    });
  }
}

class Planimeter extends Measurer {
  constructor(points) {
    super(points);
  }

  draw() {
    if (this.el) this.el.selectAll("*").remove();
    const size = this.getSize();

    const el = this.el = ruler.append("g").attr("class", "planimeter").call(d3.drag().on("start", this.drag)).attr("font-size", 10 * size);
    el.append("path").attr("class", "planimeter").attr("stroke-width", size);
    el.append("text").on("click", () => rulers.remove(this.id));

    this.updateCurve();
    this.updateLabel();
    return this;
  }

  updateCurve() {
    lineGen.curve(d3.curveCatmullRomClosed.alpha(.5));
    const path = round(lineGen(this.points));
    this.el.selectAll("path").attr("d", path);
  }

  updateLabel() {
    if (this.points.length < 3) return;

    const polygonArea = rn(Math.abs(d3.polygonArea(this.points)));
    const unit = areaUnit.value === "square" ? " " + distanceUnitInput.value + "²" : " " + areaUnit.value;
    const area = si(polygonArea * distanceScaleInput.value ** 2) + " " + unit;
    const c = polylabel([this.points], 1.0);
    this.el.select("text").attr("x", c[0]).attr("y", c[1]).text(area);
  }
}

// Scale bar
function drawScaleBar() {
  if (scaleBar.style("display") === "none") return; // no need to re-draw hidden element
  scaleBar.selectAll("*").remove(); // fully redraw every time

  const dScale = distanceScaleInput.value;
  const unit = distanceUnitInput.value;

  // calculate size
  const init = 100; // actual length in pixels if scale, dScale and size = 1;
  const size = +barSize.value;
  let val = init * size * dScale / scale; // bar length in distance unit
  if (val > 900) val = rn(val, -3); // round to 1000
  else if (val > 90) val = rn(val, -2); // round to 100
  else if (val > 9) val = rn(val, -1); // round to 10
  else val = rn(val) // round to 1
  const l = val * scale / dScale; // actual length in pixels on this scale

  scaleBar.append("line").attr("x1", 0.5).attr("y1", 0).attr("x2", l+size-0.5).attr("y2", 0).attr("stroke-width", size).attr("stroke", "white");
  scaleBar.append("line").attr("x1", 0).attr("y1", size).attr("x2", l+size).attr("y2", size).attr("stroke-width", size).attr("stroke", "#3d3d3d");
  const dash = size + " " + rn(l / 5 - size, 2);
  scaleBar.append("line").attr("x1", 0).attr("y1", 0).attr("x2", l+size).attr("y2", 0)
    .attr("stroke-width", rn(size * 3, 2)).attr("stroke-dasharray", dash).attr("stroke", "#3d3d3d");

  const fontSize = rn(5 * size, 1);
  scaleBar.selectAll("text").data(d3.range(0,6)).enter().append("text")
    .attr("x", d => rn(d * l/5, 2)).attr("y", 0).attr("dy", "-.5em")
    .attr("font-size", fontSize).text(d => rn(d * l/5 * dScale / scale) + (d<5 ? "" : " " + unit));

  if (barLabel.value !== "") {
    scaleBar.append("text").attr("x", (l+1) / 2).attr("y", 2 * size)
      .attr("dominant-baseline", "text-before-edge")
      .attr("font-size", fontSize).text(barLabel.value);
  }

  const bbox = scaleBar.node().getBBox();
  // append backbround rectangle
  scaleBar.insert("rect", ":first-child").attr("x", -10).attr("y", -20).attr("width", bbox.width + 10).attr("height", bbox.height + 15)
    .attr("stroke-width", size).attr("stroke", "none").attr("filter", "url(#blur5)")
    .attr("fill", barBackColor.value).attr("opacity", +barBackOpacity.value);

  fitScaleBar();
}

// fit ScaleBar to canvas size
function fitScaleBar() {
  if (!scaleBar.select("rect").size() || scaleBar.style("display") === "none") return;
  const px = isNaN(+barPosX.value) ? .99 : barPosX.value / 100;
  const py = isNaN(+barPosY.value) ? .99 : barPosY.value / 100;
  const bbox = scaleBar.select("rect").node().getBBox();
  const x = rn(svgWidth * px - bbox.width + 10), y = rn(svgHeight * py - bbox.height + 20);
  scaleBar.attr("transform", `translate(${x},${y})`);
}