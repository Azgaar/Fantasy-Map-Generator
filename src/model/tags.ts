import { type EntityRef, MapEntities } from "@/model/map-entities";

export interface Taggable {
  tags?: string[];
}

export class TagsModule {
  /** Parse a comma/semicolon-separated string or string array into trimmed, lowercase, unique tags */
  parse(input?: string | string[] | null): string[] {
    if (!input) return [];
    const raw = Array.isArray(input)
      ? input.flatMap(i => (typeof i === "string" ? i.split(/[,;]/) : []))
      : input.split(/[,;]/);
    return [...new Set(raw.map(tag => this.normalize(tag)).filter(Boolean))];
  }

  /** Lowercase letters, numbers, spaces and `_-'.` only: tags go into markup and attributes unescaped */
  private normalize(tag: unknown): string {
    if (typeof tag !== "string") return "";
    return tag
      .replace(/[^\p{L}\p{M}\p{N}\s_'.-]/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase();
  }

  /** Format an array of tags as a comma-separated display string; tags from a loaded file are normalized too */
  format(tags?: string[] | null): string {
    return Array.isArray(tags) ? this.parse(tags).join(", ") : "";
  }

  /** Check if an entity matches a search query by name, alias, or tag */
  matches(query: string, name?: string, tags?: string[], aliases: (string | null | undefined)[] = []): boolean {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return true;

    if (q.startsWith("#")) {
      const tagQuery = q.slice(1).trim();
      if (!tagQuery) return Boolean(tags && tags.length > 0);
      return Boolean(tags?.some(tag => tag.toLocaleLowerCase().includes(tagQuery)));
    }

    if (name?.toLocaleLowerCase().includes(q)) return true;
    if (aliases.some(alias => alias?.toLocaleLowerCase().includes(q))) return true;
    if (tags?.some(tag => tag.toLocaleLowerCase().includes(q))) return true;
    return false;
  }

  /** Resolve target object from Taggable or EntityRef */
  private resolve(target?: Taggable | EntityRef | null): Taggable | undefined {
    if (!target || typeof target !== "object") return undefined;
    if ("type" in target && "id" in target) {
      return MapEntities.get(target);
    }
    return target;
  }

  /** Get tags from an entity or EntityRef */
  get(target?: Taggable | EntityRef | null): string[] {
    return this.resolve(target)?.tags ?? [];
  }

  /** Set tags on an entity or EntityRef, normalizing them */
  set(target?: Taggable | EntityRef | null, tags?: string | string[] | null): string[] {
    const entity = this.resolve(target);
    if (!entity) return [];
    const parsed = this.parse(tags);
    entity.tags = parsed;
    return parsed;
  }

  /** Add one or more tags to an entity or EntityRef */
  add(target?: Taggable | EntityRef | null, ...tags: (string | string[])[]): string[] {
    const entity = this.resolve(target);
    if (!entity) return [];
    const current = entity.tags ?? [];
    const parsed = this.parse(tags.flat());
    const updated = [...new Set([...current, ...parsed])];
    entity.tags = updated;
    return updated;
  }

  /** Remove one or more tags from an entity or EntityRef */
  remove(target?: Taggable | EntityRef | null, ...tags: string[]): string[] {
    const entity = this.resolve(target);
    if (!entity?.tags) return [];
    const toRemove = new Set(this.parse(tags));
    entity.tags = entity.tags.filter(tag => !toRemove.has(tag));
    return entity.tags;
  }

  /** Check if an entity or EntityRef has a specific tag */
  has(target?: Taggable | EntityRef | null, tag?: string | null): boolean {
    if (!tag) return false;
    const targetTag = this.normalize(tag);
    if (!targetTag) return false;
    return this.get(target).some(t => t.toLocaleLowerCase() === targetTag);
  }

  /** Get all unique tags across a collection of items */
  all(items: (Taggable | null | undefined)[]): string[] {
    return this.parse(items.flatMap(item => (item && typeof item === "object" ? (item.tags ?? []) : []))).sort();
  }
}

export const Tags = new TagsModule();
