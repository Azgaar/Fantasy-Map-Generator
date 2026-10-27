import { max, quadtree, range } from "d3";
import { type Alignment, rollAlignment, rollValues, traitsRng } from "@/data/culture-traits";
import { Emblems } from "@/generators/emblems-generator";
import type { Emblem } from "@/types/emblems";
import { requireColor } from "@/utils/colorUtils";
import { requireCode, requireName, requireOneOf, requireOrigins } from "@/utils/validationUtils";
import { abbreviate, biased, getColors, getRandomColor, minmax, P, ra, rand, rn, rw } from "../utils";
import { Population } from "./population-generator";

/** The named culture sets the user picks from: how many cultures each holds and how often it is rolled */
export const CULTURE_SETS: Record<string, { name: string; max: number; probability: number }> = {
  world: { name: "All-world", max: 32, probability: 10 },
  european: { name: "European", max: 15, probability: 10 },
  oriental: { name: "Oriental", max: 13, probability: 2 },
  english: { name: "English", max: 10, probability: 5 },
  antique: { name: "Antique", max: 10, probability: 3 },
  highFantasy: { name: "High Fantasy", max: 100, probability: 11 },
  darkFantasy: { name: "Dark Fantasy", max: 100, probability: 3 },
  random: { name: "Random", max: 100, probability: 1 },
  astralTrek: { name: "AstralTrek", max: 100, probability: 5 },
  astralJammer: { name: "AstralJammer", max: 100, probability: 4 },
  grimdark: { name: "Grimdark", max: 100, probability: 3 },
  rpgFantasy: { name: "RPG Fantasy", max: 100, probability: 4 }
};

declare global {
  var Cultures: CulturesGenerator;
}

export interface Culture {
  name: string;
  i: number;
  base: string; // name base id
  shield: string;
  lock?: boolean;
  code?: string;
  center?: number;
  // transient coordinates cached by the heightmap editor across a re-graph
  x?: number;
  y?: number;
  sort?: (i: number) => number;
  odd?: number;
  color?: string;
  type: CultureType;
  expansionism?: number;
  /** the ethos its authorities share; absent on old maps and when the traits layer is off */
  alignment?: Alignment;
  /** 1 entry = a dominant value "held above all others", 2 = paired values */
  values?: string[];
  origins?: (number | null)[];
  removed?: boolean;
  cells?: number;
  area?: number;
  rural?: number;
  urban?: number;
  note?: string;
}

export const CULTURE_TYPES = ["Generic", "Hunting", "Highland", "River", "Lake", "Naval", "Nomadic"] as const;
export type CultureType = (typeof CULTURE_TYPES)[number];
export const DEFAULT_CULTURE_TYPE: CultureType = "Generic";

class CulturesGenerator {
  cells: any;

  getRandomShield() {
    const type = rw(Emblems.shields.types);
    return rw(Emblems.shields[type]);
  }

