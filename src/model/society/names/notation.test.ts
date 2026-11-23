import { expect, it } from "vitest";
import { NameNotation } from "./notation";

it("reads and writes the forms of a concept", () => {
  const text = "-gorod~grad 4, kings- 3, King, ton";
  const formants = NameNotation.parseFormants(text);
  expect(formants).toEqual([
    { form: "gorod", weight: 4, position: "last", short: "grad" },
    { form: "kings", weight: 3, position: "first" },
    { form: "king", position: "word" },
    { form: "ton" }
  ]);
  expect(NameNotation.formatFormants(formants)).toBe(text);
  expect(NameNotation.parseFormants("ton, , two words, ton 1.5, -bad-, Bad-, =Bad, bad@place")).toEqual([
    { form: "ton" }
  ]);
});

it("reads and writes a lexicon, a concept a line", () => {
  const text = "# settlements\ntown: -ton\n\nland: -ia 6, land 4";
  const lexicon = NameNotation.parseLexicon(text);
  expect(lexicon).toEqual({
    town: [{ form: "ton", position: "last" }],
    land: [
      { form: "ia", weight: 6, position: "last" },
      { form: "land", weight: 4 }
    ]
  });
  expect(NameNotation.formatLexicon(lexicon)).toBe("town: -ton\nland: -ia 6, land 4");
  expect(NameNotation.parseLexicon({ town: "-ton" })).toEqual({ town: [{ form: "ton", position: "last" }] });
});

it("reads and writes templates", () => {
  const text = "{root}ov 4, {modifier} {root}, al {root}{generic} 2";
  const templates = NameNotation.parseTemplates(text);
  expect(templates).toEqual([
    { parts: "{root}ov", weight: 4 },
    { parts: "{modifier} {root}" },
    { parts: "al {root}{generic}", weight: 2 }
  ]);
  expect(NameNotation.formatTemplates(templates)).toBe(text);
});

it("reads and writes rules, a rule a line", () => {
  const text = [
    "(.)\\1+ => $1",
    "([aeiou])\\+u$ => $1 | join",
    "gorod$ => grad | long",
    "th => f | foreign",
    "o\\+(?=[^aeiou]) => + | 30%",
    "x => "
  ].join("\n");
  const rules = NameNotation.parseRules(text);
  expect(rules).toEqual([
    { match: "(.)\\1+", replace: "$1" },
    { match: "([aeiou])\\+u$", replace: "$1", at: "join" },
    { match: "gorod$", replace: "grad", when: "long" },
    { match: "th", replace: "f", when: "foreign" },
    { match: "o\\+(?=[^aeiou])", replace: "+", chance: 0.3 },
    { match: "x", replace: "" }
  ]);
  expect(NameNotation.formatRules(rules)).toBe(text);
  expect(NameNotation.parseRules("no arrow here\n\n=> nothing")).toEqual([]);
});

it("reads and writes suffixes, stems, agreeing words and noun classes", () => {
  const text = "=sk 6, berez=, nov*, verhn*soft, Pristan/f, Verhnyaya/f, _/n 2, ust--, -Gorodok 2";
  const formants = NameNotation.parseFormants(text);
  expect(formants).toEqual([
    { form: "-sk", weight: 6 },
    { form: "berez", position: "stem" },
    { form: "nov*" },
    { form: "verhn*soft" },
    { form: "pristan", class: "f", position: "word" },
    { form: "verhnyaya", class: "f", position: "word" },
    { form: "_", class: "n", position: "word", weight: 2 },
    { form: "ust-", position: "first" },
    { form: "gorodok", weight: 2, position: "word", hyphen: true }
  ]);
  expect(NameNotation.formatFormants(formants)).toBe(text);
});

it("reads and writes a grammar: noun classes, sets of endings and the rules that make forms", () => {
  const text = [
    "f: a$\nn: [oe]$\nm:",
    "*: f aya, n oye, m yi\n*soft: f yaya, n eye, m iy",
    "stem: (?:ye|[aoe])$ =>\nfirst: [aoe]?$ => o"
  ].join("\n\n");
  const grammar = NameNotation.parseGrammar(text);
  expect(grammar).toEqual({
    classes: { f: "a$", n: "[oe]$", m: "" },
    endings: { "": { f: "aya", n: "oye", m: "yi" }, soft: { f: "yaya", n: "eye", m: "iy" } },
    derive: {
      stem: [{ match: "(?:ye|[aoe])$", replace: "" }],
      first: [{ match: "[aoe]?$", replace: "o" }]
    }
  });
  expect(NameNotation.formatGrammar(grammar)).toBe(text);
  expect(NameNotation.parseGrammar("common: [^s]$\nplural: s$")).toEqual({
    classes: { common: "[^s]$", plural: "s$" }
  });
  expect(NameNotation.parseGrammar("no classes here")).toBeUndefined();
});

it("reads and writes a rule that makes a noun of a class", () => {
  const text = "(?<=[sxz])$ => es | as pl\n$ => s | as pl\na$ =>  | as many";
  const rules = NameNotation.parseRules(text);
  expect(rules).toEqual([
    { match: "(?<=[sxz])$", replace: "es", as: "pl" },
    { match: "$", replace: "s", as: "pl" },
    { match: "a$", replace: "", as: "many" }
  ]);
  expect(NameNotation.parseRules(NameNotation.formatRules(rules))).toEqual(rules);
});
