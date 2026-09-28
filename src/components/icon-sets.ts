import type { BurgIconSetId } from "@/generators/burgs-generator";
import type { ChargeIconSetId } from "@/generators/emblems-generator";
import type { ReliefIconSetId } from "@/generators/relief-generator";
import type { IconSet } from "@/types/icons";

export type IconSetId = ReliefIconSetId | BurgIconSetId | typeof Goods.iconSet.id | ChargeIconSetId;

/** The catalog of the built-in sets: their files and the symbols they make; `Icons` puts them in the page */
export class IconSetRegistry {
  private readonly sources = import.meta.glob("@/assets/icons/**/*.svg", { query: "?raw", import: "default" });
  private readonly folders = new Map<string, Map<string, () => Promise<unknown>>>(); // the glob never changes
  private catalog: readonly IconSet[] | null = null; // the models' sets never change either
  private index: Map<string, { set: IconSetId; file: string }> | null = null;

  /** the models that own icon sets, in picker order; a new family adds its model here, a new relief set is a directory plus its name in `Relief.sets` */
  sets(): readonly IconSet[] {
    this.catalog ??= [...Burgs.iconSets, Goods.iconSet, ...Relief.iconSets, ...window.Emblems.iconSets];
    return this.catalog;
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

  /** a set's directory under `src/assets/icons/`: `relief-simple` → `relief/simple` */
  folder(id: string): string {
    return id.replace("-", "/");
  }

  /** a set's file names, known before the chunk loads: the path within the folder, `watabou/capital` */
  files(id: IconSetId): string[] {
    return [...this.loaders(this.folder(id)).keys()];
  }

  /** the set a symbol id belongs to, or none for map-carried and foreign art */
  setForId(symbolId: string): IconSetId | undefined {
    return this.sets().find(set => symbolId.startsWith(`${set.id}-`))?.id as IconSetId | undefined;
  }

  /** the set and file a symbol id is drawn from; none for aliases and foreign art */
  fileOf(symbolId: string): { set: IconSetId; file: string } | undefined {
    this.index ??= new Map(
      this.sets().flatMap(({ id }) =>
        this.files(id as IconSetId).map(file => [this.symbolId(id, file), { set: id as IconSetId, file }] as const)
      )
    );
    return this.index.get(symbolId);
  }

  /** a set's symbols, read from its lazy chunk */
  async read(set: IconSet): Promise<string> {
    const entries = [...this.loaders(this.folder(set.id))].map(
      async ([name, load]) => [name, (await load()) as string] as const
    );
    return this.symbols(set, Object.fromEntries(await Promise.all(entries)));
  }

  /** Every set converts its files the same way; a set with `aliases` additionally emits a symbol per missing name */
  symbols(set: IconSet, files: Record<string, string>): string {
    const names = Object.keys(files);
    const symbols = names.map(name => {
      const id = this.symbolId(set.id, name);
      const symbol = this.svgToSymbol(set.prepare ? set.prepare(files[name], id) : files[name], id);
      return set.em ? this.anchorSymbol(symbol) : symbol;
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

  /** Art drawn around its anchor keeps its anchor-relative frame, which a renderer reads to place it (`Icons.anchoredBox`);
   * the art may overflow the frame, so it never clips */
  anchorSymbol(symbol: string): string {
    if (!/^<symbol\b[^>]*?\sviewBox="-?[\d.]+ -?[\d.]+ [\d.]+ [\d.]+"/.test(symbol))
      throw new Error(`Anchored art needs a plain "x y w h" viewBox: ${symbol.slice(0, 80)}`);
    return symbol.replace(/^<symbol\b/, '<symbol overflow="visible"');
  }

  private aliasSymbol(id: string, target: string): string {
    return `<symbol id="${id}" viewBox="0 0 100 100"><use href="#${target}" width="100" height="100"/></symbol>`;
  }

  /** a set's files by name (the path within its folder without `.svg`), each with its lazy source loader */
  private loaders(folder: string): Map<string, () => Promise<unknown>> {
    const cached = this.folders.get(folder);
    if (cached) return cached;
    const prefix = `/assets/icons/${folder}/`;
    const files = Object.entries(this.sources)
      .filter(([path]) => path.includes(prefix))
      .map(([path, load]) => [path.slice(path.indexOf(prefix) + prefix.length).replace(/\.svg$/, ""), load] as const)
      .sort(([a], [b]) => a.localeCompare(b));
    const loaders = new Map(files);
    this.folders.set(folder, loaders);
    return loaders;
  }
}

export const IconSets = new IconSetRegistry();
