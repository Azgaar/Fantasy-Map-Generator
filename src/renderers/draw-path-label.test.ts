import { describe, expect, test } from "vitest";
import { getLabelGroupAttributes, getLabelPath, getLabelTextMarkup } from "./draw-label-utils";

const label = {
  id: "stateLabel1",
  text: "North",
  pathPoints: [
    [0, 0],
    [10, 0]
  ] as [number, number][]
};

describe("path label markup", () => {
  test("generates path data shared by rendering and measurement", () => {
    expect(getLabelPath(label)).toBe("M0,0L10,0");
  });

  test("omits letter spacing when it is not set", () => {
    expect(getLabelTextMarkup(label).includes("letter-spacing")).toBe(false);
  });

  test("escapes label text before inserting markup", () => {
    const markup = getLabelTextMarkup({ ...label, text: `North & <tspan onclick="alert(1)">West</tspan>` });

    expect(markup.includes("North &amp; &lt;tspan onclick=&quot;alert(1)&quot;&gt;West&lt;/tspan&gt;")).toBe(true);
    expect(markup.includes("<tspan onclick=")).toBe(false);
  });

  test("does not apply stored identity attributes to a new group", () => {
    expect(getLabelGroupAttributes({ id: "oldGroup", fill: "#123456" })).toEqual([["fill", "#123456"]]);
  });
});
