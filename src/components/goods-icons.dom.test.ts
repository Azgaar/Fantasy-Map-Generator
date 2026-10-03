// Browser-mode test (vitest.browser.config.ts): goods art measured as a browser draws it
import { expect, test } from "vitest";

const files = import.meta.glob<string>("@/assets/icons/goods/*.svg", { query: "?raw", import: "default", eager: true });

test("every goods icon is centred in its frame, as its circle is", () => {
  for (const [path, source] of Object.entries(files)) {
    const host = document.createElement("div");
    host.innerHTML = source;
    document.body.append(host);
    const box = host.querySelector("svg")!.getBBox(); // the drawing in the frame, its scale groups applied
    host.remove();
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    const name = path.split("/").pop();
    expect(Math.abs(x - 50), `${name} horizontal centre`).toBeLessThanOrEqual(4);
    expect(Math.abs(y - 50), `${name} vertical centre`).toBeLessThanOrEqual(4);
  }
});

test.each([0, 1, 2, 4])("goods strokes inherit their colour and width %s while keeping filled details", width => {
  for (const [path, source] of Object.entries(files)) {
    const host = document.createElement("div");
    host.innerHTML = source;
    const svg = host.querySelector("svg")!;
    svg.style.stroke = "#c2410c";
    svg.style.strokeWidth = String(width);
    document.body.append(host);
    try {
      for (const shape of svg.querySelectorAll("path, circle, ellipse, rect, line, polyline, polygon")) {
        const style = getComputedStyle(shape);
        if (style.stroke === "none") continue;
        expect(style.stroke, `${path} stroke colour`).toBe("rgb(194, 65, 12)");
        expect(parseFloat(style.strokeWidth), `${path} stroke width`).toBe(width);
      }
    } finally {
      host.remove();
    }
  }
});
