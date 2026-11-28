// Takes a name over from another name base as its people would say it: the whole word, its ending with it, bent
// until it sounds like the base's own place names. Lipsko is Lipzku in German, as it is Leipzig on the map

import { NEAREST_LETTERS } from "@/data/name-rules";
import type { NameBase } from "@/types/names";
import { isVowel } from "@/utils/language-utils";
import { NameBases } from "./name-bases";
import { SoundRules } from "./sound-rules";

// what it costs to change a name
const COSTS = {
  accent: 0.4, // a mark dropped
  mark: 1, // a mark taken
  near: 2, // a letter for the nearest one, and more for each next
  next: 1,
  telling: 1.5, // besides, for a vowel, an l or an r: they tell a name more than the rest
  vowel: 5, // a vowel for any other
  addVowel: 4,
  dropVowel: 6,
  dropLastVowel: 2,
  dropConsonant: 7,
  dropSilent: 1.5 // an h, or one of two letters of a kind
};
const [FIRST, TAIL] = [3, 0.5]; // how much dearer the first letter is to change, and how much cheaper the ending
const TAIL_LENGTH = 3;
const FAMILIAR = 3.5; // the surprise a letter may come with and sound native
const STRANGE_END = 3; // how much worse a strange ending sounds than a strange letter
const [PAIR_PRIOR, TRIPLE_PRIOR] = [2, 12]; // how many names it takes to trust the pairs and triples of letters over single ones
const OTHERS = 0.2; // what a name of a person or a water counts for, against a place name
const BEAM = 40; // how many spellings are kept in mind

/** What a base's names sound like */
interface Profile {
  others: (readonly string[])[]; // the lists of people and waters it was measured with
  letters: string[];
  vowels: string[];
  counts: Map<string, number>; // of a letter, a pair and a triple, `^` before a word and `$` after it
  total: number;
  costs: Map<string, number>; // of a letter after two others
  adapted: Map<string, string>;
}

interface Spelling {
  text: string;
  cost: number;
}

class AppropriationModule {
  private readonly profiles = new WeakMap<readonly string[], Profile>(); // by place names: edited lists are measured anew

  /** A lowercase name coined in another base as a base's people say it: its rules for foreign names run, then each word is
   * respelled to the closest one that sounds native, then the word rules run. An `open` name takes endings: its own
   * end is no word's end */
  adapt(name: string, base: NameBase, open = false): string {
    const profile = this.profileOf(base);
    const rules = NameBases.rulesOf(base);
    const words = name.split(/([^\p{L}\p{M}]+)/u); // words, and what stands between them
    return words
      .map((word, index) => {
        if (index % 2 || word.length < 2) return word; // the s of Eadric's is no word
        const foreign = SoundRules.applyForeign(word, rules);
        const key = open ? `${foreign}+` : foreign;
        let native = profile.adapted.get(key);
        if (native === undefined) {
          native = respell(foreign, profile, open);
          profile.adapted.set(key, native);
        }
        return SoundRules.apply(native, rules);
      })
      .join("");
  }

