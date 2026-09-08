import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTriage } from "./board-plan.mjs";

test("parses an exact block", () => {
  const body = "### Triage\nPriority: P2 – Medium\nSize: M\n";
  assert.deepEqual(parseTriage(body), { priority: "P2 – Medium", size: "M", errors: [] });
});

test("accepts a hyphen where an en dash belongs", () => {
  const body = "### Triage\nPriority: P1 - High\nSize: XL\n";
  assert.equal(parseTriage(body).priority, "P1 – High");
});

test("accepts a bare priority code", () => {
  const body = "### Triage\nPriority: P4\nSize: s\n";
  const got = parseTriage(body);
  assert.equal(got.priority, "P4 – Wishlist");
  assert.equal(got.size, "S");
});

test("returns nothing when there is no block", () => {
  assert.deepEqual(parseTriage("### Describe the bug\n\nit broke"), {
    priority: null,
    size: null,
    errors: []
  });
});

test("reports an unknown value instead of guessing", () => {
  const got = parseTriage("### Triage\nPriority: Urgent-ish\nSize: Medium\n");
  assert.equal(got.priority, null);
  assert.equal(got.size, null);
  assert.equal(got.errors.length, 2);
});

test("ignores other blocks around it", () => {
  const body = "### Theme\n\nMilitary\n\n### Triage\nPriority: P0 – Urgent\nSize: XXL\n\n### Notes\nblah";
  const got = parseTriage(body);
  assert.equal(got.priority, "P0 – Urgent");
  assert.equal(got.size, "XXL");
});
