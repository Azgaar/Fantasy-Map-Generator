// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { drawLegend, redrawLegend } from "./draw-legend";

beforeEach(() => {
  document.body.innerHTML = /* html */ `<svg id="map" width="800" height="600">
      <g id="legend" font-size="13" data-x="99" data-y="93"></g>
    </svg>
    <input id="styleLegendColItems" value="8" />
    <input id="styleLegendBack" value="#ffffff" />
    <input id="styleLegendOpacity" value="1" />`;

  // jsdom has no layout engine
  (SVGElement.prototype as unknown as { getBBox: () => object }).getBBox = () => ({
    x: 0,
    y: 0,
    width: 60,
    height: 40
  });
  globalThis.svgWidth = 800;
  globalThis.svgHeight = 600;
});

const items = [
  ["state1", "#ff0000", "Alpha"],
  ["state2", "#00ff00", "Beta"]
];

describe("drawLegend", () => {
  it("takes the styling from the style inputs when the legend is drawn anew", () => {
    drawLegend("States", items);

    const box = document.getElementById("legendBox")!;
    expect(box.getAttribute("data-columns")).toBe("8");
    expect(box.getAttribute("fill")).toBe("#ffffff");
  });

  it("keeps the styling of the drawn legend on redraw, ignoring the style inputs", () => {
    drawLegend("States", items);

    const box = document.getElementById("legendBox")!;
    box.setAttribute("data-columns", "1"); // the user restyles the legend
    box.setAttribute("fill", "#f0e0c0");
    box.setAttribute("fill-opacity", "0.6");

    redrawLegend();

    const redrawn = document.getElementById("legendBox")!;
    expect(redrawn.getAttribute("data-columns")).toBe("1");
    expect(redrawn.getAttribute("fill")).toBe("#f0e0c0");
    expect(redrawn.getAttribute("fill-opacity")).toBe("0.6");
    expect(document.getElementById("legendLabel")?.textContent).toBe("States");
    expect(document.querySelectorAll("#legend text")).toHaveLength(3); // 2 items + the label
  });
});
