// Argument checks for model edits: return the clean value or throw a readable error

/** A usable entity name: trimmed and not empty */
export const requireName = (name: unknown): string => {
  const value = typeof name === "string" ? name.trim() : "";
  if (!value) throw new Error("The name must not be empty");
  return value;
};

/** One of the allowed values, or a readable error listing them */
export const requireOneOf = <T extends string>(value: unknown, allowed: readonly T[], label: string): T => {
  if (!allowed.includes(value as T)) throw new Error(`${label} must be one of: ${allowed.join(", ")}`);
  return value as T;
};

interface Rooted {
  i: number;
  removed?: boolean;
  origins?: (number | null)[] | null;
}

/** Origins for an entity: the first is primary (0 = top level), the rest secondary. None may descend from it */
export function requireOrigins(list: Rooted[], id: number, origins: number[]): number[] {
  if (!Array.isArray(origins) || !origins.length) throw new Error("Name at least one origin; 0 is the top level");
  const unique = [...new Set(origins)];
  const ancestors = (from: number, seen = new Set<number>()): Set<number> => {
    for (const origin of list[from]?.origins ?? []) {
      if (!origin || seen.has(origin)) continue;
      seen.add(origin);
      ancestors(origin, seen);
    }
    return seen;
  };
  for (const [index, origin] of unique.entries()) {
    if (origin === 0 && !index) continue;
    const entity = list[origin];
    if (!Number.isInteger(origin) || !origin || !entity || entity.removed || entity.i !== origin)
      throw new Error(`Origin ${origin} does not exist; only the primary origin may be 0, the top level`);
    if (origin === id || ancestors(origin).has(id))
      throw new Error(`${origin} descends from ${id} and cannot be its origin`);
  }
  return unique;
}

/** A short code of 1 to 3 characters */
export function requireCode(code: unknown): string {
  const value = typeof code === "string" ? code.trim() : "";
  if (!value || value.length > 3) throw new Error("The code must be 1 to 3 characters");
  return value;
}

/** Whether html keeps to the notes editor's subset: no event handlers, JavaScript URLs, scripts or iframes */
export function isSafeHtml(html: string): boolean {
  const TAGS = new Set(
    "p div br hr span strong b em i u s strike a img ol ul li blockquote code h1 h2 h3 h4 h5 h6 sub sup table tbody tr td".split(
      " "
    )
  );
  const ATTRIBUTES = new Set(["href", "src", "alt", "title", "style", "colspan", "rowspan"]);

  const template = document.createElement("template");
  template.innerHTML = html;
  return [...template.content.querySelectorAll("*")].every(
    element =>
      TAGS.has(element.localName) &&
      [...element.attributes].every(attribute => {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.trim();
        if (!ATTRIBUTES.has(name)) return false;
        if (name === "style") return !/url\s*\(|expression\s*\(|@import/i.test(value);
        if (name !== "href" && name !== "src") return true;
        const compact = [...value].filter(character => character.charCodeAt(0) > 32).join("");
        return (
          !/^[a-z][a-z\d+.-]*:/i.test(compact) ||
          (name === "src"
            ? /^(?:https?:|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(compact)
            : /^(?:https?|mailto):/i.test(compact))
        );
      })
  );
}
