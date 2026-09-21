import { tip } from "@/components/tooltips";
import type { BurgIconSetId } from "@/generators/burgs-generator";
import type { ReliefIconSetId } from "@/generators/relief-generator";
import type { IconSet } from "@/types/icons";

export type IconSetId = ReliefIconSetId | BurgIconSetId | typeof Goods.iconSet.id;

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

/** The catalog of every set, the id rule, and the loader that turns a set's files into symbols in the document */
export class IconSetRegistry {
  /** where every set's group goes; map-carried art (`custom-<set>-…`) sits beside the groups */
  readonly defs = "#defElements defs";
  private readonly sources = import.meta.glob("@/assets/icons/**/*.svg", { query: "?raw", import: "default" });
  private readonly chunks = new Map<string, IconChunk>();

  /** the models that own icon sets; a new family adds its model here, a new relief set is a directory plus its name in `Relief.sets` */
  private sets(): readonly IconSet[] {
    return [...Relief.iconSets, ...Burgs.iconSets, Goods.iconSet];
  }

  get(id: IconSetId): IconSet {
    const set = this.sets().find(set => set.id === id);
    if (!set) throw new Error(`Unknown icon set: ${id}`);
    return set;
  }

  /** the symbol id of a set's file (`watabou/capital`) or alias name */
  symbolId(set: string, name: string): string {
    return `${set}-${name.replaceAll("/", "-")}`;
  }

  /** the group a loaded set's symbols live in */
  containerId(id: string): string {
    return `icons-${id}`;
  }

  /** the reserved namespace of art a map carries for a set: never a symbol the set provides */
  customPrefix(id: IconSetId): string {
    return `custom-${id}-`;
  }

  /** a set's file names, known before the chunk loads: the path within the folder, `watabou/capital` */
  files(id: IconSetId): string[] {
    return [...this.loaders(this.get(id).folder).keys()];
  }

  /** the set a symbol id belongs to, or none for map-carried and foreign art */
  setForId(symbolId: string): IconSetId | undefined {
    return this.sets().find(set => symbolId.startsWith(`${set.id}-`))?.id as IconSetId | undefined;
  }

  /** the human name of a symbol: its id without the set prefix */
  name(symbolId: string): string {
    const id = symbolId.replace(/^#/, "");
    const set = this.setForId(id);
    return (set ? id.slice(set.length + 1) : id).replaceAll("-", " ");
  }

  isLoaded(id: IconSetId): boolean {
    return this.chunk(id).isLoaded;
  }

  load(id: IconSetId): Promise<void> {
    return this.chunk(id).load();
  }

  loadAll(ids: readonly IconSetId[]): Promise<void> {
    return Promise.all(ids.map(id => this.load(id))).then(() => undefined);
  }

  /** an explicit demand, e.g. a picker or an export after a failed attempt */
  retry(id: IconSetId): Promise<void> {
    return this.chunk(id).retry();
  }

  /** Every set converts its files the same way; a set with `aliases` additionally emits a symbol per missing name */
  symbols(set: IconSet, files: Record<string, string>): string {
    const names = Object.keys(files);
    const symbols = names.map(name => {
      const symbol = this.svgToSymbol(files[name], this.symbolId(set.id, name));
      return set.em ? this.anchorSymbol(symbol, set.em) : symbol;
    });
    const aliases = (set.aliases?.(names) ?? []).map(({ name, target }) =>
      this.aliasSymbol(this.symbolId(set.id, name), this.symbolId(set.id, target))
    );
    return symbols.concat(aliases).join("");
  }

  /** the file's root `<svg>` becomes the symbol; its artwork, metadata and sizing stay as they are */
  svgToSymbol(svg: string, id: string): string {
    const match = svg.trim().match(/^<svg\b([^>]*)>([\s\S]*)<\/svg>$/);
    if (!match) throw new Error(`Invalid SVG for ${id}`);
    const attrs = match[1].replace(/\s+(?:xmlns(?::[\w-]+)?|id)\s*=\s*(?:"[^"]*"|'[^']*')/g, "");
    return `<symbol id="${id}"${attrs}>${match[2]}</symbol>`;
  }

  /** Art drawn around its anchor: keep the frame, size it in em and move the anchor to the frame's corner,
   * so `<use x y>` under the group's font-size lands the anchor on the point and the art overflows around it */
  anchorSymbol(symbol: string, em: number): string {
    return symbol.replace(
      /^(<symbol\b[^>]*?)viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"([^>]*)>([\s\S]*)<\/symbol>$/,
      (_, open, x, y, w, h, rest, inner) =>
        `${open}viewBox="${x} ${y} ${w} ${h}" width="${w / em}em" height="${h / em}em" overflow="visible"${rest}>` +
        `<g transform="translate(${x} ${y})">${inner}</g></symbol>`
    );
  }

  private aliasSymbol(id: string, target: string): string {
    return `<symbol id="${id}" viewBox="0 0 100 100"><use href="#${target}" width="100" height="100"/></symbol>`;
  }

  /** a set's files by name (the path within its folder without `.svg`), each with its lazy source loader */
  private loaders(folder: string): Map<string, () => Promise<unknown>> {
    const prefix = `/assets/icons/${folder}/`;
    const files = Object.entries(this.sources)
      .filter(([path]) => path.includes(prefix))
      .map(([path, load]) => [path.slice(path.indexOf(prefix) + prefix.length).replace(/\.svg$/, ""), load] as const)
      .sort(([a], [b]) => a.localeCompare(b));
    return new Map(files);
  }

  /** Prepare the whole group before appending, so a failure leaves no partial definitions */
  private async inject(set: IconSet): Promise<void> {
    const entries = [...this.loaders(set.folder)].map(
      async ([name, load]) => [name, (await load()) as string] as const
    );
    const files = Object.fromEntries(await Promise.all(entries));
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.id = this.containerId(set.id);
    group.innerHTML = this.symbols(set, files);
    const parent = document.querySelector(this.defs);
    if (!parent) throw new Error(`Missing icon container for ${set.id}`);
    parent.appendChild(group);
  }

  private chunk(id: IconSetId): IconChunk {
    const existing = this.chunks.get(id);
    if (existing) return existing;
    const set = this.get(id);
    const chunk = new IconChunk(id, () => this.inject(set));
    this.chunks.set(id, chunk);
    return chunk;
  }
}

export const IconSets = new IconSetRegistry();
