// The Icon Library: every icon a slot can reference — the built-in sets, glyphs and the map's custom icons
import { type IconSetId, IconSets } from "@/components/icon-sets";
import { tip } from "@/components/tooltips";
import { sanitizeSvgIcon } from "@/utils/fileUtils";
import { escapeHtml } from "@/utils/stringUtils";

/** where a reference resolves: a built-in set, a glyph built from its text, or a picture the map carries */
export type IconKind = "set" | "glyph" | "custom";

/** the slots that reference icons, as `Icons.uses` counts them */
export type IconUseKind = "good" | "marker" | "regiment" | "unit" | "burgGroup" | "market";

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
const ROOT_FRAME_ATTRIBUTES = new Set(["id", "width", "height", "viewbox", "x", "y", "preserveaspectratio", "version"]);

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
    Options.save();
    return added;
  }

  /** a new picture under the same id, so every slot using the icon follows */
  replace(id: string, picture: IconPicture): void {
    const icon = this.get(id);
    if (!icon) return;
    Object.assign(icon, picture);
    Options.save();
  }

  setFrame(id: string, viewBox: string): void {
    const icon = this.get(id);
    if (!icon) return;
    icon.viewBox = viewBox;
    Options.save();
  }

  /** references are left as they are: a slot pointing at a removed icon draws nothing */
  remove(id: string): void {
    options.map.customIcons = this.all.filter(icon => icon.id !== id);
    Options.save();
  }

  /** a sanitised svg as a picture: its frame, and its art in a group that keeps the root's paint */
  fromSvg(svg: Element): IconPicture {
    const size = (name: string) => Number.parseFloat(svg.getAttribute(name) ?? "") || 0;
    const frame =
      Icons.parseFrame(svg.getAttribute("viewBox") ?? "") ??
      (size("width") && size("height") ? [0, 0, size("width"), size("height")] : [0, 0, 100, 100]);
    const paint = Array.from(svg.attributes)
      .filter(({ name }) => !ROOT_FRAME_ATTRIBUTES.has(name.toLowerCase()) && !name.startsWith("xmlns"))
      .map(({ name, value }) => ` ${name}="${escapeHtml(value)}"`)
      .join("");
    return { kind: "svg", content: `<g${paint}>${svg.innerHTML}</g>`, viewBox: Icons.formatFrame(frame) };
  }
}

export const CustomIcons = new CustomIconList();

/** One set's load state: concurrent callers share an attempt, a failure is cached until an explicit retry */
class IconChunk {
  private status: "idle" | "pending" | "loaded" | "failed" = "idle";
  private promise: Promise<void> | null = null;
  private attempts = 0;

  constructor(
    readonly id: string,
    private readonly inject: () => Promise<void>
  ) {}

  get isLoaded(): boolean {
    return this.status === "loaded";
  }

  /** The shared attempt: a cached failure is handed back as it is, so a redraw can neither start a retry nor repeat the report */
  load(): Promise<void> {
    return this.promise ?? this.start();
  }

  /** An explicit demand: a failed attempt is repeated, while a live one stays shared */
  retry(): Promise<void> {
    if (this.status === "pending" || this.status === "loaded") return this.promise ?? Promise.resolve();
    return this.start();
  }

  private start(): Promise<void> {
    this.status = "pending";
    this.attempts += 1;
    this.promise = this.attempt();
    return this.promise;
  }

  /** never rejects: the chunk reports its own failure, once per attempt */
  private async attempt(): Promise<void> {
    try {
      await this.inject();
      this.status = "loaded";
    } catch (error) {
      this.status = "failed";
      console.error(`Failed to load ${this.id} icons`, error);
      const advice = this.attempts > 1 ? "Please reload the page." : "Reload the page or retry the action.";
      tip(`Cannot load ${this.id} icons. ${advice}`, false, "error", 8000);
    }
  }
}

