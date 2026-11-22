// Semantic names on real generated maps
import { beforeAll, describe, expect, it, vi } from "vitest";
import { fitsOf } from "@/data/name-concepts";
import { Goods } from "@/model/economy/goods-generator";
import { Burgs } from "@/model/political/burgs-generator";
import { capitalize } from "@/utils/string-utils";
import { generateMap, living } from "../real-map.testing";
import { adopt } from "./name-adoption";
import { fits, type Meaning, render } from "./name-render";
import { Names } from "./names-generator";

beforeAll(() => vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} }));

const concepts = ({ tokens }: Meaning) => tokens.filter(token => !token.startsWith("~"));
const names = () => ({
  burgs: living(pack.burgs).map(burg => [burg.name, burg.meaning]),
  states: living(pack.states).map(state => [state.name, state.meaning])
});

describe.each(["world", "highFantasy", "oriental"])("names of a %s map", set => {
  beforeAll(async () => {
    options.generation.cultures.set = set;
    await generateMap({ seed: `toponyms-${set}`, points: 5000 });
  });

  it("gives every burg and state a meaning its name is rendered from", () => {
    for (const { name, meaning } of [...living(pack.burgs), ...living(pack.states)]) {
      expect(meaning, name).toBeDefined();
      expect(render(meaning!, meaning!.origin)).toBe(name);
    }
  });

  it("repeats no burg name and no state name", () => {
    for (const list of [living(pack.burgs), living(pack.states)]) {
      const all = list.map(({ name }) => name);
      expect(all.length - new Set(all).size).toBe(0);
    }
  });

  it("keeps names within what their base allows", () => {
    for (const { name, meaning } of living(pack.burgs)) {
      if (meaning!.pattern !== "simplex") expect(fits(name!, Names.find(meaning!.origin)!), name).toBe(true);
    }
  });

  it("uses a concept only where the place has what it asks for", () => {
    const { cells, features, rivers } = pack;
    const isMouth = (cell: number) =>
      Boolean(cells.conf[cell]) || rivers.some(river => river.i === cells.r[cell] && river.mouth === cell);
    const hasDeposit = (cell: number) => [cell, ...cells.c[cell]].some(near => Goods.get(cells.good[near]));

    for (const burg of living(pack.burgs)) {
      for (const concept of concepts(burg.meaning!)) {
        const tags = fitsOf(concept as never) ?? [];
        const only = (tag: string) => tags.length === 1 && tags[0] === tag;
        if (only("port")) expect(Boolean(burg.port && cells.t[burg.cell] === 1), `${burg.name}: ${concept}`).toBe(true);
        if (only("mouth")) expect(isMouth(burg.cell), `${burg.name}: ${concept}`).toBe(true);
        if (only("island"))
          expect(features[cells.f[burg.cell]].subtype, `${burg.name}: ${concept}`).not.toBe("continent");
        if (only("ore")) expect(hasDeposit(burg.cell), `${burg.name}: ${concept}`).toBe(true);
        if (only("stream")) expect(cells.r[burg.cell], `${burg.name}: ${concept}`).toBeGreaterThan(0);
      }
    }
  });

  it("names a burg after the river or lake it stands by, in its own base's spelling", () => {
    const waters = [...pack.rivers.map(river => river.name), ...pack.features.map(feature => feature?.name)].filter(
      Boolean
    );
    const byWater = living(pack.burgs).filter(burg => burg.meaning!.pattern === "generic-of");
    expect(byWater.length).toBeGreaterThan(0);
    for (const { meaning, name } of byWater) {
      const base = Names.find(meaning!.origin)!;
      const spellings = waters.flatMap(water => [water, capitalize(adopt(water.toLowerCase(), base))]);
      expect(spellings, name).toContain(meaning!.tokens[1].slice(1));
    }
  });

  it("names a founder with a personal name of the base's people", () => {
    const founded = living(pack.burgs).filter(burg => burg.meaning!.pattern === "owner-generic");
    expect(founded.length).toBeGreaterThan(0);
    for (const { meaning, name } of founded) {
      const { male, female } = Names.find(meaning!.origin)!.people!;
      if (male!.mode === "pick")
        expect([...male!.names, ...female!.names], name).toContain(meaning!.tokens[0].slice(1));
    }
  });

  it("generates the same names for the same seed", async () => {
    const before = names();
    await generateMap({ seed: `toponyms-${set}`, points: 5000 });
    expect(names()).toEqual(before);
  });

  it("gives a burg another meaning and name on request, its label with it", () => {
    const burg = living(pack.burgs).find(({ capital }) => !capital)!;
    burg.label = { ...burg.label, text: burg.name } as typeof burg.label;
    const before = [burg.name, burg.meaning];
    Burgs.regenerateName(burg.i);
    expect([burg.name, burg.meaning]).not.toEqual(before);
    expect(burg.label!.text).toBe(burg.name);
    expect(render(burg.meaning!, burg.meaning!.origin)).toBe(burg.name);
  });
});

describe("the share of meaningful names", () => {
  const simplexShare = () => {
    const burgs = living(pack.burgs);
    return burgs.filter(burg => burg.meaning!.pattern === "simplex").length / burgs.length;
  };

  it("follows the option, from proper names only to as few as the places allow", async () => {
    options.generation.cultures.set = "european";
    options.generation.names.meaningful = 0;
    await generateMap({ seed: "toponyms-share", points: 4000 });
    expect(simplexShare()).toBe(1);
    expect(living(pack.states).every(state => state.meaning!.pattern === "simplex")).toBe(true);

    options.generation.names.meaningful = 100;
    await generateMap({ seed: "toponyms-share", points: 4000 });
    expect(simplexShare()).toBeLessThan(0.05);
    options.generation.names.meaningful = 65;
  });
});
