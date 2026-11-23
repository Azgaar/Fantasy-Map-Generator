import { expect, it } from "vitest";
import { NameNotation } from "./notation";

it("reads and writes the forms of a concept", () => {
  const text = "gorod~grad@last:4, king+s:3, novo@first, ton";
  const formants = NameNotation.parseFormants(text);
  expect(formants).toEqual([
    { form: "gorod", weight: 4, position: "last", short: "grad" },
    { form: "king", weight: 3, link: "s" },
    { form: "novo", position: "first" },
    { form: "ton" }
  ]);
  expect(NameNotation.formatFormants(formants)).toBe(text);
  expect(NameNotation.parseFormants("ton, , two words, bad@place")).toEqual([{ form: "ton" }]);
  expect(NameNotation.parseLexicon({ town: "ton", land: "ia:6, land:4" })).toEqual({
    town: [{ form: "ton" }],
    land: [
      { form: "ia", weight: 6 },
      { form: "land", weight: 4 }
    ]
  });
});

it("reads and writes templates", () => {
  const text = "{root}ov:4, {modifier} {root}, al {root}{generic}:0.5";
  const templates = NameNotation.parseTemplates(text);
  expect(templates).toEqual([
    { parts: "{root}ov", weight: 4 },
    { parts: "{modifier} {root}" },
    { parts: "al {root}{generic}", weight: 0.5 }
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
  const text = "-sk:6, berez@stem, nov*, pristan/f@word, verhnyaya/f@word, _/n@word:0.5, ust-@first";
  const formants = NameNotation.parseFormants(text);
  expect(formants).toEqual([
    { form: "-sk", weight: 6 },
    { form: "berez", position: "stem" },
    { form: "nov*" },
    { form: "pristan", class: "f", position: "word" },
    { form: "verhnyaya", class: "f", position: "word" },
    { form: "_", class: "n", position: "word", weight: 0.5 },
    { form: "ust-", position: "first" }
  ]);
  expect(NameNotation.formatFormants(formants)).toBe(text);
});

it("reads and writes a grammar", () => {
  const text = "f: a$ => aya\nn: [oe]$ => oye\nm: => yi";
  const grammar = NameNotation.parseGrammar(text);
  expect(grammar).toEqual({
    classes: { f: "a$", n: "[oe]$", m: "" },
    agreement: { f: "aya", n: "oye", m: "yi" }
  });
  expect(NameNotation.formatGrammar(grammar)).toBe(text);
  expect(NameNotation.parseGrammar("common: [^s]$\nplural: s$")).toEqual({
    classes: { common: "[^s]$", plural: "s$" },
    agreement: {}
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