  getDefault(count: number = 0): Omit<Culture, "i" | "type">[] {
    // generic sorting functions
    const cells = pack.cells,
      s = cells.s,
      sMax = max(s) as number,
      t = cells.t,
      h = cells.h,
      temp = grid.cells.temp;
    const n = (cell: number) => Math.ceil((s[cell] / sMax) * 3); // normalized cell score
    const td = (cell: number, goal: number) => {
      const d = Math.abs(temp[cells.g[cell]] - goal);
      return d ? d + 1 : 1;
    }; // temperature difference fee
    const bd = (cell: number, biomes: number[], fee = 4) => (biomes.includes(cells.biome[cell]) ? 1 : fee); // biome difference fee
    const sf = (cell: number, fee = 4) =>
      cells.haven[cell] && pack.features[cells.f[cells.haven[cell]]].type !== "lake" ? 1 : fee; // not on sea coast fee

    if (options.map.cultures.set === "european") {
      return [
        {
          name: "Shwazen",
          base: "GERMA",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 10) / bd(i, [6, 8]),
          shield: "swiss"
        },
        {
          name: "Angshire",
          base: "ENGLI",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 10) / sf(i),
          shield: "wedged"
        },
        {
          name: "Luari",
          base: "FRENC",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 12) / bd(i, [6, 8]),
          shield: "french"
        },
        {
          name: "Tallian",
          base: "ITALI",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 15),
          shield: "horsehead"
        },
        {
          name: "Astellian",
          base: "CASTI",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 16),
          shield: "spanish"
        },
        {
          name: "Slovan",
          base: "RUTHE",
          odd: 1,
          sort: (i: number) => (n(i) / td(i, 6)) * t[i],
          shield: "polish"
        },
        {
          name: "Norse",
          base: "NORDI",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 5),
          shield: "heater"
        },
        {
          name: "Elladan",
          base: "GREEK",
          odd: 1,
          sort: (i: number) => (n(i) / td(i, 18)) * h[i],
          shield: "boeotian"
        },
        {
          name: "Romian",
          base: "ROMAN",
          odd: 0.2,
          sort: (i: number) => n(i) / td(i, 15) / t[i],
          shield: "roman"
        },
        {
          name: "Soumi",
          base: "FINNI",
          odd: 1,
          sort: (i: number) => (n(i) / td(i, 5) / bd(i, [9])) * t[i],
          shield: "pavise"
        },
        {
          name: "Portuzian",
          base: "PORTU",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 17) / sf(i),
          shield: "renaissance"
        },
        {
          name: "Vengrian",
          base: "HUNGA",
          odd: 1,
          sort: (i: number) => (n(i) / td(i, 11) / bd(i, [4])) * t[i],
          shield: "horsehead2"
        },
        {
          name: "Turchian",
          base: "TURKI",
          odd: 0.05,
          sort: (i: number) => n(i) / td(i, 14),
          shield: "round"
        },
        {
          name: "Euskati",
          base: "BASQU",
          odd: 0.05,
          sort: (i: number) => (n(i) / td(i, 15)) * h[i],
          shield: "oldFrench"
        },
        {
          name: "Keltan",
          base: "CELTI",
          odd: 0.05,
          sort: (i: number) => (n(i) / td(i, 11) / bd(i, [6, 8])) * t[i],
          shield: "oval"
        }
      ];
    }

    if (options.map.cultures.set === "oriental") {
      return [
        {
          name: "Koryo",
          base: "KOREA",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 12) / t[i],
          shield: "round"
        },
        {
          name: "Hantzu",
          base: "CHINE",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 13),
          shield: "banner"
        },
        {
          name: "Yamoto",
          base: "JAPAN",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 15) / t[i],
          shield: "round"
        },
        {
          name: "Turchian",
          base: "TURKI",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 12),
          shield: "round"
        },
        {
          name: "Amazi",
          base: "AMAZI",
          odd: 0.2,
          sort: (i: number) => (n(i) / td(i, 19) / bd(i, [1, 2, 3], 7)) * t[i],
          shield: "oval"
        },
        {
          name: "Eurabic",
          base: "ARABI",
          odd: 1,
          sort: (i: number) => (n(i) / td(i, 26) / bd(i, [1, 2], 7)) * t[i],
          shield: "oval"
        },
        {
          name: "Efratic",
          base: "MESOP",
          odd: 0.1,
          sort: (i: number) => (n(i) / td(i, 22)) * t[i],
          shield: "round"
        },
        {
          name: "Tehrani",
          base: "IRANI",
          odd: 1,
          sort: (i: number) => (n(i) / td(i, 18)) * h[i],
          shield: "round"
        },
        {
          name: "Maui",
          base: "HAWAI",
          odd: 0.2,
          sort: (i: number) => n(i) / td(i, 24) / sf(i) / t[i],
          shield: "vesicaPiscis"
        },
        {
          name: "Carnatic",
          base: "KARNA",
          odd: 0.5,
          sort: (i: number) => n(i) / td(i, 26),
          shield: "round"
        },
        {
          name: "Vietic",
          base: "VIETN",
          odd: 0.8,
          sort: (i: number) => n(i) / td(i, 25) / bd(i, [7], 7) / t[i],
          shield: "banner"
        },
        {
          name: "Guantzu",
          base: "CANTO",
          odd: 0.5,
          sort: (i: number) => n(i) / td(i, 17),
          shield: "banner"
        },
        {
          name: "Ulus",
          base: "MONGO",
          odd: 1,
          sort: (i: number) => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i],
          shield: "banner"
        }
      ];
    }

    if (options.map.cultures.set === "english") {
      const getName = () => Names.getBase("ENGLI", 5, 9, "");
      return [
        { name: getName(), base: "ENGLI", odd: 1, shield: "heater" },
        { name: getName(), base: "ENGLI", odd: 1, shield: "wedged" },
        { name: getName(), base: "ENGLI", odd: 1, shield: "swiss" },
        { name: getName(), base: "ENGLI", odd: 1, shield: "oldFrench" },
        { name: getName(), base: "ENGLI", odd: 1, shield: "swiss" },
        { name: getName(), base: "ENGLI", odd: 1, shield: "spanish" },
        { name: getName(), base: "ENGLI", odd: 1, shield: "hessen" },
        { name: getName(), base: "ENGLI", odd: 1, shield: "fantasy5" },
        { name: getName(), base: "ENGLI", odd: 1, shield: "fantasy4" },
        { name: getName(), base: "ENGLI", odd: 1, shield: "fantasy1" }
      ];
    }

    if (options.map.cultures.set === "antique") {
      return [
        {
          name: "Roman",
          base: "ROMAN",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 14) / t[i],
          shield: "roman"
        }, // Roman
        {
          name: "Roman",
          base: "ROMAN",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 15) / sf(i),
          shield: "roman"
        }, // Roman
        {
          name: "Roman",
          base: "ROMAN",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 16) / sf(i),
          shield: "roman"
        }, // Roman
        {
          name: "Roman",
          base: "ROMAN",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 17) / t[i],
          shield: "roman"
        }, // Roman
        {
          name: "Hellenic",
          base: "GREEK",
          odd: 1,
          sort: (i: number) => (n(i) / td(i, 18) / sf(i)) * h[i],
          shield: "boeotian"
        }, // Greek
        {
          name: "Hellenic",
          base: "GREEK",
          odd: 1,
          sort: (i: number) => (n(i) / td(i, 19) / sf(i)) * h[i],
          shield: "boeotian"
        }, // Greek
        {
          name: "Macedonian",
          base: "GREEK",
          odd: 0.5,
          sort: (i: number) => (n(i) / td(i, 12)) * h[i],
          shield: "round"
        }, // Greek
        {
          name: "Celtic",
          base: "CELTI",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 11) ** 0.5 / bd(i, [6, 8]),
          shield: "round"
        },
        {
          name: "Germanic",
          base: "GERMA",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 10) ** 0.5 / bd(i, [6, 8]),
          shield: "round"
        },
        {
          name: "Persian",
          base: "IRANI",
          odd: 0.8,
          sort: (i: number) => (n(i) / td(i, 18)) * h[i],
          shield: "oval"
        }, // Iranian
        {
          name: "Scythian",
          base: "IRANI",
          odd: 0.5,
          sort: (i: number) => n(i) / td(i, 11) ** 0.5 / bd(i, [4]),
          shield: "round"
        }, // Iranian
        {
          name: "Cantabrian",
          base: "BASQU",
          odd: 0.5,
          sort: (i: number) => (n(i) / td(i, 16)) * h[i],
          shield: "oval"
        }, // Basque
        {
          name: "Estian",
          base: "FINNI",
          odd: 0.2,
          sort: (i: number) => (n(i) / td(i, 5)) * t[i],
          shield: "pavise"
        }, // Finnic
        {
          name: "Carthaginian",
          base: "LEVAN",
          odd: 0.3,
          sort: (i: number) => n(i) / td(i, 20) / sf(i),
          shield: "oval"
        }, // Levantine
        {
          name: "Hebrew",
          base: "LEVAN",
          odd: 0.2,
          sort: (i: number) => (n(i) / td(i, 19)) * sf(i),
          shield: "oval"
        }, // Levantine
        {
          name: "Mesopotamian",
          base: "MESOP",
          odd: 0.2,
          sort: (i: number) => n(i) / td(i, 22) / bd(i, [1, 2, 3]),
          shield: "oval"
        } // Mesopotamian
      ];
    }

    if (options.map.cultures.set === "highFantasy") {
      return [
        // fantasy races
        {
          name: "Quenian (Elfish)",
          base: "ELVEN",
          odd: 1,
          sort: (i: number) => (n(i) / bd(i, [6, 7, 8, 9], 10)) * t[i],
          shield: "gondor"
        }, // Elves
        {
          name: "Eldar (Elfish)",
          base: "ELVEN",
          odd: 1,
          sort: (i: number) => (n(i) / bd(i, [6, 7, 8, 9], 10)) * t[i],
          shield: "noldor"
        }, // Elves
        {
          name: "Trow (Dark Elfish)",
          base: "DARKE",
          odd: 0.9,
          sort: (i: number) => (n(i) / bd(i, [7, 8, 9, 12], 10)) * t[i],
          shield: "hessen"
        }, // Dark Elves
        {
          name: "Lothian (Dark Elfish)",
          base: "DARKE",
          odd: 0.3,
          sort: (i: number) => (n(i) / bd(i, [7, 8, 9, 12], 10)) * t[i],
          shield: "wedged"
        }, // Dark Elves
        {
          name: "Dunirr (Dwarven)",
          base: "DWARV",
          odd: 1,
          sort: (i: number) => n(i) + h[i],
          shield: "ironHills"
        }, // Dwarfs
        {
          name: "Khazadur (Dwarven)",
          base: "DWARV",
          odd: 1,
          sort: (i: number) => n(i) + h[i],
          shield: "erebor"
        }, // Dwarfs
        {
          name: "Kobold (Goblin)",
          base: "GOBLI",
          odd: 1,
          sort: (i: number) => t[i] - s[i],
          shield: "moriaOrc"
        }, // Goblin
        {
          name: "Uruk (Orkish)",
          base: "ORCIS",
          odd: 1,
          sort: (i: number) => h[i] * t[i],
          shield: "urukHai"
        }, // Orc
        {
          name: "Ugluk (Orkish)",
          base: "ORCIS",
          odd: 0.5,
          sort: (i: number) => (h[i] * t[i]) / bd(i, [1, 2, 10, 11]),
          shield: "moriaOrc"
        }, // Orc
        {
          name: "Yotunn (Giants)",
          base: "GIANT",
          odd: 0.7,
          sort: (i: number) => td(i, -10),
          shield: "pavise"
        }, // Giant
        {
          name: "Rake (Drakonic)",
          base: "DRACO",
          odd: 0.7,
          sort: (i: number) => -s[i],
          shield: "fantasy2"
        }, // Draconic
        {
          name: "Arago (Arachnid)",
          base: "ARACH",
          odd: 0.7,
          sort: (i: number) => t[i] - s[i],
          shield: "horsehead2"
        }, // Arachnid
        {
          name: "Aj'Snaga (Serpents)",
          base: "SERPE",
          odd: 0.7,
          sort: (i: number) => n(i) / bd(i, [12], 10),
          shield: "fantasy1"
        }, // Serpents
        // fantasy human
        {
          name: "Anor (Human)",
          base: "HUMAN",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 10),
          shield: "fantasy5"
        },
        {
          name: "Dail (Human)",
          base: "HUMAN",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 13),
          shield: "roman"
        },
        {
          name: "Rohand (Human)",
          base: "TURKI",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 16),
          shield: "round"
        },
        {
          name: "Dulandir (Human)",
          base: "MONGO",
          odd: 1,
          sort: (i: number) => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i],
          shield: "easterling"
        }
      ];
    }

    if (options.map.cultures.set === "darkFantasy") {
      return [
        // common real-world English
        {
          name: "Angshire",
          base: "ENGLI",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 10) / sf(i),
          shield: "heater"
        },
        {
          name: "Enlandic",
          base: "ENGLI",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 12),
          shield: "heater"
        },
        {
          name: "Westen",
          base: "ENGLI",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 10),
          shield: "heater"
        },
        {
          name: "Nortumbic",
          base: "ENGLI",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 7),
          shield: "heater"
        },
        {
          name: "Mercian",
          base: "ENGLI",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 9),
          shield: "heater"
        },
        {
          name: "Kentian",
          base: "ENGLI",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 12),
          shield: "heater"
        },
        // rare real-world western
        {
          name: "Norse",
          base: "NORDI",
          odd: 0.7,
          sort: (i: number) => n(i) / td(i, 5) / sf(i),
          shield: "oldFrench"
        },
        {
          name: "Schwarzen",
          base: "GERMA",
          odd: 0.3,
          sort: (i: number) => n(i) / td(i, 10) / bd(i, [6, 8]),
          shield: "gonfalon"
        },
        {
          name: "Luarian",
          base: "FRENC",
          odd: 0.3,
          sort: (i: number) => n(i) / td(i, 12) / bd(i, [6, 8]),
          shield: "oldFrench"
        },
        {
          name: "Hetallian",
          base: "ITALI",
          odd: 0.3,
          sort: (i: number) => n(i) / td(i, 15),
          shield: "oval"
        },
        {
          name: "Astellian",
          base: "CASTI",
          odd: 0.3,
          sort: (i: number) => n(i) / td(i, 16),
          shield: "spanish"
        },
        // rare real-world exotic
        {
          name: "Kiswaili",
          base: "SWAHI",
          odd: 0.05,
          sort: (i: number) => n(i) / td(i, 29) / bd(i, [1, 3, 5, 7]),
          shield: "vesicaPiscis"
        },
        {
          name: "Yoruba",
          base: "NIGER",
          odd: 0.05,
          sort: (i: number) => n(i) / td(i, 15) / bd(i, [5, 7]),
          shield: "vesicaPiscis"
        },
        {
          name: "Koryo",
          base: "KOREA",
          odd: 0.05,
          sort: (i: number) => n(i) / td(i, 12) / t[i],
          shield: "round"
        },
        {
          name: "Hantzu",
          base: "CHINE",
          odd: 0.05,
          sort: (i: number) => n(i) / td(i, 13),
          shield: "banner"
        },
        {
          name: "Yamoto",
          base: "JAPAN",
          odd: 0.05,
          sort: (i: number) => n(i) / td(i, 15) / t[i],
          shield: "round"
        },
        {
          name: "Guantzu",
          base: "CANTO",
          odd: 0.05,
          sort: (i: number) => n(i) / td(i, 17),
          shield: "banner"
        },
        {
          name: "Ulus",
          base: "MONGO",
          odd: 0.05,
          sort: (i: number) => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i],
          shield: "banner"
        },
        {
          name: "Turan",
          base: "TURKI",
          odd: 0.05,
          sort: (i: number) => n(i) / td(i, 12),
          shield: "round"
        },
        {
          name: "Amazi",
          base: "AMAZI",
          odd: 0.05,
          sort: (i: number) => (n(i) / td(i, 19) / bd(i, [1, 2, 3], 7)) * t[i],
          shield: "round"
        },
        {
          name: "Eurabic",
          base: "ARABI",
          odd: 0.05,
          sort: (i: number) => (n(i) / td(i, 26) / bd(i, [1, 2], 7)) * t[i],
          shield: "round"
        },
        {
          name: "Slovan",
          base: "RUTHE",
          odd: 0.05,
          sort: (i: number) => (n(i) / td(i, 6)) * t[i],
          shield: "round"
        },
        {
          name: "Keltan",
          base: "CELTI",
          odd: 0.1,
          sort: (i: number) => n(i) / td(i, 11) ** 0.5 / bd(i, [6, 8]),
          shield: "vesicaPiscis"
        },
        {
          name: "Elladan",
          base: "GREEK",
          odd: 0.2,
          sort: (i: number) => (n(i) / td(i, 18) / sf(i)) * h[i],
          shield: "boeotian"
        },
        {
          name: "Romian",
          base: "ROMAN",
          odd: 0.2,
          sort: (i: number) => n(i) / td(i, 14) / t[i],
          shield: "roman"
        },
        // fantasy races
        {
          name: "Eldar",
          base: "ELVEN",
          odd: 0.5,
          sort: (i: number) => (n(i) / bd(i, [6, 7, 8, 9], 10)) * t[i],
          shield: "fantasy5"
        }, // Elves
        {
          name: "Trow",
          base: "DARKE",
          odd: 0.8,
          sort: (i: number) => (n(i) / bd(i, [7, 8, 9, 12], 10)) * t[i],
          shield: "hessen"
        }, // Dark Elves
        {
          name: "Durinn",
          base: "DWARV",
          odd: 0.8,
          sort: (i: number) => n(i) + h[i],
          shield: "erebor"
        }, // Dwarven
        {
          name: "Kobblin",
          base: "GOBLI",
          odd: 0.8,
          sort: (i: number) => t[i] - s[i],
          shield: "moriaOrc"
        }, // Goblin
        {
          name: "Uruk",
          base: "ORCIS",
          odd: 0.8,
          sort: (i: number) => (h[i] * t[i]) / bd(i, [1, 2, 10, 11]),
          shield: "urukHai"
        }, // Orc
        {
          name: "Yotunn",
          base: "GIANT",
          odd: 0.8,
          sort: (i: number) => td(i, -10),
          shield: "pavise"
        }, // Giant
        {
          name: "Drake",
          base: "DRACO",
          odd: 0.9,
          sort: (i: number) => -s[i],
          shield: "fantasy2"
        }, // Draconic
        {
          name: "Rakhnid",
          base: "ARACH",
          odd: 0.9,
          sort: (i: number) => t[i] - s[i],
          shield: "horsehead2"
        }, // Arachnid
        {
          name: "Aj'Snaga",
          base: "SERPE",
          odd: 0.9,
          sort: (i: number) => n(i) / bd(i, [12], 10),
          shield: "fantasy1"
        } // Serpents
      ];
    }

    if (options.map.cultures.set === "astralTrek") {
      return [
        {
          name: "Terran (Human)",
          base: "TRKTE",
          odd: 1,
          sort: (i: number) => n(i) / td(i, 12),
          shield: "heater"
        },
        { name: "Colonial (Human)", base: "TRKTE", odd: 0.8, sort: (i: number) => n(i), shield: "kite" },
        {
          name: "Continental (Human)",
          base: "TRKCN",
          odd: 0.9,
          sort: (i: number) => n(i) / td(i, 12),
          shield: "french"
        },
        {
          name: "Highlander (Human)",
          base: "TRKCN",
          odd: 0.6,
          sort: (i: number) => (n(i) / td(i, 0)) * (h[i] || 1),
          shield: "hessen"
        },
        {
          name: "Synthetic (Machine)",
          base: "TRKSY",
          odd: 0.7,
          sort: (i: number) => n(i),
          shield: "hexagon"
        },
        {
          name: "Posthuman (Machine)",
          base: "TRKSY",
          odd: 0.5,
          sort: (i: number) => 1 / (n(i) + 1),
          shield: "diamond"
        },
        {
          name: "Core Worlds (Mixed)",
          base: "TRKCO",
          odd: 0.8,
          sort: (i: number) => n(i),
          shield: "gonfalon"
        },
        {
          name: "Inner Reach (Mixed)",
          base: "TRKCO",
          odd: 0.6,
          sort: (i: number) => 1 / (n(i) + 1),
          shield: "banner"
        }
      ];
    }

    if (options.map.cultures.set === "astralJammer") {
      return [
        {
          name: "Ethereal (Kindred)",
          base: "JAMET",
          odd: 1,
          sort: (i: number) => 1 / (n(i) + 1),
          shield: "vesicaPiscis"
        },
        {
          name: "Silver Kin (Kindred)",
          base: "JAMET",
          odd: 0.8,
          sort: (i: number) => n(i),
          shield: "fantasy1"
        },
        {
          name: "Stoneborn (Deep)",
          base: "JAMST",
          odd: 0.9,
          sort: (i: number) => (n(i) / td(i, 0)) * (h[i] || 1),
          shield: "wedged"
        },
        {
          name: "Deepkin (Deep)",
          base: "JAMST",
          odd: 0.7,
          sort: (i: number) => (n(i) / td(i, 0)) * (h[i] || 1),
          shield: "fantasy2"
        },
        {
          name: "Wild (Ferals)",
          base: "JAMWI",
          odd: 0.8,
          sort: (i: number) => (n(i) / td(i, 0)) * (h[i] || 1),
          shield: "moriaOrc"
        },
        {
          name: "Scavengers (Ferals)",
          base: "JAMWI",
          odd: 0.6,
          sort: (i: number) => n(i),
          shield: "fantasy4"
        },
        {
          name: "Deep Choir (Collective)",
          base: "JAMDE",
          odd: 0.7,
          sort: (i: number) => n(i),
          shield: "pavise"
        },
        {
          name: "Far Chorus (Collective)",
          base: "JAMDE",
          odd: 0.5,
          sort: (i: number) => 1 / (n(i) + 1),
          shield: "fantasy5"
        }
      ];
    }

    if (options.map.cultures.set === "grimdark") {
      return [
        {
          name: "Gothic (Darkling)",
          base: "GRMGO",
          odd: 1,
          sort: (i: number) => (n(i) / td(i, 0)) * (h[i] || 1),
          shield: "oldFrench"
        },
        {
          name: "Northerners (Darkling)",
          base: "GRMGO",
          odd: 0.8,
          sort: (i: number) => (n(i) / td(i, 0)) * (h[i] || 1),
          shield: "horsehead"
        },
        {
          name: "Iron (Foundrymen)",
          base: "GRMIR",
          odd: 0.9,
          sort: (i: number) => n(i),
          shield: "square"
        },
        {
          name: "Yard Companies (Foundrymen)",
          base: "GRMIR",
          odd: 0.7,
          sort: (i: number) => n(i),
          shield: "targe"
        },
        {
          name: "Machine (Cold)",
          base: "GRMCH",
          odd: 0.7,
          sort: (i: number) => 1 / (n(i) + 1),
          shield: "embowed"
        },
        {
          name: "Calculators (Cold)",
          base: "GRMCH",
          odd: 0.5,
          sort: (i: number) => n(i),
          shield: "diamond"
        },
        {
          name: "Core Holds (Mixed)",
          base: "GRMCO",
          odd: 0.8,
          sort: (i: number) => n(i),
          shield: "gonfalon"
        },
        {
          name: "Rust Kingdoms (Mixed)",
          base: "GRMCO",
          odd: 0.6,
          sort: (i: number) => 1 / (n(i) + 1),
          shield: "pavise"
        }
      ];
    }

    if (options.map.cultures.set === "rpgFantasy") {
      const habitat = {
        forest: (i: number) => n(i) / bd(i, [6, 7, 8, 9], 10),
        highland: (i: number) => n(i) + h[i],
        arid: (i: number) => n(i) / td(i, 25),
        polar: (i: number) => n(i) / td(i, -10),
        coastal: (i: number) => n(i) * (cells.haven[i] ? 1 : 0.2),
        underworld: (i: number) => n(i) / td(i, 20) + (sMax - h[i]),
        open: (i: number) => n(i)
      };

      return [
        // Elves & kin
        { name: "Quenar (High Elf)", base: "ELVEN", odd: 1, sort: habitat.forest, shield: "noldor" },
        { name: "Sylvan (Wood Elf)", base: "ELVEN", odd: 0.9, sort: habitat.forest, shield: "fantasy3" },
        { name: "Drow (Dark Elf)", base: "DARKE", odd: 0.8, sort: habitat.underworld, shield: "hessen" },
        { name: "Aelvar (Sea Elf)", base: "MERFO", odd: 0.35, sort: habitat.coastal, shield: "vesicaPiscis" },

        // Dwarves & smallfolk
        { name: "Khazad (Mountain Dwarf)", base: "DWARV", odd: 1, sort: habitat.highland, shield: "ironHills" },
        { name: "Hearthdwarf (Hill Dwarf)", base: "DWARV", odd: 0.9, sort: habitat.highland, shield: "erebor" },
        { name: "Duergar (Deep Dwarf)", base: "DWARV", odd: 0.45, sort: habitat.underworld, shield: "pavise" },
        { name: "Halfling (Hobbit)", base: "HALFL", odd: 1, sort: habitat.open, shield: "round" },
        { name: "Gnome (Tinker)", base: "HALFL", odd: 0.6, sort: habitat.highland, shield: "oval" },

        // Goblinoids, giants & dragonspawn
        { name: "Orc", base: "ORCIS", odd: 1, sort: habitat.highland, shield: "urukHai" },
        { name: "Goblin", base: "GOBLI", odd: 1, sort: habitat.underworld, shield: "moriaOrc" },
        { name: "Hobgoblin (Legion)", base: "ORCIS", odd: 0.6, sort: habitat.open, shield: "targe" },
        { name: "Troll", base: "GIANT", odd: 0.5, sort: habitat.polar, shield: "swiss" },
        { name: "Ogre", base: "GIANT", odd: 0.4, sort: habitat.highland, shield: "horsehead2" },
        { name: "Dragonborn", base: "DRACO", odd: 0.6, sort: habitat.highland, shield: "fantasy2" },
        { name: "Kobold", base: "GOBLI", odd: 0.3, sort: habitat.underworld, shield: "fantasy1" },
        { name: "Lizardfolk", base: "SERPE", odd: 0.6, sort: habitat.coastal, shield: "fantasy4" },

        // Beastfolk & fey
        { name: "Lionkin (Catfolk)", base: "BEAST", odd: 0.45, sort: habitat.arid, shield: "horsehead" },
        { name: "Wolfkin (Werefolk)", base: "BEAST", odd: 0.35, sort: habitat.forest, shield: "round" },
        { name: "Aarakocra (Birdfolk)", base: "BEAST", odd: 0.35, sort: habitat.highland, shield: "vesicaPiscis" },
        { name: "Minotaur (Bullkin)", base: "GIANT", odd: 0.35, sort: habitat.highland, shield: "spanish" },
        { name: "Fey (Fair Folk)", base: "FEYFO", odd: 0.6, sort: habitat.forest, shield: "fantasy5" },
        { name: "Sidhe (Lake Fey)", base: "FEYFO", odd: 0.3, sort: habitat.coastal, shield: "diamond" },
        { name: "Genasi (Elemental)", base: "ELEME", odd: 0.4, sort: habitat.polar, shield: "hexagon" },

        // Dark powers & divine
        { name: "Tiefling (Fiendblood)", base: "INFER", odd: 0.55, sort: habitat.arid, shield: "targe2" },
        { name: "Demon (Fiend)", base: "INFER", odd: 0.25, sort: habitat.underworld, shield: "no" },
        { name: "Vampire (Nightblood)", base: "GRAVE", odd: 0.5, sort: habitat.polar, shield: "baroque" },
        { name: "Lich (Necromancer)", base: "GRAVE", odd: 0.3, sort: habitat.polar, shield: "oldFrench" },
        { name: "Aasimar (Celestial)", base: "CELES", odd: 0.35, sort: habitat.highland, shield: "boeotian" },
        { name: "Chosen (Oracle)", base: "CELES", odd: 0.25, sort: habitat.open, shield: "flag" },

        // Constructs & aberrations
        { name: "Warforged (Construct)", base: "CONST", odd: 0.35, sort: habitat.open, shield: "square" },
        { name: "Aboleth (Eldritch)", base: "ELDRI", odd: 0.2, sort: habitat.coastal, shield: "dovetail" },
        { name: "Mindflayer (Eldritch)", base: "ELDRI", odd: 0.2, sort: habitat.open, shield: "wedged" },

        // Humans
        { name: "Imperial (Human)", base: "ROMAN", odd: 1, sort: habitat.open, shield: "roman" },
        { name: "Feudal (Human)", base: "HUMAN", odd: 1, sort: habitat.open, shield: "heater" },
        { name: "Nordlander (Human)", base: "NORDI", odd: 0.9, sort: habitat.coastal, shield: "french" },
        { name: "Steppe Rider (Human)", base: "MONGO", odd: 0.8, sort: habitat.arid, shield: "banner" },
        { name: "Desert Nomad (Human)", base: "ARABI", odd: 0.8, sort: habitat.arid, shield: "gonfalon" },
        { name: "Islander (Human)", base: "HAWAI", odd: 0.5, sort: habitat.coastal, shield: "oval" },
        { name: "Jungle Tribe (Human)", base: "TRIBA", odd: 0.6, sort: habitat.forest, shield: "pennon" },
        { name: "Tundra Tribe (Human)", base: "TRIBA", odd: 0.4, sort: habitat.polar, shield: "guidon" },
        { name: "Eastern Empire (Human)", base: "JAPAN", odd: 0.5, sort: habitat.open, shield: "dovetail" },
        { name: "Southern Kingdom (Human)", base: "SWAHI", odd: 0.4, sort: habitat.arid, shield: "pennant" }
      ];
    }

    if (options.map.cultures.set === "random") {
      return range(count).map(() => {
        const base = ra(Names.nameBases);
        const name = Names.getBaseShort(base.id);
        return { name, base: base.id, odd: 1, shield: this.getRandomShield() };
      });
    }

    // all-world
    return [
      {
        name: "Shwazen",
        base: "GERMA",
        odd: 0.7,
        sort: (i: number) => n(i) / td(i, 10) / bd(i, [6, 8]),
        shield: "hessen"
      },
      {
        name: "Angshire",
        base: "ENGLI",
        odd: 1,
        sort: (i: number) => n(i) / td(i, 10) / sf(i),
        shield: "heater"
      },
      {
        name: "Luari",
        base: "FRENC",
        odd: 0.6,
        sort: (i: number) => n(i) / td(i, 12) / bd(i, [6, 8]),
        shield: "oldFrench"
      },
      {
        name: "Tallian",
        base: "ITALI",
        odd: 0.6,
        sort: (i: number) => n(i) / td(i, 15),
        shield: "horsehead2"
      },
      {
        name: "Astellian",
        base: "CASTI",
        odd: 0.6,
        sort: (i: number) => n(i) / td(i, 16),
        shield: "spanish"
      },
      {
        name: "Slovan",
        base: "RUTHE",
        odd: 0.7,
        sort: (i: number) => (n(i) / td(i, 6)) * t[i],
        shield: "round"
      },
      {
        name: "Norse",
        base: "NORDI",
        odd: 0.7,
        sort: (i: number) => n(i) / td(i, 5),
        shield: "heater"
      },
      {
        name: "Elladan",
        base: "GREEK",
        odd: 0.7,
        sort: (i: number) => (n(i) / td(i, 18)) * h[i],
        shield: "boeotian"
      },
      {
        name: "Romian",
        base: "ROMAN",
        odd: 0.7,
        sort: (i: number) => n(i) / td(i, 15),
        shield: "roman"
      },
      {
        name: "Soumi",
        base: "FINNI",
        odd: 0.3,
        sort: (i: number) => (n(i) / td(i, 5) / bd(i, [9])) * t[i],
        shield: "pavise"
      },
      {
        name: "Koryo",
        base: "KOREA",
        odd: 0.1,
        sort: (i: number) => n(i) / td(i, 12) / t[i],
        shield: "round"
      },
      {
        name: "Hantzu",
        base: "CHINE",
        odd: 0.1,
        sort: (i: number) => n(i) / td(i, 13),
        shield: "banner"
      },
      {
        name: "Yamoto",
        base: "JAPAN",
        odd: 0.1,
        sort: (i: number) => n(i) / td(i, 15) / t[i],
        shield: "round"
      },
      {
        name: "Portuzian",
        base: "PORTU",
        odd: 0.4,
        sort: (i: number) => n(i) / td(i, 17) / sf(i),
        shield: "spanish"
      },
      {
        name: "Nawatli",
        base: "NAHUA",
        odd: 0.1,
        sort: (i: number) => h[i] / td(i, 18) / bd(i, [7]),
        shield: "square"
      },
      {
        name: "Vengrian",
        base: "HUNGA",
        odd: 0.2,
        sort: (i: number) => (n(i) / td(i, 11) / bd(i, [4])) * t[i],
        shield: "wedged"
      },
      {
        name: "Turchian",
        base: "TURKI",
        odd: 0.2,
        sort: (i: number) => n(i) / td(i, 13),
        shield: "round"
      },
      {
        name: "Amazi",
        base: "AMAZI",
        odd: 0.1,
        sort: (i: number) => (n(i) / td(i, 19) / bd(i, [1, 2, 3], 7)) * t[i],
        shield: "round"
      },
      {
        name: "Eurabic",
        base: "ARABI",
        odd: 0.2,
        sort: (i: number) => (n(i) / td(i, 26) / bd(i, [1, 2], 7)) * t[i],
        shield: "round"
      },
      {
        name: "Inuk",
        base: "INUIT",
        odd: 0.05,
        sort: (i: number) => td(i, -1) / bd(i, [10, 11]) / sf(i),
        shield: "square"
      },
      {
        name: "Euskati",
        base: "BASQU",
        odd: 0.05,
        sort: (i: number) => (n(i) / td(i, 15)) * h[i],
        shield: "spanish"
      },
      {
        name: "Yoruba",
        base: "NIGER",
        odd: 0.05,
        sort: (i: number) => n(i) / td(i, 15) / bd(i, [5, 7]),
        shield: "vesicaPiscis"
      },
      {
        name: "Keltan",
        base: "CELTI",
        odd: 0.05,
        sort: (i: number) => (n(i) / td(i, 11) / bd(i, [6, 8])) * t[i],
        shield: "vesicaPiscis"
      },
      {
        name: "Efratic",
        base: "MESOP",
        odd: 0.05,
        sort: (i: number) => (n(i) / td(i, 22)) * t[i],
        shield: "diamond"
      },
      {
        name: "Tehrani",
        base: "IRANI",
        odd: 0.1,
        sort: (i: number) => (n(i) / td(i, 18)) * h[i],
        shield: "round"
      },
      {
        name: "Maui",
        base: "HAWAI",
        odd: 0.05,
        sort: (i: number) => n(i) / td(i, 24) / sf(i) / t[i],
        shield: "round"
      },
      {
        name: "Carnatic",
        base: "KARNA",
        odd: 0.05,
        sort: (i: number) => n(i) / td(i, 26),
        shield: "round"
      },
      {
        name: "Inqan",
        base: "QUECH",
        odd: 0.05,
        sort: (i: number) => h[i] / td(i, 13),
        shield: "square"
      },
      {
        name: "Kiswaili",
        base: "SWAHI",
        odd: 0.1,
        sort: (i: number) => n(i) / td(i, 29) / bd(i, [1, 3, 5, 7]),
        shield: "vesicaPiscis"
      },
      {
        name: "Vietic",
        base: "VIETN",
        odd: 0.1,
        sort: (i: number) => n(i) / td(i, 25) / bd(i, [7], 7) / t[i],
        shield: "banner"
      },
      {
        name: "Guantzu",
        base: "CANTO",
        odd: 0.1,
        sort: (i: number) => n(i) / td(i, 17),
        shield: "banner"
      },
      {
        name: "Ulus",
        base: "MONGO",
        odd: 0.1,
        sort: (i: number) => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i],
        shield: "banner"
      },
      {
        name: "Levent",
        base: "LEVAN",
        odd: 0.2,
        sort: (i: number) => (n(i) / td(i, 18)) * sf(i),
        shield: "oval"
      } // Levantine
    ];
  }

  generate() {
    options.map.cultures.set = options.generation.cultures.set;
    this.cells = pack.cells;
    const cultureIds = new Uint16Array(this.cells.i.length); // cell cultures
    const withTraits = options.generation.cultures.traits; // one switch for the whole social layer

    const culturesInputNumber = options.generation.cultures.limit;
    const culturesInSetNumber = CULTURE_SETS[options.map.cultures.set]?.max ?? 0;
    let count = Math.min(culturesInputNumber, culturesInSetNumber);
    const populated = this.cells.i.filter((i: number) => this.cells.s[i]); // populated cells

    if (populated.length < count * 25) {
      count = Math.floor(populated.length / 50);
      if (!count) {
        WARN && console.warn(`There are no populated cells. Cannot generate cultures`);
        pack.cultures = [
          {
            name: "Wildlands",
            i: 0,
            base: "ENGLI",
            shield: "round",
            type: DEFAULT_CULTURE_TYPE
          }
        ];
        this.cells.culture = cultureIds;

        alertMessage.innerHTML = /* html */ `The climate is harsh and people cannot live in this world.<br />
          No cultures, states and burgs will be created.<br />
          Please consider changing climate settings in the World Configurator`;

        $("#alert").dialog({
          resizable: false,
          title: "Extreme climate warning",
          buttons: {
            Ok: function () {
              $(this).dialog("close");
            }
          }
        });
        return;
      } else {
        WARN && console.warn(`Not enough populated cells (${populated.length}). Will generate only ${count} cultures`);
        alertMessage.innerHTML = /* html */ ` There are only ${populated.length} populated cells and it's insufficient livable area.<br />
          Only ${count} out of ${options.generation.cultures.limit} requested cultures will be generated.<br />
          Please consider changing climate settings in the World Configurator`;
        $("#alert").dialog({
          resizable: false,
          title: "Extreme climate warning",
          buttons: {
            Ok: function () {
              $(this).dialog("close");
            }
          }
        });
      }
    }

    const selectCultures = (culturesNumber: number): Culture[] => {
      const defaultCultures = this.getDefault(culturesNumber);
      const cultures: Culture[] = [];

      pack.cultures?.forEach(culture => {
        if (culture.lock && !culture.removed) cultures.push(culture);
      });

      if (!cultures.length) {
        if (culturesNumber === defaultCultures.length) return defaultCultures as Culture[];
        if (defaultCultures.every(d => d.odd === 1)) return defaultCultures.splice(0, culturesNumber) as Culture[];
      }

      for (let culture: Culture, rnd: number, i = 0; cultures.length < culturesNumber && defaultCultures.length > 0; ) {
        do {
          rnd = rand(defaultCultures.length - 1);
          culture = defaultCultures[rnd] as Culture;
          i++;
        } while (i < 200 && !P(culture.odd as number));
        cultures.push(culture);
        defaultCultures.splice(rnd, 1);
      }
      return cultures;
    };

    const cultures = selectCultures(count);
    pack.cultures = cultures;
    const centers = quadtree<number>();
    const colors = getColors(count);
    const emblemShape = Emblems.shape;

    const codes: string[] = [];

    const placeCenter = (sortingFn: (i: number) => number) => {
      let spacing = (options.map.graph.width + options.map.graph.height) / 2 / count;
      const MAX_ATTEMPTS = 100;

      const sorted = [...populated].sort((a, b) => sortingFn(b) - sortingFn(a));
      const max = Math.floor(sorted.length / 2);

      let cellId = 0;
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        cellId = sorted[biased(0, max, 5)];
        spacing *= 0.9;
        if (!cultureIds[cellId] && !centers.find(this.cells.p[cellId][0], this.cells.p[cellId][1], spacing)) break;
      }

      return cellId;
    };

    // set culture type based on culture center position
    const defineCultureType = (i: number) => {
      if (this.cells.h[i] < 70 && [1, 2, 4].includes(this.cells.biome[i])) return "Nomadic"; // high penalty in forest biomes and near coastline
      if (this.cells.h[i] > 50) return "Highland"; // no penalty for hills and mountains, high for other elevations
      const f = pack.features[this.cells.f[this.cells.haven[i]]]; // opposite feature
      if (f.type === "lake" && f.cells > 5) return "Lake"; // low water cross penalty and high for growth not along coastline
      if (
        (this.cells.harbor[i] && f.type !== "lake" && P(0.1)) ||
        (this.cells.harbor[i] === 1 && P(0.6)) ||
        (pack.features[this.cells.f[i]].subtype === "isle" && P(0.4))
      )
        return "Naval"; // low water cross penalty and high for non-along-coastline growth
      if (this.cells.r[i] && this.cells.fl[i] > 100) return "River"; // no River cross penalty, penalty for non-River growth
      if (this.cells.t[i] > 2 && [3, 7, 8, 9, 10, 12].includes(this.cells.biome[i])) return "Hunting"; // high penalty in non-native biomes
      return DEFAULT_CULTURE_TYPE;
    };

    const defineCultureExpansionism = (type: CultureType) => {
      let base = 1; // Generic
      if (type === "Lake") base = 0.8;
      else if (type === "Naval") base = 1.5;
      else if (type === "River") base = 0.9;
      else if (type === "Nomadic") base = 1.5;
      else if (type === "Hunting") base = 0.7;
      else if (type === "Highland") base = 1.2;
      return rn(((Math.random() * options.generation.cultures.sizeVariety) / 2 + 1) * base, 1);
    };

    cultures.forEach((c: Culture, i: number) => {
      const newId = i + 1;

      if (c.lock) {
        codes.push(c.code as string);
        centers.add(c.center as number);

        for (const i of this.cells.i) {
          if (this.cells.culture[i] === c.i) cultureIds[i] = newId;
        }

        c.i = newId;
        return;
      }

      const sortingFn = c.sort ? c.sort : (i: number) => this.cells.s[i];
      const center = placeCenter(sortingFn);

      centers.add(this.cells.p[center]);
      c.center = center;
      c.i = newId;
      delete c.odd;
      delete c.sort;
      c.color = colors[i];
      c.type = defineCultureType(center);
      c.expansionism = defineCultureExpansionism(c.type);
      c.origins = [0];
      c.code = abbreviate(c.name, codes);
      codes.push(c.code);

      // a culture starts from scratch: the neutral column, not its parent's
      if (withTraits) {
        const rng = traitsRng(options.map.seed, "culture", newId);
        c.alignment = rollAlignment(rng);
        c.values = rollValues(rng, c.alignment);
      }

      cultureIds[center] = newId;
      if (emblemShape === "random") c.shield = this.getRandomShield();
    });

    this.cells.culture = cultureIds;

    // the first culture with id 0 is for wildlands
    cultures.unshift({
      name: "Wildlands",
      i: 0,
      base: "ENGLI",
      origins: [null],
      shield: "round",
      type: DEFAULT_CULTURE_TYPE
    });

    // make sure all bases exist in Names.nameBases
    if (!Names.nameBases.length) {
      ERROR && console.error("Name base is empty, default nameBases will be applied");
      Names.nameBases = Names.getNameBases();
    }

    cultures.forEach((c: Culture) => {
      if (!Names.getNameBase(c.base)) c.base = Names.nameBases[0].id;
    });
  }

  /** Found a culture centered at a map point; it takes land when cultures are recalculated. Returns its id */
  add(x: number, y: number): number {
    const center = Pack.requireCell(x, y);
    if (pack.cells.h[center] < 20) throw new Error("A culture center cannot be placed in the water");
    if (pack.cultures.some(c => c.i && !c.removed && c.center === center))
      throw new Error(`Cell ${center} is already a culture center`);
    const defaultCultures = this.getDefault();
    let culture: number, base: string, name: string;

    if (pack.cultures.length < defaultCultures.length) {
      // add one of the default cultures
      culture = pack.cultures.length;
      base = defaultCultures[culture].base;
      name = defaultCultures[culture].name;
    } else {
      // add random culture based on one of the current ones
      culture = rand(pack.cultures.length - 1);
      name = Names.getCulture(culture, 5, 8, "");
      base = pack.cultures[culture].base;
    }

    const code = abbreviate(name, pack.cultures.map(c => c.code) as string[]);
    const i = pack.cultures.length;
    const color = getRandomColor();

    const created: Culture = {
      name,
      color,
      base,
      center,
      i,
      expansionism: 1,
      type: DEFAULT_CULTURE_TYPE,
      cells: 0,
      area: 0,
      rural: 0,
      urban: 0,
      origins: [pack.cells.culture[center]],
      code,
      shield: Emblems.shape === "random" ? this.getRandomShield() : ""
    };

    // a founded culture diverges from its parent: it rolls the parent's prevailing column. The
    // parent can be Wildlands, removed or unknown (old map/founded on the sea), which reads the
    // neutral column - the same default a culture from scratch gets
    if (options.generation.cultures.traits) {
      const rng = traitsRng(options.map.seed, "culture", i);
      created.alignment = rollAlignment(rng, pack.cultures[pack.cells.culture[center]]?.alignment);
      created.values = rollValues(rng, created.alignment);
    }

    pack.cultures.push(created);
    return i;
  }

  expand() {
    const { cells, cultures } = pack;

    const queue = new FlatQueue();
    const cost: number[] = [];

    const growthRate = options.generation.cultures.growthRate;
    const maxExpansionCost = cells.i.length * 0.6 * growthRate; // limit cost for culture growth

    // remove culture from all cells except of locked
    const hasLocked = cultures.some(c => !c.removed && c.lock);
    if (hasLocked) {
      for (const cellId of cells.i) {
        const culture = cultures[cells.culture[cellId]];
        if (culture.lock) continue;
        cells.culture[cellId] = 0;
      }
    } else {
      cells.culture = new Uint16Array(cells.i.length);
    }

    for (const culture of cultures) {
      if (!culture.i || culture.removed || culture.lock) continue;
      queue.push({ cellId: culture.center, cultureId: culture.i, priority: 0 }, 0);
    }

    const getBiomeCost = (c: number, biome: number, type: string) => {
      if (cells.biome[cultures[c].center as number] === biome) return 10; // tiny penalty for native biome
      if (type === "Hunting") return pack.biomes[biome].cost * 5; // non-native biome penalty for hunters
      if (type === "Nomadic" && biome > 4 && biome < 10) return pack.biomes[biome].cost * 10; // forest biome penalty for nomads
      return pack.biomes[biome].cost * 2; // general non-native biome penalty
    };

    const getHeightCost = (i: number, h: number, type: string) => {
      const f = pack.features[cells.f[i]],
        a = cells.area[i];
      if (type === "Lake" && f.type === "lake") return 10; // no lake crossing penalty for Lake cultures
      if (type === "Naval" && h < 20) return a * 2; // low sea/lake crossing penalty for Naval cultures
      if (type === "Nomadic" && h < 20) return a * 50; // giant sea/lake crossing penalty for Nomads
      if (h < 20) return a * 6; // general sea/lake crossing penalty
      if (type === "Highland" && h < 44) return 3000; // giant penalty for highlanders on lowlands
      if (type === "Highland" && h < 62) return 200; // giant penalty for highlanders on lowhills
      if (type === "Highland") return 0; // no penalty for highlanders on highlands
      if (h >= 67) return 200; // general mountains crossing penalty
      if (h >= 44) return 30; // general hills crossing penalty
      return 0;
    };

    const getRiverCost = (riverId: number, cellId: number, type: string) => {
      if (type === "River") return riverId ? 0 : 100; // penalty for river cultures
      if (!riverId) return 0; // no penalty for others if there is no river
      return minmax(cells.fl[cellId] / 10, 20, 100); // river penalty from 20 to 100 based on flux
    };

    const getTypeCost = (t: number, type: string) => {
      if (t === 1) return type === "Naval" || type === "Lake" ? 0 : type === "Nomadic" ? 60 : 20; // penalty for coastline
      if (t === 2) return type === "Naval" || type === "Nomadic" ? 30 : 0; // low penalty for land level 2 for Navals and nomads
      if (t !== -1) return type === "Naval" || type === "Lake" ? 100 : 0; // penalty for mainland for navals
      return 0;
    };

    while (queue.length) {
      const { cellId, priority, cultureId } = queue.pop();
      const { type, expansionism } = cultures[cultureId];
      const sourceBiome = cells.biome[cellId];

      cells.c[cellId].forEach(neibCellId => {
        if (hasLocked) {
          const neibCultureId = cells.culture[neibCellId];
          if (neibCultureId && cultures[neibCultureId].lock) return; // do not overwrite cell of locked culture
        }

        const targetBiome = cells.biome[neibCellId];
        const biomeCost = getBiomeCost(cultureId, targetBiome, type as string);
        const biomeChangeCost = sourceBiome === targetBiome ? 0 : 20; // penalty on biome change
        const heightCost = getHeightCost(neibCellId, cells.h[neibCellId], type as string);
        const riverCost = getRiverCost(cells.r[neibCellId], neibCellId, type as string);
        const typeCost = getTypeCost(cells.t[neibCellId], type as string);
        const cellCost = (biomeCost + biomeChangeCost + heightCost + riverCost + typeCost) / (expansionism as number);
        const totalCost = priority + cellCost;

        if (totalCost > maxExpansionCost) return;

        if (!cost[neibCellId] || totalCost < cost[neibCellId]) {
          if (cells.pop[neibCellId] > 0) cells.culture[neibCellId] = cultureId; // assign culture to populated cell
          cost[neibCellId] = totalCost;
          queue.push({ cellId: neibCellId, cultureId, priority: totalCost }, totalCost);
        }
      });
    }
  }

  /** Rename a culture; its code is recomputed */
  rename(cultureId: number, name: string): void {
    const culture = pack.cultures[cultureId];
    if (!culture || culture.removed) throw new Error(`Culture ${cultureId} does not exist`);
    culture.name = requireName(name);
    culture.code = abbreviate(
      culture.name,
      pack.cultures.flatMap(other => (other !== culture && other.code ? [other.code] : []))
    );
  }

  /** Set a culture's color */
  recolor(cultureId: number, color: string): void {
    this.living(cultureId).color = requireColor(color);
  }

  /** Set a culture's type: Generic, Hunting, Highland, River, Lake, Naval or Nomadic */
  setType(cultureId: number, type: string): void {
    this.living(cultureId).type = requireOneOf(type, CULTURE_TYPES, "The type");
  }

  /** Set the name base a culture takes its names from, by id */
  setBase(cultureId: number, baseId: string): void {
    if (!Names.getNameBase(baseId)) throw new Error(`Name base ${baseId} does not exist`);
    this.living(cultureId).base = baseId;
  }

  /** Set how strongly a culture expands when cultures are recalculated, from 0 to 99 */
  setExpansionism(cultureId: number, expansionism: number): void {
    if (typeof expansionism !== "number" || !(expansionism >= 0 && expansionism <= 99))
      throw new Error("The expansionism must be a number from 0 to 99");
    this.living(cultureId).expansionism = expansionism;
  }

  /** Redraw culture borders from their centers, types and expansionism; burgs take their cell's culture */
  recalculate(): void {
    this.expand();
    for (const burg of pack.burgs) if (burg?.i && !burg.removed) burg.culture = pack.cells.culture[burg.cell];
  }

  /** Remove a culture; its lands, burgs, states and religions fall to the wildlands */
  remove(cultureId: number): void {
    const culture = this.living(cultureId);
    if (!cultureId) throw new Error("The wildlands cannot be removed");
    const { burgs, states, religions, cells, cultures } = pack;
    for (const burg of burgs) if (burg?.i && burg.culture === cultureId) burg.culture = 0;
    for (const state of states) if (state.culture === cultureId) state.culture = 0;
    for (const religion of religions) if (religion.culture === cultureId) religion.culture = 0;
    cells.culture.forEach((owner, cell) => {
      if (owner === cultureId) cells.culture[cell] = 0;
    });
    culture.removed = true;
    for (const other of cultures) {
      if (!other.i || other.removed || !other.origins) continue;
      other.origins = other.origins.filter(origin => origin !== cultureId);
      if (!other.origins.length) other.origins = [0];
    }
  }

  /** Set a culture's rural and urban population, in people: its cells and burgs scale to the totals */
  setPopulation(cultureId: number, rural: number, urban: number): void {
    this.living(cultureId);
    const { cells } = pack;
    Population.setArea(
      Population.landCells(cell => cells.culture[cell] === cultureId),
      Population.burgIds(burg => burg.culture === cultureId),
      rural,
      urban
    );
  }

  /** Lock a culture so regeneration keeps it, or unlock it */
  setLocked(cultureId: number, locked: boolean): void {
    const culture = this.living(cultureId);
    if (locked) culture.lock = true;
    else delete culture.lock;
  }

  /** Set a culture's origins, as the Hierarchy tree does: the first is primary (0 = top level), the rest secondary */
  setOrigins(cultureId: number, originIds: number[]): void {
    this.living(cultureId).origins = requireOrigins(pack.cultures, cultureId, originIds);
  }

  /** Set a culture's short code, 1 to 3 characters */
  setCode(cultureId: number, code: string): void {
    this.living(cultureId).code = requireCode(code);
  }

  /** Move a culture's center to a land cell at a map point; it takes effect when cultures are recalculated */
  moveCenter(cultureId: number, x: number, y: number): void {
    const culture = this.living(cultureId);
    if (!cultureId) throw new Error("The wildlands have no center");
    const cell = Pack.requireCell(x, y);
    if (pack.cells.h[cell] < 20) throw new Error("A culture center cannot be placed in the water");
    const other = pack.cultures.find(item => item.i && !item.removed && item !== culture && item.center === cell);
    if (other) throw new Error(`Cell ${cell} is already the center of culture ${other.i}`);
    culture.center = cell;
  }

  /** Give land cells to a culture, or to the wildlands with id 0; burgs there take it too */
  setCells(cultureId: number, cellIds: number[]): void {
    this.living(cultureId);
    const { cells } = pack;
    if (!Array.isArray(cellIds) || !cellIds.length) throw new Error("Name at least one cell");
    for (const cell of cellIds) {
      if (!Number.isInteger(cell) || cell < 0 || cell >= cells.i.length) throw new Error(`Cell ${cell} does not exist`);
      if (cells.h[cell] < 20) throw new Error(`Cell ${cell} is water; cultures hold land only`);
    }
    for (const cell of cellIds) {
      cells.culture[cell] = cultureId;
      if (cells.burg[cell]) pack.burgs[cells.burg[cell]].culture = cultureId;
    }
  }

  /** Set a culture's emblem shape; emblems of its states, provinces and burgs take it, except icon emblems */
  setEmblemShape(cultureId: number, shape: string): void {
    const culture = this.living(cultureId);
    const shapes = Object.keys(Emblems.shields.types).flatMap(type => Object.keys(Emblems.shields[type]));
    culture.shield = requireOneOf(shape, shapes, "The shape");
    const reshape = (coa: Emblem | undefined) => {
      if (coa && !("icon" in coa)) coa.shield = culture.shield;
    };
    for (const state of pack.states) if (state.i && !state.removed && state.culture === cultureId) reshape(state.coa);
    for (const province of pack.provinces)
      if (province.i && !province.removed && pack.cells.culture[province.center] === cultureId) reshape(province.coa);
    for (const burg of pack.burgs) if (burg?.i && !burg.removed && burg.culture === cultureId) reshape(burg.coa);
  }

  private living(cultureId: number): Culture {
    const culture = pack.cultures[cultureId];
    if (!culture || culture.removed) throw new Error(`Culture ${cultureId} does not exist`);
    return culture;
  }

  regenerate(): void {
    this.generate();
    this.expand();

    pack.states = pack.states.map(state =>
      !state.i || state.removed ? state : { ...state, culture: pack.cells.culture[state.center] }
    );
    pack.burgs = pack.burgs.map(burg =>
      !burg.i || burg.removed ? burg : { ...burg, culture: pack.cells.culture[burg.cell] }
    );
    pack.religions = pack.religions.map(religion =>
      !religion.i || religion.removed ? religion : { ...religion, culture: pack.cells.culture[religion.center] }
    );
  }
}

// biome-ignore lint/suspicious/noRedeclare: legacy seam
export const Cultures = new CulturesGenerator();
window.Cultures = Cultures;
