import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyTheme, themeFromBody, themeFromKeywords } from "./theme-classify.mjs";

test("themeFromBody reads a dropdown answer", () => {
  const body = "### Describe the bug\n\nIt breaks\n\n### Theme\n\nMilitary\n\n### System\n\nFirefox";
  assert.equal(themeFromBody(body), "theme: military");
});

test("themeFromBody returns null for an unrecognised answer", () => {
  assert.equal(themeFromBody("### Theme\n\nNot sure"), null);
});

test("themeFromBody returns null when there is no heading", () => {
  assert.equal(themeFromBody("just some prose about rivers"), null);
});

test("themeFromKeywords scores a title hit above a body hit", () => {
  assert.equal(themeFromKeywords("Regiment icons overlap", ""), "theme: military");
});

test("themeFromKeywords returns null below threshold", () => {
  assert.equal(themeFromKeywords("Something odd happened", "please help"), null);
});

test("classifyTheme prefers the dropdown over keywords", () => {
  const body = "### Theme\n\nMilitary\n\nthis text is all about rivers lakes and coast";
  assert.equal(classifyTheme("rivers", body), "theme: military");
});

test("classifyTheme falls back to needs-theme", () => {
  assert.equal(classifyTheme("Something odd happened", "please help"), "needs-theme");
});
