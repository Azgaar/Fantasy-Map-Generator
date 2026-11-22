import { z } from "zod";
import { getDefaultNameBases, type NameBase } from "@/data/name-bases";
import { last } from "@/utils/array-utils";
import { sentences, t } from "@/utils/i18n";
import { isVowel } from "@/utils/language-utils";
import { log } from "@/utils/logger";
import { notify } from "@/utils/notices";
import { P, ra, rand } from "@/utils/probability-utils";
import { capitalize } from "@/utils/string-utils";
import { applyRules, doublesRule } from "./sound-rules";

// Markov chain lookup table: key is a letter (or empty string for word start), value is array of possible next syllables
// Note: Uses array with string keys (sparse array) to match original JS behavior
type MarkovChain = string[][] & Record<string, string[]>;

const SYLLABIC = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const WORD_START = /(?<=^|[ -])./gu;
const SHIPPED = getDefaultNameBases().map(base => base.id); // a shipped base's place in the default set
const FANTASY = ["elven", "dark-elven", "dwarven", "goblin", "orc", "giant", "draconic", "arachnid", "serpents"];

/** A base as a namesbase file holds it */
export const nameBaseSchema = z.object({
  id: z.string().regex(/^[\p{L}\p{N}-]+$/u),
  name: z.string().min(1),
  length: z.tuple([z.number(), z.number()]),
  places: z.object({ names: z.array(z.string()) }),
  rules: z.array(z.object({ match: z.string(), replace: z.string() })).optional()
});

/** A base of the classic make: a length range, a corpus and the letters allowed to stand twice in a row */
export const composeBase = (
  id: string,
  name: string,
  length: [number, number],
  names: string[],
  doubled = ""
): NameBase => ({ id, name, length, places: { names }, rules: [doublesRule(doubled)] });

/** An id made of a base's name, numbered when another base has taken it */
export function uniqueBaseId(name: string, taken: string[]): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "") || "base";
  let id = slug;
  for (let n = 2; taken.includes(id); n++) id = `${slug}-${n}`;
  return id;
}

class NamesGenerator {
  nameBases: NameBase[] = this.getNameBases();
  chains = new Map<string, MarkovChain | null>(); // Markov chains by base id

  calculateChain(names: string[]): MarkovChain {
    const chain: MarkovChain = [] as unknown as MarkovChain;

    for (const n of names) {
      const name = n.trim().toLowerCase();
      const basic = !/[^\x20-\x7e]/.test(name); // basic printable ASCII chars and English rules can be applied

      // split word into pseudo-syllables
      for (let i = -1, syllable = ""; i < name.length; i += syllable.length || 1, syllable = "") {
        const prev = name[i] || ""; // pre-onset letter
        let v = 0; // 0 if no vowels in syllable

        for (let c = i + 1; name[c] && syllable.length < 5; c++) {
          const that = name[c],
            next = name[c + 1]; // next char
          syllable += that;
          if (syllable === " " || syllable === "-") break; // syllable starts with space or hyphen
          if (!next || next === " " || next === "-") break; // no need to check
          if (SYLLABIC.test(that) || SYLLABIC.test(next)) break; // CJK character is a syllable on its own

          if (isVowel(that)) v = 1; // check if letter is vowel

          // do not split some diphthongs
          if (that === "y" && next === "e") continue; // 'ye'
          if (basic) {
            // English-like
            if (that === "o" && next === "o") continue; // 'oo'
            if (that === "e" && next === "e") continue; // 'ee'
            if (that === "a" && next === "e") continue; // 'ae'
            if (that === "c" && next === "h") continue; // 'ch'
          }

          if (isVowel(that) === (next as unknown as boolean)) break; // two same vowels in a row (original quirky behavior)
          if (v && isVowel(name[c + 2])) break; // syllable has vowel and additional vowel is expected soon
        }

        if (!chain[prev]) chain[prev] = [];
        chain[prev].push(syllable);
      }
    }

    return chain;
  }

  updateChain(id: string): MarkovChain | null {
    const names = this.find(id)?.places.names;
    const chain = names?.length ? this.calculateChain(names) : null;
    this.chains.set(id, chain);
    return chain;
  }

  clearChains(): void {
    this.chains.clear();
  }

  find(id: string): NameBase | undefined {
    return this.nameBases.find(base => base.id === id);
  }

  /** A base by id; a shipped one the map has dropped gives the base standing in its place */
  resolve(id: string): NameBase | undefined {
    return this.find(id) ?? this.nameBases[SHIPPED.indexOf(id) % this.nameBases.length];
  }

  /** Any of the map's bases */
  randomBase(): NameBase {
    return this.nameBases[rand(this.nameBases.length - 1)];
  }

