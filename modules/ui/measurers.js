// UI measurers: rulers (linear, curve, area) and Scale Bar
class Ruler {
  constructor(points) {
    this.points = points;
  }

  toString() {
    return "ruler" + ": " + this.points.join(" ");
  }

  getPoints() {
    return this.points.join(" ");
  }

  updatePoint(index, x, y) {
    this.points[index] = [x, y];
  }

  getPointId(x, y) {
    return this.points.findIndex(el => el[0] == x && el[1] == y);
  }

  addPoint(i) {
    const [x, y] = this.points[i];
    i ? this.points.push([x, y]) : this.points.unshift([x, y]);
  }

  render() {
    if (this.el) this.el.selectAll("*").remove();
    const points = this.getPoints();
    const size = rn(1 / scale ** .3 * 2, 2);
    const dash = rn(30 / distanceScaleInput.value, 2);

    const el = this.el = ruler.append("g").attr("class", "ruler").call(d3.drag().on("start", this.drag)).attr("font-size", 10 * size)
    el.append("polyline").attr("points", points).attr("class", "white").attr("stroke-width", size);
    el.append("polyline").attr("points", points).attr("class", "gray").attr("stroke-width", rn(size * 1.2, 2)).attr("stroke-dasharray", dash);
    el.append("g").attr("class", "rulerPoints").attr("stroke-width", .5 * size).attr("font-size", 2 * size);
    el.append("text").attr("dx", ".35em").attr("dy", "-.45em").on("click", this.remove);
    this.renderPoints(el);
    this.updateLabel();
  }

  renderPoints(el) {
    const g = el.select(".rulerPoints");
    g.selectAll("circle").remove();

    for (let i=0; i < this.points.length; i++) {
      const [x, y] = this.points[i];
      this.renderPoint(g, x, y, i);
    }
  }

  renderPoint(el, x, y, i) {
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

  drag() {
    const tr = parseTransform(this.getAttribute("transform"));
    const x = +tr[0] - d3.event.x, y = +tr[1] - d3.event.y;

    d3.event.on("drag", function() {
      const transform = `translate(${(x + d3.event.x)},${(y + d3.event.y)})`;
      this.setAttribute("transform", transform);
    });
  }

  dragControl(context, pointId) {
    let edge = context.isEdge(pointId)
    let circle = context.el.select(`circle:nth-child(${pointId+1})`);
    const line = context.el.selectAll("polyline");

    d3.event.on("drag", function() {
      if (edge) {
        if (d3.event.dx < .1 && d3.event.dy < .1) return;
        context.addPoint(pointId);
        context.renderPoints(context.el);
        if (pointId) pointId++;
        circle = context.el.select(`circle:nth-child(${pointId+1})`);
        edge = false;
      }

      const x = rn(d3.event.x, 1);
      const y = rn(d3.event.y, 1);
      context.updatePoint(pointId, x, y);
      line.attr("points", context.getPoints());
      circle.attr("cx", x).attr("cy", y);
      context.updateLabel();
    });
  }

  removePoint(context, pointId) {
    this.points.splice(pointId, 1);
    if (this.points.length < 2) context.el.remove();
    else context.render();
  }

  remove() {
    this.parentNode.parentNode.removeChild(this.parentNode);
  }

}


// Linear measurer (one is added by default)
function addRuler(x1, y1, x2, y2) {
  const cx = rn((x1 + x2) / 2, 2), cy = rn((y1 + y2) / 2, 2);
  const size = rn(1 / scale ** .3 * 2, 1);
  const dash = rn(30 / distanceScaleInput.value, 2);

  // body
  const rulerNew = ruler.append("g").attr("class", "ruler").call(d3.drag().on("start", dragRuler));
  rulerNew.append("line").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2).attr("class", "white").attr("stroke-width", size);
  rulerNew.append("line").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2).attr("class", "gray").attr("stroke-width", size).attr("stroke-dasharray", dash);
  rulerNew.append("circle").attr("r", 2 * size).attr("stroke-width", .5 * size).attr("cx", x1).attr("cy", y1).attr("data-edge", "left").call(d3.drag().on("drag", dragRulerEdge));
  rulerNew.append("circle").attr("r", 2 * size).attr("stroke-width", .5 * size).attr("cx", x2).attr("cy", y2).attr("data-edge", "right").call(d3.drag().on("drag", dragRulerEdge));

  // label and center
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  const rotate = `rotate(${angle} ${cx} ${cy})`;
  const dist = rn(Math.hypot(x1 - x2, y1 - y2));
  const label = rn(dist * distanceScaleInput.value) + " " + distanceUnitInput.value;
  rulerNew.append("rect").attr("x", cx - size * 1.5).attr("y", cy - size * 1.5).attr("width", size * 3).attr("height", size * 3).attr("transform", rotate).attr("stroke-width", .5 * size).call(d3.drag().on("start", rulerCenterDrag));
  rulerNew.append("text").attr("x", cx).attr("y", cy).attr("dx", ".3em").attr("dy", "-.3em").attr("transform", rotate).attr("font-size", 10 * size).text(label).on("click", removeParent);
}

