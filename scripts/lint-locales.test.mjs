import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintCatalog, missingKeys } from "./lint-locales.mjs";

const ENGLISH = {
  Rivers: "Rivers",
  "{{layer}}: click": "{{layer}}: click",
  "{{count}} burgs_one": "a burg",
  "{{count}} burgs_other": "{{count}} burgs"
};

describe("lintCatalog", () => {
  it("passes a clean translation, plural forms English lacks included", () => {
    const russian = {
      Rivers: "Реки",
      "{{layer}}: click": "{{layer}}: нажмите",
      "{{count}} burgs_one": "{{count}} город",
      "{{count}} burgs_few": "{{count}} города",
      "{{count}} burgs_many": "{{count}} городов"
    };
    assert.deepEqual(lintCatalog(russian, ENGLISH), []);
  });

  it("reports unknown keys, empty values, raw quotes and changed placeholders", () => {
    const broken = {
      Lakes: "Озёра",
      Rivers: " ",
      "{{layer}}: click": '{{layer}}: нажмите "здесь"',
      "{{count}} burgs_few": "несколько городов"
    };
    assert.deepEqual(lintCatalog(broken, ENGLISH), [
      '"Lakes": not in the English catalog',
      '"Rivers": empty, leave it out instead',
      '"{{layer}}: click": a raw double quote breaks attribute markup, use “ ”',
      '"{{count}} burgs_few": placeholders differ from the English'
    ]);
  });

  it("reports a trailing colon, which belongs in code", () => {
    assert.deepEqual(lintCatalog({ "Name:": "Name:" }, { "Name:": "Name:" }), [
      '"Name:": ends with a colon, put it in code'
    ]);
    assert.deepEqual(lintCatalog({ Rivers: "Реки：" }, ENGLISH), ['"Rivers": ends with a colon, put it in code']);
  });

  it("keeps symbols, values and decoration out of English keys", () => {
    const english = {
      "+ Add condition": "+ Add condition",
      "/ (slash sign)": "/ (slash sign)",
      "Name*": "Name*",
      "0: transparent, 1: solid": "0: transparent, 1: solid",
      "Drag to pan • Scroll to zoom": "Drag to pan • Scroll to zoom",
      "Close_button": "Close",
      "{{count}} burgs_other": "{{count}} burgs",
      "“{{name}}” is used (in {{count}} maps)": "“{{name}}” is used (in {{count}} maps)"
    };
    const problem = key => `"${key}": a key is language only, symbols and values around it belong in code`;
    assert.deepEqual(lintCatalog(english, english), Object.keys(english).slice(0, 5).map(problem));
  });

  it("rejects markup and requires the same raw placeholders", () => {
    const english = { "See {{- link}}": "See {{- link}}", "Click <b>here</b>": "Click <b>here</b>" };
    assert.deepEqual(lintCatalog({ "See {{- link}}": "См. {{- link}}" }, english), []);
    assert.deepEqual(lintCatalog({ "See {{- link}}": "См. {{link}}" }, english), [
      '"See {{- link}}": placeholders differ from the English'
    ]);
    assert.deepEqual(lintCatalog({ "See {{- link}}": 'См. <a href="x">{{- link}}</a>' }, english), [
      '"See {{- link}}": markup belongs in code, pass it in a {{- placeholder}}',
      '"See {{- link}}": a raw double quote breaks attribute markup, use “ ”'
    ]);
    assert.deepEqual(lintCatalog(english, english), [
      '"Click <b>here</b>": markup belongs in code, pass it in a {{- placeholder}}'
    ]);
  });

  it("reports stray spacing and line breaks", () => {
    const english = { " Port": " Port", Ship: "Ship" };
    assert.deepEqual(lintCatalog({ Ship: " Корабль" }, english), ['"Ship": a value is one line with no outer spaces']);
    assert.deepEqual(lintCatalog({ Ship: "Корабль⏎ тут" }, english), ['"Ship": a value is one line with no outer spaces']);
    assert.deepEqual(lintCatalog({ Ship: "Корабль\n   тут" }, english), ['"Ship": a value is one line with no outer spaces']);
    assert.deepEqual(lintCatalog({ " Port": "Порт" }, english), ['" Port": a key is one line with no outer spaces']);
  });

  it("checks English against itself, letting its singular drop the count", () => {
    assert.deepEqual(lintCatalog(ENGLISH, ENGLISH), []);
    const quoted = { ...ENGLISH, 'Say "hi"': 'Say "hi"' };
    assert.deepEqual(lintCatalog(quoted, quoted), [
      '"Say "hi"": a raw double quote breaks attribute markup, use “ ”'
    ]);
  });
});

describe("missingKeys", () => {
  it("lists untranslated keys, with the plural forms the language has", () => {
    const russian = { Rivers: "Реки", "{{count}} burgs_one": "{{count}} город" };
    assert.deepEqual(missingKeys(russian, ENGLISH, "ru"), [
      "{{layer}}: click",
      "{{count}} burgs_few",
      "{{count}} burgs_many",
      "{{count}} burgs_other"
    ]);
    assert.deepEqual(missingKeys({}, ENGLISH, "zh"), ["Rivers", "{{layer}}: click", "{{count}} burgs_other"]);
  });
});
