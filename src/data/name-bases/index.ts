import type { NameBaseEntry, ShippedNameBase, WrittenNameBase } from "@/types/names";
import { capitalize } from "@/utils/string-utils";

/** The shipped bases in their order: the id is the name of the base's file */
const IDS = [
  // real-world bases by Azgaar
  "german",
  "english",
  "french",
  "italian",
  "castillian",
  "ruthenian",
  "nordic",
  "greek",
  "roman",
  "finnic",
  "korean",
  "chinese",
  "japanese",
  "portuguese",
  "nahuatl",
  "hungarian",
  "turkish",
  "amazigh",
  "arabic",
  "inuit",
  "basque",
  "nigerian",
  "welsh",
  "mesopotamian",
  "iranian",
  "hawaiian",
  "karnataka",
  "quechua",
  "swahili",
  "vietnamese",
  "cantonese",
  "mongolian",
  // fantasy bases by Dopu
  "human-generic",
  "sindarin",
  "dark-elven",
  "dwarven",
  "goblin",
  "orc",
  "giant",
  "dovahzul",
  "arachnid",
  "serpents",
  // additional by Avengium
  "levantine",
  // real-world bases by Azgaar, added later: an old map finds its bases by their places, so new ones go last
  "egyptian",
  "polish",
  "hindustani",
  "gaelic",
  "gaulish",
  "phoenician",
  "ethiopic",
  "thai",
  "malay",
  "georgian",
  "lithuanian",
  "maya",
  "tibetan",
  "ojibwe",
  "gothic",
  "dutch",
  "romanian",
  "serbian",
  // fantasy bases, added later
  "halfling",
  "infernal",
  "quenya",
  "valyrian",
  "dothraki",
  "celestial"
];

/** A shipped base is called by its id: `dark-elven` is Dark Elven */
const entryOf = (id: string) => ({ id, name: id.split("-").map(capitalize).join(" ") });

export const NAME_BASES: NameBaseEntry[] = IDS.map(entryOf);

type BaseModule = Record<string, WrittenNameBase>;
const files = import.meta.glob<BaseModule>(["./*.ts", "!./index.ts"]);

/** A shipped base in its written form */
export async function readNameBase(id: string): Promise<ShippedNameBase> {
  const load = files[`./${id}.ts`];
  if (!load) throw new Error(`Name base ${id} is not shipped`);
  const [base] = Object.values(await load()); // a file exports its base alone
  return { ...entryOf(id), ...base };
}
