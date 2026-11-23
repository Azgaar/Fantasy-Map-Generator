// Adapts a root coined in one name base to the sounds of another, as every language does with foreign names

import { NEAREST_LETTERS } from "@/data/name-rules";
import type { NameBase } from "@/types/names";
import { isVowel } from "@/utils/language-utils";
import { SoundRules } from "./sound-rules";

/** What a base's own names are made of: the measure a foreign root is brought to */
interface Profile {
  letters: Set<string>;
  clusters: Set<string>; // the pairs of consonants its names hold
  open: boolean; // whether its names keep consonants apart, as Hawaiian and Japanese do
  endings: Set<string>; // the letters its names end in
  vocalic: boolean; // whether its names mostly end in a vowel, as Italian and Finnic ones do
  vowel: string; // its commonest vowel, which parts a pair of consonants it has no use for
  finalVowel: string; // the vowel its names most often end in
}

const OPEN_SHARE = 0.12; // a base pairing fewer of its consonants than this parts the pairs it does not know
const VOCALIC_SHARE = 0.6; // a base ending this share of its names in a vowel ends a borrowed root in one too

class AppropriationModule {
  private readonly profiles = new WeakMap<string[], Profile>(); // by corpus, so an edited corpus is measured anew

  /** Adapt a lowercase root coined in another base: its rules for foreign roots run, letters the base never writes
   * give way to the nearest it does, a base of open syllables parts the consonants it never puts together, a root
   * that ends the word takes a vowel where the base's names end in vowels and never in its last letter, then the
   * word rules run */
  adapt(root: string, base: NameBase, endsWord = true): string {
    const { letters, clusters, open, endings, vocalic, vowel, finalVowel } = this.profileOf(base);
    if (!letters.size) return root;

    const respell = (char: string) => (isLetter(char) && !letters.has(char) ? nearest(char, letters) : char);
    let word = "";
    for (const char of [...SoundRules.applyForeign(root, base.rules)].map(respell).join("")) {
      const before = word[word.length - 1];
      const isPair = before && before !== char && isConsonant(before) && isConsonant(char);
      word += open && isPair && !clusters.has(before + char) ? vowel + char : char;
    }

    const end = word[word.length - 1];
    const isClosed = endsWord && vocalic && end && isConsonant(end) && !endings.has(end);
    return SoundRules.apply(isClosed ? word + finalVowel : word, base.rules);
  }

  private profileOf(base: NameBase): Profile {
    const cached = this.profiles.get(base.places.names);
    if (cached) return cached;

    const corpora = [base.places.names, base.people?.male?.names ?? [], base.people?.female?.names ?? []];
    const words = corpora.flat().flatMap(name =>
      name
        .toLowerCase()
        .split(/[^\p{L}]+/u)
        .filter(Boolean)
    );
    const [letters, clusters, endings] = [new Set<string>(), new Set<string>(), new Set<string>()];
    const [vowels, finalVowels] = [new Map<string, number>(), new Map<string, number>()];
    let [consonants, paired, open] = [0, 0, 0];

    for (const word of words) {
      const chars = [...word];
      chars.forEach((char, index) => {
        letters.add(char);
        if (isVowel(char)) vowels.set(char, (vowels.get(char) ?? 0) + 1);
        else consonants++;
        if (index && isConsonant(char) && isConsonant(chars[index - 1]) && char !== chars[index - 1]) {
          clusters.add(chars[index - 1] + char);
          paired++;
        }
      });
      const end = chars[chars.length - 1];
      endings.add(end);
      if (isVowel(end)) {
        finalVowels.set(end, (finalVowels.get(end) ?? 0) + 1);
        open++;
      }
    }

    const vowel = commonest(vowels);
    const finalVowel = finalVowels.size ? commonest(finalVowels) : vowel;
    const profile = {
      letters,
      clusters,
      open: paired < consonants * OPEN_SHARE,
      endings,
      vocalic: open >= words.length * VOCALIC_SHARE,
      vowel,
      finalVowel
    };
    this.profiles.set(base.places.names, profile);
    return profile;
  }
}

const isLetter = (char: string) => /\p{L}/u.test(char);
const isConsonant = (char: string) => isLetter(char) && !isVowel(char);
const commonest = (counts: Map<string, number>) => [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "a";

function nearest(char: string, letters: Set<string>): string {
  const plain = char.normalize("NFD").replace(/\p{M}/gu, "");
  if (letters.has(plain)) return plain;
  const written = (NEAREST_LETTERS[plain] ?? []).find(stand => [...stand].every(letter => letters.has(letter)));
  return written ?? plain;
}

export const Appropriation = new AppropriationModule();
