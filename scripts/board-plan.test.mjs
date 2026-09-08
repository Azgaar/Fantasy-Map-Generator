import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTriage, planFieldWrites } from "./board-plan.mjs";

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

const item = over => ({
  number: 1812,
  type: "Issue",
  labels: [],
  title: "",
  body: "",
  fields: { theme: null, priority: null, size: null },
  ...over
});

test("fills an empty Theme from a single theme label", () => {
  const { writes, drift } = planFieldWrites(item({ labels: ["bug", "theme: burgs-population"] }));
  assert.deepEqual(drift, []);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].field, "theme");
  assert.equal(writes[0].optionName, "Burgs/Population");
  assert.equal(writes[0].optionId, "10011b09");
});

test("never overwrites a Theme a human already set", () => {
  const { writes, drift } = planFieldWrites(
    item({ labels: ["theme: military"], fields: { theme: "Routes", priority: null, size: null } })
  );
  assert.deepEqual(writes, []);
  assert.equal(drift.length, 1);
  assert.match(drift[0], /Theme/);
});

test("refuses to choose between two theme labels", () => {
  const { writes, drift } = planFieldWrites(
    item({ labels: ["theme: ui-editors", "theme: markers-zones"] })
  );
  assert.deepEqual(writes, []);
  assert.equal(drift.length, 1);
  assert.match(drift[0], /two theme labels/);
});

test("fills Priority and Size from a triage block", () => {
  const { writes } = planFieldWrites(item({ body: "### Triage\nPriority: P3 – Low\nSize: S\n" }));
  assert.deepEqual(
    writes.map(w => [w.field, w.optionName]),
    [
      ["priority", "P3 – Low"],
      ["size", "S"]
    ]
  );
});

test("never overwrites a Priority a human already set", () => {
  const { writes, drift } = planFieldWrites(
    item({
      body: "### Triage\nPriority: P3 – Low\nSize: S\n",
      fields: { theme: null, priority: "P1 – High", size: null }
    })
  );
  assert.deepEqual(
    writes.map(w => w.field),
    ["size"]
  );
  assert.equal(drift.length, 1);
  assert.match(drift[0], /Priority/);
});

test("surfaces an unparseable triage value as drift and writes nothing", () => {
  const { writes, drift } = planFieldWrites(item({ body: "### Triage\nPriority: soon\nSize: big\n" }));
  assert.deepEqual(writes, []);
  assert.equal(drift.length, 2);
});

test("writes nothing for an item with no labels and no block", () => {
  assert.deepEqual(planFieldWrites(item({})), { writes: [], drift: [] });
});

import { itemsFromGraphql } from "./board-plan.mjs";

const node = {
  id: "PVTI_abc",
  fieldValues: {
    nodes: [
      {},
      { name: "Backlog", field: { name: "Status" } },
      { name: "UI/Editors", field: { name: "Theme" } }
    ]
  },
  content: {
    __typename: "Issue",
    number: 1780,
    title: "Editor dialogs snap back",
    body: "### Theme\n\nUI / Editors",
    labels: { nodes: [{ name: "bug" }, { name: "theme: ui-editors" }] }
  }
};

test("maps a graphql node onto the planner's item shape", () => {
  const [got] = itemsFromGraphql([node]);
  assert.equal(got.id, "PVTI_abc");
  assert.equal(got.number, 1780);
  assert.equal(got.type, "Issue");
  assert.deepEqual(got.labels, ["bug", "theme: ui-editors"]);
  assert.equal(got.fields.theme, "UI/Editors");
  assert.equal(got.fields.priority, null);
  assert.equal(got.fields.size, null);
});

test("drops draft items that have no content number", () => {
  assert.deepEqual(itemsFromGraphql([{ id: "PVTI_x", fieldValues: { nodes: [] }, content: {} }]), []);
});

import { planLabelWrites } from "./board-plan.mjs";

test("labels a pull request that has no theme label", () => {
  const got = planLabelWrites(
    item({ number: 1666, type: "PullRequest", labels: [], title: "Regiment icons overlap" })
  );
  assert.deepEqual(got, [{ number: 1666, label: "theme: military" }]);
});

test("leaves an item that already has a theme label alone", () => {
  assert.deepEqual(planLabelWrites(item({ labels: ["theme: routes"], title: "Regiments" })), []);
});

test("leaves an item already marked needs-theme alone", () => {
  assert.deepEqual(planLabelWrites(item({ labels: ["needs-theme"], title: "Regiments" })), []);
});

test("marks an unclassifiable item needs-theme", () => {
  const got = planLabelWrites(item({ number: 9, title: "Something odd", body: "please help" }));
  assert.deepEqual(got, [{ number: 9, label: "needs-theme" }]);
});
