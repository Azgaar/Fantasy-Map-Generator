import { afterEach, describe, expect, it } from "vitest";
import type { Meaning, NameBase, Token } from "@/types/names";
import { Meanings } from "./meanings";
import { Names } from "./names-generator";
import { NameNotation } from "./notation";

afterEach(() => Names.restore());

const meaning = (pattern: Meaning["pattern"], ...tokens: Token[]): Meaning => ({ pattern, tokens, origin: "english" });
const withSalt = (base: Meaning, salt: number): Meaning => ({ ...base, salt });

/** a base nobody wrote a lexicon for: 250 names on four endings */
const custom = (extra: Partial<NameBase> = {}): NameBase => {
  const stems = [..."kmtvsdnbgh"].flatMap(onset =>
    [..."aeiou"].flatMap(vowel => [..."rlnst"].map(coda => onset + vowel + coda))
  );
  const names = stems.map((stem, index) => stem + ["bach", "dorf", "heim", "stadt"][index % 4]);
  return { ...Names.composeBase("custom", "Custom", [4, 12], names, "l"), ...extra };
};

describe("gloss", () => {
  it("reads each pattern in English", () => {
    expect(Meanings.gloss(meaning("simplex", "~Aitern"))).toBe("Aitern");
    expect(Meanings.gloss(meaning("feature", "ford"))).toBe("The Ford");
    expect(Meanings.gloss(meaning("modifier-generic", "new", "town"))).toBe("New Town");
    expect(Meanings.gloss(meaning("owner-generic", "~Eadric", "farm"))).toBe("Eadric's Farm");
    expect(Meanings.gloss(meaning("owner-generic", "~Crys", "shore"))).toBe("Crys' Shore");
    expect(Meanings.gloss(meaning("generic-of", "mouth", "~Exe"))).toBe("Mouth of Exe");
    expect(Meanings.gloss(meaning("relative", "upper", "~Aitern"))).toBe("Upper Aitern");
    expect(Meanings.gloss(meaning("compound", "red", "hill", "city"))).toBe("Red Hill City");
    expect(Meanings.gloss(meaning("modifier-generic", "three", "tower"))).toBe("Three Towers");
    expect(Meanings.gloss(meaning("modifier-generic", "seven", "falls"))).toBe("Seven Falls");
    expect(Meanings.gloss(meaning("compound", "five", "hill", "city"))).toBe("Five Hills City");
    expect(Meanings.gloss(meaning("root-land", "~Frank", "land"))).toBe("Land of Frank");
    expect(Meanings.gloss(meaning("modifier-land", "east", "realm"))).toBe("East Realm");
    expect(Meanings.gloss(Meanings.simplex("Aitern", "german"))).toBe("Aitern");
  });
});

