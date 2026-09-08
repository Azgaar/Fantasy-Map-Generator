import { PRIORITY_OPTIONS, SIZE_OPTIONS, THEME_LABEL_TO_OPTION, THEME_OPTIONS } from "./board-fields.mjs";
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
  const block = (body || "").match(/###\s*Triage\s*\n([\s\S]*?)(?=\n###\s|\s*$)/i);
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

export function planFieldWrites(item) {
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

  const triage = parseTriage(item.body);
  for (const error of triage.errors) drift.push(`#${item.number}: ${error}`);
  consider("priority", triage.priority);
  consider("size", triage.size);

  return { writes, drift };
}

const FIELD_BY_NAME = { Theme: "theme", Priority: "priority", Size: "size" };

export function itemsFromGraphql(nodes) {
  const items = [];
  for (const node of nodes) {
    const content = node.content || {};
    if (!content.number) continue;
    const fields = { theme: null, priority: null, size: null };
    for (const value of node.fieldValues.nodes) {
      const key = FIELD_BY_NAME[value?.field?.name];
      if (key) fields[key] = value.name;
    }
    items.push({
      id: node.id,
      number: content.number,
      type: content.__typename,
      title: content.title || "",
      body: content.body || "",
      labels: (content.labels?.nodes || []).map(l => l.name),
      repository: content.repository?.nameWithOwner ?? null,
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
