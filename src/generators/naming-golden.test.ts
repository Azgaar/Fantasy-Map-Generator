// Golden English names: what the naming code produces today for a fixed seed, and how many random
// draws it takes. Moving composition behind a locale grammar must leave these snapshots untouched.
import Alea from "alea";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getAdjective } from "@/utils/languageUtils";
import type { State } from "./states-generator";
import { STATE_FORMS } from "./states-generator";

let draws = 0;

beforeEach(() => {
  draws = 0;
  const random = Alea("fmg-golden-names");
  vi.spyOn(Math, "random").mockImplementation(() => {
    draws++;
    return random();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Run `fn` and report its result with the number of random draws it took */
const counted = <T>(fn: () => T): [T, number] => {
  const before = draws;
  const result = fn();
  return [result, draws - before];
};

// every adjectivization rule, the probabilistic ones several times over
const NOUNS = [
  "Zhang Guo",
  "Magyarorszag",
  "Kisorszag",
  "Kazakhstan",
  "Turkmenistan",
  "England",
  "Ireland",
  "Swaziland",
  "Martinique",
  "Ardalia",
  "Morocco",
  "Peru",
  "Haiti",
  "Lorraine",
  "Uruguay",
  "Thasos",
  "Lemnos",
  "Achaeos",
  "Hebrides",
  "Bes",
  "Nepal",
  "Senegal",
  "Lorvan",
  "Japan",
  "Baghdad",
  "Chad",
  "Sudan",
  "Taiwan",
  "Orwyth",
  "Kestrel",
  "Brythm",
  "Qx",
  "Ash-Kar"
];

describe("golden adjectives", () => {
  it("derives the same adjectives with the same draws", () => {
    const results = NOUNS.map(noun => {
      const runs = Array.from({ length: 4 }, () => {
        const [adjective, used] = counted(() => getAdjective(noun));
        return `${adjective} (${used})`;
      });
      return `${noun} → ${new Set(runs).size === 1 ? runs[0] : runs.join(" | ")}`;
    });
    expect(results).toMatchSnapshot();
  });
});

describe("golden state full names", () => {
  let States: { getFullName(state: Partial<State>): string };

  beforeAll(async () => {
    await import("./states-generator");
    States = globalThis.States as unknown as typeof States;
  });

  it("composes the same full name for every form", () => {
    const formNames = Object.values(STATE_FORMS).flat();
    const names = ["Ardalia", "Lorvan", "Kisorszag", "Nova Terra", "Ash-Kar", ""];
    const results = formNames.flatMap(formName =>
      names.map(name => {
        const [fullName, used] = counted(() => States.getFullName({ name, formName }));
        return `${formName} + "${name}" → ${fullName} (${used})`;
      })
    );
    results.push(`no form + "Ardalia" → ${States.getFullName({ name: "Ardalia" })}`);
    expect(results).toMatchSnapshot();
  });
});

describe("golden religion names", () => {
  interface TestableReligionsModule {
    generateReligionName(variety: string, form: string, deity: string, center: number): [string, string];
  }
  let Religions: TestableReligionsModule;

  // forms by the religion type (variety) they belong to
  const FORMS: Record<string, string[]> = {
    Folk: ["Shamanism", "Animism", "Polytheism", "Ancestor Worship", "Nature Worship", "Totemism"],
    Organized: [
      "Polytheism",
      "Monotheism",
      "Dualism",
      "Pantheism",
      "Non-theism",
      "Syncretism",
      "Philosophical",
      "Ethical",
      "Deism",
      "Henotheism"
    ],
    Cult: ["Cult", "Dark Cult", "Sect"],
    Heresy: ["Heresy"]
  };

  beforeAll(async () => {
    await import("./religions-generator");
    Religions = globalThis.Religions as unknown as TestableReligionsModule;
  });

  beforeEach(() => {
    globalThis.pack = {
      cells: { culture: [1, 1], burg: [0, 1], state: [1, 1] },
      cultures: [{ name: "Wildlands" }, { name: "Elvari" }],
      burgs: [{}, { name: "Lorvania" }],
      states: [{ name: "Neutrals" }, { name: "Ardalia" }]
    } as any;
    // a fixed cycle of culture names, so the snapshot sees only the naming code's own draws
    const cultureNames = ["Thalor", "Brennic", "Ashwyn", "Kesra", "Orvand"];
    let next = 0;
    globalThis.Names = { getCulture: () => cultureNames[next++ % cultureNames.length] } as any;
  });

  it("names every form the same way", () => {
    const results = Object.entries(FORMS).flatMap(([variety, forms]) =>
      forms.flatMap(form =>
        Array.from({ length: 8 }, (_, run) => {
          const center = run % 2; // a burg cell and a state-only cell
          const deity = run % 3 ? "Toran, the Bright Sun" : "";
          const [[name, expansion], used] = counted(() => Religions.generateReligionName(variety, form, deity, center));
          return `${variety}/${form} → ${name} [${expansion}] (${used})`;
        })
      )
    );
    expect(results).toMatchSnapshot();
  });
});