describe("render", () => {
  it("gives the same name for the same meaning and base, whatever was rendered between", () => {
    const meanings = [meaning("modifier-generic", "black", "ford"), meaning("owner-generic", "~Eadric", "farm")];
    const first = Names.nameBases.map(base => meanings.map(item => Meanings.render(item, base.id)));
    Names.clearChains();
    Meanings.render(meaning("feature", "harbour"), "german");
    expect(Names.nameBases.map(base => meanings.map(item => Meanings.render(item, base.id)))).toEqual(first);
  });

  it("renders every pattern in every shipped base", () => {
    const meanings = [
      meaning("simplex", "~Aitern"),
      meaning("feature", "harbour"),
      meaning("modifier-generic", "new", "town"),
      meaning("owner-generic", "~Eadric", "farm"),
      meaning("generic-of", "mouth", "~Exe"),
      meaning("compound", "red", "hill", "city"),
      meaning("relative", "upper", "~Aitern"),
      meaning("root-land", "~Frank", "land"),
      meaning("modifier-land", "east", "land")
    ];
    for (const base of Names.nameBases) {
      for (const item of meanings) {
        const name = Meanings.render(item, base.id);
        expect(name, `${base.id} ${Meanings.gloss(item)}`).toMatch(/^\p{Lu}/u);
        expect(name).not.toMatch(/[+{}]|ERROR/);
      }
    }
  });

  it("takes the plain English word where a base speaks plain English", () => {
    expect(Meanings.render(meaning("modifier-generic", "new", "town"), "human-generic")).toMatch(
      /^New(?!town)\p{Ll}+$/u
    ); // a settlement by its English ending
    expect(Meanings.render(meaning("owner-generic", "~Eadric", "farm"), "human-generic")).toBe("Eadricfarm");
    expect(Meanings.render(meaning("feature", "bridge"), "human-generic")).toBe("Bridge");
    expect(Meanings.render(meaning("modifier-generic", "oak", "wood"), "human-generic")).toBe("Oakwood");
    expect(Meanings.render(meaning("modifier-generic", "thorn", "mill"), "english")).toBe("Thornmill"); // a rule for words undoes no form
  });

  it("names a land with the forms the base has for it", () => {
    const frank = meaning("root-land", "~Frank", "land");
    const names = (baseId: string) =>
      new Set(Array.from({ length: 40 }, (_, salt) => Meanings.render(withSalt(frank, salt), baseId)));
    expect(names("german")).toEqual(new Set(["Frankland", "Frankia"]));
    expect(names("korean")).toEqual(new Set(["Prankguk"])); // Korean writes no f
    expect(names("chinese")).toEqual(new Set(["Frank Guo"]));
    expect(names("arabic")).toEqual(new Set(["Franka", "Frankia", "Al Franka", "Al Frankia"]));
    expect(names("elven")).toEqual(new Set(["Frankia"])); // the shared form: a base with no land of its own
  });

  it("applies a base's rules at the join", () => {
    expect(Meanings.render(meaning("root-land", "~Kyoto", "land"), "japanese")).toBe("Kyoto");
    expect(Meanings.render(meaning("root-land", "~Kan", "land"), "japanese")).toBe("Kanu");
    const aswan = meaning("root-land", "~Aswan", "land");
    const arabic = Array.from({ length: 40 }, (_, salt) => Meanings.render(withSalt(aswan, salt), "arabic"));
    expect(arabic).toContain("Alaswana"); // "al" joins a root that starts with a vowel
  });

  it("drops a root's last vowels before a short vowel ending", () => {
    expect(Meanings.render(meaning("root-land", "~Friede", "land"), "greek")).toMatch(/^Fried(e?ia)$/);
    expect(Meanings.render(meaning("modifier-generic", "free", "island"), "human-generic")).toBe("Freeisland");
  });
});

describe("a base with no lexicon", () => {
  it("ends its generics with the commonest endings of its corpus and coins the rest from its chain", () => {
    Names.nameBases.push(custom());
    const names = ["city", "town", "village", "hamlet"].map(generic =>
      Meanings.render(meaning("owner-generic", "~Mel", generic as Token), "custom")
    );
    expect(names).toEqual(["Melbach", "Meldorf", "Melheim", "Melstadt"]); // a settlement is an ending
    expect(Meanings.render(meaning("owner-generic", "~Mel", "quarry"), "custom")).toMatch(/^Mel ?\p{L}+$/u); // a place may be a word
  });

  it("keeps one form for a concept across names", () => {
    Names.nameBases.push(custom());
    const [town, farm] = ["town", "farm"].map(generic =>
      Meanings.render(meaning("modifier-generic", "black", generic as Token), "custom")
    );
    const prefix = town.slice(
      0,
      [...town].findIndex((letter, index) => letter !== farm[index])
    );
    expect(prefix.length).toBeGreaterThanOrEqual(2);
    expect(Meanings.render(meaning("modifier-generic", "white", "town"), "custom")).not.toBe(town);
  });

  it("takes the lexicon and templates of the base it extends", () => {
    Names.nameBases.push(custom({ extends: "chinese" }));
    expect(Meanings.render({ ...meaning("root-land", "~Mel", "land"), origin: "custom" }, "custom")).toBe("Mel Guo");
  });
});

describe("a name too long for its base", () => {
  it("clips its root at a syllable, then gives up its modifier", () => {
    Names.nameBases.push(custom({ length: [4, 9] }));
    const long = Meanings.compose(meaning("owner-generic", "~Korbachmelheim", "town"), "custom");
    expect(long).toEqual({ name: "Kordorf", whole: true }); // the root kept as far as the ending leaves room
    expect(Meanings.render(meaning("simplex", "~Korbachmelheim"), "custom")).toBe("Korbachmelheim"); // a name of its own is left whole

    Names.nameBases.push({ ...custom({ length: [4, 9] }), id: "plain", extends: "human-generic" });
    expect(Meanings.compose(meaning("modifier-generic", "shepherd", "harbour"), "plain")).toEqual({
      name: "Harbour",
      whole: false
    });
    expect(Meanings.compose(meaning("modifier-generic", "new", "town"), "plain")).toMatchObject({ whole: true });
  });
});

