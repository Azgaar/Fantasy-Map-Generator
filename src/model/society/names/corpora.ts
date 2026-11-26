// What a list of names sounds like: the Markov chain new words come off, the letters its words put together, how they end

import { isVowel } from "@/utils/language-utils";
import { ra, seeded } from "@/utils/probability-utils";

/** The syllables that may follow a letter, or start a word under "" */
type MarkovChain = Record<string, string[]>;

/** What the words of a corpus sound like: the letters they put together and the consonants they close in */
interface Sounds {
  words: Set<string>;
  triples: Set<string>;
  ends: Set<string>;
}

const SYLLABIC = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

export const MIN_CUT = 3; // a name cut short keeps this many letters
const REDRAWS = 12; // how many times a word that does not sound like its corpus is walked anew
const WALK_STEPS = 20; // parts a walk takes at most

/** All by list, so a list is replaced, never edited in place */
class CorporaModule {
  private readonly chains = new WeakMap<readonly string[], MarkovChain>();
  private readonly sounds = new WeakMap<readonly string[], Sounds>();

  isSyllabic(word: string): boolean {
    return SYLLABIC.test(word);
  }

  /** The chain of a corpus; a list with no words in it has none to start with */
  chainOf(names: readonly string[]): MarkovChain {
    let chain = this.chains.get(names);
    if (!chain) {
      chain = this.calculateChain(names);
      this.chains.set(names, chain);
    }
    return chain;
  }

  /** A word off a chain that sounds like its corpus: one that does not is walked anew, on a random sequence of its
   * own, and the closest of the words is taken */
  draw(names: readonly string[], min: number, max: number): string {
    const chain = this.chainOf(names);
    let word = this.walkChain(chain, min, max);
    if (this.isSyllabic(word)) return word;
    const first = word;
    let best = this.strangeness(word, names);
    for (let n = 1; best && n <= REDRAWS; n++) {
      const other = seeded(`${first}|${n}`, () => this.walkChain(chain, min, max));
      const strangeness = other.length < min ? Infinity : this.strangeness(other, names);
      if (strangeness < best) [word, best] = [other, strangeness];
    }
    return word;
  }

  // how many times a word puts three letters together as no word of the corpus does; a word of the corpus itself is one off
  private strangeness(word: string, names: readonly string[]): number {
    const { triples, words } = this.soundsOf(names);
    let strange = words.has(word) ? 1 : 0;
    for (const triple of triplesOf(word)) if (!triples.has(triple)) strange++;
    return strange;
  }

  /** Whether a word puts letters together as the words of a corpus do, and is none of them */
  isFamiliar(word: string, names: readonly string[]): boolean {
    if (this.isSyllabic(word)) return true;
    const { triples, words } = this.soundsOf(names);
    const ended = `^${word}$`;
    for (let i = 0; i + 3 <= ended.length; i++) if (!triples.has(ended.slice(i, i + 3))) return false;
    return !words.has(word);
  }

  private soundsOf(names: readonly string[]): Sounds {
    let sounds = this.sounds.get(names);
    if (!sounds) {
      const words = names.map(name => name.trim().toLowerCase());
      const ends = words.flatMap(word => word.split(/[^\p{L}]+/u)).map(closingOf);
      sounds = { words: new Set(words), triples: new Set(words.flatMap(triplesOf)), ends: new Set(ends) };
      this.sounds.set(names, sounds);
    }
    return sounds;
  }

  /** The start of a name, so many syllables of it, with no more consonants at its end than the names close in */
  cut(name: string, names: readonly string[], syllables: number): string {
    let start = "";
    for (const [index, syllable] of this.syllables(name).entries())
      if (index < syllables || start.length < MIN_CUT) start += syllable;
    return start.length < name.length ? this.close(start, names) : name;
  }

  /** The start of a name with no more consonants at its end than the names close in */
  close(start: string, names: readonly string[]): string {
    if (this.isSyllabic(start)) return start;
    const { ends } = this.soundsOf(names);
    let closed = start;
    while (closed.length > 2 && closingOf(closed) && !ends.has(closingOf(closed))) closed = closed.slice(0, -1);
    return closed.length >= MIN_CUT || start.length < MIN_CUT ? closed : start;
  }

  /** A word off the chain of a corpus, as long as given or somewhat longer */
  walk(names: readonly string[], min: number, max: number): string {
    return this.walkChain(this.chainOf(names), min, max);
  }

  // from a word's start until the word ends between the lengths given, or grows too long
  private walkChain(chain: MarkovChain, min: number, max: number): string {
    let choices = chain[""]; // what may come next
    let part = ra(choices);
    let word = "";
    for (let step = 0; step < WALK_STEPS; step++) {
      if (part === "") {
        if (word.length >= min) break;
        [word, choices] = ["", chain[""]]; // ended too short: start again
      } else if (word.length + part.length > max) {
        if (word.length < min) word += part;
        break;
      } else choices = chain[part[part.length - 1]] || chain[""];

      word += part;
      part = ra(choices);
    }

    return /['\- ]$/.test(word) ? word.slice(0, -1) : word; // a name ends in a letter
  }

  /** The endings many names of a corpus share, the commonest first: -bach, -ingen, -ton */
  mineEndings(names: readonly string[]): string[] {
    const counts = new Map<string, number>();
    for (const name of names) {
      const word = name.trim().toLowerCase();
      for (const size of [3, 4, 5]) {
        const ending = word.slice(-size);
        if (word.length >= size + 2 && !/[^\p{L}]/u.test(ending)) counts.set(ending, (counts.get(ending) ?? 0) + 1);
      }
    }

    const common = [...counts].filter(([, count]) => count >= 3);
    const eclipsed = ([ending, count]: [string, number]) =>
      common.some(
        ([other, otherCount]) =>
          other !== ending &&
          (other.endsWith(ending) || ending.endsWith(other)) &&
          (otherCount > count || (otherCount === count && other.length > ending.length))
      );
    return common
      .filter(entry => !eclipsed(entry))
      .sort((a, b) => b[1] - a[1])
      .map(([ending]) => ending);
  }

  private calculateChain(names: readonly string[]): MarkovChain {
    const chain: MarkovChain = {};

    for (const name of names) {
      let prev = ""; // the letter a syllable follows; a word ends in an empty syllable
      for (const syllable of [...this.syllables(name), ""]) {
        chain[prev] ??= [];
        chain[prev].push(syllable);
        prev = syllable[syllable.length - 1];
      }
    }

    return chain;
  }

  /** Split a name into the pseudo-syllables the chain is made of */
  syllables(rawName: string): string[] {
    const name = rawName.trim().toLowerCase();
    const basic = !/[^\x20-\x7e]/.test(name); // basic printable ASCII chars and English rules can be applied
    const syllables: string[] = [];

    for (let i = 0; i < name.length; i += syllables[syllables.length - 1].length) {
      let syllable = "";
      let v = 0; // 0 if no vowels in syllable

      for (let c = i; name[c] && syllable.length < 5; c++) {
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

        if (v && isVowel(name[c + 2])) break; // syllable has vowel and additional vowel is expected soon
      }

      syllables.push(syllable);
    }

    return syllables;
  }
}

const triplesOf = (word: string) => {
  const ended = `^${word}$`;
  const triples: string[] = [];
  for (let i = 0; i + 3 <= ended.length; i++) triples.push(ended.slice(i, i + 3));
  return triples;
};

// the consonants a word closes in
const closingOf = (word: string) => {
  let start = word.length;
  while (start > 0 && !isVowel(word[start - 1])) start--;
  return word.slice(start);
};

export const Corpora = new CorporaModule();
