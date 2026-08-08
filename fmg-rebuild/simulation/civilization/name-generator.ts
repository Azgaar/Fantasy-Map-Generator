import { createPRNG } from "../../core/random";
import { NameBase, getDefaultNameBases } from "../../core/name-bases";

let currentRNG = Math.random;

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function isVowel(char: string): boolean {
  if (!char) return false;
  return ['a','e','i','o','u','y','а','e','и','о','у','ы','э','ю','я'].includes(char.toLowerCase());
}

export function last<T>(arr: T[]): T {
  return arr[arr.length - 1];
}

export function P(prob: number): boolean {
  return currentRNG() < prob;
}

export function ra<T>(arr: T[]): T {
  return arr[Math.floor(currentRNG() * arr.length)];
}

export function rand(min: number, max: number): number {
  return Math.floor(currentRNG() * (max - min + 1)) + min;
}

type MarkovChain = string[][] & Record<string, string[]>;

class NamesGenerator {
  nameBases: NameBase[] = getDefaultNameBases();
  chains: (MarkovChain | null)[] = [];

  calculateChain(namesList: string): MarkovChain {
    const chain: MarkovChain = [] as unknown as MarkovChain;
    const availableNames = namesList.split(",");

    for (const n of availableNames) {
      const name = n.trim().toLowerCase();
      const basic = !/[^\x20-\x7e]/.test(name);

      for (let i = -1, syllable = ""; i < name.length; i += syllable.length || 1, syllable = "") {
        const prev = name[i] || "";
        let v = 0;

        for (let c = i + 1; name[c] && syllable.length < 5; c++) {
          const that = name[c], next = name[c + 1];
          syllable += that;
          if (syllable === " " || syllable === "-") break;
          if (!next || next === " " || next === "-") break;
          if (isVowel(that)) v = 1;
          if (that === "y" && next === "e") continue;
          if (basic) {
            if (that === "o" && next === "o") continue;
            if (that === "e" && next === "e") continue;
            if (that === "a" && next === "e") continue;
            if (that === "c" && next === "h") continue;
          }
          if (isVowel(that) === (isVowel(next) as unknown as boolean)) break;
          if (v && isVowel(name[c + 2])) break;
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

  getBase(base: number, min?: number, max?: number, dupl?: string): string {
    if (base === undefined) return "ERROR";
    if (this.nameBases[base] === undefined) base = 0;

    if (!this.chains[base]) this.updateChain(base);

    const data = this.chains[base];
    if (!data || data[""] === undefined) return "ERROR";

    min = min || this.nameBases[base].min;
    max = max || this.nameBases[base].max;
    dupl = dupl !== undefined ? dupl : this.nameBases[base].d;

    let v = data[""], cur = ra(v), w = "";
    for (let i = 0; i < 20; i++) {
      if (cur === "") {
        if (w.length < min!) {
          cur = "";
          w = "";
          v = data[""];
        } else break;
      } else {
        if (w.length + cur.length > max!) {
          if (w.length < min!) w += cur;
          break;
        } else v = data[last(cur.split("")) as string] || data[""];
      }

      w += cur;
      cur = ra(v);
    }

    const l = last(w.split(""));
    if (l === "'" || l === " " || l === "-") w = w.slice(0, -1);

    let name = [...w].reduce((r, c, i, d) => {
      if (c === d[i + 1] && !dupl!.includes(c)) return r;
      if (!r.length) return c.toUpperCase();
      if (r.slice(-1) === "-" && c === " ") return r;
      if (r.slice(-1) === " ") return r + c.toUpperCase();
      if (r.slice(-1) === "-") return r + c.toUpperCase();
      if (c === "a" && d[i + 1] === "e") return r;
      if (i + 2 < d.length && c === d[i + 1] && c === d[i + 2]) return r;
      return r + c;
    }, "");

    if (name.split(" ").some(part => part.length < 2))
      name = name.split(" ").map((p, i) => (i ? p.toLowerCase() : p)).join("");

    if (name.length < 2) {
      name = ra(this.nameBases[base].b.split(","));
    }

    return name;
  }
}

export const Names = new NamesGenerator();

export function generateName(language: string, seed: string): string {
  if (seed) {
    currentRNG = createPRNG(seed);
  } else {
    currentRNG = Math.random;
  }
  let base = 1;
  const l = language.toLowerCase();
  if (l.includes("norse") || l.includes("nordic")) base = 6;
  else if (l.includes("roman")) base = 8;
  else if (l.includes("elven")) base = 33;
  else if (l.includes("german")) base = 0;
  else if (l.includes("french")) base = 2;
  else if (l.includes("english")) base = 1;
  return Names.getBase(base);
}
