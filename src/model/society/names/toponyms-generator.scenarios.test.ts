// Semantic names on real generated maps
import { group } from "d3";
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
import { NameBases } from "./name-bases";
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
  expect(pack.cultures.every(({ base }) => NameBases.find(base))).toBe(true);
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

  it("repeats no burg name and no name of a state or a province", () => {
    for (const list of [living(pack.burgs), [...living(pack.states), ...living(pack.provinces)]]) {
      const all = list.map(({ name }) => name);
      expect(all.length - new Set(all).size).toBe(0);
    }
  });

  it("keeps names within what their base allows", () => {
    for (const { name, meaning } of living(pack.burgs)) {
      if (meaning!.pattern !== "simplex")
        expect(Meanings.fits(name!, NameBases.find(meaning!.origin)!), name).toBe(true);
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
      const base = NameBases.find(meaning!.origin)!;
      const spellings = waters.flatMap(water => [water, capitalize(Appropriation.adapt(water.toLowerCase(), base))]);
      expect(spellings, name).toContain(meaning!.tokens[1].slice(1));
    }
  });

  it("keeps the place a burg is named after: the river, lake or burg its root names", () => {
    const named = living(pack.burgs).filter(({ meaning }) => ["generic-of", "relative"].includes(meaning!.pattern));
    expect(named.length).toBeGreaterThan(0);
    for (const { meaning, name } of named) {
      const { type, id } = meaning!.after!;
      expect(type, name).toMatch(meaning!.pattern === "relative" ? /^burg$/ : /^(river|feature)$/);
      const place = Toponyms.placeOf(type, id)!.name!;
      const root = meaning!.tokens.find(token => token.startsWith("~"))!.slice(1);
      expect([place, Appropriation.adopt(place, NameBases.find(meaning!.origin)!)], name).toContain(root);
    }
  });

  it("names a founder with a personal name of the base's people", () => {
    const founded = living(pack.burgs).filter(burg => burg.meaning!.pattern === "owner-generic");
    expect(founded.length).toBeGreaterThan(0);
    for (const { meaning, name } of founded) {
      const { male, female } = NameBases.find(meaning!.origin)!.people!;
      if (male!.mode === "pick")
        expect([...male!.names, ...female!.names], name).toContain(meaning!.tokens[0].slice(1));
    }
  });

  it("gives a province no burg's name but its own", () => {
    for (const { name, burg } of living(pack.provinces)) {
      const named = living(pack.burgs).find(other => other.name === name);
      if (named) expect(burg, name).toBe(named.i);
    }
  });

  it("names states as lands and islands as islands, not as towns", () => {
    for (const { name, meaning } of living(pack.states)) expect(meaning!.pattern, name).toMatch(/-land$|simplex/);
    for (const { name, meaning, subtype, type } of pack.features.filter(Boolean)) {
      if (type !== "island" || subtype === "continent") continue;
      if (meaning!.tokens[1] !== "island") expect(meaning!.pattern, name).toBe("root-land");
    }
  });

  it("names a state after the river of its capital with no land word where the name is long already", async () => {
    await NameBases.load(["dutch"]);
    const meaning: Meaning = { pattern: "generic-of", tokens: ["city", "~Platvliet"], origin: "dutch" };
    const capital = { ...living(pack.burgs).find(burg => burg.capital)!, meaning };
    const names = Array.from(
      { length: 100 },
      (_, i) => seeded(`river-${i}`, () => Toponyms.state(capital, capital.culture!, { baseId: "dutch" })).name
    );
    expect(names.filter(name => name.startsWith("Platvliet"))).toContain("Platvliet");
    expect(names.filter(name => /^Platvliet./.test(name))).toEqual([]);
  });

  it("gives rivers, lakes, islands and provinces meanings their names are rendered from", () => {
    const lakes = pack.features.filter(feature => feature?.type === "lake");
    const islands = pack.features.filter(feature => feature?.type === "island");
    const provinces = living(pack.provinces);
    expect(pack.rivers.length * lakes.length * islands.length * provinces.length).toBeGreaterThan(0);
    for (const { name, meaning } of [...pack.rivers, ...lakes, ...islands, ...provinces]) {
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
    const adopted = Toponyms.nameIn(burg, other.i, burg.meaning!.origin)?.name ?? burg.name!;
    expect(adopted.toLowerCase()).toBe(Appropriation.adapt(burg.name!.toLowerCase(), NameBases.find(other.base)!));
    expect(Toponyms.nameIn(burg, burg.culture!, burg.meaning!.origin)).toBeUndefined();
  });

  it("gives back the name a thing had, typed or not, and whatever it means", () => {
    const home = living(pack.cultures)[1];
    const away = living(pack.cultures).find(culture => culture.base !== home.base)!;
    const meaning: Meaning = { pattern: "feature", tokens: ["ford"], origin: home.base };
    for (const typed of [{ name: "Qwyxxa" }, { name: "Qwyxxa", meaning }]) {
      expect(Toponyms.nameIn(typed, home.i, home.base)).toBeUndefined();
      const named = Toponyms.nameIn(typed, away.i, home.base)!;
      expect(named.meaning.own).toBe("Qwyxxa");
      const back = Toponyms.nameIn(named, home.i, away.base)!;
      expect(back).toEqual({ name: "Qwyxxa", meaning: typed.meaning ?? Meanings.simplex("Qwyxxa", home.base) });
    }
  });

  it("offers new names for all places of a culture that takes another base, each free", () => {
    const culture = living(pack.cultures).find(({ i, base }) => pack.states.some(s => s.i && s.culture === i && base))!;
    const saidIn = culture.base;
    const other = living(pack.cultures).find(({ base }) => base !== saidIn)!;
    expect(Toponyms.renamings(culture.i, saidIn)).toEqual([]); // the base it has
    culture.base = other.base;
    const renamings = Toponyms.renamings(culture.i, saidIn);
    culture.base = saidIn;
    const types = new Set(renamings.map(({ type }) => type));
    expect([...types]).toEqual(expect.arrayContaining(["burg", "state"]));
    for (const { type, named } of renamings) expect(named.meaning.own, type).toBeTruthy();
    for (const kinds of [["burg"], ["state", "province"], ["river"], ["feature"]]) {
      const all = renamings.filter(({ type }) => kinds.includes(type)).map(({ named }) => named.name);
      expect(all.length).toBe(new Set(all).size);
    }
  });

  it("names some states after their own people, none after the same", () => {
    const roots = living(pack.states).flatMap(({ culture, meaning }) => {
      const [root] = meaning!.tokens;
      return pack.cultures[culture].name.startsWith(root.slice(1)) ? `${culture} ${root}` : [];
    });
    expect(roots.length).toBeGreaterThan(0);
    expect(roots.length).toBe(new Set(roots).size);
  });

  it("generates the same names for the same seed", async () => {
    const before = names();
    await generateMap({ seed: `toponyms-${set}`, points: 5000 });
    expect(names()).toEqual(before);
  });

  it("gives a river another meaning and name on request", () => {
    const river = pack.rivers[0];
    const before = [river.name, river.meaning];
    Rivers.setName(river.i, Toponyms.river(river));
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

  it("reads every meaning of the map back from its notation", () => {
    const named = [
      ...living(pack.burgs),
      ...living(pack.states),
      ...living(pack.provinces),
      ...pack.rivers,
      ...pack.features
    ];
    for (const { meaning } of named as { meaning?: Meaning }[]) {
      if (!meaning) continue;
      const { pattern, tokens, origin } = meaning;
      expect(Meanings.read(Meanings.write(meaning), origin)).toEqual({ pattern, tokens, origin });
    }
  });

  it("names no burg after a name another loses when they are renamed together", () => {
    const burgs = living(pack.burgs).filter(({ i }) => i);
    Burgs.regenerateNames(burgs);
    const names = new Set(burgs.map(({ name }) => `~${name}`));
    expect(names.size).toBe(burgs.length);
    const relative = burgs.filter(({ meaning }) => meaning!.pattern === "relative");
    for (const { meaning } of relative) expect(names).toContain(meaning!.tokens[1]);
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

  it("keep a name respelled by another people respelled in another group", () => {
    const groups = ["town", "village"];
    const inGroup = (burg: Burg) => groups.includes(burg.group!) && burg.meaning!.tokens.includes(burg.group as never);
    let offered = 0;
    for (const burg of living(pack.burgs).filter(inGroup)) {
      const home = pack.cultures[burg.culture!].base;
      const host = living(pack.cultures).find(({ base }) => base !== home)!;
      const there = Toponyms.nameIn(burg, host.i, home);
      if (!there) continue;
      const group = groups.find(name => name !== burg.group)!;
      const named = Toponyms.regrouped({ ...burg, ...there, culture: host.i, group }, burg.group);
      if (!named) continue;
      offered++;
      const { own = named.name } = named.meaning;
      expect(named.meaning.tokens).toContain(group);
      expect(Meanings.render(named.meaning, home), named.name).toBe(own);
      expect(Appropriation.adopt(own, NameBases.find(host.base)!)).toBe(named.name);
    }
    expect(offered).toBeGreaterThan(20);
  });

  it("take no other group's ending where their tongue is not on the map", () => {
    const town = living(pack.burgs).find(({ meaning, group }) => group === "town" && meaning!.tokens.includes("town"))!;
    const meaning = { ...town.meaning!, origin: "dropped" };
    expect(Toponyms.regrouped({ ...town, meaning, group: "village" }, "town")).toBeUndefined();
  });

  it("build on rivers, neighbours and capitals as another base says them", async () => {
    await NameBases.load(["japanese"]);
    const base = NameBases.find("japanese")!;
    const native = (root: string) => Appropriation.adopt(root, base);
    const waters = [...pack.rivers, ...pack.features].flatMap(water => water?.name ?? []);
    const theirs = new Set([...waters, ...living(pack.burgs).map(({ name }) => name!)].map(native));

    const burgs = seeded("borrowed", () => living(pack.burgs).map(burg => Toponyms.burg(burg, { baseId: base.id })));
    const roots = burgs.flatMap(({ meaning: { pattern, tokens } }) =>
      pattern === "generic-of" || pattern === "relative" ? tokens[1].slice(1) : []
    );
    expect(roots.length).toBeGreaterThan(10);
    for (const root of roots) expect(theirs, root).toContain(root);

    const founded = living(pack.states).map(({ capital }) => pack.burgs[capital]);
    const isForeign = (token: string) => token.startsWith("~") && native(token.slice(1)) !== token.slice(1);
    const foreign = founded.flatMap(({ meaning }) => meaning!.tokens.filter(isForeign));
    const states = seeded("borrowed", () =>
      founded.flatMap(capital =>
        Array.from({ length: 12 }, () => Toponyms.state(capital, capital.culture!, { baseId: base.id }))
      )
    );
    for (const { meaning, name } of states) expect(foreign, name).not.toContain(meaning.tokens[0]);
  });

  it("agree in gender and number where they are two words", () => {
    const pairs = inRuthenian().filter(({ meaning, name }) => meaning.pattern === "modifier-generic" && / /.test(name));
    for (const { name } of pairs) {
      const [describing, noun] = name.toLowerCase().split(" ");
      if (noun === "vorota")
        expect(describing, name).toMatch(/ye$/); // gates, a plural
      else if (/a$/.test(noun)) expect(describing, name).toMatch(/ya$/);
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

describe("a place renamed", () => {
  beforeAll(async () => {
    options.generation.cultures.set = "world";
    await generateMap({ seed: "renamed", points: 5000 });
  });

  it("offers its new name to the places named after it, but not to one renamed by hand", () => {
    const byRiver = group(
      living(pack.burgs).filter(({ meaning }) => meaning!.after?.type === "river"),
      ({ meaning }) => meaning!.after!.id
    );
    const [id, [kept, ...others]] = [...byRiver].sort(([, a], [, b]) => b.length - a.length)[0];
    const river = pack.rivers.find(({ i }) => i === id)!;
    const [handmade] = others;
    if (handmade) Burgs.setName(handmade.i, { name: "Handmade", meaning: handmade.meaning });

    const was = river.name!;
    Rivers.setName(river.i, { name: "Zorvath", meaning: { ...river.meaning!, tokens: ["~Zorvath"] } });
    const renamings = Toponyms.renamedAfter({ type: "river", id }, was);
    const ids = renamings.map(({ id }) => id);
    expect(ids).toContain(kept.i);
    if (handmade) expect(ids).not.toContain(handmade.i);
    for (const { named } of renamings) {
      expect(named.meaning.after).toEqual({ type: "river", id });
      expect(named.meaning.tokens.join()).not.toContain(was);
      expect(Meanings.render(named.meaning, named.meaning.origin)).toBe(named.meaning.own ?? named.name);
    }
    expect(Toponyms.renamedAfter({ type: "river", id }, "Zorvath")).toEqual([]); // nothing changed
  });
});
