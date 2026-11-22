import { expect, it } from "vitest";
import {
  formatFormants,
  formatRules,
  formatTemplates,
  lexiconOf,
  parseFormants,
  parseRules,
  parseTemplates
} from "./name-notation";

it("reads and writes the forms of a concept", () => {
  const text = "gorod~grad@last:4, king+s:3, novo@first, ton";
  const formants = parseFormants(text);
  expect(formants).toEqual([
    { form: "gorod", weight: 4, position: "last", short: "grad" },
    { form: "king", weight: 3, link: "s" },
    { form: "novo", position: "first" },
    { form: "ton" }
  ]);
  expect(formatFormants(formants)).toBe(text);
  expect(parseFormants("ton, , two words, bad@place")).toEqual([{ form: "ton" }]);
  expect(lexiconOf({ town: "ton", land: "ia:6, land:4" })).toEqual({
    town: [{ form: "ton" }],
    land: [
      { form: "ia", weight: 6 },
      { form: "land", weight: 4 }
    ]
  });
});

it("reads and writes templates", () => {
  const text = "{root}ov:4, {modifier} {root}, al {root}{generic}:0.5";
  const templates = parseTemplates(text);
  expect(templates).toEqual([
    { parts: "{root}ov", weight: 4 },
    { parts: "{modifier} {root}" },
    { parts: "al {root}{generic}", weight: 0.5 }
  ]);
  expect(formatTemplates(templates)).toBe(text);
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
  const rules = parseRules(text);
  expect(rules).toEqual([
    { match: "(.)\\1+", replace: "$1" },
    { match: "([aeiou])\\+u$", replace: "$1", at: "join" },
    { match: "gorod$", replace: "grad", when: "long" },
    { match: "th", replace: "f", when: "foreign" },
    { match: "o\\+(?=[^aeiou])", replace: "+", chance: 0.3 },
    { match: "x", replace: "" }
  ]);
  expect(formatRules(rules)).toBe(text);
  expect(parseRules("no arrow here\n\n=> nothing")).toEqual([]);
});
