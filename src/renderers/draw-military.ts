import { color, easeSinInOut, select, transition } from "d3";
import { Icons } from "@/model/icons";
import type { Regiment } from "@/model/political/military-generator";
import { Military } from "@/model/political/military-generator";
import { rn } from "@/utils/number-utils";

/** the icon box inside the square left of a regiment box at x1, y1 of height h */
export const regimentIconBox = (x1: number, y1: number, h: number, icon: string) => {
  const inset = Icons.kind(icon) === "glyph" ? h * 0.1 : 0;
  return { x: rn(x1 - h + inset, 2), y: rn(y1 + inset, 2), size: rn(h - 2 * inset, 2) };
};

export function getRegimentWidth(regiment: Regiment): number {
  const size = styles.military.options.boxSize;
  return regiment.n ? size * 4 : size * 6;
}

export function updateRegimentIcon(use: SVGUseElement, regiment: Regiment): void {
  const size = styles.military.options.boxSize;
  const w = getRegimentWidth(regiment);
  const x = rn(regiment.x - w / 2, 2);
  const y = rn(regiment.y - size, 2);
  const icon = regiment.icon ?? "";
  const box = regimentIconBox(x, y, size * 2, icon);
  use.setAttribute("href", Icons.href(icon));
  for (const [name, value] of Object.entries({ x: box.x, y: box.y, width: box.size, height: box.size }))
    use.setAttribute(name, String(value));
}

export const drawMilitary = (): void => {
  TIME && console.time("drawMilitary");

  select<SVGGElement, unknown>("#armies").selectAll("g").remove();
  // regiment labels size by inheritance from the group, in step with the box
  select<SVGGElement, unknown>("#armies").attr("font-size", styles.military.options.boxSize * 2);
  for (const state of pack.states) {
    if (!state.i || state.removed) continue;
    drawRegimentsRenderer(state.military || [], state.i);
  }

  TIME && console.timeEnd("drawMilitary");
};

const drawRegimentsRenderer = (regiments: Regiment[], s: number): void => {
  const visible = regiments.filter(d => !d.hidden);
  if (!visible.length) return;

  const size = styles.military.options.boxSize;
  const showNames = styles.military.options.showNames;
  const w = (d: Regiment) => getRegimentWidth(d);
  const h = size * 2;
  const x = (d: Regiment) => rn(d.x - w(d) / 2, 2);
  const y = (d: Regiment) => rn(d.y - size, 2);

  const stateColor = pack.states[s]?.color;
  const baseColor = stateColor && stateColor[0] === "#" ? stateColor : "#999";
  const darkerColor = color(baseColor)!.darker().formatHex();
  const army = select<SVGGElement, unknown>("#armies")
    .append("g")
    .attr("id", `army${s}`)
    .attr("fill", baseColor)
    .attr("color", darkerColor);

  const g = army
    .selectAll("g")
    .data(visible)
    .enter()
    .append("g")
    .attr("id", d => `regiment${s}-${d.i}`)
    .attr("data-name", d => d.name)
    .attr("data-state", s)
    .attr("data-id", d => d.i)
    .attr("transform", d => (d.angle ? `rotate(${d.angle})` : null))
    .attr("font-size", size * 2)
    .attr("transform-origin", d => `${d.x}px ${d.y}px`);
  g.append("rect")
    .attr("x", d => x(d))
    .attr("y", d => y(d))
    .attr("width", d => w(d))
    .attr("height", h);
  g.append("text")
    .attr("class", "regimentTotal")
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
  g.append("use")
    .attr("class", "regimentIcon")
    .each(function (d) {
      updateRegimentIcon(this, d);
    });

  if (showNames) {
    g.append("text")
      .attr("class", "regimentName")
      .attr("x", d => rn(d.x - size, 2))
      .attr("y", d => rn(d.y + size * 2.3, 2))
      .attr("font-size", `${rn(size * 1.6, 2)}px`)
      .attr("text-rendering", "optimizeSpeed")
      .text(d => d.name);
  }
};

export const drawRegiment = (reg: Regiment, stateId: number): void => {
  let army = select<SVGGElement, unknown>("#armies").select<SVGGElement>(`g#army${stateId}`);
  if (reg.hidden) {
    if (army.size()) army.select(`g#regiment${stateId}-${reg.i}`).remove();
    return;
  }

  const size = styles.military.options.boxSize;
  const showNames = styles.military.options.showNames;
  const w = getRegimentWidth(reg);
  const h = size * 2;
  const x1 = rn(reg.x - w / 2, 2);
  const y1 = rn(reg.y - size, 2);

  if (!army.size()) {
    const stateColor = pack.states[stateId]?.color;
    const baseColor = stateColor && stateColor[0] === "#" ? stateColor : "#999";
    const darkerColor = color(baseColor)!.darker().formatHex();
    army = select<SVGGElement, unknown>("#armies")
      .append("g")
      .attr("id", `army${stateId}`)
      .attr("fill", baseColor)
      .attr("color", darkerColor);
  }

  army.select(`g#regiment${stateId}-${reg.i}`).remove();

  const g = army
    .append("g")
    .attr("id", `regiment${stateId}-${reg.i}`)
    .attr("data-name", reg.name)
    .attr("data-state", stateId)
    .attr("data-id", reg.i)
    .attr("transform", `rotate(${reg.angle || 0})`)
    .attr("font-size", size * 2)
    .attr("transform-origin", `${reg.x}px ${reg.y}px`);
  g.append("rect").attr("x", x1).attr("y", y1).attr("width", w).attr("height", h);
  g.append("text")
    .attr("class", "regimentTotal")
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
  const use = g.append("use").attr("class", "regimentIcon").node()!;
  updateRegimentIcon(use, reg);

  if (showNames) {
    g.append("text")
      .attr("class", "regimentName")
      .attr("x", rn(reg.x - size, 2))
      .attr("y", rn(reg.y + size * 2.3, 2))
      .attr("font-size", `${rn(size * 1.6, 2)}px`)
      .attr("text-rendering", "optimizeSpeed")
      .text(reg.name);
  }
};

// move one regiment to another
export const moveRegiment = (reg: Regiment, x: number, y: number): void => {
  const el = select<SVGGElement, unknown>("#armies")
    .select(`g#army${reg.state}`)
    .select(`g#regiment${reg.state}-${reg.i}`);
  if (!el.size()) return;

  const duration = Math.hypot(reg.x - x, reg.y - y) * 8;
  reg.x = x;
  reg.y = y;
  const size = styles.military.options.boxSize;
  const w = getRegimentWidth(reg);
  const h = size * 2;
  const x1 = (x: number) => rn(x - w / 2, 2);
  const y1 = (y: number) => rn(y - size, 2);

  const move = transition().duration(duration).ease(easeSinInOut);
  el.select("rect")
    .transition(move as any)
    .attr("x", x1(x))
    .attr("y", y1(y));
  el.select("text.regimentTotal")
    .transition(move as any)
    .attr("x", x)
    .attr("y", y);
  el.selectAll("rect:nth-of-type(2)")
    .transition(move as any)
    .attr("x", x1(x) - h)
    .attr("y", y1(y));
  const box = regimentIconBox(x1(x), y1(y), h, reg.icon);
  el.select(".regimentIcon")
    .transition(move as any)
    .attr("x", box.x)
    .attr("y", box.y);
  el.select("text.regimentName")
    .transition(move as any)
    .attr("x", rn(x - size, 2))
    .attr("y", rn(y + size * 2.3, 2));
};
