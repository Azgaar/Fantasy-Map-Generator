import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Concept } from "@/data/name-concepts";
import type { Meaning, NameBase, Token } from "@/types/names";
import { Lexicon } from "./lexicon";
import { Meanings } from "./meanings";
import { Names } from "./names-generator";
import { NameNotation } from "./notation";
import { SoundRules } from "./sound-rules";

beforeAll(() => Names.loadAll());
afterEach(() => {
  Names.nameBases = Names.getNameBases();
  Names.clearChains();
});

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
    const first = Names.loaded().map(base => meanings.map(item => Meanings.render(item, base.id)));
    Names.clearChains();
    Meanings.render(meaning("feature", "harbour"), "german");
    expect(Names.loaded().map(base => meanings.map(item => Meanings.render(item, base.id)))).toEqual(first);
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
    for (const base of Names.loaded()) {
      for (const item of meanings) {
        const name = Meanings.render(item, base.id);
        expect(name, `${base.id} ${Meanings.gloss(item)}`).toMatch(/^\p{Lu}/u);
        expect(name).not.toMatch(/[+{}]|ERROR/);
      }
    }
  });

  it("tells English as high fantasy in Human Generic", () => {
    const salted = (item: Meaning) =>
      Array.from({ length: 20 }, (_, salt) => Meanings.render(withSalt(item, salt), "human-generic"));
    expect(Meanings.render(meaning("owner-generic", "~Aldric", "keep"), "human-generic")).toBe("Aldric's Keep");
    expect(Meanings.render(meaning("modifier-generic", "black", "keep"), "human-generic")).toBe("Black Keep");
    expect(Meanings.render(meaning("generic-of", "bridge", "~Blackwater"), "human-generic")).toBe("Blackwater Bridge");
    for (const name of salted(meaning("generic-of", "town", "~Blackwater")))
      expect(name).toMatch(/^Blackwater( \p{Lu}\p{Ll}+)?$/u); // a town on the Blackwater is Blackwater
    for (const name of salted(meaning("modifier-generic", "winter", "rest")))
      expect(name).toMatch(/^Winter(rest|'s Rest)$/);
    for (const name of salted(meaning("compound", "green", "hollow", "village")))
      expect(name).not.toMatch(/(hollow|green)\b.* \1$/i); // no word twice: Greenhollow, not Greenhollow Hollow
    expect(Meanings.render(meaning("modifier-generic", "thorn", "mill"), "english")).toBe("Thornmill"); // a rule for words undoes no form
  });

  it("joins a place word that describes another", () => {
    for (const baseId of ["english", "human-generic"])
      for (let salt = 0; salt < 20; salt++)
        expect(Meanings.render(withSalt(meaning("modifier-generic", "ford", "town"), salt), baseId)).not.toMatch(/ /);
  });

  it("names a land with the forms the base has for it", () => {
    const frank = meaning("root-land", "~Frank", "land");
    const names = (baseId: string) =>
      new Set(Array.from({ length: 40 }, (_, salt) => Meanings.render(withSalt(frank, salt), baseId)));
    expect(names("german")).toEqual(new Set(["Frankland", "Frankien"]));
    expect(names("korean")).toContain("Pralla"); // Korean writes no f and no nk
    expect(names("chinese")).toEqual(new Set(["Fran Yu", "Fran Bang"]));
    expect(names("arabic")).toEqual(new Set(["Frankiyya", "Al Frankiyya", "Bilad Frank"]));
    Names.nameBases.push(custom());
    expect(names("custom")).toEqual(new Set(["Frankia"])); // the shared form: a base with no land of its own
  });

  it("sets a describing word in the number of its noun", () => {
    const names = (baseId: string, modifier: Token, generic: Token) =>
      Array.from({ length: 80 }, (_, salt) =>
        Meanings.render(withSalt({ ...meaning("modifier-generic", modifier, generic), origin: baseId }, salt), baseId)
      );
    for (const name of names("roman", "new", "spring")) expect(name).not.toMatch(/Nova Aquae|Aquae Nova$/);
    for (const name of names("castillian", "great", "cave")) expect(name).not.toMatch(/Cuevas Grande$|Gran Cuevas/);
    for (const name of names("italian", "great", "lake")) expect(name).not.toMatch(/Laghi (?:Grande|Maggiore)$/);
    for (const name of names("french", "upper", "shore"))
      expect(name).not.toMatch(/Haut-(?:Côte|Rive)|(?:Côte|Rive)-Haut$/);
  });

  it("leaves a land unsaid where a template has a suffix for it", () => {
    Names.nameBases.push(custom({ patterns: { "root-land": { templates: [{ parts: "{root}mark" }] } } }));
    expect(Meanings.render(meaning("root-land", "~Frank", "land"), "custom")).toBe("Frankmark");
  });

  it("is not whole where a part repeats the one before", () => {
    Names.nameBases.push(custom({ lexicon: { land: [{ form: "land", position: "last" }] } }));
    const compose = (root: `~${string}`) =>
      Meanings.compose({ ...meaning("root-land", root, "land"), origin: "custom" }, "custom");
    expect(compose("~Harlan")).toEqual({ name: "Harlanland", whole: false });
    expect(compose("~Frank")).toEqual({ name: "Frankland", whole: true });
  });

  it("applies a base's rules at the join", () => {
    const aden = meaning("root-land", "~Adn", "land");
    const arabic = Array.from({ length: 40 }, (_, salt) => Meanings.render(withSalt(aden, salt), "arabic"));
    expect(arabic).toContain("Al Adniyya");
  });

  it("drops a root's last vowels before a short vowel ending", () => {
    expect(Meanings.render(meaning("root-land", "~Friede", "land"), "greek")).toMatch(/^Fried(ia|ike|is|otis)$/);
    const lexicon = {
      free: [{ form: "free", position: "first" as const }],
      island: [{ form: "island", position: "last" as const }]
    };
    Names.nameBases.push(custom({ lexicon }));
    expect(Meanings.render(meaning("modifier-generic", "free", "island"), "custom")).toBe("Freeisland");
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
    expect(Meanings.render({ ...meaning("root-land", "~Mel", "realm"), origin: "custom" }, "custom")).toBe("Mel Guo");
  });
});

