import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintCatalog } from "./lint-locales.mjs";

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
      '"{{layer}}: click": a raw double quote outside a tag breaks attribute markup, use “ ”',
      '"{{count}} burgs_few": placeholders differ from the English'
    ]);
  });

  it("reports a trailing colon, which belongs in code", () => {
    assert.deepEqual(lintCatalog({ "Name:": "Name:" }, { "Name:": "Name:" }), [
      '"Name:": ends with a colon, put it in code'
    ]);
    assert.deepEqual(lintCatalog({ Rivers: "Реки：" }, ENGLISH), ['"Rivers": ends with a colon, put it in code']);
  });

  it("allows quotes inside tags and requires the same raw placeholders", () => {
    const english = { 'See <a href="x">{{- link}}</a>': 'See <a href="x">{{- link}}</a>' };
    assert.deepEqual(lintCatalog({ 'See <a href="x">{{- link}}</a>': 'См. <a href="x">{{- link}}</a>' }, english), []);
    assert.deepEqual(lintCatalog({ 'See <a href="x">{{- link}}</a>': 'См. <a href="x">{{link}}</a>' }, english), [
      '"See <a href="x">{{- link}}</a>": placeholders differ from the English'
    ]);
  });

  it("checks English against itself, letting its singular drop the count", () => {
    assert.deepEqual(lintCatalog(ENGLISH, ENGLISH), []);
    const quoted = { ...ENGLISH, 'Say "hi"': 'Say "hi"' };
    assert.deepEqual(lintCatalog(quoted, quoted), [
      '"Say "hi"": a raw double quote outside a tag breaks attribute markup, use “ ”'
    ]);
  });
});
