import type { BurgIconSetId } from "@/generators/burgs-generator";
import type { ReliefIconSetId } from "@/generators/relief-generator";
import type { IconSet } from "@/types/icons";

export type IconSetId = ReliefIconSetId | BurgIconSetId | typeof Goods.iconSet.id;

/** The catalog of the built-in sets: their files and the symbols they make; `Icons` puts them in the page */
export class IconSetRegistry {
  private readonly sources = import.meta.glob("@/assets/icons/**/*.svg", { query: "?raw", import: "default" });

  /** the models that own icon sets; a new family adds its model here, a new relief set is a directory plus its name in `Relief.sets` */
  sets(): readonly IconSet[] {
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

  /** a set's file names, known before the chunk loads: the path within the folder, `watabou/capital` */
  files(id: IconSetId): string[] {
    return [...this.loaders(this.get(id).folder).keys()];
  }

  /** the set a symbol id belongs to, or none for map-carried and foreign art */
  setForId(symbolId: string): IconSetId | undefined {
    return this.sets().find(set => symbolId.startsWith(`${set.id}-`))?.id as IconSetId | undefined;
  }

  /** the names a picker offers for a set: its files, or the ones the set declares */
  choices(id: IconSetId): readonly string[] {
    return this.get(id).choices ?? this.files(id);
  }

  /** a set's symbols, read from its lazy chunk */
  async read(set: IconSet): Promise<string> {
    const entries = [...this.loaders(set.folder)].map(
      async ([name, load]) => [name, (await load()) as string] as const
    );
    return this.symbols(set, Object.fromEntries(await Promise.all(entries)));
  }

  /** Every set converts its files the same way; a set with `aliases` additionally emits a symbol per missing name */
  symbols(set: IconSet, files: Record<string, string>): string {
    const names = Object.keys(files);
    const symbols = names.map(name => {
      const symbol = this.svgToSymbol(files[name], this.symbolId(set.id, name));
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
    const prefix = `/assets/icons/${folder}/`;
    const files = Object.entries(this.sources)
      .filter(([path]) => path.includes(prefix))
      .map(([path, load]) => [path.slice(path.indexOf(prefix) + prefix.length).replace(/\.svg$/, ""), load] as const)
      .sort(([a], [b]) => a.localeCompare(b));
    return new Map(files);
  }
}

export const IconSets = new IconSetRegistry();
