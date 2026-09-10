import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { itemsFromGraphql, parseTriage, planFieldWrites, planLabelWrites, planStatusWrites } from "./board-plan.mjs";

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

test("reads nothing from an empty block followed by another section", () => {
  const body = "### Triage\n\n### Additional context\nPriority: P0 – Urgent\nSize: XS\n";
  const got = parseTriage(body);
  assert.equal(got.priority, null);
  assert.equal(got.size, null);
  assert.equal(got.errors.length, 2);
});

test("parses a block with CRLF line endings", () => {
  const body = "### Describe the bug\r\n\r\nit broke\r\n\r\n### Triage\r\nPriority: P1 – High\r\nSize: L\r\n";
  assert.deepEqual(parseTriage(body), { priority: "P1 – High", size: "L", errors: [] });
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
  authorAssociation: "COLLABORATOR",
  ...over
});

const TRIAGE = "### Triage\nPriority: P2 – Medium\nSize: M\n";

test("ignores a triage block from an author who is not a collaborator", () => {
  for (const authorAssociation of ["NONE", "CONTRIBUTOR", "FIRST_TIME_CONTRIBUTOR", undefined]) {
    const { writes, drift } = planFieldWrites(item({ body: TRIAGE, authorAssociation }));
    assert.deepEqual(writes, [], `wrote for ${authorAssociation}`);
    assert.equal(drift.length, 1);
    assert.match(drift[0], /Triage block ignored/);
  }
});

test("honours a triage block from an owner, member or collaborator", () => {
  for (const authorAssociation of ["OWNER", "MEMBER", "COLLABORATOR"]) {
    const { writes, drift } = planFieldWrites(item({ body: TRIAGE, authorAssociation }));
    assert.deepEqual(
      writes.map(w => w.field),
      ["priority", "size"],
      `did not write for ${authorAssociation}`
    );
    assert.deepEqual(drift, []);
  }
});

test("stays silent for an untrusted author with no triage block", () => {
  assert.deepEqual(planFieldWrites(item({ authorAssociation: "NONE" })), { writes: [], drift: [] });
});

test("honours a triage block from an allowlisted login regardless of association", () => {
  const trusted = new Set(["fmg-bot[bot]"]);
  const bot = item({ body: TRIAGE, authorAssociation: "NONE", author: "fmg-bot[bot]" });
  assert.deepEqual(
    planFieldWrites(bot, trusted).writes.map(w => w.field),
    ["priority", "size"]
  );
  const stranger = item({ body: TRIAGE, authorAssociation: "NONE", author: "someone-else" });
  assert.deepEqual(planFieldWrites(stranger, trusted).writes, []);
});

test("ignores attribution lines that follow the triage block without a heading", () => {
  const body =
    "### Triage\nPriority: P2 – Medium\nSize: M\n\n---\n\nReported via Discord by `@someone` — https://discord.com/channels/1/2/3\n";
  const { writes, drift } = planFieldWrites(item({ body }));
  assert.deepEqual(
    writes.map(w => [w.field, w.optionName]),
    [
      ["priority", "P2 – Medium"],
      ["size", "M"]
    ]
  );
  assert.deepEqual(drift, []);
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
  assert.match(drift[0], /2 theme labels/);
});

test("surfaces an unmapped theme label as drift instead of silently ignoring it", () => {
  const { writes, drift } = planFieldWrites(item({ labels: ["theme: performance"] }));
  assert.deepEqual(writes, []);
  assert.equal(drift.length, 1);
  assert.match(drift[0], /unmapped theme label/);
  assert.match(drift[0], /theme: performance/);
});

test("counts an unmapped theme label toward the conflict guard", () => {
  const { writes, drift } = planFieldWrites(
    item({ labels: ["theme: ui-editors", "theme: performance"] })
  );
  assert.deepEqual(writes, []);
  assert.equal(drift.length, 1);
  assert.match(drift[0], /2 theme labels/);
});

test("fills Priority and Size from a triage block", () => {
  const { writes, drift } = planFieldWrites(item({ body: "### Triage\nPriority: P3 – Low\nSize: S\n" }));
  assert.deepEqual(
    writes.map(w => [w.field, w.optionName]),
    [
      ["priority", "P3 – Low"],
      ["size", "S"]
    ]
  );
  assert.deepEqual(drift, []);
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

test("surfaces a triage block missing a value as drift instead of staying silent", () => {
  const { writes, drift } = planFieldWrites(item({ body: "### Triage\nPriority: P2 – Medium\n" }));
  assert.deepEqual(
    writes.map(w => w.field),
    ["priority"]
  );
  assert.equal(drift.length, 1);
  assert.match(drift[0], /no Size value/);
});

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
    labels: { nodes: [{ name: "bug" }, { name: "theme: ui-editors" }] },
    repository: { nameWithOwner: "Azgaar/Fantasy-Map-Generator" },
    authorAssociation: "NONE",
    author: { login: "reporter" }
  }
};

