import { color, easeSinInOut, transition } from "d3";
import { rn } from "../utils";

interface Regiment {
  i: number;
  name: string;
  x: number;
  y: number;
  n?: number;
  angle?: number;
  icon: string;
  state: number;
}

declare global {
  var drawMilitary: () => void;
  var drawRegiments: (regiments: Regiment[], stateId: number) => void;
  var drawRegiment: (reg: Regiment, stateId: number) => void;
  var moveRegiment: (reg: Regiment, x: number, y: number) => void;
  var armies: import("d3").Selection<SVGGElement, unknown, null, undefined>;
  var Military: { getTotal: (reg: Regiment) => number };
}

const militaryRenderer = (): void => {
  TIME && console.time("drawMilitary");

  armies.selectAll("g").remove();
  pack.states
    .filter((s) => s.i && !s.removed)
    .forEach((s) => {
      drawRegiments(s.military || [], s.i);
    });

  TIME && console.timeEnd("drawMilitary");
};

const drawRegimentsRenderer = (regiments: Regiment[], s: number): void => {
  const size = +armies.attr("box-size");
  const w = (d: Regiment) => (d.n ? size * 4 : size * 6);
  const h = size * 2;
  const x = (d: Regiment) => rn(d.x - w(d) / 2, 2);
  const y = (d: Regiment) => rn(d.y - size, 2);

  const stateColor = pack.states[s]?.color;
  const baseColor = stateColor && stateColor[0] === "#" ? stateColor : "#999";
  const darkerColor = color(baseColor)!.darker().formatHex();
  const army = armies
    .append("g")
    .attr("id", `army${s}`)
    .attr("fill", baseColor)
    .attr("color", darkerColor);

  const g = army
    .selectAll("g")
    .data(regiments)
    .enter()
    .append("g")
    .attr("id", (d) => `regiment${s}-${d.i}`)
    .attr("data-name", (d) => d.name)
    .attr("data-state", s)
    .attr("data-id", (d) => d.i)
    .attr("transform", (d) => (d.angle ? `rotate(${d.angle})` : null))
    .attr("transform-origin", (d) => `${d.x}px ${d.y}px`);
  g.append("rect")
    .attr("x", (d) => x(d))
    .attr("y", (d) => y(d))
    .attr("width", (d) => w(d))
    .attr("height", h);
  g.append("text")
    .attr("x", (d) => d.x)
    .attr("y", (d) => d.y)
    .attr("text-rendering", "optimizeSpeed")
    .text((d) => Military.getTotal(d));
  g.append("rect")
    .attr("fill", "currentColor")
    .attr("x", (d) => x(d) - h)
    .attr("y", (d) => y(d))
    .attr("width", h)
    .attr("height", h);
  g.append("text")
    .attr("class", "regimentIcon")
    .attr("text-rendering", "optimizeSpeed")
    .attr("x", (d) => x(d) - size)
    .attr("y", (d) => d.y)
    .text((d) =>
      d.icon.startsWith("http") || d.icon.startsWith("data:image")
        ? ""
        : d.icon,
    );
  g.append("image")
    .attr("class", "regimentImage")
    .attr("x", (d) => x(d) - h)
    .attr("y", (d) => y(d))
    .attr("height", h)
    .attr("width", h)
    .attr("href", (d) =>
      d.icon.startsWith("http") || d.icon.startsWith("data:image")
        ? d.icon
        : "",
    );
};

const drawRegimentRenderer = (reg: Regiment, stateId: number): void => {
  const size = +armies.attr("box-size");
  const w = reg.n ? size * 4 : size * 6;
  const h = size * 2;
  const x1 = rn(reg.x - w / 2, 2);
  const y1 = rn(reg.y - size, 2);

  let army = armies.select<SVGGElement>(`g#army${stateId}`);
  if (!army.size()) {
    const stateColor = pack.states[stateId]?.color;
    const baseColor = stateColor && stateColor[0] === "#" ? stateColor : "#999";
    const darkerColor = color(baseColor)!.darker().formatHex();
    army = armies
      .append("g")
      .attr("id", `army${stateId}`)
      .attr("fill", baseColor)
      .attr("color", darkerColor);
  }

  const g = army
    .append("g")
    .attr("id", `regiment${stateId}-${reg.i}`)
    .attr("data-name", reg.name)
    .attr("data-state", stateId)
    .attr("data-id", reg.i)
    .attr("transform", `rotate(${reg.angle || 0})`)
    .attr("transform-origin", `${reg.x}px ${reg.y}px`);
  g.append("rect")
    .attr("x", x1)
    .attr("y", y1)
    .attr("width", w)
    .attr("height", h);
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
    .text(
      reg.icon.startsWith("http") || reg.icon.startsWith("data:image")
        ? ""
        : reg.icon,
    );
  g.append("image")
    .attr("class", "regimentImage")
    .attr("x", x1 - h)
    .attr("y", y1)
    .attr("height", h)
    .attr("width", h)
    .attr(
      "href",
      reg.icon.startsWith("http") || reg.icon.startsWith("data:image")
        ? reg.icon
        : "",
    );
};

// move one regiment to another
const moveRegimentRenderer = (reg: Regiment, x: number, y: number): void => {
  const el = armies
    .select(`g#army${reg.state}`)
    .select(`g#regiment${reg.state}-${reg.i}`);
  if (!el.size()) return;

  const duration = Math.hypot(reg.x - x, reg.y - y) * 8;
  reg.x = x;
  reg.y = y;
  const size = +armies.attr("box-size");
  const w = reg.n ? size * 4 : size * 6;
  const h = size * 2;
  const x1 = (x: number) => rn(x - w / 2, 2);
  const y1 = (y: number) => rn(y - size, 2);

  const move = transition().duration(duration).ease(easeSinInOut);
  el.select("rect")
    .transition(move as any)
    .attr("x", x1(x))
    .attr("y", y1(y));
  el.select("text")
    .transition(move as any)
    .attr("x", x)
    .attr("y", y);
  el.selectAll("rect:nth-of-type(2)")
    .transition(move as any)
    .attr("x", x1(x) - h)
    .attr("y", y1(y));
  el.select(".regimentIcon")
    .transition(move as any)
    .attr("x", x1(x) - size)
    .attr("y", y)
    .attr("height", "6")
    .attr("width", "6");
  el.select(".regimentImage")
    .transition(move as any)
    .attr("x", x1(x) - h)
    .attr("y", y1(y))
    .attr("height", "6")
    .attr("width", "6");
};

window.drawMilitary = militaryRenderer;
window.drawRegiments = drawRegimentsRenderer;
window.drawRegiment = drawRegimentRenderer;
window.moveRegiment = moveRegimentRenderer;
