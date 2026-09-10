// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import "@/generators/styles";
import { setViewportSize } from "@/components/viewport";
import { clearLegend, dragLegendBox, drawLegend, fitLegendBox, hasLegend, redrawLegend } from "./draw-legend";
import { legendPositions } from "./legend-positions";

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
  setViewportSize(800, 600);
  legendPositions.clear();
});

const items = [
  ["state1", "#ff0000", "Alpha"],
  ["state2", "#00ff00", "Beta"]
];

const zones = [["zone1", "#0000ff", "Gamma"]];

const boxOf = (name: string) => document.querySelector(`#legend > g[data-legend="${name}"]`);

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

    const box = boxOf("States")!.querySelector(".legendBox")!;
    expect(box.getAttribute("data-columns")).toBe("4");
    expect(box.getAttribute("fill")).toBe("#123456");
    styles.legend.options.columns = 8;
    styles.legend.box.attrs.fill = "#ffffff";
  });

  it("redraws the box from the store, not from the attrs the drawn box carried", () => {
    drawLegend("States", items);

    const box = boxOf("States")!.querySelector(".legendBox")!;
    box.setAttribute("fill", "#f0e0c0"); // a stale DOM value the store never learned about
    styles.legend.box.attrs.fill = "#abcdef";
    styles.legend.box.attrs["fill-opacity"] = 0.6;
    styles.legend.options.columns = 1;

    redrawLegend();

    const redrawn = boxOf("States")!.querySelector(".legendBox")!;
    expect(redrawn.getAttribute("data-columns")).toBe("1");
    expect(redrawn.getAttribute("fill")).toBe("#abcdef");
    expect(redrawn.getAttribute("fill-opacity")).toBe("0.6");
    expect(boxOf("States")!.querySelector(".legendLabel")?.textContent).toBe("States");
    expect(document.querySelectorAll("#legend text")).toHaveLength(3); // 2 items + the label
    styles.legend.options.columns = 8;
    styles.legend.box.attrs.fill = "#ffffff";
  });

  it("fitLegendBox positions from the store, ignoring the retired data attrs", () => {
    styles.legend.options.x = 50;
    styles.legend.options.y = 50;
    drawLegend("States", items);
    fitLegendBox();

    const transform = boxOf("States")!.getAttribute("transform");
    // viewport 800 * 0.5 - bbox width 60 = 340; 600 * 0.5 - bbox height 40 = 260
    expect(transform).toBe("translate(340,260)");
    styles.legend.options.x = 99;
    styles.legend.options.y = 93;
  });

  it("dragLegendBox stores the dragged position of the dragged box alone", () => {
    drawLegend("States", items);
    const box = boxOf("States")!;
    box.setAttribute("transform", "translate(100,100)");

    dragLegendBox({
      x: 0,
      y: 0,
      sourceEvent: { target: box.querySelector(".legendBox") },
      on: (_type: string, cb: (e: { x: number; y: number }) => void) => cb({ x: 60, y: 20 })
    } as never);

    // (100+60+60)/800*100 = 27.5 ; (100+20+40)/600*100 = 26.67
    expect(legendPositions.get("States")).toEqual({ x: 27.5, y: 26.67, dragged: true });
    expect(styles.legend.options.x).toBe(99); // the anchor stays where the preset put it
  });
});

