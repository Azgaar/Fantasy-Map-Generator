// The Icon Library: every icon a slot can reference — the built-in sets, glyphs and the map's custom icons
import { type IconSetId, IconSets } from "@/components/icon-sets";
import { tip } from "@/components/tooltips";
import type { IconPaint } from "@/types/icons";
import { sanitizeSvgIcon } from "@/utils/fileUtils";
import { escapeHtml } from "@/utils/stringUtils";

/** where a reference resolves: a built-in set, a glyph built from its text, or a picture the map carries */
export type IconKind = "set" | "glyph" | "custom";

type IconOwner = { icon?: string };

/** the slots that reference icons, as `Icons.uses` counts them: their singular and plural name and their owners */
const SLOTS = {
  good: { names: ["good", "goods"], owners: () => pack.goods ?? [] },
  marker: { names: ["marker", "markers"], owners: () => pack.markers ?? [] },
  regiment: {
    names: ["regiment", "regiments"],
    owners: () => (pack.states ?? []).flatMap(state => state?.military ?? [])
  },
  unit: { names: ["unit type", "unit types"], owners: () => options.map.military.units },
  burgGroup: {
    names: ["burg group style", "burg group styles"],
    owners: () =>
      Object.values(styles.burgIcons.groups).flatMap(({ groups }) => [groups.icons.options, groups.anchors.options])
  },
  market: { names: ["market marker style", "market marker styles"], owners: () => [styles.markets.options] },
  emblem: {
    names: ["emblem", "emblems"],
    owners: () =>
      [...(pack.states ?? []), ...(pack.provinces ?? []), ...(pack.burgs ?? [])].flatMap(entity => {
        const coa = entity.i && !entity.removed ? entity.coa : undefined;
        if (!coa) return [];
        return "icon" in coa ? [coa] : (coa.charges ?? []).map(({ charge }) => ({ icon: charge }));
      })
  },
  relief: {
    names: ["relief icon", "relief icons"],
    owners: () => (pack.relief ?? []).flatMap(icon => ("icon" in icon ? [icon] : []))
  },
  biome: {
    names: ["biome relief pool", "biome relief pools"],
    owners: () =>
      (pack.biomes ?? []).flatMap(biome => (biome.removed ? [] : Object.keys(biome.icons).map(icon => ({ icon }))))
  }
} satisfies Record<string, { names: readonly [string, string]; owners: () => readonly IconOwner[] }>;
export type IconUseKind = keyof typeof SLOTS;

export interface CustomIcon {
  id: string; // the symbol id: `custom-<8 hex>`, or `custom-goods-<id>` for uploads kept from older maps
  kind: "svg" | "image";
  content: string; // svg: sanitised, scoped markup; image: http(s) URL or data: URI
  viewBox: string; // the icon frame, "x y w h"; an image is letterboxed in 0 0 100 100
}

export type IconPicture = Omit<CustomIcon, "id">;

export const IMAGE_FRAME = "0 0 100 100";

const GLYPH_PREFIX = "glyph-";
const CUSTOM_PREFIX = "custom-";

/** The pictures a map carries: part of its setup like the transport types, saved in `options.map.customIcons` */
class CustomIconList {
  get all(): CustomIcon[] {
    return options.map.customIcons;
  }

  get(id: string): CustomIcon | undefined {
    return this.all.find(icon => icon.id === id);
  }

  /** crypto, not the seeded Math.random: adding an icon must not shift the map's random sequence */
  newId(): string {
    let id: string;
    do id = `${CUSTOM_PREFIX}${crypto.randomUUID().slice(0, 8)}`;
    while (this.get(id));
    return id;
  }

  add(icon: IconPicture & { id?: string }): CustomIcon {
    const added = { ...icon, id: icon.id ?? this.newId() };
    this.all.push(added);
    this.changed(added.id);
    return added;
  }

  /** a new picture or frame under the same id, so every slot using the icon follows */
  update(id: string, patch: Partial<IconPicture>): void {
    const icon = this.get(id);
    if (!icon) return;
    Object.assign(icon, patch);
    this.changed(id);
  }

  /** references are left as they are: a slot pointing at a removed icon draws nothing */
  remove(id: string): void {
    options.map.customIcons = this.all.filter(icon => icon.id !== id);
    this.changed(id);
  }

  private changed(id: string): void {
    Options.iconsChanged();
    Icons.syncCustomIcon(id);
  }
}

export const CustomIcons = new CustomIconList();

/** a slot's colours without its unset ones, so they never hide the icon's */
function definedPaint(paint: IconPaint): IconPaint {
  return Object.fromEntries(Object.entries(paint).filter(([, value]) => value !== undefined && value !== ""));
}

/** Every icon reference is a bare symbol id; its symbols live in `#defElements defs > g#icons-library > g[data-set]` */
class IconLibrary {
  private readonly defs = "#defElements defs";
  private readonly container = "icons-library";
  private readonly loading = new Map<IconSetId, Promise<void>>(); // the latest attempt per set
  private readonly settled = new Map<IconSetId, "loaded" | "failed">(); // the latest attempt's outcome

