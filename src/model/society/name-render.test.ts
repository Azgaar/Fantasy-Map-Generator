import { afterEach, describe, expect, it } from "vitest";
import type { NameBase } from "@/data/name-bases";
import { lexiconOf, parseGrammar, parseRules, parseTemplates } from "@/utils/name-notation";
import { compose, gloss, type Meaning, render, simplex, type Token } from "./name-render";
import { composeBase, Names } from "./names-generator";

afterEach(() => Names.restore());

const meaning = (pattern: Meaning["pattern"], ...tokens: Token[]): Meaning => ({ pattern, tokens, origin: "english" });
const withSalt = (base: Meaning, salt: number): Meaning => ({ ...base, salt });

/** a base nobody wrote a lexicon for: 250 names on four endings */
const custom = (extra: Partial<NameBase> = {}): NameBase => {
  const stems = [..."kmtvsdnbgh"].flatMap(onset =>
    [..."aeiou"].flatMap(vowel => [..."rlnst"].map(coda => onset + vowel + coda))
  );
  const names = stems.map((stem, index) => stem + ["bach", "dorf", "heim", "stadt"][index % 4]);
  return { ...composeBase("custom", "Custom", [4, 12], names, "l"), ...extra };
};

describe("gloss", () => {
  it("reads each pattern in English", () => {
    expect(gloss(meaning("simplex", "~Aitern"))).toBe("Aitern");
    expect(gloss(meaning("feature", "ford"))).toBe("The Ford");
    expect(gloss(meaning("modifier-generic", "new", "town"))).toBe("New Town");
    expect(gloss(meaning("owner-generic", "~Eadric", "farm"))).toBe("Eadric's Farm");
    expect(gloss(meaning("owner-generic", "~Crys", "shore"))).toBe("Crys' Shore");
    expect(gloss(meaning("generic-of", "mouth", "~Exe"))).toBe("Mouth of Exe");
    expect(gloss(meaning("relative", "upper", "~Aitern"))).toBe("Upper Aitern");
    expect(gloss(meaning("root-land", "~Frank", "land"))).toBe("Land of Frank");
    expect(gloss(meaning("modifier-land", "east", "realm"))).toBe("East Realm");
    expect(gloss(simplex("Aitern", "german"))).toBe("Aitern");
  });
});

describe("render", () => {
  it("gives the same name for the same meaning and base, whatever was rendered between", () => {
    const meanings = [meaning("modifier-generic", "black", "ford"), meaning("owner-generic", "~Eadric", "farm")];
    const first = Names.nameBases.map(base => meanings.map(item => render(item, base.id)));
    Names.clearChains();
    render(meaning("feature", "harbour"), "german");
    expect(Names.nameBases.map(base => meanings.map(item => render(item, base.id)))).toEqual(first);
  });

  it("renders every pattern in every shipped base", () => {
    const meanings = [
      meaning("simplex", "~Aitern"),
      meaning("feature", "harbour"),
      meaning("modifier-generic", "new", "town"),
      meaning("owner-generic", "~Eadric", "farm"),
      meaning("generic-of", "mouth", "~Exe"),
      meaning("relative", "upper", "~Aitern"),
      meaning("root-land", "~Frank", "land"),
      meaning("modifier-land", "east", "land")
    ];
    for (const base of Names.nameBases) {
      for (const item of meanings) {
        const name = render(item, base.id);
        expect(name, `${base.id} ${gloss(item)}`).toMatch(/^\p{Lu}/u);
        expect(name).not.toMatch(/[+{}]|ERROR/);
      }
    }
  });

  it("takes the plain English word where a base speaks plain English", () => {
    expect(render(meaning("modifier-generic", "new", "town"), "human-generic")).toMatch(/^New(?!town)\p{Ll}+$/u); // a settlement by its English ending
    expect(render(meaning("owner-generic", "~Eadric", "farm"), "human-generic")).toBe("Eadricfarm");
    expect(render(meaning("feature", "bridge"), "human-generic")).toBe("Bridge");
    expect(render(meaning("modifier-generic", "oak", "wood"), "human-generic")).toBe("Oakwood");
    expect(render(meaning("modifier-generic", "thorn", "mill"), "english")).toBe("Thornmill"); // a rule for words undoes no form
  });

  it("names a land with the forms the base has for it", () => {
    const frank = meaning("root-land", "~Frank", "land");
    const names = (baseId: string) =>
      new Set(Array.from({ length: 40 }, (_, salt) => render(withSalt(frank, salt), baseId)));
    expect(names("german")).toEqual(new Set(["Frankland", "Frankia"]));
    expect(names("korean")).toEqual(new Set(["Prankguk"])); // Korean writes no f
    expect(names("chinese")).toEqual(new Set(["Frank Guo"]));
    expect(names("arabic")).toEqual(new Set(["Franka", "Frankia", "Al Franka", "Al Frankia"]));
    expect(names("elven")).toEqual(new Set(["Frankia"])); // the shared form: a base with no land of its own
  });

  it("applies a base's rules at the join", () => {
    expect(render(meaning("root-land", "~Kyoto", "land"), "japanese")).toBe("Kyoto");
    expect(render(meaning("root-land", "~Kan", "land"), "japanese")).toBe("Kanu");
    const aswan = meaning("root-land", "~Aswan", "land");
    const arabic = Array.from({ length: 40 }, (_, salt) => render(withSalt(aswan, salt), "arabic"));
    expect(arabic).toContain("Alaswana"); // "al" joins a root that starts with a vowel
  });

  it("drops a root's last vowels before a short vowel ending", () => {
    expect(render(meaning("root-land", "~Friede", "land"), "greek")).toMatch(/^Fried(e?ia)$/);
    expect(render(meaning("modifier-generic", "free", "island"), "human-generic")).toBe("Freeisland");
  });
});

