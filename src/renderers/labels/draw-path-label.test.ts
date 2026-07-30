import { describe, expect, test } from "vitest";
import type { Burg } from "@/generators/burgs-generator";
import { resolveLabelGroup } from "@/utils/label-policy";
import { getBurgLabelMarkup } from "./draw-burg-labels";
import { getLabelPath, getLabelTextMarkup } from "./draw-label-utils";
import { readLabelGroupStyle } from "./label-groups";

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

  test("preserves explicit zero letter spacing", () => {
    expect(getLabelTextMarkup({ ...label, letterSpacing: 0 }).includes('letter-spacing="0px"')).toBe(true);
  });

  test("escapes label text before inserting markup", () => {
    const markup = getLabelTextMarkup({ ...label, text: `North & <tspan onclick="alert(1)">West</tspan>` });

    expect(markup.includes("North &amp; &lt;tspan onclick=&quot;alert(1)&quot;&gt;West&lt;/tspan&gt;")).toBe(true);
    expect(markup.includes("<tspan onclick=")).toBe(false);
  });
});

describe("Label Group styles", () => {
  test("reads persisted SVG attributes and drops the derived transform", () => {
    const values = {
      "text-shadow": "white 0px 0px 4px",
      transform: "translate(0em, -0.5em)"
    };
    const group = {
      attributes: [
        { name: "id", value: "town" },
        { name: "class", value: "hidden" },
        { name: "fill", value: "#123456" },
        { name: "data-size", value: "6" },
        { name: "font-size", value: "3" },
        { name: "style", value: "ignored" }
      ],
      style: {
        *[Symbol.iterator]() {
          yield "text-shadow";
          yield "transform";
        },
        getPropertyValue(property: keyof typeof values) {
          return values[property];
        }
      }
    };

    expect(readLabelGroupStyle(group as unknown as Element)).toEqual({
      fill: "#123456",
      "font-size": "6%",
      style: "text-shadow: white 0px 0px 4px"
    });
  });
});

describe("Burg label markup", () => {
  test("uses positioned text without allocating a path", () => {
    const markup = getBurgLabelMarkup({
      i: 7,
      name: "North & West",
      x: 12,
      y: 34,
      label: { dx: 2, dy: -1, fontSize: 125 }
    } as Burg);

    expect(markup.includes('data-label-type="burg"')).toBe(true);
    expect(markup.includes('x="12" y="34"')).toBe(true);
    expect(markup.includes('transform="translate(2, -1)"')).toBe(true);
    expect(markup.includes('font-size="125%"')).toBe(true);
    expect(markup.includes("North &amp; West")).toBe(true);
    expect(markup.includes("textPath")).toBe(false);
    expect(markup.includes("<path")).toBe(false);
  });

  test("supports multiline text without adding tspans to ordinary Burg labels", () => {
    const oneLine = getBurgLabelMarkup({ i: 1, name: "North", x: 12, y: 34 } as Burg);
    const multiline = getBurgLabelMarkup({ i: 1, name: "North|West", x: 12, y: 34 } as Burg);

    expect(oneLine.includes("<tspan")).toBe(false);
    expect(multiline.match(/<tspan/g)).toHaveLength(2);
    expect(multiline.includes('x="12"')).toBe(true);
  });
});

describe("Label Group resolution", () => {
  test("accepts cross-entity groups and falls back by label type", () => {
    const burgGroups = [{ name: "town", order: 0, isDefault: true }];
    const labels = {
      resizeOnZoom: true,
      showAll: false,
      groups: ["states", "town", "added", "shared"].map(name => ({
        name,
        type: name === "town" ? ("burgs" as const) : ("added" as const),
        active: true,
        layerDependency: null,
        zoom: { min: null, max: null },
        mode: "auto" as const
      }))
    };

    expect(resolveLabelGroup("burg", "shared", labels, burgGroups)).toBe("shared");
    expect(resolveLabelGroup("burg", "missing", labels, burgGroups)).toBe("town");
    expect(resolveLabelGroup("state", "missing", labels, burgGroups)).toBe("states");
    expect(resolveLabelGroup("added", "missing", labels, burgGroups)).toBe("added");
  });
});
