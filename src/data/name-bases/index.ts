import type { NameBaseEntry, WrittenNameBase } from "@/types/names";

/** The shipped bases in their order: the id is the name of the base's file */
export const NAME_BASES: NameBaseEntry[] = [
  // real-world bases by Azgaar
  { id: "german", name: "German" },
  { id: "english", name: "English" },
  { id: "french", name: "French" },
  { id: "italian", name: "Italian" },
  { id: "castillian", name: "Castillian" },
  { id: "ruthenian", name: "Ruthenian" },
  { id: "nordic", name: "Nordic" },
  { id: "greek", name: "Greek" },
  { id: "roman", name: "Roman" },
  { id: "finnic", name: "Finnic" },
  { id: "korean", name: "Korean" },
  { id: "chinese", name: "Chinese" },
  { id: "japanese", name: "Japanese" },
  { id: "portuguese", name: "Portuguese" },
  { id: "nahuatl", name: "Nahuatl" },
  { id: "hungarian", name: "Hungarian" },
  { id: "turkish", name: "Turkish" },
  { id: "amazigh", name: "Amazigh" },
  { id: "arabic", name: "Arabic" },
  { id: "inuit", name: "Inuit" },
  { id: "basque", name: "Basque" },
  { id: "nigerian", name: "Nigerian" },
  { id: "celtic", name: "Celtic" },
  { id: "mesopotamian", name: "Mesopotamian" },
  { id: "iranian", name: "Iranian" },
  { id: "hawaiian", name: "Hawaiian" },
  { id: "karnataka", name: "Karnataka" },
  { id: "quechua", name: "Quechua" },
  { id: "swahili", name: "Swahili" },
  { id: "vietnamese", name: "Vietnamese" },
  { id: "cantonese", name: "Cantonese" },
  { id: "mongolian", name: "Mongolian" },
  // fantasy bases by Dopu
  { id: "human-generic", name: "Human Generic" },
  { id: "elven", name: "Elven" },
  { id: "dark-elven", name: "Dark Elven" },
  { id: "dwarven", name: "Dwarven" },
  { id: "goblin", name: "Goblin" },
  { id: "orc", name: "Orc" },
  { id: "giant", name: "Giant" },
  { id: "draconic", name: "Draconic" },
  { id: "arachnid", name: "Arachnid" },
  { id: "serpents", name: "Serpents" },
  // additional by Avengium
  { id: "levantine", name: "Levantine" }
];

type BaseModule = Record<string, WrittenNameBase>;
const files = import.meta.glob<BaseModule>(["./*.ts", "!./index.ts"]);

/** A shipped base in its written form */
export async function readNameBase(id: string): Promise<WrittenNameBase> {
  const load = files[`./${id}.ts`];
  if (!load) throw new Error(`Name base ${id} is not shipped`);
  return Object.values(await load())[0]; // a file exports its base alone
}