function dragRuler() {
  const tr = parseTransform(this.getAttribute("transform"));
  const x = +tr[0] - d3.event.x, y = +tr[1] - d3.event.y;

  d3.event.on("drag", function() {
    const transform = `translate(${(x + d3.event.x)},${(y + d3.event.y)})`;
    this.setAttribute("transform", transform);
  });
}

function dragRulerEdge() {
  const ruler = d3.select(this.parentNode);
  const x = d3.event.x, y = d3.event.y;

  d3.select(this).attr("cx", x).attr("cy", y);
  const line = ruler.selectAll("line");
  const left = this.dataset.edge === "left";
  const x0 = left ? +line.attr("x2") : +line.attr("x1");
  const y0 = left ? +line.attr("y2") : +line.attr("y1");
  if (left) line.attr("x1", x).attr("y1", y); else line.attr("x2", x).attr("y2", y);

  const cx = rn((x + x0) / 2, 2), cy = rn((y + y0) / 2, 2);
  const dist = Math.hypot(x0 - x, y0 - y);
  const label = rn(dist * distanceScaleInput.value) + " " + distanceUnitInput.value;
  const atan = x0 > x ? Math.atan2(y0 - y, x0 - x) : Math.atan2(y - y0, x - x0);
  const angle = rn(atan * 180 / Math.PI, 3);
  const rotate = `rotate(${angle} ${cx} ${cy})`;

  const size = rn(1 / scale ** .3 * 2, 1);
  ruler.select("rect").attr("x", cx - size * 1.5).attr("y", cy - size * 1.5).attr("transform", rotate);
  ruler.select("text").attr("x", cx).attr("y", cy).attr("transform", rotate).text(label);
}

