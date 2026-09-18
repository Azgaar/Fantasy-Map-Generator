// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { drawZones, zonesFilter } from "./draw-zones";

// neighbours kept inside each zone so getVertexPath finds no border and returns an empty path
const neighbours = [[], [2], [1], [4], [3], [6], [5], [8], [7]];

beforeEach(() => {
  document.body.innerHTML = /* html */ `<svg><g id="zones"></g></svg>`;
  globalThis.pack = {
    cells: { c: neighbours },
    zones: [
      { i: 0, name: "Invasion of Yl", type: "Invasion", color: "#ff0000", cells: [1, 2] },
      { i: 1, name: "Invasion of Ea", type: "Invasion", color: "#ff0000", cells: [3, 4] },
      { i: 2, name: "Rebels", type: "Rebels", color: "#00ff00", cells: [5, 6] },
      { i: 3, name: "Plague", type: "Disease", color: "#0000ff", cells: [7, 8], hidden: true },
      { i: 4, name: "Empty", type: "Flood", color: "#ffff00", cells: [] }
    ]
  } as unknown as typeof globalThis.pack;
  zonesFilter.type = "all";
});

const drawnIds = () => Array.from(document.querySelectorAll("#zones path"), path => path.getAttribute("data-id"));

describe("drawZones", () => {
  it("draws every zone that is neither hidden nor empty", () => {
    drawZones();

    expect(drawnIds()).toEqual(["0", "1", "2"]);
  });

  it("draws only zones of the selected type", () => {
    zonesFilter.type = "Invasion";

    drawZones();

    expect(drawnIds()).toEqual(["0", "1"]);
  });

  // #1810: the paint editor destroys the dialog holding the filter select
  it("keeps filtering while the zones editor dialog is absent", () => {
    zonesFilter.type = "Rebels";
    expect(document.getElementById("zonesFilterType")).toBeNull();

    drawZones();

    expect(drawnIds()).toEqual(["2"]);
  });

  it("still excludes a hidden zone whose type is selected", () => {
    zonesFilter.type = "Disease";

    drawZones();

    expect(drawnIds()).toEqual([]);
  });
});
