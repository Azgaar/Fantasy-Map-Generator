import { describe, expect, it } from "vitest";
import { parseStateLabelData } from "./draw-state-labels";

function createRenderedLabel({
  text = ["North", "Reach"],
  transform = "translate(12.5, -3)",
  startOffset = "42%",
  fontSize = "125%",
  letterSpacing = "1.5px",
  path = "M0,0C2.5,9.583,5,19.167,10,20C15,20.833,22.5,12.917,30,5"
} = {}) {
  const textPath = {
    textContent: text.join(""),
    getAttribute: (attribute: string) =>
      ({ href: "#textPath_stateLabel1", startOffset, "font-size": fontSize, "letter-spacing": letterSpacing })[
        attribute
      ] ?? null,
    querySelectorAll: () => text.map(textContent => ({ textContent }))
  };
  const pathEl = { getAttribute: (attribute: string) => (attribute === "d" ? path : null) };
  const ownerDocument = { getElementById: (id: string) => (id === "textPath_stateLabel1" ? pathEl : null) };

  return {
    id: "stateLabel1",
    ownerDocument,
    getAttribute: (attribute: string) => (attribute === "transform" ? transform : null),
    querySelector: (selector: string) => (selector === "textPath" ? textPath : null)
  } as unknown as SVGTextElement;
}

describe("parseStateLabelData", () => {
  it("reconstructs label data from rendered SVG", () => {
    expect(parseStateLabelData(createRenderedLabel())).toEqual({
      text: "North|Reach",
      pathPoints: [
        [0, 0],
        [10, 20],
        [30, 5]
      ],
      dx: 12.5,
      dy: -3,
      startOffset: 42,
      fontSize: 125,
      letterSpacing: 1.5
    });
  });

  it("omits default visual overrides", () => {
    const textEl = createRenderedLabel({
      text: ["North"],
      transform: "",
      startOffset: "50%",
      fontSize: "100%",
      letterSpacing: "",
      path: "M10,20h40"
    });

    expect(parseStateLabelData(textEl)).toEqual({
      text: "North",
      pathPoints: [
        [10, 20],
        [50, 20]
      ]
    });
  });
});