describe("a base with no lexicon", () => {
  it("ends its generics with the commonest endings of its corpus and coins the rest from its chain", () => {
    Names.nameBases.push(custom());
    const names = ["city", "town", "village", "hamlet"].map(generic =>
      render(meaning("owner-generic", "~Mel", generic as Token), "custom")
    );
    expect(names).toEqual(["Melbach", "Meldorf", "Melheim", "Melstadt"]); // a settlement is an ending
    expect(render(meaning("owner-generic", "~Mel", "quarry"), "custom")).toMatch(/^Mel ?\p{L}+$/u); // a place may be a word
  });

  it("keeps one form for a concept across names", () => {
    Names.nameBases.push(custom());
    const [town, farm] = ["town", "farm"].map(generic =>
      render(meaning("modifier-generic", "black", generic as Token), "custom")
    );
    const prefix = town.slice(
      0,
      [...town].findIndex((letter, index) => letter !== farm[index])
    );
    expect(prefix.length).toBeGreaterThanOrEqual(2);
    expect(render(meaning("modifier-generic", "white", "town"), "custom")).not.toBe(town);
  });

  it("takes the lexicon and templates of the base it extends", () => {
    Names.nameBases.push(custom({ extends: "chinese" }));
    expect(render({ ...meaning("root-land", "~Mel", "land"), origin: "custom" }, "custom")).toBe("Mel Guo");
  });
});

describe("a name too long for its base", () => {
  it("clips its root at a syllable, then gives up its modifier", () => {
    Names.nameBases.push(custom({ length: [4, 9] }));
    const long = compose(meaning("owner-generic", "~Korbachmelheim", "town"), "custom");
    expect(long).toEqual({ name: "Kordorf", whole: true }); // the root kept as far as the ending leaves room
    expect(render(meaning("simplex", "~Korbachmelheim"), "custom")).toBe("Korbachmelheim"); // a name of its own is left whole

    Names.nameBases.push({ ...custom({ length: [4, 9] }), id: "plain", extends: "human-generic" });
    expect(compose(meaning("modifier-generic", "shepherd", "harbour"), "plain")).toEqual({
      name: "Harbour",
      whole: false
    });
    expect(compose(meaning("modifier-generic", "new", "town"), "plain")).toMatchObject({ whole: true });
  });
});

describe("a base with a grammar", () => {
  const slavic = (): NameBase => ({
    ...custom(),
    id: "slavic",
    grammar: parseGrammar("f: a$ => aya\nn: [oe]$ => oye\npl: [iy]$ => ye\nm: => yi"),
    rules: parseRules(String.raw`(?<=\+ov)\+yi =>  | join
(?<=\+ov)\+aya => +a | join
(?<=\+ov)\+oye => +o | join`),
    lexicon: lexiconOf({
      town: "-ov:5, gorod@last, gorod@word",
      village: "selo@word, _/n@word",
      hill: "gora@word, gor@stem",
      harbour: "pristan/f@word",
      mouth: "ust-@first, ustye@word",
      birch: "berez@stem, berezo@first, berezov*",
      new: "novo@first, nov*",
      upper: "verhniy/m@word, verhnyaya/f@word"
    }),
    patterns: {
      "modifier-generic": { templates: parseTemplates("{modifier}{generic}, {modifier} {generic}") },
      "owner-generic": { templates: parseTemplates("{root}{generic}, {root}ov* {generic}, {root}-{generic}") },
      "generic-of": { templates: parseTemplates("{generic}{root}, {root}{generic}") }
    }
  });
  const names = (item: Meaning) =>
    new Set(Array.from({ length: 40 }, (_, salt) => render({ ...withSalt(item, salt), origin: "slavic" }, "slavic")));

  it("ends a stem or a proper name with a suffix, and nothing else", () => {
    Names.nameBases.push(slavic());
    expect(names(meaning("modifier-generic", "birch", "town"))).toEqual(
      new Set(["Berezov", "Berezogorod", "Berezovyi Gorod"])
    );
    expect(names(meaning("modifier-generic", "new", "town"))).toEqual(new Set(["Novogorod", "Novyi Gorod"])); // no stem, no "Novov"
    // a proper name takes the suffix; the full word stands apart from it, after a dash or as its own word
    expect(names(meaning("owner-generic", "~Ivan", "town"))).toEqual(new Set(["Ivanov", "Ivan-Gorod", "Ivanov Gorod"]));
    expect(names(meaning("modifier-generic", "hill", "town"))).toEqual(new Set(["Gorov"])); // a noun describes no noun
  });

  it("gives a describing word the ending of its noun, said or unsaid, and of a root where there is no noun", () => {
    Names.nameBases.push(slavic());
    expect(names(meaning("modifier-generic", "new", "village"))).toEqual(new Set(["Novoye Selo", "Novoye"]));
    expect(names(meaning("modifier-generic", "new", "harbour"))).toEqual(new Set(["Novaya Pristan"])); // a class it is told
    expect(names(meaning("modifier-generic", "upper", "hill"))).toEqual(new Set(["Verhnyaya Gora"])); // a form per class
    expect(names(meaning("owner-generic", "~Ivan", "hill"))).toEqual(new Set(["Ivanova Gora", "Ivan-Gora"])); // an ending in a template
    expect(names(meaning("owner-generic", "~Ivan", "village"))).toEqual(
      new Set(["Ivanovo Selo", "Ivan-Selo", "Ivanovo"])
    ); // no noun unsaid after a dash
    expect(names(meaning("relative", "new", "~Lipki"))).toEqual(new Set(["Novye Lipki"]));
    expect(names(meaning("relative", "new", "~Gorod"))).toEqual(new Set(["Novyi Gorod"]));
  });

  it("puts a prefix before a root only", () => {
    Names.nameBases.push(slavic());
    expect(names(meaning("generic-of", "mouth", "~Luga"))).toEqual(new Set(["Ust-Luga"]));
  });

  it("makes do where no forms fit, and says the name is not whole", () => {
    Names.nameBases.push(slavic());
    expect(compose({ ...meaning("modifier-generic", "harbour", "town"), origin: "slavic" }, "slavic")).toEqual({
      name: "Pristanov", // a noun for a stem
      whole: false
    });
  });
});

