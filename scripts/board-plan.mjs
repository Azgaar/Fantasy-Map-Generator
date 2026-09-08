import {
  FIELD_IDS,
  PRIORITY_OPTIONS,
  SIZE_OPTIONS,
  THEME_LABEL_TO_OPTION,
  THEME_OPTIONS
} from "./board-fields.mjs";

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
  if (rawSize && !size) errors.push(`unknown Size value: ${rawSize}`);

  return { priority, size, errors };
}

const FIELDS = {
  theme: { id: FIELD_IDS.theme, label: "Theme", options: THEME_OPTIONS },
  priority: { id: FIELD_IDS.priority, label: "Priority", options: PRIORITY_OPTIONS },
  size: { id: FIELD_IDS.size, label: "Size", options: SIZE_OPTIONS }
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

  const themeLabels = item.labels.filter(l => Object.hasOwn(THEME_LABEL_TO_OPTION, l));
  if (themeLabels.length > 1) drift.push(`#${item.number}: two theme labels, ${themeLabels.join(", ")}`);
  else if (themeLabels.length === 1) consider("theme", THEME_LABEL_TO_OPTION[themeLabels[0]]);

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
      fields
    });
  }
  return items;
}
