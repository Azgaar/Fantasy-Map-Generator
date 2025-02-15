"use strict";

function drawMilitary() {
  TIME && console.time("drawMilitary");

  armies.selectAll("g").remove();
  pack.states.filter(s => s.i && !s.removed).forEach(s => drawRegiments(s.military, s.i));

  TIME && console.timeEnd("drawMilitary");
}

const drawRegiments = function (regiments, s) {
  const size = +armies.attr("box-size");
  const w = d => (d.n ? size * 4 : size * 6);
  const h = size * 2;
  const x = d => rn(d.x - w(d) / 2, 2);
  const y = d => rn(d.y - size, 2);

  const baseColor = pack.states[s].color[0] === "#" ? pack.states[s].color : "#999";
  const darkerColor = d3.color(baseColor).darker().hex();
  const army = armies
    .append("g")
    .attr("id", "army" + s)
    .attr("fill", baseColor)
    .attr("color", darkerColor);

  const g = army
    .selectAll("g")
    .data(regiments)
    .enter()
    .append("g")
    .attr("id", d => "regiment" + s + "-" + d.i)
    .attr("data-name", d => d.name)
    .attr("data-state", s)
    .attr("data-id", d => d.i)
    .attr("transform", d => (d.angle ? `rotate(${d.angle})` : null))
    .attr("transform-origin", d => `${d.x}px ${d.y}px`);
  g.append("rect")
    .attr("x", d => x(d))
    .attr("y", d => y(d))
    .attr("width", d => w(d))
    .attr("height", h);
  g.append("text")
    .attr("x", d => d.x)
    .attr("y", d => d.y)
    .attr("text-rendering", "optimizeSpeed")
    .text(d => Military.getTotal(d));
  g.append("rect")
    .attr("fill", "currentColor")
    .attr("x", d => x(d) - h)
    .attr("y", d => y(d))
    .attr("width", h)
    .attr("height", h);
  g.append("text")
    .attr("class", "regimentIcon")
    .attr("text-rendering", "optimizeSpeed")
    .attr("x", d => x(d) - size)
    .attr("y", d => d.y)
    .text(d => (d.icon.startsWith("http") ? "" : d.icon));
  g.append("image")
    .attr("class", "regimentImage")
    .attr("x", d => x(d) - h)
    .attr("y", d => y(d))
    .attr("height", h)
    .attr("width", h)
    .attr("href", d => (d.icon.startsWith("http") ? d.icon : ""));
};

const drawRegiment = function (reg, stateId) {
  const size = +armies.attr("box-size");
  const w = reg.n ? size * 4 : size * 6;
  const h = size * 2;
  const x1 = rn(reg.x - w / 2, 2);
  const y1 = rn(reg.y - size, 2);

  let army = armies.select("g#army" + stateId);
  if (!army.size()) {
    const baseColor = pack.states[stateId].color[0] === "#" ? pack.states[stateId].color : "#999";
    const darkerColor = d3.color(baseColor).darker().hex();
    army = armies
      .append("g")
      .attr("id", "army" + stateId)
      .attr("fill", baseColor)
      .attr("color", darkerColor);
  }

  const g = army
    .append("g")
    .attr("id", "regiment" + stateId + "-" + reg.i)
    .attr("data-name", reg.name)
    .attr("data-state", stateId)
    .attr("data-id", reg.i)
    .attr("transform", `rotate(${reg.angle || 0})`)
    .attr("transform-origin", `${reg.x}px ${reg.y}px`);
  g.append("rect").attr("x", x1).attr("y", y1).attr("width", w).attr("height", h);
  g.append("text")
    .attr("x", reg.x)
    .attr("y", reg.y)
    .attr("text-rendering", "optimizeSpeed")
    .text(Military.getTotal(reg));
  g.append("rect")
    .attr("fill", "currentColor")
    .attr("x", x1 - h)
    .attr("y", y1)
    .attr("width", h)
    .attr("height", h);
  g.append("text")
    .attr("class", "regimentIcon")
    .attr("text-rendering", "optimizeSpeed")
    .attr("x", x1 - size)
    .attr("y", reg.y)
    .text(reg.icon.startsWith("http") ? "" : reg.icon);
  g.append("image")
    .attr("class", "regimentImage")
    .attr("x", x1 - h)
    .attr("y", y1)
    .attr("height", h)
    .attr("width", h)
    .attr("href", reg.icon.startsWith("http") ? reg.icon : "");
};

// move one regiment to another
const moveRegiment = function (reg, x, y) {
  const el = armies.select("g#army" + reg.state).select("g#regiment" + reg.state + "-" + reg.i);
  if (!el.size()) return;

  const duration = Math.hypot(reg.x - x, reg.y - y) * 8;
  reg.x = x;
  reg.y = y;
  const size = +armies.attr("box-size");
  const w = reg.n ? size * 4 : size * 6;
  const h = size * 2;
  const x1 = x => rn(x - w / 2, 2);
  const y1 = y => rn(y - size, 2);

  const move = d3.transition().duration(duration).ease(d3.easeSinInOut);
  el.select("rect").transition(move).attr("x", x1(x)).attr("y", y1(y));
  el.select("text").transition(move).attr("x", x).attr("y", y);
  el.selectAll("rect:nth-of-type(2)")
    .transition(move)
    .attr("x", x1(x) - h)
    .attr("y", y1(y));
  el.select(".regimentIcon")
    .transition(move)
    .attr("x", x1(x) - size)
    .attr("y", y)
    .attr("height", "6")
    .attr("width", "6");
  el.select(".regimentImage")
    .transition(move)
    .attr("x", x1(x) - h)
    .attr("y", y1(y))
    .attr("height", "6")
    .attr("width", "6");
};