/** Every icon reference is a bare symbol id; its symbols live in `#defElements defs > g#icons-library > g[data-set]` */
class IconLibrary {
  /** the paint of art drawn in the interface, where no style colours it: a burg's default look */
  readonly paint = { fill: "#ffffff", stroke: "#3e3e4b" };
  private readonly defs = "#defElements defs";
  private readonly container = "icons-library";
  private readonly chunks = new Map<IconSetId, IconChunk>();

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
    if (this.kind(id) !== "glyph") return null;
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
    const set = IconSets.setForId(id);
    const file = set && IconSets.files(set).find(file => IconSets.symbolId(set, file) === id);
    const name = file ? file.slice(file.lastIndexOf("/") + 1) : id.slice(set ? set.length + 1 : 0);
    return name.replace(/-1$/, "").replaceAll("-", " ");
  }

  /** The `<use>` href of an icon reference: a glyph symbol is built on first use, a set starts loading.
   * `<use>` resolves an id that appears later, so a caller draws at once and the icon shows when it lands */
  href(id: string): string {
    if (!id) return "";
    const kind = this.kind(id);
    if (kind === "glyph") this.ensureGlyph(id);
    else if (kind === "set") {
      const set = IconSets.setForId(id)!;
      if (!this.isLoaded(set) && document.querySelector(this.defs)) void this.load(set);
    }
    return `#${id}`;
  }

  /** An inline svg drawing an icon in the interface: art in the default paint, a glyph in the text colour */
  html(id: string): string {
    if (!id) return "";
    const { fill, stroke } = this.paint;
    const paint = this.kind(id) === "glyph" ? ` fill="currentColor"` : ` fill="${fill}" stroke="${stroke}"`;
    return /*html*/ `<svg viewBox="0 0 100 100" width="1em" height="1em" aria-hidden="true"${paint}><use href="${escapeHtml(this.href(id))}" width="100" height="100"/></svg>`;
  }

  /** the symbol's frame in the page, `[x, y, width, height]` */
  frame(id: string): number[] | null {
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
    const burgGroups = Object.values(styles.burgIcons.groups).flatMap(({ groups }) => [
      groups.icons.options,
      groups.anchors.options
    ]);
    const slots: [IconUseKind, readonly { icon?: string }[]][] = [
      ["good", pack.goods ?? []],
      ["marker", pack.markers ?? []],
      ["regiment", (pack.states ?? []).flatMap(state => state?.military ?? [])],
      ["unit", options.map.military.units],
      ["burgGroup", burgGroups],
      ["market", [styles.markets.options]]
    ];
    const counts: Partial<Record<IconUseKind, number>> = {};
    for (const [kind, owners] of slots) {
      const count = owners.filter(owner => owner.icon === id).length;
      if (count) counts[kind] = count;
    }
    return counts;
  }

  /** the page group holding a set's, the glyphs' or the custom icons' symbols */
  group(set: IconSetId | "glyph" | "custom"): Element | null {
    return document.querySelector(`${this.defs} > #${this.container} > [data-set="${set}"]`);
  }

  isLoaded(set: IconSetId): boolean {
    return this.chunk(set).isLoaded;
  }

  load(set: IconSetId): Promise<void> {
    return this.chunk(set).load();
  }

  loadAll(sets: readonly IconSetId[]): Promise<void> {
    return Promise.all(sets.map(set => this.load(set))).then(() => undefined);
  }

  /** an explicit demand, e.g. a picker or an export after a failed attempt */
  retry(set: IconSetId): Promise<void> {
    return this.chunk(set).retry();
  }

  /** Rebuild every custom icon symbol from the map's list: startup, a map load, a change in the picker */
  syncCustom(icons: readonly CustomIcon[] = CustomIcons.all): void {
    const group = this.ensureGroup("custom");
    if (group) group.innerHTML = icons.map(icon => this.customSymbol(icon)).join("");
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

  private chunk(set: IconSetId): IconChunk {
    const existing = this.chunks.get(set);
    if (existing) return existing;
    const chunk = new IconChunk(set, () => this.inject(set));
    this.chunks.set(set, chunk);
    return chunk;
  }
}

export const Icons = new IconLibrary();