  /** Generate a name with the base's Markov chain; an empty `dupl` allows no doubled letters */
  getBase(id: string, min?: number, max?: number, dupl?: string): string {
    if (id === undefined) {
      log.error("Please define a base");
      return "ERROR";
    }

    let base = this.resolve(id);
    if (!base) {
      if (!this.nameBases[0]) {
        log.error(`Namebase ${id} is not found`);
        return "ERROR";
      }
      log.warn(`Namebase ${id} is not found. First available namebase will be used`);
      base = this.nameBases[0];
    }

    const data = this.chains.get(base.id) ?? this.updateChain(base.id);
    if (!data || data[""] === undefined) {
      notify(
        sentences(t("Namesbase {{base}} is incorrect", { base: base.name }), t("Please check in namesbase editor")),
        "error"
      );
      log.error(`Namebase ${base.id} is incorrect!`);
      return "ERROR";
    }

    if (!min) min = base.length[0];
    if (!max) max = base.length[1];

    let v = data[""],
      cur = ra(v),
      w = "";
    for (let i = 0; i < 20; i++) {
      if (cur === "") {
        // end of word
        if (w.length < min) {
          cur = "";
          w = "";
          v = data[""];
        } else break;
      } else {
        if (w.length + cur.length > max) {
          // word too long
          if (w.length < min) w += cur;
          break;
        } else v = data[last(cur.split("")) as string] || data[""];
      }

      w += cur;
      cur = ra(v);
    }

    if (/['\- ]$/.test(w)) w = w.slice(0, -1); // a name ends in a letter

    const rules = dupl === "" ? [doublesRule(), ...(base.rules ?? [])] : base.rules;
    let name = applyRules(w, rules).replace(WORD_START, letter => letter.toUpperCase());

    // join the word if any part has only 1 letter
    if (name.split(" ").some(part => part.length < 2))
      name = name
        .split(" ")
        .map((p, i) => (i ? p.toLowerCase() : p))
        .join("");

    if (name.length < 2) {
      log.error("Name is too short! Random name will be selected");
      name = ra(base.places.names);
    }

    return name;
  }

  // generate name for culture
  getCulture(culture: number, min?: number, max?: number, dupl?: string): string {
    if (culture === undefined) {
      log.error("Please define a culture");
      return "ERROR";
    }
    const base = pack.cultures[culture].base;
    return this.getBase(base, min, max, dupl);
  }

  // generate short name for culture
  getCultureShort(culture: number): string {
    if (culture === undefined) {
      log.error("Please define a culture");
      return "ERROR";
    }
    return this.getBaseShort(pack.cultures[culture].base);
  }

  // generate short name for base
  getBaseShort(id: string): string {
    const base = this.resolve(id);
    const min = base ? base.length[0] - 1 : undefined;
    const max = base && min ? Math.max(base.length[1] - 2, min) : undefined;
    return this.getBase(id, min, max, "");
  }

  private validateSuffix(name: string, suffix: string): string {
    if (name.slice(-1 * suffix.length) === suffix) return name; // no suffix if name already ends with it
    const s1 = suffix.charAt(0);
    if (name.slice(-1) === s1) name = name.slice(0, -1); // remove name last letter if it's a suffix first letter
    if (isVowel(s1) === isVowel(name.slice(-1)) && isVowel(s1) === isVowel(name.slice(-2, -1)))
      name = name.slice(0, -1); // remove name last char if 2 last chars are the same type as suffix's 1st
    if (name.slice(-1) === s1) name = name.slice(0, -1); // remove name last letter if it's a suffix first letter
    return name + suffix;
  }

  private addSuffix(name: string): string {
    const suffix = P(0.8) ? "ia" : "land";
    if (suffix === "ia" && name.length > 6) name = name.slice(0, -(name.length - 3));
    else if (suffix === "land" && name.length > 6) name = name.slice(0, -(name.length - 5));
    return this.validateSuffix(name, suffix);
  }

  // generate state name based on capital or random name and culture-specific suffix
  getState(name: string, culture: number, base?: string): string {
    if (name === undefined) {
      log.error("Please define a base name");
      return "ERROR";
    }
    if (culture === undefined && base === undefined) {
      log.error("Please define a culture");
      return "ERROR";
    }
    if (base === undefined) base = pack.cultures[culture].base;

    // exclude endings inappropriate for states name
    if (name.includes(" ")) name = capitalize(name.replace(/ /g, "").toLowerCase()); // don't allow multiword state names
    if (name.length > 6 && name.slice(-4) === "berg") name = name.slice(0, -4); // remove -berg for any
    if (name.length > 5 && name.slice(-3) === "ton") name = name.slice(0, -3); // remove -ton for any

    if (base === "ruthenian" && ["sk", "ev", "ov"].includes(name.slice(-2))) name = name.slice(0, -2);
    else if (base === "japanese")
      return isVowel(name.slice(-1)) ? name : `${name}u`; // ends on any vowel or -u
    else if (base === "arabic" && P(0.4))
      name = isVowel(name.slice(0, 1).toLowerCase()) ? `Al${name.toLowerCase()}` : `Al ${name}`; // starts with Al

    // no suffix for fantasy bases
    if (FANTASY.includes(base)) return name;

    // define if suffix should be used
    if (name.length > 3 && isVowel(name.slice(-1))) {
      if (isVowel(name.slice(-2, -1)) && P(0.85)) name = name.slice(0, -2);
      // 85% for vv
      else if (P(0.7)) name = name.slice(0, -1);
      // ~60% for cv
      else return name;
    } else if (P(0.4)) return name; // 60% for cc and vc

    // define suffix
    let suffix = "ia"; // standard suffix

    const rnd = Math.random(),
      l = name.length;
    if (["italian", "castillian", "portuguese"].includes(base) && rnd < 0.03 && l < 7) suffix = "terra";
    else if (base === "french" && rnd < 0.03 && l < 7) suffix = "terre";
    else if (base === "german" && rnd < 0.5 && l < 7) suffix = "land";
    else if (base === "english" && rnd < 0.4 && l < 7) suffix = "land";
    else if (base === "nordic" && rnd < 0.3 && l < 7) suffix = "land";
    else if (base === "human-generic" && rnd < 0.1 && l < 7) suffix = "land";
    else if (base === "greek" && rnd < 0.1) suffix = "eia";
    else if (base === "finnic" && rnd < 0.35) suffix = "maa";
    else if (base === "hungarian" && rnd < 0.4 && l < 6) suffix = "orszag";
    else if (base === "turkish") suffix = rnd < 0.6 ? "yurt" : "eli";
    else if (base === "korean") suffix = "guk";
    else if (base === "chinese") suffix = " Guo";
    else if (base === "nahuatl") suffix = rnd < 0.5 && l < 6 ? "tlan" : "co";
    else if (["amazigh", "arabic"].includes(base) && rnd < 0.8) suffix = "a";

    return this.validateSuffix(name, suffix);
  }

  // generate name for the map
  getMapName(): string {
    const base = P(0.7) ? this.resolve("french") : this.nameBases[P(0.5) ? rand(0, 6) : rand(0, 31)];
    if (!base) {
      notify(t("Namebase is not found"), "error");
      return "";
    }
    const min = base.length[0] - 1;
    const max = Math.max(base.length[1] - 3, min);
    const baseName = this.getBase(base.id, min, max, "");
    const name = P(0.7) ? this.addSuffix(baseName) : baseName;
    return name;
  }

  getNameBases(): NameBase[] {
    return getDefaultNameBases();
  }

  /** The bases as a .map record: a shipped base left as it is goes by its id alone, so it follows later updates */
  serialize(): string {
    const shipped = new Map(getDefaultNameBases().map(base => [base.id, JSON.stringify(base)]));
    const isShipped = (base: NameBase) => shipped.get(base.id) === JSON.stringify(base);
    return JSON.stringify(this.nameBases.map(base => (isShipped(base) ? { id: base.id } : base)));
  }

  /** Take the bases of a .map record, or the shipped ones when it holds none */
  restore(record?: string): void {
    const shipped = getDefaultNameBases();
    const stored: (NameBase | { id: string })[] | null = record ? JSON.parse(record) : null;
    const byId = (id: string) => shipped.find(base => base.id === id) ?? [];
    this.nameBases = stored ? stored.flatMap(base => ("places" in base ? base : byId(base.id))) : shipped;
    this.clearChains();
  }

  /** Swap the whole set; a culture goes on with the base standing where its own stood */
  replace(bases: NameBase[]): void {
    const places = new Map(this.nameBases.map(({ id }, index) => [id, index]));
    for (const culture of pack.cultures ?? []) culture.base = bases[places.get(culture.base) ?? -1]?.id ?? culture.base;
    this.nameBases = bases;
    this.clearChains();
  }

  /** The calendar era: a name base plus "Era", weighted to the base most eras are built on */
  getEra(): string {
    const base = P(0.7) ? this.resolve("english") : this.nameBases[rand(this.nameBases.length)];
    return `${this.getBaseShort(base?.id ?? "")} Era`; // the roll may fall past the last base: the first one names it
  }

  /** The abbreviation an era name suggests, which the user may override */
  getEraShort(era: string): string {
    return era
      .split(" ")
      .filter(Boolean)
      .map(word => word[0].toUpperCase())
      .join("");
  }
}

export const Names = new NamesGenerator();
