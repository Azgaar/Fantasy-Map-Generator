// Semantic names on real generated maps
import { beforeAll, describe, expect, it, vi } from "vitest";
import { conceptsOf, fitsOf, settlementOf } from "@/data/name-concepts";
import { Goods } from "@/model/economy/goods-generator";
import { Rivers } from "@/model/physical/river-generator";
import { type Burg, Burgs } from "@/model/political/burgs-generator";
import type { Meaning } from "@/types/names";
import { seeded } from "@/utils/probability-utils";
import { capitalize } from "@/utils/string-utils";
import { generateMap, living } from "../../real-map.testing";
import { Appropriation } from "./appropriation";
import { Meanings } from "./meanings";
import { Names } from "./names-generator";
import { Toponyms } from "./toponyms-generator";

beforeAll(() => vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} }));

const concepts = ({ tokens }: Meaning) => tokens.filter(token => !token.startsWith("~"));
const names = () => ({
  burgs: living(pack.burgs).map(burg => [burg.name, burg.meaning]),
  rivers: pack.rivers.map(river => [river.name, river.meaning]),
  lakes: pack.features.filter(feature => feature?.type === "lake").map(lake => [lake.name, lake.meaning]),
  states: living(pack.states).map(state => [state.name, state.meaning])
});

it.each(["english", "random"])("names the cultures of a %s set once their bases are loaded", async set => {
  options.generation.cultures.set = set;
  await generateMap({ seed: `cultures-${set}` });
  const cultures = living(pack.cultures);
  expect(cultures.every(({ name, development }) => name && name !== "ERROR" && development)).toBe(true);
  expect(new Set(cultures.map(({ code }) => code)).size).toBe(cultures.length);
  expect(pack.cultures.every(({ base }) => Names.find(base))).toBe(true);
});

