// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import "@/generators/styles";
import { dragLegendBox, drawLegend, fitLegendBox, redrawLegend } from "./draw-legend";

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
  it("sizes the legend from the store and stamps the group font-size", () => {
    styles.legend.options.fontSize = 20;
    drawLegend("States", items);
    expect(document.getElementById("legend")!.getAttribute("font-size")).toBe("20");
    styles.legend.options.fontSize = 13;
  });

  it("takes the styling from the store when the legend is drawn anew", () => {
    styles.legend.options.columns = 4;
    styles.legend.box.attrs.fill = "#123456";
    drawLegend("States", items);

    const box = document.getElementById("legendBox")!;
    expect(box.getAttribute("data-columns")).toBe("4");
    expect(box.getAttribute("fill")).toBe("#123456");
    styles.legend.options.columns = 8;
    styles.legend.box.attrs.fill = "#ffffff";
  });

  it("redraws the box from the store, not from the attrs the drawn box carried", () => {
    drawLegend("States", items);

    const box = document.getElementById("legendBox")!;
    box.setAttribute("fill", "#f0e0c0"); // a stale DOM value the store never learned about
    styles.legend.box.attrs.fill = "#abcdef";
    styles.legend.box.attrs["fill-opacity"] = 0.6;
    styles.legend.options.columns = 1;

    redrawLegend();

    const redrawn = document.getElementById("legendBox")!;
    expect(redrawn.getAttribute("data-columns")).toBe("1");
    expect(redrawn.getAttribute("fill")).toBe("#abcdef");
    expect(redrawn.getAttribute("fill-opacity")).toBe("0.6");
    expect(document.getElementById("legendLabel")?.textContent).toBe("States");
    expect(document.querySelectorAll("#legend text")).toHaveLength(3); // 2 items + the label
    styles.legend.options.columns = 8;
    styles.legend.box.attrs.fill = "#ffffff";
  });

  it("fitLegendBox positions from the store, ignoring the retired data attrs", () => {
    styles.legend.options.x = 50;
    styles.legend.options.y = 50;
    drawLegend("States", items);
    fitLegendBox();

    const transform = document.getElementById("legend")!.getAttribute("transform");
    // svgWidth 800 * 0.5 - bbox width 60 = 340; svgHeight 600 * 0.5 - bbox height 40 = 260
    expect(transform).toBe("translate(340,260)");
    styles.legend.options.x = 99;
    styles.legend.options.y = 93;
  });

  it("dragLegendBox stores the dragged position in the store", () => {
    drawLegend("States", items);
    document.getElementById("legend")!.setAttribute("transform", "translate(100,100)");

    dragLegendBox({
      x: 0,
      y: 0,
      on: (_type: string, cb: (e: { x: number; y: number }) => void) => cb({ x: 60, y: 20 })
    } as never);

    // (100+60+60)/800*100 = 27.5 ; (100+20+40)/600*100 = 26.67
    expect(styles.legend.options.x).toBe(27.5);
    expect(styles.legend.options.y).toBe(26.67);
    styles.legend.options.x = 99;
    styles.legend.options.y = 93;
  });
});
