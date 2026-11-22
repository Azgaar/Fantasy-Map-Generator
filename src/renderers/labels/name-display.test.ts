import { afterEach, describe, expect, it } from "vitest";
import type { Meaning } from "@/model/society/name-render";
import { render } from "@/model/society/name-render";
import { Catalog } from "@/utils/i18n";
import { getLabelsIndex } from "./label-data";
import { displayIn, displayName, localGloss } from "./name-display";

const newTown: Meaning = { pattern: "modifier-generic", tokens: ["new", "town"], origin: "english" };
const proper: Meaning = { pattern: "simplex", tokens: ["~Aitern"], origin: "english" };
const burg = { name: render(newTown, "english"), meaning: newTown };
const show = (names: string) => {
  options.app.labels.names = names;
};

afterEach(() => show("native"));

describe("displayName", () => {
  it("shows the name itself unless asked otherwise", () => {
    expect(displayName(burg)).toBe(burg.name);
  });

  it("shows what the name means, and a proper name as it is", () => {
    show("gloss");
    expect(displayName(burg)).toBe("New Town");
    expect(displayName({ name: "Aitern", meaning: proper })).toBe("Aitern");
    expect(displayName({ name: "Typed" })).toBe("Typed");
  });

  it("shows the name another base gives the meaning", () => {
    show("ruthenian");
    expect(displayName(burg)).toBe(render(newTown, "ruthenian"));
    expect(displayName(burg)).not.toBe(burg.name);
  });

  it("keeps the name in its own base and for a base that is gone", () => {
    show("english");
    expect(displayName(burg)).toBe(burg.name);
    show("no-such-base");
    expect(displayName(burg)).toBe(burg.name);
  });
});

describe("displayIn", () => {
  it("swaps the name inside a longer text", () => {
    show("gloss");
    expect(displayIn(`Duchy of ${burg.name}`, burg)).toBe("Duchy of New Town");
    expect(displayIn("Somewhere else", burg)).toBe("Somewhere else");
  });
});

describe("localGloss", () => {
  it("reads in English as the stored gloss does", () => {
    expect(Catalog.language).toBe("en");
    expect(localGloss(newTown)).toBe("New Town");
    expect(localGloss({ pattern: "root-land", tokens: ["~Frank", "land"], origin: "english" })).toBe("Land of Frank");
  });
});

describe("labels", () => {
  const river: Meaning = { pattern: "modifier-generic", tokens: ["black", "river"], origin: "english" };

  it("follow the name display option without touching the map", () => {
    globalThis.pack = {
      states: [],
      provinces: [{ i: 0 }, { i: 1, name: burg.name, meaning: newTown, center: 0 }],
      addedLabels: [],
      burgs: [{ i: 0 }, { i: 1, x: 1, y: 1, ...burg }],
      routes: [],
      rivers: [{ i: 1, name: render(river, "english"), meaning: river, type: "River", cells: [0], points: [] }],
      cells: { p: [[0, 0]] }
    } as unknown as typeof pack;

    show("gloss");
    const texts = Object.fromEntries(getLabelsIndex().map(({ type, text }) => [type, text]));
    expect(texts).toEqual({ burg: "New Town", province: "New Town", river: "Black River" });
    expect(pack.burgs[1].name).toBe(burg.name);
  });

  it("name a land under its form by the root alone", () => {
    const meaning: Meaning = { pattern: "root-land", tokens: ["~Aric", "land"], origin: "english" };
    const name = render(meaning, "english");
    const state = { i: 1, name, meaning, formName: "Duchy", fullName: `Duchy of ${name}`, cells: 1, center: 0 };
    globalThis.pack = {
      states: [{ i: 0 }, { ...state, label: { pathPoints: [] } }],
      provinces: [],
      addedLabels: [],
      burgs: [],
      routes: [],
      rivers: [],
      cells: { p: [[0, 0]] }
    } as unknown as typeof pack;

    show("gloss");
    expect(getLabelsIndex()[0].text).toBe("Duchy of Aric");
    options.map.labels.groups = [{ ...options.map.labels.groups[0], name: "state", mode: "short" }];
    expect(getLabelsIndex()[0].text).toBe("Land of Aric");
  });
});