test("carries the author association and login through, and null when absent", () => {
  const [got] = itemsFromGraphql([node]);
  assert.equal(got.authorAssociation, "NONE");
  assert.equal(got.author, "reporter");
  const [bare] = itemsFromGraphql([
    { id: "PVTI_z", fieldValues: { nodes: [] }, content: { __typename: "Issue", number: 7, labels: { nodes: [] } } }
  ]);
  assert.equal(bare.authorAssociation, null);
  assert.equal(bare.author, null);
});

test("maps a graphql node onto the planner's item shape", () => {
  const [got] = itemsFromGraphql([node]);
  assert.equal(got.id, "PVTI_abc");
  assert.equal(got.number, 1780);
  assert.equal(got.type, "Issue");
  assert.deepEqual(got.labels, ["bug", "theme: ui-editors"]);
  assert.equal(got.repository, "Azgaar/Fantasy-Map-Generator");
  assert.equal(got.fields.theme, "UI/Editors");
  assert.equal(got.fields.priority, null);
  assert.equal(got.fields.size, null);
});

test("reports a missing repository as null rather than guessing", () => {
  const [got] = itemsFromGraphql([
    { id: "PVTI_y", fieldValues: { nodes: [] }, content: { __typename: "Issue", number: 42, labels: { nodes: [] } } }
  ]);
  assert.equal(got.repository, null);
});

test("drops draft items that have no content number", () => {
  assert.deepEqual(itemsFromGraphql([{ id: "PVTI_x", fieldValues: { nodes: [] }, content: {} }]), []);
});

test("labels a pull request that has no theme label", () => {
  const got = planLabelWrites(
    item({ number: 1666, type: "PullRequest", labels: [], title: "Regiment icons overlap" })
  );
  assert.deepEqual(got, { writes: [{ number: 1666, label: "theme: military" }], drift: [] });
});

test("leaves an item that already has a theme label alone", () => {
  assert.deepEqual(planLabelWrites(item({ labels: ["theme: routes"], title: "Regiments" })), {
    writes: [],
    drift: []
  });
});

test("leaves an item already marked needs-theme alone", () => {
  assert.deepEqual(planLabelWrites(item({ labels: ["needs-theme"], title: "Regiments" })), {
    writes: [],
    drift: []
  });
});

// Old intent (pre-fix): an unclassifiable item got a permanent "needs-theme" label, which fought
// a maintainer who deliberately removed it. New intent: surface it as drift, write nothing, and
// let theme-label.yml's creation-time needs-theme label (untouched by this script) stand.
test("surfaces an unclassifiable item as drift instead of writing needs-theme", () => {
  const got = planLabelWrites(item({ number: 9, title: "Something odd", body: "please help" }));
  assert.deepEqual(got.writes, []);
  assert.equal(got.drift.length, 1);
  assert.match(got.drift[0], /#9/);
});

test("derives the label from a human-set Theme field instead of guessing", () => {
  const got = planLabelWrites(
    item({
      number: 1780,
      title: "Editor dialogs snap back",
      body: "unrelated text with no theme keywords",
      fields: { theme: "UI/Editors", priority: null, size: null }
    })
  );
  assert.deepEqual(got, { writes: [{ number: 1780, label: "theme: ui-editors" }], drift: [] });
});

test("repairs completed, declined, merged and unmerged cards and converges after one pass", () => {
  for (const [type, state, stateReason, before, after] of [
    ["Issue", "CLOSED", "COMPLETED", "Backlog", "Done"],
    ["Issue", "CLOSED", "NOT_PLANNED", "Done", "Archive"],
    ["Issue", "CLOSED", "DUPLICATE", "Done", "Archive"],
    ["PullRequest", "MERGED", null, "In review", "Done"],
    ["PullRequest", "CLOSED", null, "Done", "Archive"],
    ["Issue", "OPEN", "REOPENED", "Done", "Backlog"],
    ["PullRequest", "OPEN", null, "Done", "Backlog"]
  ]) {
    const input = item({ type, state, stateReason, fields: { status: before } });
    const { writes, drift } = planStatusWrites(input);
    assert.deepEqual(drift, []);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].optionName, after);
    assert.equal(writes[0].field, "status");
    assert.ok(writes[0].optionId);
    assert.deepEqual(planStatusWrites({ ...input, fields: { status: after } }), { writes: [], drift: [] });
  }
});