describe("a name too long for its base", () => {
  it("clips its root at a syllable, then gives up its modifier", () => {
    Names.nameBases.push(custom({ length: [4, 9] }));
    const long = Meanings.compose(meaning("owner-generic", "~Korbachmelheim", "town"), "custom");
    expect(long).toEqual({ name: "Kordorf", whole: false }); // a stub of the root: generation draws another
    const short = Meanings.compose(meaning("owner-generic", "~Korbame", "town"), "custom");
    expect(short).toEqual({ name: "Korbadorf", whole: true }); // the root kept as far as the ending leaves room
    expect(Meanings.render(meaning("simplex", "~Korbachmelheim"), "custom")).toBe("Korbachmelheim"); // a name of its own is left whole

    Names.nameBases.push({ ...custom({ length: [4, 9] }), id: "plain", extends: "human-generic" });
    const harbour = Meanings.compose(meaning("modifier-generic", "shepherd", "harbour"), "plain");
    expect(harbour).toMatchObject({ whole: false });
    expect(harbour.name).not.toMatch(/sh[ei]p/i);
    expect(Meanings.compose(meaning("modifier-generic", "new", "town"), "plain")).toMatchObject({ whole: true });

    const lexicon = { pine: "msonobari+", town: "+ni" };
    Names.nameBases.push({ ...custom({ length: [4, 9], lexicon: NameNotation.parseLexicon(lexicon) }), id: "ending" });
    const pine = Meanings.compose(meaning("modifier-generic", "pine", "town"), "ending");
    expect(pine).toEqual({ name: "Msonobarini", whole: false }); // the ending alone would be no name
  });
});