  /** A name as it stands on the map, as a base's people say it. Its joining words stay lowercase, as do the base's own */
  adopt(name: string, base: NameBase, open = false): string {
    const kept = name
      .split(/[ -]/)
      .slice(1, -1)
      .filter(word => /^\p{Ll}/u.test(word))
      .map(word => (/^\p{L}+'/u.test(word) ? word.slice(0, word.indexOf("'") + 1) : this.adapt(word, base)));
    const joining = kept.length ? [...NameBases.joiningOf(base), ...kept] : NameBases.joiningOf(base);
    return SoundRules.capitalize(this.adapt(name.toLowerCase(), base, open), joining);
  }

  /** Whether a base's names have every letter of a name, marks aside */
  writes(name: string, base: NameBase): boolean {
    const plain = new Set(this.profileOf(base).letters.map(plainOf));
    return [...name.toLowerCase().normalize("NFC")].every(
      letter => !/\p{L}/u.test(letter) || plain.has(plainOf(letter))
    );
  }

  private profileOf(base: NameBase): Profile {
    const { names } = base.places;
    const others = [NameBases.watersOf(base) ?? [], NameBases.peopleOf(base) ?? []].flat().map(corpus => corpus.names);
    const known = this.profiles.get(names);
    if (known?.others.length === others.length && known.others.every((list, i) => list === others[i])) return known;
    const profile = measure(names, others);
    this.profiles.set(names, profile);
    return profile;
  }
}

function measure(places: readonly string[], others: (readonly string[])[]): Profile {
  const counts = new Map<string, number>();
  const letters = new Set<string>();
  let total = 0;
  const read = (names: readonly string[], weight: number) => {
    const add = (key: string) => counts.set(key, (counts.get(key) ?? 0) + weight);
    for (const word of names.flatMap(name => name.toLowerCase().split(/[^\p{L}\p{M}]+/u)).filter(Boolean)) {
      const chars = [..."^^", ...word, "$"];
      add("^");
      add("^^");
      for (let i = 2; i < chars.length; i++) {
        const [a, b, c] = chars.slice(i - 2, i + 1);
        for (const key of [c, b + c, a + b + c]) add(key);
        if (c !== "$") letters.add(c);
        total += weight;
      }
    }
  };
  read(places, 1);
  for (const list of others) read(list, OTHERS);

  const all = [...letters];
  return { others, letters: all, vowels: all.filter(isVowel), counts, total, costs: new Map(), adapted: new Map() };
}

/** The spelling of a word that changes it least and sounds most like the names of a profile */
function respell(word: string, profile: Profile, open: boolean): string {
  const letters = [...word.normalize("NFC")];
  if (!letters.some(letter => profile.letters.includes(plainOf(letter)))) return word; // of another script

  let spellings = new Map<string, Spelling>([["^^", { text: "", cost: 0 }]]); // the best by the last two letters
  const extend = (stands: [string, number][]) => {
    const longer = new Map<string, Spelling>();
    for (const [last, { text, cost }] of spellings)
      for (const [stand, change] of stands) {
        let [end, sum] = [last, cost + change];
        for (const letter of stand) {
          sum += strangeness(end, letter, profile);
          end = end.slice(-1) + letter;
        }
        if (sum < (longer.get(end)?.cost ?? Infinity)) longer.set(end, { text: text + stand, cost: sum });
      }
    spellings = new Map([...longer].sort(([, a], [, b]) => a.cost - b.cost).slice(0, BEAM));
  };

  for (const [index, letter] of letters.entries()) {
    const fromEnd = letters.length - 1 - index;
    const ease = fromEnd < TAIL_LENGTH ? TAIL : 1;
    extend(standsFor(letter, letters[index - 1], !fromEnd, index ? ease : FIRST, profile));
    const added = profile.vowels.map((vowel): [string, number] => [vowel, COSTS.addVowel * (fromEnd ? 1 : TAIL)]);
    extend([["", 0], ...added]);
  }

  let best: Spelling = { text: word, cost: Infinity };
  for (const [last, { text, cost }] of spellings) {
    const ended = open ? cost : cost + strangeness(last, "$", profile);
    if (text && ended < best.cost) best = { text, cost: ended };
  }
  return best.text;
}

/** What may stand in for a letter of a word, and the cost of each */
function standsFor(
  letter: string,
  before: string | undefined,
  isLast: boolean,
  ease: number,
  { letters, vowels }: Profile
): [string, number][] {
  const stands: [string, number][] = [];
  const add = (stand: string, cost: number) => {
    if ([...stand].every(char => letters.includes(char))) stands.push([stand, cost * ease]);
  };

  const plain = plainOf(letter);
  add(letter, 0);
  if (plain !== letter) add(plain, COSTS.accent);
  for (const kin of letters) if (kin !== plain && plainOf(kin) === plain) add(kin, COSTS.mark);
  const nearest = (NEAREST_LETTERS[letter] ?? NEAREST_LETTERS[plain] ?? []).filter(Boolean);
  const telling = isVowel(plain) || plain === "l" || plain === "r" ? COSTS.telling : 0;
  const reach = letters.includes(plain) ? 2 : nearest.length; // a letter the base writes gives way to its nearest two alone
  for (const [rank, near] of nearest.slice(0, reach).entries()) add(near, COSTS.near + COSTS.next * rank + telling);
  if (isVowel(letter)) for (const vowel of vowels) add(vowel, COSTS.vowel);

  const isSilent = letter === "h" || letter === before;
  const drop = isVowel(letter) ? (isLast ? COSTS.dropLastVowel : COSTS.dropVowel) : COSTS.dropConsonant;
  stands.push(["", (isSilent ? COSTS.dropSilent : drop) * Math.max(ease, 1)]);
  return stands;
}

/** How strange a letter sounds after two others, nothing where the names of a profile put them together often enough */
function strangeness(before: string, letter: string, { counts, total, costs }: Profile): number {
  const key = before + letter;
  let cost = costs.get(key);
  if (cost === undefined) {
    const count = (text: string) => counts.get(text) ?? 0;
    const last = before.slice(-1);
    const alone = count(letter) / total;
    const paired = (count(last + letter) + PAIR_PRIOR * alone) / (count(last) + PAIR_PRIOR);
    const tripled = (count(key) + TRIPLE_PRIOR * paired) / (count(before) + TRIPLE_PRIOR);
    const surprise = -Math.log(tripled + 1e-5) - FAMILIAR;
    cost = Math.max(0, surprise) * (letter === "$" ? STRANGE_END : 1);
    costs.set(key, cost);
  }
  return cost;
}

const UNMARKED: Record<string, string> = { ł: "l", đ: "d", ø: "o", ı: "i" }; // marks that do not come off
const plainOf = (letter: string) => UNMARKED[letter] ?? letter.normalize("NFD").replace(/\p{M}/gu, "");

export const Appropriation = new AppropriationModule();