  kind(id: string): IconKind | null {
    if (id.startsWith(GLYPH_PREFIX)) return "glyph";
    if (id.startsWith(CUSTOM_PREFIX)) return "custom";
    return IconSets.setForId(id) ? "set" : null;
  }

  /** The reference of a glyph: its code points in hex, `XIV` → `glyph-58-49-56`; empty text is no icon */
  glyph(text: string): string {
    if (!text) return "";
    return GLYPH_PREFIX + Array.from(text, char => char.codePointAt(0)!.toString(16)).join("-");
  }

  /** The text a glyph reference draws, or null for any other reference */
  glyphText(id: string): string | null {
    if (!id.startsWith(GLYPH_PREFIX)) return null;
    const points = id
      .slice(GLYPH_PREFIX.length)
      .split("-")
      .map(hex => Number.parseInt(hex, 16));
    return points.every(point => point >= 0 && point <= 0x10ffff) ? String.fromCodePoint(...points) : null;
  }

  /** the human name of an icon: a glyph's text, a set icon's file name */
  name(id: string): string {
    if (!id) return "none";
    const kind = this.kind(id);
    if (kind === "glyph") return this.glyphText(id) ?? id;
    if (kind === "custom") return "custom icon";
    const file = IconSets.fileOf(id)?.file;
    const set = IconSets.setForId(id);
    const name = file ? file.slice(file.lastIndexOf("/") + 1) : id.slice(set ? set.length + 1 : 0);
    return name
      .replace(/-1$/, "")
      .replaceAll("-", " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  }

  /** The `<use>` href of an icon reference: a glyph symbol is built on first use, a set starts loading.
   * `<use>` resolves an id that appears later, so a caller draws at once and the icon shows when it lands */
  href(id: string): string {
    if (!id) return "";
    const kind = this.kind(id);
    if (kind === "glyph") this.ensureGlyph(id);
    else if (kind === "set") {
      const set = IconSets.setForId(id)!;
      if (!this.loading.has(set) && document.querySelector(this.defs)) void this.load(set);
    }
    return `#${id}`;
  }

  /** The paint art takes where its slot sets none: its set's, the text colour for a glyph; a custom icon keeps its own */
  paint(id: string): IconPaint {
    const kind = this.kind(id);
    if (kind === "glyph") return { fill: "currentColor" };
    if (kind !== "set") return {};
    return IconSets.get(IconSets.setForId(id)!).paint ?? {};
  }

  /** The paint as attributes of a `<use>` in a slot with no paint of its own: the slot's colours over the icon's */
  paintAttributes(id: string, own: IconPaint = {}): string {
    const { fill, stroke, strokeWidth } = { ...this.paint(id), ...definedPaint(own) };
    return [
      fill && ` fill="${escapeHtml(fill)}"`,
      stroke && ` stroke="${escapeHtml(stroke)}"`,
      strokeWidth !== undefined && ` stroke-width="${strokeWidth}"`
    ]
      .filter(Boolean)
      .join("");
  }

  /** An inline svg drawing an icon in the interface in its paint, or in a slot's own colours; `attributes` go on the svg as they are */
  html(id: string, own?: IconPaint, attributes = ""): string {
    if (!id) return "";
    return /*html*/ `<svg viewBox="0 0 100 100" width="1em" height="1em" aria-hidden="true"${this.paintAttributes(id, own)}${attributes}><use href="${escapeHtml(this.href(id))}" width="100" height="100"/></svg>`;
  }

  /** the symbol's frame in the page, `[x, y, width, height]` */
  private frame(id: string): number[] | null {
    return this.parseFrame(document.getElementById(id)?.getAttribute("viewBox") ?? "");
  }

  /** where anchored art (its set declares `em`) sits around its point, in em; null for boxed icons */
  anchoredBox(id: string): number[] | null {
    const set = IconSets.setForId(id);
    const em = set && IconSets.get(set).em;
    const frame = em ? this.frame(id) : null;
    return em && frame ? frame.map(value => value / em) : null;
  }

  /** An icon frame, `"x y w h"`, as four numbers; null when it is not one */
  parseFrame(viewBox: string): number[] | null {
    const values = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const [, , width, height] = values;
    return values.length === 4 && values.every(Number.isFinite) && width > 0 && height > 0 ? values : null;
  }

  formatFrame(values: readonly number[]): string {
    return values.map(value => Math.round(value * 1000) / 1000).join(" ");
  }

  /** how many slots of each kind reference an icon */
  uses(id: string): Partial<Record<IconUseKind, number>> {
    const counts: Partial<Record<IconUseKind, number>> = {};
    for (const [kind, { owners }] of Object.entries(SLOTS)) {
      const count = (owners() as readonly IconOwner[]).filter(owner => owner.icon === id).length;
      if (count) counts[kind as IconUseKind] = count;
    }
    return counts;
  }

  /** "1 good, 12 markers" */
  describeUses(uses: Partial<Record<IconUseKind, number>>): string {
    return Object.entries(uses)
      .map(([kind, count]) => `${count} ${SLOTS[kind as IconUseKind].names[count === 1 ? 0 : 1]}`)
      .join(", ");
  }

  /** the page group holding a set's, the glyphs' or the custom icons' symbols */
  group(set: IconSetId | "glyph" | "custom"): Element | null {
    return document.querySelector(`${this.defs} > #${this.container} > [data-set="${set}"]`);
  }

  isLoaded(set: IconSetId): boolean {
    return this.settled.get(set) === "loaded";
  }

  /** the shared attempt: a cached failure is handed back as it is, so a redraw neither retries nor repeats the report */
  load(set: IconSetId): Promise<void> {
    return this.loading.get(set) ?? this.attempt(set);
  }

  loadAll(sets: readonly IconSetId[]): Promise<void> {
    return Promise.all(sets.map(set => this.load(set))).then(() => undefined);
  }

  /** an explicit demand, e.g. a picker or an export after a failed attempt */
  retry(set: IconSetId): Promise<void> {
    return this.settled.get(set) === "failed" ? this.attempt(set) : this.load(set);
  }

  /** an explicit demand that must succeed, e.g. an export: rejects when a set still fails to load */
  async require(sets: Iterable<IconSetId>): Promise<void> {
    const required = [...new Set(sets)];
    await Promise.all(required.map(set => this.retry(set)));
    const failed = required.find(set => !this.isLoaded(set));
    if (failed) throw new Error(`Failed to load ${failed} icons`);
  }

  /** Rebuild every custom icon symbol from the map's list: startup and a map load */
  syncCustom(icons: readonly CustomIcon[] = CustomIcons.all): void {
    const group = this.ensureGroup("custom");
    if (group) group.innerHTML = icons.map(icon => this.customSymbol(icon)).join("");
  }

  /** Rebuild one custom icon's symbol, or drop it once the icon is removed */
  syncCustomIcon(id: string): void {
    const group = this.ensureGroup("custom");
    if (!group) return;
    Array.from(group.children)
      .find(symbol => symbol.id === id)
      ?.remove();
    const icon = CustomIcons.get(id);
    if (icon) group.insertAdjacentHTML("beforeend", this.customSymbol(icon));
  }

  /** Glyphs inherit fill, font and shadow from where they are drawn; a stroke would outline emoji */
  private ensureGlyph(id: string): void {
    const text = this.glyphText(id);
    if (text === null || document.getElementById(id)) return;
    const symbol = /* html */ `<symbol id="${id}" viewBox="0 0 100 100" overflow="visible">
      <text x="50" y="50" font-size="100" text-anchor="middle" dominant-baseline="central" stroke="none">${escapeHtml(text)}</text></symbol>`;
    this.ensureGroup("glyph")?.insertAdjacentHTML("beforeend", symbol);
  }

  private customSymbol({ id, kind, content, viewBox }: CustomIcon): string {
    const open = `<symbol id="${escapeHtml(id)}" viewBox="${escapeHtml(viewBox)}">`;
    if (kind === "image") {
      if (!/^(https?:\/\/|data:image\/)/.test(content)) return "";
      return `${open}<image href="${escapeHtml(content)}" width="100" height="100"/></symbol>`;
    }
    const svg = sanitizeSvgIcon(`<svg>${content}</svg>`);
    return svg ? `${open}${svg.innerHTML}</symbol>` : "";
  }

  private ensureGroup(set: IconSetId | "glyph" | "custom"): Element | null {
    const existing = this.group(set);
    if (existing) return existing;
    const container = this.ensureContainer();
    if (!container) return null;
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.dataset.set = set;
    container.appendChild(group);
    return group;
  }

  private ensureContainer(): Element | null {
    const defs = document.querySelector(this.defs);
    if (!defs) return null;
    const existing = defs.querySelector(`:scope > #${this.container}`);
    if (existing) return existing;
    const container = document.createElementNS("http://www.w3.org/2000/svg", "g");
    container.id = this.container;
    defs.appendChild(container);
    return container;
  }

  /** Prepare the whole group before appending, so a failure leaves no partial definitions */
  private async inject(set: IconSetId): Promise<void> {
    const symbols = await IconSets.read(IconSets.get(set));
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.dataset.set = set;
    group.innerHTML = symbols;
    const container = this.ensureContainer();
    if (!container) throw new Error(`Missing icon container for ${set}`);
    container.appendChild(group);
  }

  /** never rejects: a failure is reported once per attempt */
  private attempt(set: IconSetId): Promise<void> {
    this.settled.delete(set);
    const attempt = this.inject(set).then(
      () => void this.settled.set(set, "loaded"),
      error => {
        this.settled.set(set, "failed");
        console.error(`Failed to load ${set} icons`, error);
        tip(`Cannot load ${set} icons. Reload the page or retry the action.`, false, "error", 8000);
      }
    );
    this.loading.set(set, attempt);
    return attempt;
  }
}

export const Icons = new IconLibrary();
