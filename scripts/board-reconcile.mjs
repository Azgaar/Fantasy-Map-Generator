import { appendFileSync } from "node:fs";
import { FIELD_IDS, PROJECT_ID } from "./board-fields.mjs";
import { itemsFromGraphql, planFieldWrites, planLabelWrites } from "./board-plan.mjs";

const DRY_RUN = Boolean(process.env.DRY_RUN);
const REPO = process.env.GITHUB_REPOSITORY || "Azgaar/Fantasy-Map-Generator";
const PROJECT_NUMBER = 3;
const OWNER = REPO.split("/")[0];

async function graphql(token, query, variables) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { authorization: `bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query, variables })
  });
  const payload = await response.json();
  if (!response.ok || payload.errors) {
    const error = new Error(`graphql ${response.status}: ${JSON.stringify(payload.errors || payload)}`);
    error.status = response.status;
    error.errors = payload.errors;
    throw error;
  }
  return payload.data;
}

const ITEMS_QUERY = `
query($owner: String!, $number: Int!, $cursor: String) {
  user(login: $owner) {
    projectV2(number: $number) {
      items(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          fieldValues(first: 50) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2SingleSelectField { name } }
              }
            }
          }
          content {
            __typename
            ... on Issue {
              number
              title
              body
              labels(first: 100) { nodes { name } }
              repository { nameWithOwner }
            }
            ... on PullRequest {
              number
              title
              body
              labels(first: 100) { nodes { name } }
              repository { nameWithOwner }
            }
          }
        }
      }
    }
  }
}`;

const SET_FIELD = `
mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
  updateProjectV2ItemFieldValue(
    input: { projectId: $project, itemId: $item, fieldId: $field, value: { singleSelectOptionId: $option } }
  ) { projectV2Item { id } }
}`;

// Only a genuine auth failure warrants opening the "renew your token" issue on Azgaar's tracker.
// A transient 502, a secondary rate limit, or a network blip must rethrow and let the next hourly
// run retry. A token that authenticates but lacks project scope comes back as HTTP 200 with a
// GraphQL error of type INSUFFICIENT_SCOPES/FORBIDDEN (or a SAML-enforcement message) — that is
// as much an auth failure as a 401, so it is checked separately from the HTTP status.
function isAuthFailure(error) {
  const status = error?.status;
  if (status === 401) return true;
  if (status === 403) return !/rate limit/i.test(String(error?.message ?? error));

  const graphqlErrors = Array.isArray(error?.errors) ? error.errors : [];
  if (graphqlErrors.some(e => /INSUFFICIENT_SCOPES|FORBIDDEN/i.test(e?.type || "") || /SAML/i.test(e?.message || "")))
    return true;

  return /bad credentials/i.test(String(error?.message ?? error));
}

async function readBoard(token) {
  const nodes = [];
  let cursor = null;
  for (;;) {
    const data = await graphql(token, ITEMS_QUERY, {
      owner: OWNER,
      number: PROJECT_NUMBER,
      cursor
    });
    const page = data.user.projectV2.items;
    nodes.push(...page.nodes);
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }
  return itemsFromGraphql(nodes);
}

async function addLabel(number, label) {
  const response = await fetch(`https://api.github.com/repos/${REPO}/issues/${number}/labels`, {
    method: "POST",
    headers: {
      authorization: `bearer ${process.env.GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json"
    },
    body: JSON.stringify({ labels: [label] })
  });
  if (!response.ok) {
    const error = new Error(`label ${number} ${response.status}: ${await response.text()}`);
    error.status = response.status;
    throw error;
  }
}

async function reportTokenFailure(message) {
  const title = "Dev board automation: PROJECT_TOKEN needs renewing";
  const search = await fetch(
    `https://api.github.com/search/issues?q=${encodeURIComponent(`repo:${REPO} is:issue is:open in:title "${title}"`)}`,
    { headers: { authorization: `bearer ${process.env.GITHUB_TOKEN}` } }
  );
  if (!search.ok) {
    console.error(`failed to search for existing token-failure issue: ${search.status} ${await search.text()}`);
    return;
  }
  const found = (await search.json()).items || [];
  const body = `The board reconciler could not write to the project.\n\n\`\`\`\n${message}\n\`\`\`\n\nRenew the classic PAT (\`project\` scope only) and update the \`PROJECT_TOKEN\` repository secret. Label writes are unaffected and keep working meanwhile.`;
  if (found.length) return;
  const response = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: "POST",
    headers: {
      authorization: `bearer ${process.env.GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json"
    },
    body: JSON.stringify({ title, body })
  });
  if (!response.ok) console.error(`failed to file token-failure issue: ${response.status} ${await response.text()}`);
}

function summarise(lines) {
  const text = lines.join("\n");
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
}

async function main() {
  const token = process.env.PROJECT_TOKEN;
  if (!token) throw new Error("PROJECT_TOKEN is not set");

  let allItems;
  try {
    allItems = await readBoard(token);
  } catch (error) {
    if (isAuthFailure(error)) await reportTokenFailure(String(error));
    throw error;
  }

  const drift = [];
  const items = allItems.filter(item => {
    if (item.repository === REPO) return true;
    drift.push(`#${item.number}: skipped, repository ${item.repository ?? "unknown"} does not match ${REPO}`);
    return false;
  });

  const fieldWrites = [];
  const labelWrites = [];
  for (const item of items) {
    const planned = planFieldWrites(item);
    fieldWrites.push(...planned.writes.map(write => ({ ...write, itemId: item.id })));
    drift.push(...planned.drift);
    const plannedLabels = planLabelWrites(item);
    labelWrites.push(...plannedLabels.writes);
    drift.push(...plannedLabels.drift);
  }

  const lines = [
    `## Dev board reconcile${DRY_RUN ? " (dry run)" : ""}`,
    "",
    `${items.length} items · ${fieldWrites.length} field writes · ${labelWrites.length} label writes · ${drift.length} drift`,
    ""
  ];
  for (const write of fieldWrites) lines.push(`- set #${write.number} ${write.field} = ${write.optionName}`);
  for (const write of labelWrites) lines.push(`- label #${write.number} ${write.label}`);
  if (drift.length) lines.push("", "### Drift (not corrected)", ...drift.map(d => `- ${d}`));

  if (DRY_RUN) {
    summarise(lines);
    return;
  }

  // Per-item isolation: one un-writable item (transferred, locked, archived, or otherwise
  // rejected) must not block every write queued behind it. Failures are collected, reported in
  // the summary, and turn the run red — but the loop always runs to completion.
  const fieldFailures = [];
  const labelFailures = [];
  let authFailureReported = false;

  for (const write of fieldWrites) {
    try {
      await graphql(token, SET_FIELD, {
        project: PROJECT_ID,
        item: write.itemId,
        field: FIELD_IDS[write.field],
        option: write.optionId
      });
    } catch (error) {
      if (isAuthFailure(error) && !authFailureReported) {
        await reportTokenFailure(String(error));
        authFailureReported = true;
      }
      fieldFailures.push(`#${write.number} ${write.field}: ${error.message ?? error}`);
    }
  }
  for (const write of labelWrites) {
    try {
      await addLabel(write.number, write.label);
    } catch (error) {
      // addLabel authenticates with GITHUB_TOKEN, not PROJECT_TOKEN — never route its
      // failures (locked issue, abuse detection, a missing pull-requests scope) through
      // reportTokenFailure, which would misdiagnose a healthy PAT on Azgaar's tracker.
      labelFailures.push(`#${write.number} ${write.label}: ${error.message ?? error}`);
    }
  }

  if (fieldFailures.length || labelFailures.length) {
    lines.push(
      "",
      "### Write failures",
      ...fieldFailures.map(f => `- field ${f}`),
      ...labelFailures.map(f => `- label ${f}`)
    );
  }

  summarise(lines);
  if (fieldFailures.length || labelFailures.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
