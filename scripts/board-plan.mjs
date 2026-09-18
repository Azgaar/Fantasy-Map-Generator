import { PRIORITY_OPTIONS, SIZE_OPTIONS, STATUS_OPTIONS, THEME_LABEL_TO_OPTION, THEME_OPTIONS } from "./board-fields.mjs";
import { classifyTheme } from "./theme-classify.mjs";

const THEME_OPTION_TO_LABEL = Object.fromEntries(
  Object.entries(THEME_LABEL_TO_OPTION).map(([label, option]) => [option, label])
);

const PRIORITY_BY_CODE = new Map(
  Object.keys(PRIORITY_OPTIONS).map(name => [name.slice(0, 2).toUpperCase(), name])
);

const normalise = value => value.replace(/[-‒–—―]/g, "-").replace(/\s+/g, " ").trim();

function resolvePriority(raw) {
  const cleaned = normalise(raw);
  const byCode = PRIORITY_BY_CODE.get(cleaned.slice(0, 2).toUpperCase());
  if (!byCode) return null;
  const rest = cleaned.slice(2).replace(/^[\s-]+/, "");
  if (rest && normalise(byCode).slice(2).replace(/^[\s-]+/, "").toLowerCase() !== rest.toLowerCase())
    return null;
  return byCode;
}

function resolveSize(raw) {
  const cleaned = normalise(raw).toUpperCase();
  return Object.hasOwn(SIZE_OPTIONS, cleaned) ? cleaned : null;
}

export function parseTriage(body) {
  const errors = [];
  const block = (body || "").match(/###\s*Triage[ \t\r]*\n([\s\S]*?)(?=\n###\s|\s*$)/i);
  if (!block) return { priority: null, size: null, errors };

  const read = key => {
    const m = block[1].match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, "im"));
    return m ? m[1].trim() : null;
  };

  const rawPriority = read("Priority");
  const rawSize = read("Size");
  const priority = rawPriority ? resolvePriority(rawPriority) : null;
  const size = rawSize ? resolveSize(rawSize) : null;

  if (rawPriority && !priority) errors.push(`unknown Priority value: ${rawPriority}`);
  else if (!priority) errors.push("Triage block present but no Priority value found");
  if (rawSize && !size) errors.push(`unknown Size value: ${rawSize}`);
  else if (!size) errors.push("Triage block present but no Size value found");

  return { priority, size, errors };
}

const FIELDS = {
  theme: { label: "Theme", options: THEME_OPTIONS },
  priority: { label: "Priority", options: PRIORITY_OPTIONS },
  size: { label: "Size", options: SIZE_OPTIONS }
};

// Anyone can edit the body of an issue they filed, so a Triage block is only a moderator's decision
// when the author is one. Collaborators qualify by association; the intake bot, which writes under
// its own login, qualifies by allowlist.
const TRUSTED_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

const isTrustedAuthor = (item, trustedLogins) =>
  TRUSTED_ASSOCIATIONS.has(item.authorAssociation) || trustedLogins.has(item.author);

export function planFieldWrites(item, trustedLogins = new Set()) {
  const writes = [];
  const drift = [];

  const consider = (field, optionName) => {
    if (!optionName) return;
    const current = item.fields[field];
    if (current === optionName) return;
    if (current) {
      drift.push(
        `#${item.number}: ${FIELDS[field].label} is "${current}" but its source says "${optionName}"`
      );
      return;
    }
    writes.push({
      number: item.number,
      field,
      optionName,
      optionId: FIELDS[field].options[optionName]
    });
  };

  const allThemeLabels = item.labels.filter(l => l.startsWith("theme:"));
  const unmappedThemeLabels = allThemeLabels.filter(l => !Object.hasOwn(THEME_LABEL_TO_OPTION, l));

  if (allThemeLabels.length > 1)
    drift.push(`#${item.number}: ${allThemeLabels.length} theme labels, ${allThemeLabels.join(", ")}`);
  else if (unmappedThemeLabels.length === 1)
    drift.push(`#${item.number}: unmapped theme label "${unmappedThemeLabels[0]}"`);
  else if (allThemeLabels.length === 1) consider("theme", THEME_LABEL_TO_OPTION[allThemeLabels[0]]);

  if (isTrustedAuthor(item, trustedLogins)) {
    const triage = parseTriage(item.body);
    for (const error of triage.errors) drift.push(`#${item.number}: ${error}`);
    consider("priority", triage.priority);
    consider("size", triage.size);
  } else if (/###\s*Triage/i.test(item.body)) {
    drift.push(
      `#${item.number}: Triage block ignored, author ${item.author ?? "unknown"} is ${item.authorAssociation ?? "unknown"}, not a collaborator`
    );
  }

  return { writes, drift };
}

export function planStatusWrites(item) {
  const writes = [];
  const drift = [];
  if (item.isArchived) return { writes, drift };

  let status = null;
  if (item.state === "OPEN") {
    if (item.fields.status === "Done") status = "Backlog";
  } else if (item.type === "PullRequest") {
    if (item.state === "MERGED") status = "Done";
    else if (item.state === "CLOSED") status = "Archive";
  } else if (item.type === "Issue" && item.state === "CLOSED") {
    if (item.stateReason === "COMPLETED") status = "Done";
    else if (["NOT_PLANNED", "DUPLICATE"].includes(item.stateReason)) status = "Archive";
    else drift.push(`#${item.number}: closed issue has no recognized completion reason; review its resolution`);
  }

  if (status && item.fields.status !== status) {
    writes.push({ number: item.number, field: "status", optionName: status, optionId: STATUS_OPTIONS[status] });
  }
  return { writes, drift };
}

const FIELD_BY_NAME = { Theme: "theme", Priority: "priority", Size: "size", Status: "status" };

export function itemsFromGraphql(nodes) {
  const items = [];
  for (const node of nodes) {
    const content = node.content || {};
    if (!content.number) continue;
    const fields = { theme: null, priority: null, size: null, status: null };
    for (const value of node.fieldValues.nodes) {
      const key = FIELD_BY_NAME[value?.field?.name];
      if (key) fields[key] = value.name;
    }
    items.push({
      id: node.id,
      number: content.number,
      type: content.__typename,
      state: content.state ?? null,
      stateReason: content.stateReason ?? null,
      isArchived: node.isArchived === true,
      title: content.title || "",
      body: content.body || "",
      labels: (content.labels?.nodes || []).map(l => l.name),
      repository: content.repository?.nameWithOwner ?? null,
      authorAssociation: content.authorAssociation ?? null,
      author: content.author?.login ?? null,
      fields
    });
  }
  return items;
}

export function planLabelWrites(item) {
  if (item.labels.some(l => l.startsWith("theme:") || l === "needs-theme")) return { writes: [], drift: [] };

  const fromField = item.fields.theme ? THEME_OPTION_TO_LABEL[item.fields.theme] : null;
  const label = fromField || classifyTheme(item.title, item.body);

  if (label === "needs-theme")
    return { writes: [], drift: [`#${item.number}: no theme label and the title/body do not classify`] };

  return { writes: [{ number: item.number, label }], drift: [] };
}
