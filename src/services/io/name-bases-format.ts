import { BASE_ID_PATTERN, deriveBaseId, getDefaultNameBases, type NameBase } from "@/data/name-bases";

/**
 * The `.map` name-base slot: `id|name|min|max|d|m|names`, rows joined by `/`.
 *
 * Rows saved before ids existed carry no id column; the id then comes from the shipped base at the
 * same position, or is derived from the name for bases the generator never shipped. An empty
 * `names` field means the shipped content for that id.
 */
export function parseNameBases(rows: string | undefined, defaults: NameBase[] = getDefaultNameBases()): NameBase[] {
  if (!rows) return defaults.map(base => ({ ...base }));

  const taken = new Set<string>();
  return rows.split("/").map((row, i) => {
    const fields = row.split("|");
    // Only a well-formed id marks the new layout; anything else is a legacy row, including one
    // whose corpus accidentally contains a separator.
    const hasId = fields.length === 7 && BASE_ID_PATTERN.test(fields[0].trim().toUpperCase());
    const [rawId, rawName = "", min = "5", max = "12", d = "", m = "0", names = ""] = hasId
      ? fields
      : [undefined, ...fields.slice(0, 6)];

    const candidate = rawId?.trim().toUpperCase();
    const fallbackId = defaults[i]?.id;
    const id =
      candidate && BASE_ID_PATTERN.test(candidate) && !taken.has(candidate)
        ? candidate
        : fallbackId && !taken.has(fallbackId)
          ? fallbackId
          : deriveBaseId(rawName, taken);
    taken.add(id);

    const b = names ? names : (defaults.find(base => base.id === id)?.b ?? "");
    return { id, name: rawName, i, min: +min, max: +max, d, m: +m, b };
  });
}

/** The inverse of {@link parseNameBases}; empty `names` when the base still carries shipped content */
export function serializeNameBases(bases: NameBase[], defaults: NameBase[] = getDefaultNameBases()): string {
  const defaultContent = new Map(defaults.map(base => [base.id, base.b]));
  return bases
    .map(base => {
      const names = defaultContent.get(base.id) === base.b ? "" : base.b;
      return `${base.id}|${base.name}|${base.min}|${base.max}|${base.d}|${base.m}|${names}`;
    })
    .join("/");
}

/**
 * Point every culture at a base id.
 *
 * Saved maps from before ids store a position instead, which is resolved through the parsed list so
 * an overridden or shortened list keeps its own order.
 */
export function normalizeCultureBases(cultures: { base?: unknown }[], bases: NameBase[]): void {
  const fallback = bases[0]?.id;
  if (!fallback) return;

  for (const culture of cultures) {
    if (!culture) continue;
    if (typeof culture.base === "number") culture.base = bases[culture.base]?.id ?? fallback;
    else if (!bases.some(base => base.id === culture.base)) culture.base = fallback;
  }
}