function rulerCenterDrag() {
  let xc1, yc1, xc2, yc2, r1, r2;
  const rulerOld = d3.select(this.parentNode); // current ruler
  let x = d3.event.x, y = d3.event.y; // current coords
  const line = rulerOld.selectAll("line"); // current lines
  const x1 = +line.attr("x1"), y1 = +line.attr("y1"), x2 = +line.attr("x2"), y2 = +line.attr("y2"); // initial line edge points
  const size = rn(1 / scale ** .3 * 2, 1);
  const dash = +rulerOld.select(".gray").attr("stroke-dasharray");

  const rulerNew = ruler.insert("g", ":first-child");
  rulerNew.attr("transform", rulerOld.attr("transform")).call(d3.drag().on("start", dragRuler));
  rulerNew.append("line").attr("class", "white").attr("stroke-width", size);
  rulerNew.append("line").attr("class", "gray").attr("stroke-dasharray", dash).attr("stroke-width", size);
  rulerNew.append("text").attr("dx", ".3em").attr("dy", "-.3em").on("click", removeParent).attr("font-size", 10 * size).attr("stroke-width", size);

  d3.event.on("drag", function() {
    x = d3.event.x, y = d3.event.y;

    // change first part
    let dist = rn(Math.hypot(x1 - x, y1 - y));
    let label = rn(dist * distanceScaleInput.value) + " " + distanceUnitInput.value;
    let atan = x1 > x ? Math.atan2(y1 - y, x1 - x) : Math.atan2(y - y1, x - x1);
    xc1 = rn((x + x1) / 2, 2), yc1 = rn((y + y1) / 2, 2);
    r1 = `rotate(${rn(atan * 180 / Math.PI, 3)} ${xc1} ${yc1})`;
    line.attr("x1", x1).attr("y1", y1).attr("x2", x).attr("y2", y);
    rulerOld.select("rect").attr("x", x - size * 1.5).attr("y", y - size * 1.5).attr("transform", null);
    rulerOld.select("text").attr("x", xc1).attr("y", yc1).attr("transform", r1).text(label);

    // change second (new) part
    dist = rn(Math.hypot(x2 - x, y2 - y));
    label = rn(dist * distanceScaleInput.value) + " " + distanceUnitInput.value;
    atan = x2 > x ? Math.atan2(y2 - y, x2 - x) : Math.atan2(y - y2, x - x2);
    xc2 = rn((x + x2) / 2, 2), yc2 = rn((y + y2) / 2, 2);
    r2 = `rotate(${rn(atan * 180 / Math.PI, 3)} ${xc2} ${yc2})`;
    rulerNew.selectAll("line").attr("x1", x).attr("y1", y).attr("x2", x2).attr("y2", y2);
    rulerNew.select("text").attr("x", xc2).attr("y", yc2).attr("transform", r2).text(label);
  });

  d3.event.on("end", function() {
    // contols for 1st part
    rulerOld.select("circle[data-edge='left']").attr("cx", x1).attr("cy", y1);
    rulerOld.select("circle[data-edge='right']").attr("cx", x).attr("cy", y);
    rulerOld.select("rect").attr("x", xc1 - size * 1.5).attr("y", yc1 - size * 1.5).attr("transform", r1);

    // contols for 2nd part
    rulerNew.append("circle").attr("cx", x).attr("cy", y).attr("r", 2 * size).attr("stroke-width", 0.5 * size).attr("data-edge", "left").call(d3.drag().on("drag", dragRulerEdge));
    rulerNew.append("circle").attr("cx", x2).attr("cy", y2).attr("r", 2 * size).attr("stroke-width", 0.5 * size).attr("data-edge", "right").call(d3.drag().on("drag", dragRulerEdge));
    rulerNew.append("rect").attr("x", xc2 - size * 1.5).attr("y", yc2 - size * 1.5).attr("width", size * 3).attr("height", size * 3).attr("transform", r2).attr("stroke-width", .5 * size).call(d3.drag().on("start", rulerCenterDrag));
  });
}

function drawOpisometer() {
  lineGen.curve(d3.curveBasis);
  const size = rn(1 / scale ** .3 * 2, 1);
  const dash = rn(30 / distanceScaleInput.value, 2);
  const p0 = d3.mouse(this);
  const points = [[p0[0], p0[1]]];
  let length = 0;

  const rulerNew = ruler.append("g").attr("class", "opisometer").call(d3.drag().on("start", dragRuler));
  const curve = rulerNew.append("path").attr("class", "white").attr("stroke-width", size);
  const curveGray = rulerNew.append("path").attr("class", "gray").attr("stroke-width", size).attr("stroke-dasharray", dash);
  const text = rulerNew.append("text").attr("dy", "-.3em").attr("font-size", 10 * size).on("click", removeParent);
  const start = rulerNew.append("circle").attr("r", 2 * size).attr("stroke-width", .5 * size).attr("data-edge", "start").call(d3.drag().on("start", dragOpisometerEnd));
  const end = rulerNew.append("circle").attr("r", 2 * size).attr("stroke-width", .5 * size).attr("data-edge", "end").call(d3.drag().on("start", dragOpisometerEnd));

  d3.event.on("drag", function() {
    const p = d3.mouse(this);
    const diff = Math.hypot(last(points)[0] - p[0], last(points)[1] - p[1]);
    if (diff > 3) points.push([p[0], p[1]]); else return;

    const path = round(lineGen(points));
    curve.attr("d", path);
    curveGray.attr("d", path);
    length = curve.node().getTotalLength();
    const label = rn(length * distanceScaleInput.value) + " " + distanceUnitInput.value;
    text.attr("x", p[0]).attr("y", p[1]).text(label);
  });

  d3.event.on("end", function() {
    restoreDefaultEvents();
    clearMainTip();
    addOpisometer.classList.remove("pressed");

    const c = curve.node().getPointAtLength(length / 2);
    const p = curve.node().getPointAtLength(length / 2 - 1);
    const atan = p.x > c.x ? Math.atan2(p.y - c.y, p.x - c.x) : Math.atan2(c.y - p.y, c.x - p.x);
    const angle = rn(atan * 180 / Math.PI, 3);
    const rotate = `rotate(${angle} ${c.x} ${c.y})`;

    rulerNew.attr("data-points", JSON.stringify(points));
    text.attr("x", c.x).attr("y", c.y).attr("transform", rotate);
    start.attr("cx", points[0][0]).attr("cy", points[0][1]);
    end.attr("cx", last(points)[0]).attr("cy", last(points)[1]);
  });
}