describe("several legend boxes", () => {
  it("keeps the boxes side by side, each in its own named group", () => {
    drawLegend("States", items);
    drawLegend("Zones", zones);

    expect(hasLegend("States")).toBe(true);
    expect(hasLegend("Zones")).toBe(true);
    expect(document.querySelectorAll("#legend > g[data-legend]")).toHaveLength(2);
    expect(boxOf("Zones")!.querySelector(".legendLabel")?.textContent).toBe("Zones");
  });

  it("stacks a new box on top of the shown one instead of covering it", () => {
    drawLegend("States", items);
    drawLegend("Zones", zones);

    // the states box sits at y 518 (600 * 0.93 - 40), so the zones box's bottom goes 10px above it
    expect(boxOf("States")!.getAttribute("transform")).toBe("translate(732,518)");
    expect(legendPositions.get("Zones")).toEqual({ x: 99, y: 84.67 });
    expect(boxOf("Zones")!.getAttribute("transform")).toBe("translate(732,468)");
  });

  it("places the new box below when the legend is anchored to the top of the canvas", () => {
    // a map whose legend was dragged to the top-left has no room above it or to its left
    styles.legend.options.x = 10;
    styles.legend.options.y = 8;
    drawLegend("States", items);
    drawLegend("Zones", zones);

    // states box bottom sits at 600 * 0.08 = 48, so the zones box goes below it, not on top of it
    expect(legendPositions.get("States")).toEqual({ x: 10, y: 8 });
    expect(legendPositions.get("Zones")).not.toEqual(legendPositions.get("States"));
    expect(legendPositions.get("Zones")).toEqual({ x: 10, y: 16.33 }); // (48 + 10 + 40) / 600
    styles.legend.options.x = 99;
    styles.legend.options.y = 93;
  });

  it("never auto-places a box partly outside the canvas", () => {
    styles.legend.options.x = 2; // right edge at 16px, narrower than the 60px box
    styles.legend.options.y = 8;
    drawLegend("States", items);
    drawLegend("Zones", zones);

    const { x, y } = legendPositions.get("Zones")!;
    expect(800 * (x / 100) - 60).toBeGreaterThanOrEqual(0); // left edge on canvas
    expect(600 * (y / 100) - 40).toBeGreaterThanOrEqual(0); // top edge on canvas
    styles.legend.options.x = 99;
    styles.legend.options.y = 93;
  });

  it("redraws every shown box and leaves the placement alone", () => {
    drawLegend("States", items);
    drawLegend("Zones", zones);
    const placement = structuredClone({ States: legendPositions.get("States"), Zones: legendPositions.get("Zones") });

    redrawLegend();

    expect(document.querySelectorAll("#legend > g[data-legend]")).toHaveLength(2);
    expect({ States: legendPositions.get("States"), Zones: legendPositions.get("Zones") }).toEqual(placement);
  });

  it("clears one box by name and every box when no name is given", () => {
    drawLegend("States", items);
    drawLegend("Zones", zones);

    clearLegend("States");
    expect(hasLegend("States")).toBe(false);
    expect(hasLegend("Zones")).toBe(true);

    clearLegend();
    expect(document.querySelectorAll("#legend > g[data-legend]")).toHaveLength(0);
  });

  it("gives an auto-placed slot back when the box is hidden, but keeps a dragged one", () => {
    drawLegend("States", items);
    drawLegend("Zones", zones);
    expect(legendPositions.get("States")).toEqual({ x: 99, y: 93 });

    clearLegend("States"); // auto-placed: the slot is released so the next box can use it
    expect(legendPositions.get("States")).toBeUndefined();

    // and the freed anchor slot is reused rather than leaving a gap under the remaining box
    drawLegend("States", items);
    expect(legendPositions.get("States")).toEqual({ x: 99, y: 93 });
    const dragged = { x: 40, y: 40, dragged: true } as const;
    legendPositions.set("States", { ...dragged });

    clearLegend("States"); // the user chose this spot, so it survives the box being hidden
    expect(legendPositions.get("States")).toEqual(dragged);
  });

  it("places against the remembered positions, not the transforms left in the dom", () => {
    drawLegend("States", items);
    drawLegend("Zones", zones);

    // a stale layout in the dom, as a style preset re-render would leave behind
    boxOf("States")!.setAttribute("transform", "translate(0,0)");
    boxOf("Zones")!.setAttribute("transform", "translate(0,0)");
    legendPositions.clear();

    redrawLegend();

    // the stack is rebuilt from the anchor, not from the zeroed transforms
    expect(legendPositions.get("States")).toEqual({ x: 99, y: 93 });
    expect(legendPositions.get("Zones")).toEqual({ x: 99, y: 84.67 });
  });

  it("redraws a box with no items as empty, not as one blank row", () => {
    drawLegend("Zones", []); // every zone filtered out
    expect(boxOf("Zones")!.getAttribute("data")).toBe("");

    redrawLegend();

    const swatches = boxOf("Zones")!.querySelectorAll("rect:not(.legendBox)");
    expect(swatches).toHaveLength(0);
    expect(boxOf("Zones")!.textContent).toBe("Zones"); // the title alone, no "undefined" row
  });

  it("adopts the single box of a map saved before the legend could hold several", () => {
    const legend = document.getElementById("legend")!;
    legend.setAttribute("data", "state1,#ff0000,Alpha|state2,#00ff00,Beta");
    legend.setAttribute("transform", "translate(100,100)");
    legend.innerHTML = /* html */ `<rect id="legendBox" /><g><text id="legendLabel">States</text></g>`;

    redrawLegend();

    expect(legend.hasAttribute("data")).toBe(false);
    expect(document.querySelectorAll("#legend > g[data-legend]")).toHaveLength(1);
    expect(boxOf("States")!.getAttribute("data")).toBe("state1,#ff0000,Alpha|state2,#00ff00,Beta");
    expect(boxOf("States")!.querySelector(".legendLabel")?.textContent).toBe("States");
  });
});