describe("a base with a grammar", () => {
  const slavic = (): NameBase => ({
    ...custom(),
    id: "slavic",
    grammar: NameNotation.parseGrammar("f: a$ => aya\nn: [oe]$ => oye\npl: [iy]$ => ye\nm: => yi"),
    rules: NameNotation.parseRules(String.raw`(?<=\+ov)\+yi =>  | join
(?<=\+ov)\+aya => +a | join
(?<=\+ov)\+oye => +o | join`),
    lexicon: NameNotation.parseLexicon({
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
      "modifier-generic": { templates: NameNotation.parseTemplates("{modifier}{generic}, {modifier} {generic}") },
      "owner-generic": {
        templates: NameNotation.parseTemplates("{root}{generic}, {root}ov* {generic}, {root}-{generic}")
      },
      "generic-of": { templates: NameNotation.parseTemplates("{generic}{root}, {root}{generic}") }
    }
  });
  const names = (item: Meaning) =>
    new Set(
      Array.from({ length: 40 }, (_, salt) => Meanings.render({ ...withSalt(item, salt), origin: "slavic" }, "slavic"))
    );

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

  it("puts a noun in the class a counting word calls for, by the base's rules", () => {
    const counting = slavic();
    counting.rules!.push(
      ...NameNotation.parseRules("o$ => a | as few\n(?<=[^aeiou])$ => a | as few\na$ => y | as fewf")
    );
    Object.assign(
      counting.lexicon!,
      NameNotation.parseLexicon({ three: "tri/few@word, tri/fewf@word", two: "dva/few@word, dve/fewf@word" })
    );
    Names.nameBases.push(counting);
    expect(names(meaning("modifier-generic", "three", "village"))).toEqual(new Set(["Tri Sela"]));
    expect(names(meaning("modifier-generic", "two", "hill"))).toEqual(new Set(["Dve Gory"])); // the form its class allows
    expect(names(meaning("modifier-generic", "new", "village"))).toEqual(new Set(["Novoye Selo", "Novoye"])); // no number, no change
  });

  it("makes do where no forms fit, and says the name is not whole", () => {
    Names.nameBases.push(slavic());
    expect(Meanings.compose({ ...meaning("modifier-generic", "harbour", "town"), origin: "slavic" }, "slavic")).toEqual(
      {
        name: "Pristanov", // a noun for a stem
        whole: false
      }
    );
  });
});

describe("Ruthenian", () => {
  const names = (pattern: Meaning["pattern"], ...tokens: Token[]) =>
    new Set(
      Array.from({ length: 300 }, (_, salt) =>
        Meanings.render({ pattern, tokens, origin: "ruthenian", salt }, "ruthenian")
      )
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
      Meanings.render({ pattern: "owner-generic", tokens: [`~Name${salt}`, "town"], origin: "ruthenian" }, "ruthenian")
    );
    expect(sample.filter(name => /ov$/.test(name)).length).toBeGreaterThan(220);
    expect(sample.filter(name => /Gorodok$/.test(name)).length).toBeLessThan(15);
    expect([...names("owner-generic", "~David", "city")]).toEqual(expect.arrayContaining(["Davidovsk", "David-Gorod"]));
    expect([...names("owner-generic", "~David", "village")]).toEqual(expect.arrayContaining(["Davidovo", "Davidovka"]));
  });

  it("builds a name of three parts, a stem between a describing form and a suffix", () => {
    const three = (...tokens: Token[]) => [...names("compound", ...tokens)];
    expect(three("red", "hill", "city")).toEqual(expect.arrayContaining(["Krasnogorsk"]));
    expect(three("white", "lake", "city")).toContain("Belozersk");
    expect(three("iron", "hill", "city")).toContain("Zheleznogorsk");
    expect(three("dragon", "hill", "city")).toContain("Zmeinogorsk");
    expect(three("red", "valley", "city")).toContain("Krasnoyarsk");
    expect(three("white", "hill", "hamlet")).toContain("Belogorka");
  });

  it("counts what stands there: a few take one form, many another, or the number joins the name", () => {
    const of = (pattern: Meaning["pattern"], ...tokens: Token[]) => [...names(pattern, ...tokens)];
    expect(of("modifier-generic", "three", "lake")).toEqual(["Tri Ozera"]);
    expect(of("modifier-generic", "two", "bridge")).toEqual(["Dva Mosta"]);
    expect(of("modifier-generic", "two", "tower")).toEqual(
      expect.arrayContaining(["Dve Vezhi", "Dve Bashni", "Dva Stolpa"])
    );
    expect(of("modifier-generic", "seven", "hill")).toEqual(expect.arrayContaining(["Sem Holmov", "Sem Gor"]));
    expect(of("modifier-generic", "seven", "spring")).toContain("Sem Klyuchey");
    expect(of("modifier-generic", "thousand", "island")).toEqual(["Tysyacha Ostrovov"]);
    expect(of("compound", "five", "hill", "city")).toContain("Pyatigorsk");
    expect(of("compound", "seven", "bend", "hamlet")).toContain("Semiluki");
    expect(of("compound", "three", "hill", "hamlet")).toContain("Trehgorka");
    expect(of("modifier-generic", "great", "meadow")).toContain("Velikiye Luki"); // a plural of its own needs no number
  });

  it("has names of old for the new words", () => {
    const of = (pattern: Meaning["pattern"], ...tokens: Token[]) => [...names(pattern, ...tokens)];
    expect(of("modifier-generic", "beaver", "town")).toContain("Bobrov");
    expect(of("modifier-generic", "lion", "town")).toContain("Lvov");
    expect(of("modifier-generic", "rooster", "city")).toContain("Kursk");
    expect(of("modifier-generic", "brother", "city")).toContain("Bratsk");
    expect(of("modifier-generic", "fish", "city")).toContain("Rybinsk");
    expect(of("modifier-generic", "cross", "hamlet")).toContain("Kresty");
    expect(of("modifier-generic", "peace", "town")).toContain("Mirnyi");
    expect(of("modifier-generic", "peace", "city")).toContain("Mirgorod");
    expect(of("modifier-generic", "bitter", "town")).toContain("Gorkiy");
    expect(of("modifier-generic", "crooked", "horn")).toContain("Krivoy Rog");
    expect(of("modifier-generic", "crone", "valley")).toContain("Babiy Yar");
    expect(of("modifier-generic", "devil", "bridge")).toContain("Chertov Most");
    expect(of("modifier-generic", "white", "temple")).toContain("Belaya Tserkov");
    expect(of("modifier-generic", "king", "village")).toContain("Tsarskoye Selo");
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

describe("English", () => {
  const names = (pattern: Meaning["pattern"], ...tokens: Token[]) => [
    ...new Set(
      Array.from({ length: 300 }, (_, salt) => Meanings.render({ pattern, tokens, origin: "english", salt }, "english"))
    )
  ];

  it("joins a describing word and a place, or sets them apart", () => {
    expect(names("modifier-generic", "winter", "fell")).toEqual(expect.arrayContaining(["Winterfell", "Winter Fell"]));
    expect(names("modifier-generic", "raven", "tree")).toEqual(expect.arrayContaining(["Raventree", "Raven's Tree"]));
    expect(names("modifier-generic", "dragon", "rock")).toContain("Dragonstone");
    expect(names("modifier-generic", "king", "landing")).toContain("King's Landing");
    expect(names("modifier-generic", "crow", "nest")).toContain("Crow's Nest");
    expect(names("modifier-generic", "high", "garden")).toContain("Highgarden");
  });

  it("counts what stands there, in the plural", () => {
    expect(names("modifier-generic", "three", "tower")).toEqual(["Three Towers"]);
    expect(names("modifier-generic", "seven", "falls")).toEqual(expect.arrayContaining(["Seven Falls"]));
    expect(names("modifier-generic", "two", "peak")).toEqual(expect.arrayContaining(["Twin Peaks", "Two Pikes"]));
    expect(names("modifier-generic", "nine", "pass")).toEqual(expect.arrayContaining(["Nine Passes", "Nine Gaps"]));
    expect(names("modifier-generic", "three", "tooth")).toEqual(expect.arrayContaining(["Three Teeth"]));
    expect(names("modifier-generic", "new", "tower")).not.toContain("New Towers");
    expect(names("compound", "five", "hill", "city")).toEqual(["Five Hills"]);
  });

  it("names a place after its lord", () => {
    expect(names("owner-generic", "~Torrhen", "square")).toContain("Torrhen's Square");
    expect(names("owner-generic", "~Clegane", "keep")).toContain("Clegane's Keep");
  });

  it("builds on the lie of the land, with a keep for a fort", () => {
    expect(names("compound", "deep", "wood", "fort")).toEqual(expect.arrayContaining(["Deepwood", "Deepwood Keep"]));
    expect(names("compound", "black", "water", "town")).toContain("Blackwater");
  });
});
