import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCatalog, extractStrings } from "./extract-strings.mjs";

const extract = text => extractStrings("file.ts", text);

describe("extractStrings", () => {
  it("collects literal keys from t() calls, wherever they are", () => {
    const { strings, problems } = extract('const a = t("Rivers"); const b = `<p>${t(`Lakes`)}</p>`;');
    assert.deepEqual([...strings], [
      ["Rivers", "Rivers"],
      ["Lakes", "Lakes"]
    ]);
    assert.deepEqual(problems, []);
  });

  it("suffixes a context and expands a plural", () => {
    const { strings } = extract('t("Close", { context: "button" }); t("{{count}} burgs", { count });');
    assert.deepEqual([...strings], [
      ["Close_button", "Close"],
      ["{{count}} burgs_one", "{{count}} burgs"],
      ["{{count}} burgs_other", "{{count}} burgs"]
    ]);
  });

  it("ignores other functions and methods named t", () => {
    assert.equal(extract('i18n.t("A"); tt("B"); const t2 = 1;').strings.size, 0);
  });

  it("reports keys and contexts that are not literals", () => {
    const { problems } = extract("t(label);\nt(\"Close\", { context: kind });");
    assert.deepEqual(problems, ["file.ts:1: t() needs a literal key", "file.ts:2: t() needs a literal context"]);
  });
});

describe("buildCatalog", () => {
  it("keeps existing English, defaults new keys to their text, sorts and drops unused keys", () => {
    const found = new Map([
      ["b_one", "b"],
      ["b_other", "b"],
      ["a", "a"]
    ]);
    const catalog = buildCatalog(found, { b_one: "one b", unused: "x" });
    assert.deepEqual(catalog, { a: "a", b_one: "one b", b_other: "b" });
    assert.deepEqual(Object.keys(catalog), ["a", "b_one", "b_other"]);
  });
});
