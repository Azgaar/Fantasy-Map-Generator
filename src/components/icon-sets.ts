import { tip } from "@/components/tooltips";
import type { ReliefIconRef, ReliefSet, ReliefType } from "@/generators/relief-generator";

const SOURCES = import.meta.glob("@/assets/icons/**/*.svg", { query: "?raw", import: "default" });
const loadFolder = (folder: string) => async (): Promise<Record<string, string>> => {
  const entries = Object.entries(SOURCES).filter(([path]) => path.includes(`/assets/icons/${folder}/`));
  return Object.fromEntries(await Promise.all(entries.map(async ([path, load]) => [path, await load()])));
};

const SETS = {
  "relief-simple": { prefix: "relief-simple-", files: loadFolder("relief/simple") },
  "relief-colored": { prefix: "relief-colored-", files: loadFolder("relief/colored") },
  "relief-gray": { prefix: "relief-gray-", files: loadFolder("relief/gray") },
  "relief-illustrated": { prefix: "relief-illustrated-", files: loadFolder("relief/illustrated") },
  burgs: { prefix: "icon-", files: loadFolder("burgs") },
  goods: { prefix: "good-", files: loadFolder("goods") }
} as const satisfies Record<string, { prefix: string; files: () => Promise<Record<string, string>> }>;

export type IconSetId = keyof typeof SETS;

export const GOOD_ICON_ROOTS =
  '#good-icons > #icons-goods > symbol[id^="good-"], #good-icons > svg[id^="good-custom-"]';

export function svgToSymbol(svg: string, id: string): string {
  const match = svg.trim().match(/^<svg\b([^>]*)>([\s\S]*)<\/svg>$/);
  if (!match) throw new Error(`Invalid SVG for ${id}`);
  const attrs = match[1].replace(/\s+(?:xmlns(?::[\w-]+)?|id)\s*=\s*(?:"[^"]*"|'[^']*')/g, "");
  return `<symbol id="${id}"${attrs}>${match[2]}</symbol>`;
}

/** Convert a chunk's files into symbols, filling every union slot the set does not draw */
export function buildIconSymbols(
  id: IconSetId,
  files: Record<string, string>,
  types: readonly ReliefType[] = Relief.types
): string {
  const { prefix } = SETS[id];
  const art = new Map(
    Object.entries(files).map(([path, svg]) => [
      path
        .split("/")
        .pop()!
        .replace(/\.svg$/, ""),
      svg
    ])
  );
  const symbols = [...art].map(([name, svg]) => svgToSymbol(svg, prefix + name));
  const isRelief = (id: IconSetId): boolean => id.startsWith("relief-");
  if (!isRelief(id)) return symbols.join("");

  for (const { type, variants } of types) {
    for (let variant = 1; variant <= variants; variant++) {
      if (art.has(`${type}-${variant}`)) continue;
      const visited = new Set<string>();
      let candidates: string[] = [];
      let fallback: string | undefined = type;
      while (fallback && !visited.has(fallback)) {
        visited.add(fallback);
        const name: string = fallback;
        candidates = [...art.keys()]
          .filter(key => key.startsWith(`${name}-`))
          .sort((a, b) => Number(a.split("-").pop()) - Number(b.split("-").pop()));
        if (candidates.length) break;
        fallback = types.find(entry => entry.type === name)?.fallback;
      }
      if (!candidates.length) throw new Error(`No artwork for ${id}/${type}-${variant}`);
      const target = candidates[(variant - 1) % candidates.length];
      symbols.push(
        `<symbol id="${prefix}${type}-${variant}" viewBox="0 0 100 100"><use href="#${prefix}${target}" width="100" height="100"/></symbol>`
      );
    }
  }
  return symbols.join("");
}

/** One lazy chunk: it knows its id, its load state and how to inject itself */
class IconChunk {
  private status: "idle" | "pending" | "loaded" | "failed" = "idle";
  private promise: Promise<void> | null = null;
  private attempts = 0;

  constructor(readonly id: IconSetId) {}

  get isLoaded(): boolean {
    return this.status === "loaded";
  }

  /** Concurrent callers share one attempt; a failed attempt is repeated only on retry */
  load({ retry = false }: { retry?: boolean } = {}): Promise<void> {
    if (this.status === "loaded") return Promise.resolve();
    if (this.promise && (this.status === "pending" || !retry)) return this.promise;
    this.status = "pending";
    this.attempts += 1;
    this.promise = this.inject();
    return this.promise;
  }

  /** Renderers: a failed attempt has already been reported, so drawing continues without icons */
  async ensure(options: { retry?: boolean } = {}): Promise<void> {
    try {
      await this.load(options);
    } catch {
      // reported by inject()
    }
  }

  /** Prepare the whole group before appending, so a failure leaves no partial definitions */
  private async inject(): Promise<void> {
    try {
      const files = await SETS[this.id].files();
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.id = `icons-${this.id}`;
      group.innerHTML = buildIconSymbols(this.id, files);
      const parent = document.querySelector(this.id === "goods" ? "#good-icons" : "#defElements defs");
      if (!parent) throw new Error(`Missing icon container for ${this.id}`);
      parent.appendChild(group);
      this.status = "loaded";
    } catch (error) {
      this.status = "failed";
      console.error(`Failed to load ${this.id} icons`, error);
      const advice = this.attempts > 1 ? "Please reload the page." : "Reload the page or retry the action.";
      tip(`Cannot load ${this.id} icons. ${advice}`, false, "error", 8000);
      throw error;
    }
  }
}

export class IconSetRegistry {
  private readonly chunks = new Map<IconSetId, IconChunk>();

  constructor() {
    for (const id of Object.keys(SETS) as IconSetId[]) this.chunks.set(id, new IconChunk(id));
  }

  isLoaded(id: IconSetId): boolean {
    return this.chunk(id).isLoaded;
  }

  load(id: IconSetId, options: { retry?: boolean } = {}): Promise<void> {
    return this.chunk(id).load(options);
  }

  ensure(id: IconSetId, options: { retry?: boolean } = {}): Promise<void> {
    return this.chunk(id).ensure(options);
  }

  ensureAll(ids: readonly IconSetId[], options: { retry?: boolean } = {}): Promise<void> {
    return Promise.all(ids.map(id => this.ensure(id, options))).then(() => undefined);
  }

  /** every relief chunk a draw needs: the style's set plus each explicit pin in the map */
  reliefSets(icons: readonly ReliefIconRef[], styleSet: ReliefSet): IconSetId[] {
    const sets = new Set<IconSetId>([`relief-${styleSet}`]);
    for (const icon of icons) if (icon.set) sets.add(`relief-${icon.set}`);
    return [...sets];
  }

  setForId(id: string): IconSetId | undefined {
    if (id.startsWith("icon-")) return "burgs";
    if (id.startsWith("good-") && !id.startsWith("good-custom-")) return "goods";
    return Relief.sets.map(set => `relief-${set}` as IconSetId).find(set => id.startsWith(`${set}-`));
  }

  private chunk(id: IconSetId): IconChunk {
    const chunk = this.chunks.get(id);
    if (!chunk) throw new Error(`Unknown icon set: ${id}`);
    return chunk;
  }
}

export const IconSets = new IconSetRegistry();