describe.each(["world", "highFantasy", "oriental"])("names of a %s map", set => {
  beforeAll(async () => {
    options.generation.cultures.set = set;
    await generateMap({ seed: `toponyms-${set}`, points: 5000 });
  });

  it("gives every burg and state a meaning its name is rendered from", () => {
    for (const { name, meaning } of [...living(pack.burgs), ...living(pack.states)]) {
      expect(meaning, name).toBeDefined();
      expect(Meanings.render(meaning!, meaning!.origin)).toBe(name);
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
      if (meaning!.pattern !== "simplex") expect(Meanings.fits(name!, Names.find(meaning!.origin)!), name).toBe(true);
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
      const spellings = waters.flatMap(water => [water, capitalize(Appropriation.adapt(water.toLowerCase(), base))]);
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

  it("gives rivers, lakes and provinces meanings their names are rendered from", () => {
    const lakes = pack.features.filter(feature => feature?.type === "lake");
    const provinces = living(pack.provinces);
    expect(pack.rivers.length * lakes.length * provinces.length).toBeGreaterThan(0);
    for (const { name, meaning } of [...pack.rivers, ...lakes, ...provinces]) {
      expect(meaning, name).toBeDefined();
      expect(Meanings.render(meaning!, meaning!.origin)).toBe(name);
    }
    const waters = [...pack.rivers, ...lakes].filter(({ meaning }) => meaning!.pattern !== "simplex");
    expect(waters.length).toBeGreaterThan(0);
    const kinds = ["river", "brook", "water", "run", "lake", "pool", "tarn", "eye"];
    for (const { meaning } of waters) expect(kinds).toContain(meaning!.tokens[1]);
  });

  it("repeats no river name", () => {
    const all = pack.rivers.map(({ name }) => name);
    expect(all.length - new Set(all).size).toBe(0);
  });

  it("says what a name would be in another culture's base, and nothing when it stays", () => {
    const burg = living(pack.burgs).find(({ meaning }) => meaning!.pattern === "modifier-generic")!;
    const other = living(pack.cultures).find(culture => culture.base !== burg.meaning!.origin)!;
    expect(Toponyms.nameIn(burg, other.i, burg.meaning!.origin)).toBe(Meanings.render(burg.meaning!, other.base));
    expect(Toponyms.nameIn(burg, burg.culture!, burg.meaning!.origin)).toBeUndefined();
  });

  it("generates the same names for the same seed", async () => {
    const before = names();
    await generateMap({ seed: `toponyms-${set}`, points: 5000 });
    expect(names()).toEqual(before);
  });

  it("gives a river another meaning and name on request", () => {
    const river = pack.rivers[0];
    const before = [river.name, river.meaning];
    Rivers.regenerateName(river.i);
    expect([river.name, river.meaning]).not.toEqual(before);
    expect(Meanings.render(river.meaning!, river.meaning!.origin)).toBe(river.name);
  });

  it("gives a burg another meaning and name on request, its label with it", () => {
    const burg = living(pack.burgs).find(({ capital }) => !capital)!;
    burg.label = { ...burg.label, text: burg.name } as typeof burg.label;
    const before = [burg.name, burg.meaning];
    Burgs.regenerateName(burg.i);
    expect([burg.name, burg.meaning]).not.toEqual(before);
    expect(burg.label!.text).toBe(burg.name);
    expect(Meanings.render(burg.meaning!, burg.meaning!.origin)).toBe(burg.name);
  });
});

describe("burg names of an authored base", () => {
  beforeAll(async () => {
    options.generation.cultures.set = "european";
    await generateMap({ seed: "toponyms-groups", points: 6000 });
  });

  const settlementOfBurg = (burg: Burg) =>
    burg.capital ? "city" : settlementOf(options.map.burgs.groups.find(({ name }) => name === burg.group));
  // burgs of each group named as Ruthenian would name them: as many as a large culture has, so names stay free
  const inRuthenian = () =>
    seeded("ruthenian", () => {
      const taken = new Set<string | undefined>();
      const burgs = living(pack.burgs);
      const sample = ["city", "town", "village"].flatMap(group =>
        burgs.filter(burg => settlementOfBurg(burg) === group).slice(0, 60)
      );
      return sample.map(burg => {
        const named = Toponyms.burg(burg, { baseId: "ruthenian", taken });
        taken.add(named.name);
        return { ...named, settlement: settlementOfBurg(burg) };
      });
    });

  it("say something, every one", () => {
    const plain = living(pack.burgs).filter(burg => burg.meaning!.pattern === "simplex");
    expect(plain.map(burg => `${burg.name} ${burg.meaning!.origin} ${burg.group} ${burg.capital}`)).toEqual([]);
  });

  it("build some names of three parts around the lie of the land", () => {
    const compounds = living(pack.burgs).filter(burg => burg.meaning!.pattern === "compound");
    for (const { meaning, name } of compounds) {
      expect(meaning!.tokens, name).toHaveLength(3);
      expect(meaning!.tokens[2], name).toBe(settlementOfBurg(pack.burgs.find(burg => burg.name === name)!));
    }
  });

  it("count what stands at a place, in a form that Meanings.fits the number", () => {
    const isNumeral = (token: string) => (conceptsOf("numeral") as string[]).includes(token);
    const counted = living(pack.burgs).filter(burg => isNumeral(burg.meaning!.tokens[0]));
    expect(counted.length).toBeGreaterThan(0);
    for (const { name, meaning } of counted.filter(burg => burg.meaning!.origin === "english"))
      expect(name, Meanings.gloss(meaning!)).toMatch(/^(Tw\p{Ll}+|\p{Lu}\p{Ll}+ \p{Lu}\p{Ll}+s)$/u);
  });

  it("say what a burg would be called in another group", () => {
    // a town named for its river alone, as Dvina, stays as it is
    const town = living(pack.burgs).find(
      burg =>
        burg.group === "town" &&
        burg.meaning!.origin === "ruthenian" &&
        burg.meaning!.tokens.includes("town") &&
        Toponyms.regrouped({ ...burg, group: "village" }, "town")
    )!;
    const village = Toponyms.regrouped({ ...town, group: "village" }, "town")!;
    expect(village.meaning.tokens).toContain("village");
    expect(village.name).not.toBe(town.name);
    expect(Meanings.render(village.meaning, "ruthenian")).toBe(village.name);
    expect(Toponyms.regrouped(town, "town")).toBeUndefined();
  });

  it("agree in gender and number where they are two words", () => {
    const pairs = inRuthenian().filter(({ meaning, name }) => meaning.pattern === "modifier-generic" && / /.test(name));
    for (const { name } of pairs) {
      const [describing, noun] = name.toLowerCase().split(" ");
      if (/a$/.test(noun)) expect(describing, name).toMatch(/ya$/);
      if (/[oe]$/.test(noun)) expect(describing, name).toMatch(/(oye|eye|ye)$/);
    }
  });
});

describe("names that wait for the burgs", () => {
  it("routes and religions are named for burgs that have their names", () => {
    const named = new Set(living(pack.burgs).map(burg => burg.name));
    expect(named.has(undefined)).toBe(false);
    expect(pack.routes.filter(route => route.points.length >= 4 && !route.name)).toEqual([]);
    expect(pack.religions.filter(religion => religion.i && !religion.name)).toEqual([]);
  });
});