describe("a base with a grammar", () => {
  const slavic = (): NameBase => ({
    ...custom(),
    id: "slavic",
    grammar: NameNotation.parseGrammar("f: a$\nn: [oe]$\npl: [iy]$\nm:\n*: f aya, n oye, pl ye, m yi"),
    rules: NameNotation.parseRules(String.raw`(?<=\+ov)\+yi =>  | join
(?<=\+ov)\+aya => +a | join
(?<=\+ov)\+oye => +o | join`),
    lexicon: NameNotation.parseLexicon({
      town: "^ov 5, +gorod, -Gorod",
      village: "Selo, /n",
      hill: "Gora, gor^",
      harbour: "Pristan/f",
      mouth: "ust-+, Ustye",
      birch: "berez^, berezo+, berezov*",
      new: "novo+, nov*",
      upper: "Verhniy/m, Verhnyaya/f"
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
    expect(names(meaning("owner-generic", "~Ivan", "hill"))).toEqual(new Set(["Ivanova Gora"])); // an ending in a template; Gora takes no dash
    expect(names(meaning("owner-generic", "~Ivan", "village"))).toEqual(new Set(["Ivanovo Selo", "Ivanovo"])); // Selo takes no dash
    expect(names(meaning("relative", "new", "~Lipki"))).toEqual(new Set(["Novye Lipki"]));
    expect(names(meaning("relative", "new", "~Gorod"))).toEqual(new Set(["Novyi Gorod"]));
  });

  it("takes a named set of endings as they are spelled", () => {
    const base = slavic();
    Object.assign(base.grammar!, NameNotation.parseGrammar("*soft: f yaya, n eye, pl iye, m iy"));
    Object.assign(base.lexicon!, NameNotation.parseLexicon({ middle: "sredn*soft" }));
    Names.nameBases.push(base);
    expect(names(meaning("modifier-generic", "middle", "hill"))).toEqual(new Set(["Srednyaya Gora"]));
    expect(names(meaning("modifier-generic", "middle", "town"))).toEqual(new Set(["Sredniy Gorod"]));
  });

  it("makes stems and combining forms by the grammar, but none of a kind written for the concept", () => {
    const base = slavic();
    base.grammar!.derive = NameNotation.parseGrammar("stem: [aoe]?$ =>\nfirst: \\*$ => o\nfirst: [aoe]?$ => o")!.derive;
    Object.assign(
      base.lexicon!,
      NameNotation.parseLexicon({ black: "chern* 2", field: "Pole", wolf: "volk^ 3, volch*" })
    );
    Names.nameBases.push(base);
    const derived = (concept: Concept) => Lexicon.derivedForms(base, concept, base.lexicon![concept]!);
    expect(derived("black")).toEqual([{ form: "cherno", position: "first", weight: 2 }]); // a describing word has no stem
    expect(derived("field")).toEqual([{ form: "pol", position: "stem" }]);
    expect(derived("wolf")).toEqual([{ form: "volko", position: "first", weight: 3 }]); // of the stem, not the word
    expect(derived("new")).toEqual([]); // its combining form is written
    expect(derived("birch")).toEqual([]); // both are
    expect(names(meaning("modifier-generic", "black", "town"))).toContain("Chernogorod");
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
      NameNotation.parseLexicon({ three: "Tri/few, Tri/fewf", two: "Dva/few, Dve/fewf" })
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

describe("English, as real names are built", () => {
  const english = () => Names.resolve("english")!;
  const join = (parts: string) => SoundRules.join(parts, english().rules);
  const names = (pattern: Meaning["pattern"], ...tokens: Token[]) =>
    Array.from({ length: 300 }, (_, salt) => Meanings.render({ pattern, tokens, origin: "english", salt }, "english"));

  it("says where a town lies and what stands there the way real names do", () => {
    expect(names("modifier-generic", "new", "town")).toEqual(expect.arrayContaining(["Newton", "Newham", "Newbury"]));
    expect(names("modifier-generic", "south", "town")).toContain("Sutton");
    expect(names("modifier-generic", "heath", "town")).toContain("Morton");
    expect(names("modifier-generic", "ox", "ford")).toContain("Oxford");
  });

  it("keeps two letters where real names double them", () => {
    expect(join("sut+ton")).toBe("sutton");
    expect(join("west+ton")).toBe("weston");
    expect(join("mill+ton")).toBe("milton");
    expect(join("apple+ley")).toBe("appley");
  });

  it("cuts a founder to a syllable before -ing-", () => {
    expect(join("edwin+ing+ton")).toBe("eddington");
    expect(join("harold+ing+ton")).toBe("harrington");
    expect(join("richard+ing+ham")).toBe("rickingham");
    expect(join("leofric+ing+ham")).toBe("leofingham");
    expect(join("roger+ing+strand")).toBe("rogerstrand"); // -ing- only before what real names have it before
  });

  it("drops a founder's last a, and the s after a hiss", () => {
    expect(join("wada+s+by")).toBe("wadby");
    expect(join("offa+ton")).toBe("offton");
    expect(join("alice+s+ton")).toBe("aliceton");
  });

  it("names a town on a long river name as the river, and what stands there in a word of its own", () => {
    const fits = (name: string) => name.split(" ").every(word => word.length <= 12);
    expect(join("blackburn+ton")).toBe("blackburn");
    expect(join("brook+ton")).toBe("brookton"); // a brook is no river's name
    expect(SoundRules.join("fishwater+bridge", english().rules, { fits })).toBe("fishwater bridge");
    expect(SoundRules.join("otter+bridge", english().rules, { fits })).toBe("otterbridge");
  });

  it("names rivers after real ones", () => {
    expect(english().waters?.names).toContain(Names.getWater("english"));
  });
});

describe("Ruthenian", () => {
  const names = (pattern: Meaning["pattern"], ...tokens: Token[]) =>
    new Set(
      Array.from({ length: 300 }, (_, salt) =>
        Meanings.render({ pattern, tokens, origin: "ruthenian", salt }, "ruthenian")
      )
    );

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

  it("names a town after a prince in the old way, and takes other endings where that makes nothing", () => {
    expect([...names("owner-generic", "~Yaroslav", "town")]).toContain("Yaroslavl");
    expect([...names("owner-generic", "~Peremysl", "town")]).toContain("Peremyshl");
    expect([...names("owner-generic", "~Vsevolod", "city")]).toContain("Vsevolozh");
    expect([...names("owner-generic", "~Yaropolk", "city")]).toContain("Yaropolch");
    expect([...names("owner-generic", "~Vladimir", "city")]).toContain("Vladimir");
    expect([...names("owner-generic", "~Nikita", "town")]).toContain("Nikitin");
    expect([...names("owner-generic", "~Pavel", "city")]).toEqual(expect.arrayContaining(["Pavlov", "Pavlovsk"]));
    expect([...names("owner-generic", "~Irina", "village")]).toEqual(expect.arrayContaining(["Irinino", "Irinichi"]));
    expect([...names("owner-generic", "~Rogvolod", "village")].filter(name => /in(o|ka)?$/.test(name))).toEqual([]);
  });

  it("names a burg after its river: the river's name as it is, or with -sk", () => {
    expect([...names("generic-of", "town", "~Dvina")]).toEqual(expect.arrayContaining(["Dvina", "Dvinsk"]));
    expect([...names("generic-of", "city", "~Polota")]).toContain("Polotsk");
    expect([...names("generic-of", "village", "~Kamenka")]).toContain("Kamensk");
    for (const name of names("generic-of", "bridge", "~Dvina")) expect(name).toMatch(/^Dvinsk\p{Ll}+ \p{Lu}/u); // a bridge is said
  });

  it("names a place for what it lies behind, under or between", () => {
    expect([...names("feature", "wood")]).toEqual(expect.arrayContaining(["Zalesye", "Polesye", "Bor"]));
    expect([...names("feature", "hill")]).toEqual(expect.arrayContaining(["Zagorye", "Podgorye", "Gory"]));
    expect([...names("feature", "fork")]).toContain("Mezhdurechye");
    expect([...names("compound", "white", "shore", "village")]).toContain("Beloberezhye");
    expect([...names("compound", "white", "hill", "town")]).toContain("Belogorye");
  });

  it("keeps another burg's name whole, before the describing word or after it", () => {
    const of = [...names("relative", "great", "~Rostov")];
    expect(of).toEqual(expect.arrayContaining(["Velikiy Rostov", "Rostov Velikiy"]));
    for (const name of names("relative", "new", "~Odinokoborovsk")) expect(name).toContain("Odinokoborovsk");
  });

  it("gives a river one word more often than two", () => {
    expect([...names("modifier-generic", "stone", "river")]).toEqual(expect.arrayContaining(["Kamenka", "Kamenitsa"]));
    expect([...names("modifier-generic", "swift", "river")]).toEqual(expect.arrayContaining(["Bystritsa"]));
    expect([...names("modifier-generic", "bear", "fort")]).toContain("Medvedets");
    expect([...names("modifier-generic", "bear", "den")]).toContain("Medvezhye Logovo");
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
    expect(of("modifier-generic", "three", "lake")).toEqual(expect.arrayContaining(["Tri Ozera", "Tri Zaozerya"]));
    expect(of("modifier-generic", "two", "bridge")).toContain("Dva Mosta");
    expect(of("modifier-generic", "two", "tower")).toEqual(
      expect.arrayContaining(["Dve Vezhi", "Dve Bashni", "Dva Stolpa"])
    );
    expect(of("modifier-generic", "seven", "hill")).toEqual(expect.arrayContaining(["Sem Holmov", "Sem Gor"]));
    expect(of("modifier-generic", "seven", "spring")).toContain("Sem Klyuchey");
    expect(of("modifier-generic", "thousand", "island")).toEqual(
      expect.arrayContaining(["Tysyacha Ostrovov", "Tysyacha Ostrovkov"])
    );
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
    expect(of("modifier-generic", "peace", "city")).toContain("Mirgorod");
    expect(of("modifier-generic", "crooked", "horn")).toContain("Krivoy Rog");
    expect(of("modifier-generic", "crone", "valley")).toContain("Babiy Yar");
    expect(of("modifier-generic", "devil", "bridge")).toContain("Chertov Most");
    expect(of("modifier-generic", "white", "temple")).toContain("Belaya Tserkov");
  });

  it("writes two stems as two words that agree", () => {
    expect([...names("modifier-generic", "white", "temple")]).toEqual(
      expect.arrayContaining(["Belyi Hram", "Belaya Tserkov"])
    );
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

  it("joins a describing word and a place, and sets only an owner's word apart", () => {
    expect(names("modifier-generic", "winter", "fell")).toEqual(["Winterfell"]);
    expect(names("modifier-generic", "oak", "bay")).toContain("Oakbay");
    expect(names("modifier-generic", "oak", "bay").filter(name => name.includes(" "))).toEqual([]);
    expect(names("modifier-generic", "red", "wood")).toContain("Redwood");
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

  it("joins a land's ending, and sets isles and a coast apart from a name", () => {
    expect(names("root-land", "~Godwin", "isles")).toContain("Godwin Isles");
    expect(names("root-land", "~Osbert", "coast")).toEqual(expect.arrayContaining(["Osbert Coast", "Osbertshore"]));
    expect(names("modifier-land", "salt", "coast")).toEqual(["Saltshore"]);
    expect(names("modifier-land", "north", "folk")).toContain("Norfolk");
  });
});
