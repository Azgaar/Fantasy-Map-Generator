import { tip } from "@/components/tooltips";
import { getDefaultNameBases, type NameBase } from "@/data/name-bases";
import { capitalize, isVowel, last, P, ra } from "../utils";

declare global {
  var Names: NamesGenerator;
}

// Markov chain lookup table: key is a letter (or empty string for word start), value is array of possible next syllables
// Note: Uses array with string keys (sparse array) to match original JS behavior
type MarkovChain = string[][] & Record<string, string[]>;

const SYLLABIC = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/** The fantasy bases (Elven through Serpents) that take state names without a suffix */
const FANTASY_BASE_IDS = new Set(["ELVEN", "DARKE", "DWARV", "GOBLI", "ORCIS", "GIANT", "DRACO", "ARACH", "SERPE"]);

class NamesGenerator {
  nameBases: NameBase[] = this.getNameBases();
  chains: Record<string, MarkovChain | null> = {}; // Markov chains by base id

  calculateChain(namesList: string): MarkovChain {
    const chain: MarkovChain = [] as unknown as MarkovChain;
    const availableNames = namesList.split(",");

    for (const n of availableNames) {
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

  /** One base by its stable id */
  getNameBase(id: string): NameBase | undefined {
    return this.nameBases.find(base => base.id === id);
  }

  /** Refresh the derived array positions after the list is mutated */
  reindex(): void {
    this.nameBases.forEach((base, i) => {
      base.i = i;
    });
  }

  updateChain(id: string): void {
    const base = this.getNameBase(id);
    this.chains[id] = base?.b ? this.calculateChain(base.b) : null;
  }

  clearChains(): void {
    this.chains = {};
  }

  // generate name using Markov's chain
  getBase(id: string, min?: number, max?: number, dupl?: string): string {
    if (id === undefined) {
      ERROR && console.error("Please define a base");
      return "ERROR";
    }

    let base = this.getNameBase(id);
    if (!base) {
      const fallback = this.nameBases[0];
      if (!fallback) {
        ERROR && console.error(`Namebase ${id} is not found`);
        return "ERROR";
      }
      WARN && console.warn(`Namebase ${id} is not found. First available namebase will be used`);
      base = fallback;
    }

    if (!this.chains[base.id]) this.updateChain(base.id);

    const data = this.chains[base.id];
    if (!data || data[""] === undefined) {
      tip(`Namesbase ${base.id} is incorrect. Please check in namesbase editor`, false, "error");
      ERROR && console.error(`Namebase ${base.id} is incorrect!`);
      return "ERROR";
    }

    if (!min) min = base.min;
    if (!max) max = base.max;
    if (dupl !== "") dupl = base.d;

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

    // parse word to get a final name
    const l = last(w.split("")); // last letter
    if (l === "'" || l === " " || l === "-") w = w.slice(0, -1); // not allow some characters at the end

    let name = [...w].reduce((r, c, i, d) => {
      if (c === d[i + 1] && !dupl.includes(c)) return r; // duplication is not allowed
      if (!r.length) return c.toUpperCase();
      if (r.slice(-1) === "-" && c === " ") return r; // remove space after hyphen
      if (r.slice(-1) === " ") return r + c.toUpperCase(); // capitalize letter after space
      if (r.slice(-1) === "-") return r + c.toUpperCase(); // capitalize letter after hyphen
      if (c === "a" && d[i + 1] === "e") return r; // "ae" => "e"
      if (i + 2 < d.length && c === d[i + 1] && c === d[i + 2]) return r; // remove three same letters in a row
      return r + c;
    }, "");

    // join the word if any part has only 1 letter
    if (name.split(" ").some(part => part.length < 2))
      name = name
        .split(" ")
        .map((p, i) => (i ? p.toLowerCase() : p))
        .join("");

    if (name.length < 2) {
      ERROR && console.error("Name is too short! Random name will be selected");
      name = ra(base.b.split(","));
    }

    return name;
  }

  // generate name for culture
  getCulture(culture: number, min?: number, max?: number, dupl?: string): string {
    if (culture === undefined) {
      ERROR && console.error("Please define a culture");
      return "ERROR";
    }
    const base = pack.cultures[culture].base;
    return this.getBase(base, min, max, dupl);
  }

  // generate short name for culture
  getCultureShort(culture: number): string {
    if (culture === undefined) {
      ERROR && console.error("Please define a culture");
      return "ERROR";
    }
    return this.getBaseShort(pack.cultures[culture].base);
  }

  // generate short name for base
  getBaseShort(id: string): string {
    const base = this.getNameBase(id);
    const min = base ? base.min - 1 : undefined;
    const max = base && min ? Math.max(base.max - 2, min) : undefined;
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
      ERROR && console.error("Please define a base name");
      return "ERROR";
    }
    if (culture === undefined && base === undefined) {
      ERROR && console.error("Please define a culture");
      return "ERROR";
    }
    if (base === undefined) base = pack.cultures[culture].base;

    // exclude endings inappropriate for states name
    if (name.includes(" ")) name = capitalize(name.replace(/ /g, "").toLowerCase()); // don't allow multiword state names
    if (name.length > 6 && name.slice(-4) === "berg") name = name.slice(0, -4); // remove -berg for any
    if (name.length > 5 && name.slice(-3) === "ton") name = name.slice(0, -3); // remove -ton for any

    if (base === "RUTHE" && ["sk", "ev", "ov"].includes(name.slice(-2))) name = name.slice(0, -2);
    // remove -sk/-ev/-ov for Ruthenian
    else if (base === "JAPAN") return isVowel(name.slice(-1)) ? name : `${name}u`;
    // Japanese ends on any vowel or -u
    else if (base === "ARABI" && P(0.4))
      name = isVowel(name.slice(0, 1).toLowerCase()) ? `Al${name.toLowerCase()}` : `Al ${name}`; // Arabic starts with -Al

    // no suffix for fantasy bases
    if (FANTASY_BASE_IDS.has(base)) return name;

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
    if (base === "ITALI" && rnd < 0.03 && l < 7) suffix = "terra";
    // Italian
    else if (base === "CASTI" && rnd < 0.03 && l < 7) suffix = "terra";
    // Spanish
    else if (base === "PORTU" && rnd < 0.03 && l < 7) suffix = "terra";
    // Portuguese
    else if (base === "FRENC" && rnd < 0.03 && l < 7) suffix = "terre";
    // French
    else if (base === "GERMA" && rnd < 0.5 && l < 7) suffix = "land";
    // German
    else if (base === "ENGLI" && rnd < 0.4 && l < 7) suffix = "land";
    // English
    else if (base === "NORDI" && rnd < 0.3 && l < 7) suffix = "land";
    // Nordic
    else if (base === "HUMAN" && rnd < 0.1 && l < 7) suffix = "land";
    // generic Human
    else if (base === "GREEK" && rnd < 0.1) suffix = "eia";
    // Greek
    else if (base === "FINNI" && rnd < 0.35) suffix = "maa";
    // Finnic
    else if (base === "HUNGA" && rnd < 0.4 && l < 6) suffix = "orszag";
    // Hungarian
    else if (base === "TURKI") suffix = rnd < 0.6 ? "yurt" : "eli";
    // Turkish
    else if (base === "KOREA") suffix = "guk";
    // Korean
    else if (base === "CHINE") suffix = " Guo";
    // Chinese
    else if (base === "NAHUA") suffix = rnd < 0.5 && l < 6 ? "tlan" : "co";
    // Nahuatl
    else if (base === "AMAZI" && rnd < 0.8) suffix = "a";
    // Amazigh
    else if (base === "ARABI" && rnd < 0.8) suffix = "a"; // Arabic

    return this.validateSuffix(name, suffix);
  }

  // generate name for the map
  getMapName(): string {
    const picked = P(0.7)
      ? this.getNameBase("FRENC")
      : ra(P(0.5) ? this.nameBases.slice(0, 7) : this.nameBases.slice(0, 32));
    if (!picked) {
      tip("Namebase is not found", false, "error");
      return "";
    }
    const min = picked.min - 1;
    const max = Math.max(picked.max - 3, min);
    const baseName = this.getBase(picked.id, min, max, "") as string;
    const name = P(0.7) ? this.addSuffix(baseName) : baseName;
    return name;
  }

  getNameBases(): NameBase[] {
    return getDefaultNameBases();
  }

  /** The calendar era: a name base plus "Era", weighted to the base most eras are built on */
  getEra(): string {
    return `${this.getBaseShort(P(0.7) ? "ENGLI" : ra(this.nameBases).id)} Era`;
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

// biome-ignore lint/suspicious/noRedeclare: legacy seam
export const Names = new NamesGenerator();

window.Names = Names;