function dragOpisometerEnd() {
  const ruler = d3.select(this.parentNode);
  const curve = ruler.select(".white");
  const curveGray = ruler.select(".gray");
  const text = ruler.select("text");

  const points = JSON.parse(ruler.attr("data-points"));
  const x0 = +this.getAttribute("cx"), y0 = +this.getAttribute("cy");
  if (x0 === points[0][0] && y0 === points[0][1]) points.reverse();
  lineGen.curve(d3.curveBasis);
  let length = 0;

  d3.event.on("drag", function() {
    const p = d3.mouse(this);
    d3.select(this).attr("cx", p[0]).attr("cy", p[1]);

    const diff = Math.hypot(last(points)[0] - p[0], last(points)[1] - p[1]);
    if (diff > 3) points.push([p[0], p[1]]); else return;

    const path = round(lineGen(points));
    curve.attr("d", path);
    curveGray.attr("d", path);
    length = curve.node().getTotalLength();
    const label = rn(length * distanceScaleInput.value) + " " + distanceUnitInput.value;
    text.text(label);
  });

  d3.event.on("end", function() {
    const c = curve.node().getPointAtLength(length / 2);
    const p = curve.node().getPointAtLength(length / 2 - 1);
    const atan = p.x > c.x ? Math.atan2(p.y - c.y, p.x - c.x) : Math.atan2(c.y - p.y, c.x - p.x);
    const angle = rn(atan * 180 / Math.PI, 3);
    const rotate = `rotate(${angle} ${c.x} ${c.y})`;

    ruler.attr("data-points", JSON.stringify(points));
    text.attr("x", c.x).attr("y", c.y).attr("transform", rotate);
  });
}

function drawPlanimeter() {
  lineGen.curve(d3.curveBasisClosed);
  const size = rn(1 / scale ** .3 * 2, 1);
  const p0 = d3.mouse(this);
  const points = [[p0[0], p0[1]]];

  const rulerNew = ruler.append("g").attr("class", "planimeter").call(d3.drag().on("start", dragRuler));
  const curve = rulerNew.append("path").attr("class", "planimeter").attr("stroke-width", size);
  const text = rulerNew.append("text").attr("font-size", 10 * size).on("click", removeParent);

  d3.event.on("drag", function() {
    const p = d3.mouse(this);
    const diff = Math.hypot(last(points)[0] - p[0], last(points)[1] - p[1]);
    if (diff > 5) points.push([p[0], p[1]]); else return;
    curve.attr("d", round(lineGen(points)));
  });

  d3.event.on("end", function() {
    restoreDefaultEvents();
    clearMainTip();
    addPlanimeter.classList.remove("pressed");

    const polygonArea = rn(Math.abs(d3.polygonArea(points)));
    const unit = areaUnit.value === "square" ? " " + distanceUnitInput.value + "²" : " " + areaUnit.value;
    const area = si(polygonArea * distanceScaleInput.value ** 2) + " " + unit;
    const c = polylabel([points], 1.0); // pole of inaccessibility
    text.attr("x", c[0]).attr("y", c[1]).text(area);
  });
}

// draw scale bar
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