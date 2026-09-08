import { appendFileSync } from "node:fs";
import { FIELD_IDS, PROJECT_ID } from "./board-fields.mjs";
import { itemsFromGraphql, planFieldWrites, planLabelWrites } from "./board-plan.mjs";

const DRY_RUN = process.env.DRY_RUN === "1";
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
  if (!response.ok || payload.errors)
    throw new Error(`graphql ${response.status}: ${JSON.stringify(payload.errors || payload)}`);
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
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2SingleSelectField { name } }
              }
            }
          }
          content {
            __typename
            ... on Issue { number title body labels(first: 20) { nodes { name } } }
            ... on PullRequest { number title body labels(first: 20) { nodes { name } } }
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

// Only an auth failure warrants opening the "renew your token" issue on Azgaar's tracker.
// A transient 502, rate limit, or network blip must rethrow and let the next hourly run retry.
function isAuthFailure(error) {
  const message = String(error?.message ?? error);
  return /\b401\b|\b403\b|bad credentials/i.test(message);
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
  if (!response.ok) throw new Error(`label ${number} ${response.status}: ${await response.text()}`);
}

async function reportTokenFailure(message) {
  const title = "Dev board automation: PROJECT_TOKEN needs renewing";
  const search = await fetch(
    `https://api.github.com/search/issues?q=${encodeURIComponent(`repo:${REPO} is:issue is:open in:title "${title}"`)}`,
    { headers: { authorization: `bearer ${process.env.GITHUB_TOKEN}` } }
  );
  const found = (await search.json()).items || [];
  const body = `The board reconciler could not write to the project.\n\n\`\`\`\n${message}\n\`\`\`\n\nRenew the classic PAT (\`project\` scope only) and update the \`PROJECT_TOKEN\` repository secret. Label writes are unaffected and keep working meanwhile.`;
  if (found.length) return;
  await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: "POST",
    headers: {
      authorization: `bearer ${process.env.GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json"
    },
    body: JSON.stringify({ title, body })
  });
}

function summarise(lines) {
  const text = lines.join("\n");
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
}

async function main() {
  const token = process.env.PROJECT_TOKEN;
  if (!token) throw new Error("PROJECT_TOKEN is not set");

  let items;
  try {
    items = await readBoard(token);
  } catch (error) {
    if (isAuthFailure(error)) await reportTokenFailure(String(error));
    throw error;
  }

  const fieldWrites = [];
  const labelWrites = [];
  const drift = [];
  for (const item of items) {
    const planned = planFieldWrites(item);
    fieldWrites.push(...planned.writes.map(write => ({ ...write, itemId: item.id })));
    drift.push(...planned.drift);
    labelWrites.push(...planLabelWrites(item));
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

  for (const write of fieldWrites) {
    try {
      await graphql(token, SET_FIELD, {
        project: PROJECT_ID,
        item: write.itemId,
        field: FIELD_IDS[write.field],
        option: write.optionId
      });
    } catch (error) {
      if (isAuthFailure(error)) await reportTokenFailure(String(error));
      throw error;
    }
  }
  for (const write of labelWrites) await addLabel(write.number, write.label);

  summarise(lines);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
