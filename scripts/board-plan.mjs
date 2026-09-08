import { PRIORITY_OPTIONS, SIZE_OPTIONS } from "./board-fields.mjs";

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
