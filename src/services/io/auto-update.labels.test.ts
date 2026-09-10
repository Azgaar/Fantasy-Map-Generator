// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Options } from "@/components/options-model";
import "@/generators/added-labels";
import "@/generators/features";
import { Labels } from "@/generators/labels-generator";
import "@/generators/styles";
import * as versioning from "@/services/versioning";
import { resolveVersionConflicts } from "./auto-update";

// a pre-1.140 map: label styling lives on the svg groups, state labels are saved text
const fixture = (states: string, labelsAttrs = "") => /* html */ `<svg id="map"><g id="viewbox">
  <g id="labels" ${labelsAttrs}>
    <g id="burgLabels">
      <g id="towns" fill="#3e3e4b" stroke-width="3.02" font-family="Bitter" data-size="12.9" font-size="9.67"></g>
      <g id="cities" fill="#ff0000" stroke="#8a0000" stroke-width="0.57" data-size="15" font-size="11.25"></g>
    </g>
    <g id="states" data-size="33" font-size="24.75" stroke="#000000" stroke-width="0.81">${states}</g>
  </g>
  <g id="textPaths">
    <path id="textPath_stateLabel1" d="M0,0 L10,0"/>
    <path id="textPath_stateLabel2" d="M0,0 L10,0"/>
  </g>
</g></svg>`;

const label = (id: number, text: string) =>
  `<text id="stateLabel${id}"><textPath href="#textPath_stateLabel${id}">${text}</textPath></text>`;

describe("v1.140 label group migration", () => {
  beforeEach(() => {
    localStorage.clear();
    globalThis.options = Options.getDefaultOptions();
    globalThis.pack = {
      features: [],
      burgs: [],
      states: [
        { i: 0, name: "Neutrals" },
        { i: 1, name: "Liga Schwarzwaldzka", fullName: "Duchy of Ormsbonia" },
        { i: 2, name: "Kept", fullName: "Duchy of Kept" }
      ]
    } as unknown as typeof globalThis.pack;
    // Isolate the label migration from later migrations that need a complete map.
    vi.spyOn(versioning, "compareVersions").mockImplementation((_a, b) => ({
      isOlder: b === "1.140.0",
      isNewer: false,
      isEqual: false
    }));
  });

  afterEach(() => vi.restoreAllMocks());

  it("does not invent a stroke for a label group that never had one", async () => {
    document.body.innerHTML = fixture("");
    await resolveVersionConflicts("1.139.9", []);

    // #towns carried a stroke-width with no stroke, so nothing was ever stroked
    expect(styles.labels.groups.towns.attrs["stroke-width"]).toBe(0);
    expect(styles.labels.groups.cities.attrs.stroke).toBe("#8a0000");
    expect(styles.labels.groups.cities.attrs["stroke-width"]).toBe(0.57);
  });

  it("keeps the stroke width when the stroke is inherited from an ancestor", async () => {
    document.body.innerHTML = fixture("", 'stroke="#123456"');
    await resolveVersionConflicts("1.139.9", []);

    expect(styles.labels.groups.towns.attrs.stroke).toBe("#123456");
    expect(styles.labels.groups.towns.attrs["stroke-width"]).toBe(3.02);
  });

  it("pins a state label whose saved text the renderer would not reproduce", async () => {
    document.body.innerHTML = fixture(label(1, "Liga Schwarzwaldzka") + label(2, "Duchy of Kept"));
    await resolveVersionConflicts("1.139.9", []);

    // auto mode renders fullName, so a label that showed the short name must be pinned
    expect(pack.states[1].label?.text).toBe("Liga Schwarzwaldzka");
    expect(pack.states[2].label?.text).toBeUndefined();
  });

  it("does not pin a short-name label when the map's state label mode is short", async () => {
    options.map.labels.groups = [{ ...Labels.getFallbackGroup("state"), mode: "short" }];
    document.body.innerHTML = fixture(label(1, "Liga Schwarzwaldzka"));
    await resolveVersionConflicts("1.139.9", []);

    expect(pack.states[1].label?.text).toBeUndefined();
  });
});