describe("Ruthenian", () => {
  const names = (pattern: Meaning["pattern"], ...tokens: Token[]) =>
    new Set(
      Array.from({ length: 300 }, (_, salt) => render({ pattern, tokens, origin: "ruthenian", salt }, "ruthenian"))
    );
  const common = (all: Set<string>) => [...all][0]; // what the meaning gives unsalted

  it("ends a burg's name in what its group is", () => {
    expect([...names("modifier-generic", "birch", "city")]).toEqual(expect.arrayContaining(["Berezovsk"]));
    expect([...names("modifier-generic", "birch", "town")]).toEqual(expect.arrayContaining(["Berezov"]));
    expect([...names("modifier-generic", "birch", "village")]).toEqual(
      expect.arrayContaining(["Berezovo", "Berezovka", "Berezichi"])
    );
    expect([...names("modifier-generic", "birch", "hamlet")]).toEqual(expect.arrayContaining(["Berezka", "Berezki"]));
    expect([...names("owner-generic", "~Olga", "town")]).toContain("Olgin");
    expect([...names("owner-generic", "~Olga", "village")]).toContain("Olgino");
    expect([...names("generic-of", "city", "~Dvina")]).toContain("Dvinsk");
  });

  it("names a town after a founder with a suffix, seldom with a word of its own", () => {
    const david = names("owner-generic", "~David", "town");
    expect(david).toEqual(
      new Set([
        "Davidov",
        "Davidets",
        "Davidov Gorodok",
        "Davidov Gorod",
        "Davidov Posad",
        "David-Gorodok",
        "David-Gorod",
        "David-Posad"
      ])
    );
    const sample = Array.from({ length: 300 }, (_, salt) =>
      render({ pattern: "owner-generic", tokens: [`~Name${salt}`, "town"], origin: "ruthenian" }, "ruthenian")
    );
    expect(sample.filter(name => /ov$/.test(name)).length).toBeGreaterThan(220);
    expect(sample.filter(name => /Gorodok$/.test(name)).length).toBeLessThan(15);
    expect([...names("owner-generic", "~David", "city")]).toEqual(expect.arrayContaining(["Davidovsk", "David-Gorod"]));
    expect([...names("owner-generic", "~David", "village")]).toEqual(expect.arrayContaining(["Davidovo", "Davidovka"]));
  });

  it("writes two stems as two words that agree", () => {
    expect([...names("modifier-generic", "red", "village")]).toEqual(
      expect.arrayContaining(["Krasnoye", "Krasnoye Selo"])
    );
    expect([...names("modifier-generic", "white", "temple")]).toEqual(
      expect.arrayContaining(["Belyi Hram", "Belaya Tserkov"])
    );
    expect(common(names("owner-generic", "~Olga", "hill"))).toMatch(/^Olgin(a Gor(k)?a|y Gory| Holm)$/);
    expect([...names("generic-of", "ford", "~Dvina")]).toContain("Dvinskiy Brod");
    expect([...names("relative", "little", "~Gorki")]).toContain("Malye Gorki");
    expect(names("generic-of", "mouth", "~Izhora")).toEqual(new Set(["Ust-Izhora", "Izhorskoye Ustye"]));
  });
});