test("preserves active triage, intentionally parked proposals and actually archived history", () => {
  for (const status of [null, "Backlog", "Approved", "In progress", "In review", "Archive"]) {
    assert.deepEqual(planStatusWrites(item({ state: "OPEN", fields: { status } })), { writes: [], drift: [] });
  }
  assert.deepEqual(
    planStatusWrites(item({ type: "PullRequest", state: "CLOSED", isArchived: true, fields: { status: "Done" } })),
    { writes: [], drift: [] }
  );
});

test("unknown issue closure reasons require review instead of being marked complete", () => {
  for (const stateReason of [null, undefined, "UNRECOGNIZED"]) {
    const result = planStatusWrites(item({ state: "CLOSED", stateReason }));
    assert.deepEqual(result.writes, []);
    assert.match(result.drift[0], /review its resolution/);
  }
});

test("carries completion metadata and archived state from GraphQL into the planner", () => {
  const [got] = itemsFromGraphql([{
    ...node,
    isArchived: true,
    content: { ...node.content, state: "CLOSED", stateReason: "NOT_PLANNED" }
  }]);
  assert.equal(got.state, "CLOSED");
  assert.equal(got.stateReason, "NOT_PLANNED");
  assert.equal(got.isArchived, true);
  assert.equal(got.fields.status, "Backlog");
});

const completionNode = (number, type, state, stateReason, status) => ({
  id: `item-${number}`,
  fieldValues: { nodes: [
    { name: status, field: { name: "Status" } },
    { name: "Military", field: { name: "Theme" } }
  ] },
  content: {
    __typename: type, number, state, stateReason, title: "Regiment issue", body: "",
    labels: { nodes: [{ name: "theme: military" }] },
    repository: { nameWithOwner: "Azgaar/Fantasy-Map-Generator" }
  }
});

function runCompletionFixture({ dryRun = false, authFailure = false, writeFailure = false } = {}) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const pages = [
    [completionNode(1, "PullRequest", "CLOSED", null, "Done")],
    [completionNode(2, "Issue", "CLOSED", "COMPLETED", "Backlog")]
  ];
  const script = `
    const pages = ${JSON.stringify(pages)};
    let page = 0;
    let writes = 0;
    globalThis.fetch = async (url, options) => {
      if (url !== "https://api.github.com/graphql") throw new Error("Unexpected external write: " + url);
      const {query, variables} = JSON.parse(options.body);
      if (query.includes("updateProjectV2ItemFieldValue")) {
        console.log("WRITE", variables.item, variables.option);
        if (${writeFailure} && ++writes === 1) return {ok:false,status:502,json:async()=>({message:"fixture write failure"})};
        return {ok:true,status:200,json:async()=>({data:{updateProjectV2ItemFieldValue:{}}})};
      }
      if (${authFailure}) return {ok:false,status:401,json:async()=>({message:"Bad credentials"})};
      if (variables.cursor !== (page === 0 ? null : "next-page")) throw new Error("Wrong pagination cursor");
      const nodes = pages[page++];
      return {ok:true,status:200,json:async()=>({data:{user:{projectV2:{items:{nodes,pageInfo:{hasNextPage:page < 2,endCursor:"next-page"}}}}}})};
    };
    await import(${JSON.stringify(new URL("./board-reconcile.mjs", import.meta.url).href)});
  `;
  return spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8",
    env: {
      ...env, PROJECT_TOKEN: "fixture-token", GITHUB_TOKEN: "fixture-token",
      GITHUB_REPOSITORY: "Azgaar/Fantasy-Map-Generator", GITHUB_STEP_SUMMARY: "",
      DRY_RUN: dryRun ? "1" : "", TRUSTED_TRIAGE_LOGINS: ""
    }
  });
}

test("runner repairs completion across all board pages", () => {
  const result = runCompletionFixture();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /2 items · 2 field writes/);
  assert.match(result.stdout, /WRITE item-1 6e3c9f61/);
  assert.match(result.stdout, /WRITE item-2 98236657/);
});

test("runner preview prints completion repairs without writing", () => {
  const result = runCompletionFixture({ dryRun: true });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /set #1 status = Archive/);
  assert.match(result.stdout, /set #2 status = Done/);
  assert.doesNotMatch(result.stdout, /WRITE/);
});

test("runner dry run cannot file an issue when project authentication fails", () => {
  const result = runCompletionFixture({ dryRun: true, authFailure: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Dry run: would report PROJECT_TOKEN authentication failure/);
  assert.doesNotMatch(result.stderr, /Unexpected external write/);
});

test("runner continues completion repairs after one write fails and reports failure", () => {
  const result = runCompletionFixture({ writeFailure: true });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /WRITE item-2 98236657/);
  assert.match(result.stdout, /Write failures/);
  assert.match(result.stdout, /#1 status: graphql 502/);
});
