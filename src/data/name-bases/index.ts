import type { WrittenNameBase } from "@/types/names";
import { amazigh } from "./amazigh";
import { arabic } from "./arabic";
import { arachnid } from "./arachnid";
import { basque } from "./basque";
import { cantonese } from "./cantonese";
import { castillian } from "./castillian";
import { celtic } from "./celtic";
import { chinese } from "./chinese";
import { darkElven } from "./dark-elven";
import { draconic } from "./draconic";
import { dwarven } from "./dwarven";
import { elven } from "./elven";
import { english } from "./english";
import { finnic } from "./finnic";
import { french } from "./french";
import { german } from "./german";
import { giant } from "./giant";
import { goblin } from "./goblin";
import { greek } from "./greek";
import { hawaiian } from "./hawaiian";
import { humanGeneric } from "./human-generic";
import { hungarian } from "./hungarian";
import { inuit } from "./inuit";
import { iranian } from "./iranian";
import { italian } from "./italian";
import { japanese } from "./japanese";
import { karnataka } from "./karnataka";
import { korean } from "./korean";
import { levantine } from "./levantine";
import { mesopotamian } from "./mesopotamian";
import { mongolian } from "./mongolian";
import { nahuatl } from "./nahuatl";
import { nigerian } from "./nigerian";
import { nordic } from "./nordic";
import { orc } from "./orc";
import { portuguese } from "./portuguese";
import { quechua } from "./quechua";
import { roman } from "./roman";
import { ruthenian } from "./ruthenian";
import { serpents } from "./serpents";
import { swahili } from "./swahili";
import { turkish } from "./turkish";
import { vietnamese } from "./vietnamese";

/** The shipped bases, in their written form */
export const NAME_BASES: WrittenNameBase[] = [
  // real-world bases by Azgaar
  german,
  english,
  french,
  italian,
  castillian,
  ruthenian,
  nordic,
  greek,
  roman,
  finnic,
  korean,
  chinese,
  japanese,
  portuguese,
  nahuatl,
  hungarian,
  turkish,
  amazigh,
  arabic,
  inuit,
  basque,
  nigerian,
  celtic,
  mesopotamian,
  iranian,
  hawaiian,
  karnataka,
  quechua,
  swahili,
  vietnamese,
  cantonese,
  mongolian,
  // fantasy bases by Dopu
  humanGeneric,
  elven,
  darkElven,
  dwarven,
  goblin,
  orc,
  giant,
  draconic,
  arachnid,
  serpents,
  // additional by Avengium
  levantine
];
