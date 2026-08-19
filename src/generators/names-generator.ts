import { tip } from "@/components/tooltips";
import { getDefaultNameBases, type NameBase } from "@/data/name-bases";
import { stored, unlock } from "@/utils/preferences";
import { capitalize, isVowel, last, P, ra, rand } from "../utils";

declare global {
  var Names: NamesGenerator;
}

// Markov chain lookup table: key is a letter (or empty string for word start), value is array of possible next syllables
// Note: Uses array with string keys (sparse array) to match original JS behavior
type MarkovChain = string[][] & Record<string, string[]>;

class NamesGenerator {
  nameBases: NameBase[] = this.getNameBases();
  chains: (MarkovChain | null)[] = []; // Markov chains for namebases

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

  updateChain(index: number): void {
    this.chains[index] = this.nameBases[index]?.b ? this.calculateChain(this.nameBases[index].b) : null;
  }

  clearChains(): void {
    this.chains = [];
  }

  // generate name using Markov's chain
  getBase(base: number, min?: number, max?: number, dupl?: string): string {
    if (base === undefined) {
      ERROR && console.error("Please define a base");
      return "ERROR";
    }

    if (this.nameBases[base] === undefined) {
      if (this.nameBases[0]) {
        WARN && console.warn(`Namebase ${base} is not found. First available namebase will be used`);
        base = 0;
      } else {
        ERROR && console.error(`Namebase ${base} is not found`);
        return "ERROR";
      }
    }

    if (!this.chains[base]) this.updateChain(base);

    const data = this.chains[base];
    if (!data || data[""] === undefined) {
      tip(`Namesbase ${base} is incorrect. Please check in namesbase editor`, false, "error");
      ERROR && console.error(`Namebase ${base} is incorrect!`);
      return "ERROR";
    }

    if (!min) min = this.nameBases[base].min;
    if (!max) max = this.nameBases[base].max;
    if (dupl !== "") dupl = this.nameBases[base].d;

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
      name = ra(this.nameBases[base].b.split(","));
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
  getBaseShort(base: number): string {
    const min = this.nameBases[base] ? this.nameBases[base].min - 1 : undefined;
    const max = min ? Math.max(this.nameBases[base].max - 2, min) : undefined;
    return this.getBase(base, min, max, "");
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
  getState(name: string, culture: number, base?: number): string {
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

    if (base === 5 && ["sk", "ev", "ov"].includes(name.slice(-2))) name = name.slice(0, -2);
    // remove -sk/-ev/-ov for Ruthenian
    else if (base === 12) return isVowel(name.slice(-1)) ? name : `${name}u`;
    // Japanese ends on any vowel or -u
    else if (base === 18 && P(0.4))
      name = isVowel(name.slice(0, 1).toLowerCase()) ? `Al${name.toLowerCase()}` : `Al ${name}`; // Arabic starts with -Al

    // no suffix for fantasy bases
    if (base > 32 && base < 42) return name;

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
    if (base === 3 && rnd < 0.03 && l < 7) suffix = "terra";
    // Italian
    else if (base === 4 && rnd < 0.03 && l < 7) suffix = "terra";
    // Spanish
    else if (base === 13 && rnd < 0.03 && l < 7) suffix = "terra";
    // Portuguese
    else if (base === 2 && rnd < 0.03 && l < 7) suffix = "terre";
    // French
    else if (base === 0 && rnd < 0.5 && l < 7) suffix = "land";
    // German
    else if (base === 1 && rnd < 0.4 && l < 7) suffix = "land";
    // English
    else if (base === 6 && rnd < 0.3 && l < 7) suffix = "land";
    // Nordic
    else if (base === 32 && rnd < 0.1 && l < 7) suffix = "land";
    // generic Human
    else if (base === 7 && rnd < 0.1) suffix = "eia";
    // Greek
    else if (base === 9 && rnd < 0.35) suffix = "maa";
    // Finnic
    else if (base === 15 && rnd < 0.4 && l < 6) suffix = "orszag";
    // Hungarian
    else if (base === 16) suffix = rnd < 0.6 ? "yurt" : "eli";
    // Turkish
    else if (base === 10) suffix = "guk";
    // Korean
    else if (base === 11) suffix = " Guo";
    // Chinese
    else if (base === 14) suffix = rnd < 0.5 && l < 6 ? "tlan" : "co";
    // Nahuatl
    else if (base === 17 && rnd < 0.8) suffix = "a";
    // Berber
    else if (base === 18 && rnd < 0.8) suffix = "a"; // Arabic

    return this.validateSuffix(name, suffix);
  }

  // generate name for the map
  getMapName(force: boolean) {
    if (!force && stored("mapName")) return;
    if (force && stored("mapName")) unlock("mapName");
    const base = P(0.7) ? 2 : P(0.5) ? rand(0, 6) : rand(0, 31);
    if (!this.nameBases[base]) {
      tip("Namebase is not found", false, "error");
      return "";
    }
    const min = this.nameBases[base].min - 1;
    const max = Math.max(this.nameBases[base].max - 3, min);
    const baseName = this.getBase(base, min, max, "") as string;
    const name = P(0.7) ? this.addSuffix(baseName) : baseName;
    mapName.value = name;
  }

  getNameBases(): NameBase[] {
    return getDefaultNameBases();
  }
}

window.Names = new NamesGenerator();
