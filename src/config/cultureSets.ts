import {rand} from "utils/probabilityUtils";

const {Names, COA} = window;

export type TCultureSetName =
  | "world"
  | "european"
  | "oriental"
  | "english"
  | "antique"
  | "highFantasy"
  | "darkFantasy"
  | "random";

interface ICultureConfig {
  name: string;
  base: number;
  odd: number;
  shield: string;
  sort?: Function;
}

const world = () => [
  {name: "Shwazen", base: 0, odd: 0.7, sort: new Function(`i => n(i) / td(i, 10) / bd(i, [6, 8])`), shield: "hessen"},
  {name: "Shwazen", base: 0, odd: 0.7, sort: i => n(i) / td(i, 10) / bd(i, [6, 8]), shield: "hessen"},
  {name: "Angshire", base: 1, odd: 1, sort: i => n(i) / td(i, 10) / sf(i), shield: "heater"},
  {name: "Luari", base: 2, odd: 0.6, sort: i => n(i) / td(i, 12) / bd(i, [6, 8]), shield: "oldFrench"},
  {name: "Tallian", base: 3, odd: 0.6, sort: i => n(i) / td(i, 15), shield: "horsehead2"},
  {name: "Astellian", base: 4, odd: 0.6, sort: i => n(i) / td(i, 16), shield: "spanish"},
  {name: "Slovan", base: 5, odd: 0.7, sort: i => (n(i) / td(i, 6)) * t[i], shield: "round"},
  {name: "Norse", base: 6, odd: 0.7, sort: i => n(i) / td(i, 5), shield: "heater"},
  {name: "Elladan", base: 7, odd: 0.7, sort: i => (n(i) / td(i, 18)) * h[i], shield: "boeotian"},
  {name: "Romian", base: 8, odd: 0.7, sort: i => n(i) / td(i, 15), shield: "roman"},
  {name: "Soumi", base: 9, odd: 0.3, sort: i => (n(i) / td(i, 5) / bd(i, [9])) * t[i], shield: "pavise"},
  {name: "Koryo", base: 10, odd: 0.1, sort: i => n(i) / td(i, 12) / t[i], shield: "round"},
  {name: "Hantzu", base: 11, odd: 0.1, sort: i => n(i) / td(i, 13), shield: "banner"},
  {name: "Yamoto", base: 12, odd: 0.1, sort: i => n(i) / td(i, 15) / t[i], shield: "round"},
  {name: "Portuzian", base: 13, odd: 0.4, sort: i => n(i) / td(i, 17) / sf(i), shield: "spanish"},
  {name: "Nawatli", base: 14, odd: 0.1, sort: i => h[i] / td(i, 18) / bd(i, [7]), shield: "square"},
  {name: "Vengrian", base: 15, odd: 0.2, sort: i => (n(i) / td(i, 11) / bd(i, [4])) * t[i], shield: "wedged"},
  {name: "Turchian", base: 16, odd: 0.2, sort: i => n(i) / td(i, 13), shield: "round"},
  {name: "Berberan", base: 17, odd: 0.1, sort: i => (n(i) / td(i, 19) / bd(i, [1, 2, 3], 7)) * t[i], shield: "round"},
  {name: "Eurabic", base: 18, odd: 0.2, sort: i => (n(i) / td(i, 26) / bd(i, [1, 2], 7)) * t[i], shield: "round"},
  {name: "Inuk", base: 19, odd: 0.05, sort: i => td(i, -1) / bd(i, [10, 11]) / sf(i), shield: "square"},
  {name: "Euskati", base: 20, odd: 0.05, sort: i => (n(i) / td(i, 15)) * h[i], shield: "spanish"},
  {name: "Yoruba", base: 21, odd: 0.05, sort: i => n(i) / td(i, 15) / bd(i, [5, 7]), shield: "vesicaPiscis"},
  {name: "Keltan", base: 22, odd: 0.05, sort: i => (n(i) / td(i, 11) / bd(i, [6, 8])) * t[i], shield: "vesicaPiscis"},
  {name: "Efratic", base: 23, odd: 0.05, sort: i => (n(i) / td(i, 22)) * t[i], shield: "diamond"},
  {name: "Tehrani", base: 24, odd: 0.1, sort: i => (n(i) / td(i, 18)) * h[i], shield: "round"},
  {name: "Maui", base: 25, odd: 0.05, sort: i => n(i) / td(i, 24) / sf(i) / t[i], shield: "round"},
  {name: "Carnatic", base: 26, odd: 0.05, sort: i => n(i) / td(i, 26), shield: "round"},
  {name: "Inqan", base: 27, odd: 0.05, sort: i => h[i] / td(i, 13), shield: "square"},
  {name: "Kiswaili", base: 28, odd: 0.1, sort: i => n(i) / td(i, 29) / bd(i, [1, 3, 5, 7]), shield: "vesicaPiscis"},
  {name: "Vietic", base: 29, odd: 0.1, sort: i => n(i) / td(i, 25) / bd(i, [7], 7) / t[i], shield: "banner"},
  {name: "Guantzu", base: 30, odd: 0.1, sort: i => n(i) / td(i, 17), shield: "banner"},
  {name: "Ulus", base: 31, odd: 0.1, sort: i => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i], shield: "banner"}
];

const european = () => [
  {name: "Shwazen", base: 0, odd: 1, sort: i => n(i) / td(i, 10) / bd(i, [6, 8]), shield: "swiss"},
  {name: "Angshire", base: 1, odd: 1, sort: i => n(i) / td(i, 10) / sf(i), shield: "wedged"},
  {name: "Luari", base: 2, odd: 1, sort: i => n(i) / td(i, 12) / bd(i, [6, 8]), shield: "french"},
  {name: "Tallian", base: 3, odd: 1, sort: i => n(i) / td(i, 15), shield: "horsehead"},
  {name: "Astellian", base: 4, odd: 1, sort: i => n(i) / td(i, 16), shield: "spanish"},
  {name: "Slovan", base: 5, odd: 1, sort: i => (n(i) / td(i, 6)) * t[i], shield: "polish"},
  {name: "Norse", base: 6, odd: 1, sort: i => n(i) / td(i, 5), shield: "heater"},
  {name: "Elladan", base: 7, odd: 1, sort: i => (n(i) / td(i, 18)) * h[i], shield: "boeotian"},
  {name: "Romian", base: 8, odd: 0.2, sort: i => n(i) / td(i, 15) / t[i], shield: "roman"},
  {name: "Soumi", base: 9, odd: 1, sort: i => (n(i) / td(i, 5) / bd(i, [9])) * t[i], shield: "pavise"},
  {name: "Portuzian", base: 13, odd: 1, sort: i => n(i) / td(i, 17) / sf(i), shield: "renaissance"},
  {name: "Vengrian", base: 15, odd: 1, sort: i => (n(i) / td(i, 11) / bd(i, [4])) * t[i], shield: "horsehead2"},
  {name: "Turchian", base: 16, odd: 0.05, sort: i => n(i) / td(i, 14), shield: "round"},
  {name: "Euskati", base: 20, odd: 0.05, sort: i => (n(i) / td(i, 15)) * h[i], shield: "oldFrench"},
  {name: "Keltan", base: 22, odd: 0.05, sort: i => (n(i) / td(i, 11) / bd(i, [6, 8])) * t[i], shield: "oval"}
];

const oriental = () => [
  {name: "Koryo", base: 10, odd: 1, sort: i => n(i) / td(i, 12) / t[i], shield: "round"},
  {name: "Hantzu", base: 11, odd: 1, sort: i => n(i) / td(i, 13), shield: "banner"},
  {name: "Yamoto", base: 12, odd: 1, sort: i => n(i) / td(i, 15) / t[i], shield: "round"},
  {name: "Turchian", base: 16, odd: 1, sort: i => n(i) / td(i, 12), shield: "round"},
  {name: "Berberan", base: 17, odd: 0.2, sort: i => (n(i) / td(i, 19) / bd(i, [1, 2, 3], 7)) * t[i], shield: "oval"},
  {name: "Eurabic", base: 18, odd: 1, sort: i => (n(i) / td(i, 26) / bd(i, [1, 2], 7)) * t[i], shield: "oval"},
  {name: "Efratic", base: 23, odd: 0.1, sort: i => (n(i) / td(i, 22)) * t[i], shield: "round"},
  {name: "Tehrani", base: 24, odd: 1, sort: i => (n(i) / td(i, 18)) * h[i], shield: "round"},
  {name: "Maui", base: 25, odd: 0.2, sort: i => n(i) / td(i, 24) / sf(i) / t[i], shield: "vesicaPiscis"},
  {name: "Carnatic", base: 26, odd: 0.5, sort: i => n(i) / td(i, 26), shield: "round"},
  {name: "Vietic", base: 29, odd: 0.8, sort: i => n(i) / td(i, 25) / bd(i, [7], 7) / t[i], shield: "banner"},
  {name: "Guantzu", base: 30, odd: 0.5, sort: i => n(i) / td(i, 17), shield: "banner"},
  {name: "Ulus", base: 31, odd: 1, sort: i => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i], shield: "banner"}
];

const getEnglishName: () => string = () => Names.getBase(1, 5, 9, "", 0);

const english = () => [
  {name: getEnglishName(), base: 1, odd: 1, shield: "heater"},
  {name: getEnglishName(), base: 1, odd: 1, shield: "wedged"},
  {name: getEnglishName(), base: 1, odd: 1, shield: "swiss"},
  {name: getEnglishName(), base: 1, odd: 1, shield: "oldFrench"},
  {name: getEnglishName(), base: 1, odd: 1, shield: "swiss"},
  {name: getEnglishName(), base: 1, odd: 1, shield: "spanish"},
  {name: getEnglishName(), base: 1, odd: 1, shield: "hessen"},
  {name: getEnglishName(), base: 1, odd: 1, shield: "fantasy5"},
  {name: getEnglishName(), base: 1, odd: 1, shield: "fantasy4"},
  {name: getEnglishName(), base: 1, odd: 1, shield: "fantasy1"}
];

const antique = () => [
  {name: "Roman", base: 8, odd: 1, sort: i => n(i) / td(i, 14) / t[i], shield: "roman"}, // Roman
  {name: "Roman", base: 8, odd: 1, sort: i => n(i) / td(i, 15) / sf(i), shield: "roman"}, // Roman
  {name: "Roman", base: 8, odd: 1, sort: i => n(i) / td(i, 16) / sf(i), shield: "roman"}, // Roman
  {name: "Roman", base: 8, odd: 1, sort: i => n(i) / td(i, 17) / t[i], shield: "roman"}, // Roman
  {name: "Hellenic", base: 7, odd: 1, sort: i => (n(i) / td(i, 18) / sf(i)) * h[i], shield: "boeotian"}, // Greek
  {name: "Hellenic", base: 7, odd: 1, sort: i => (n(i) / td(i, 19) / sf(i)) * h[i], shield: "boeotian"}, // Greek
  {name: "Macedonian", base: 7, odd: 0.5, sort: i => (n(i) / td(i, 12)) * h[i], shield: "round"}, // Greek
  {name: "Celtic", base: 22, odd: 1, sort: i => n(i) / td(i, 11) ** 0.5 / bd(i, [6, 8]), shield: "round"},
  {name: "Germanic", base: 0, odd: 1, sort: i => n(i) / td(i, 10) ** 0.5 / bd(i, [6, 8]), shield: "round"},
  {name: "Persian", base: 24, odd: 0.8, sort: i => (n(i) / td(i, 18)) * h[i], shield: "oval"}, // Iranian
  {name: "Scythian", base: 24, odd: 0.5, sort: i => n(i) / td(i, 11) ** 0.5 / bd(i, [4]), shield: "round"}, // Iranian
  {name: "Cantabrian", base: 20, odd: 0.5, sort: i => (n(i) / td(i, 16)) * h[i], shield: "oval"}, // Basque
  {name: "Estian", base: 9, odd: 0.2, sort: i => (n(i) / td(i, 5)) * t[i], shield: "pavise"}, // Finnic
  {name: "Carthaginian", base: 17, odd: 0.3, sort: i => n(i) / td(i, 19) / sf(i), shield: "oval"}, // Berber
  {name: "Mesopotamian", base: 23, odd: 0.2, sort: i => n(i) / td(i, 22) / bd(i, [1, 2, 3]), shield: "oval"} // Mesopotamian
];

const highFantasy = () => [
  // fantasy races
  {name: "Quenian (Elfish)", base: 33, odd: 1, sort: i => (n(i) / bd(i, [6, 7, 8, 9], 10)) * t[i], shield: "gondor"}, // Elves
  {name: "Eldar (Elfish)", base: 33, odd: 1, sort: i => (n(i) / bd(i, [6, 7, 8, 9], 10)) * t[i], shield: "noldor"}, // Elves
  {
    name: "Trow (Dark Elfish)",
    base: 34,
    odd: 0.9,
    sort: i => (n(i) / bd(i, [7, 8, 9, 12], 10)) * t[i],
    shield: "hessen"
  },
  {
    name: "Lothian (Dark Elfish)",
    base: 34,
    odd: 0.3,
    sort: i => (n(i) / bd(i, [7, 8, 9, 12], 10)) * t[i],
    shield: "wedged"
  },
  {name: "Dunirr (Dwarven)", base: 35, odd: 1, sort: i => n(i) + h[i], shield: "ironHills"}, // Dwarfs
  {name: "Khazadur (Dwarven)", base: 35, odd: 1, sort: i => n(i) + h[i], shield: "erebor"}, // Dwarfs
  {name: "Kobold (Goblin)", base: 36, odd: 1, sort: i => t[i] - s[i], shield: "moriaOrc"}, // Goblin
  {name: "Uruk (Orkish)", base: 37, odd: 1, sort: i => h[i] * t[i], shield: "urukHai"}, // Orc
  {name: "Ugluk (Orkish)", base: 37, odd: 0.5, sort: i => (h[i] * t[i]) / bd(i, [1, 2, 10, 11]), shield: "moriaOrc"}, // Orc
  {name: "Yotunn (Giants)", base: 38, odd: 0.7, sort: i => td(i, -10), shield: "pavise"}, // Giant
  {name: "Rake (Drakonic)", base: 39, odd: 0.7, sort: i => -s[i], shield: "fantasy2"}, // Draconic
  {name: "Arago (Arachnid)", base: 40, odd: 0.7, sort: i => t[i] - s[i], shield: "horsehead2"}, // Arachnid
  {name: "Aj'Snaga (Serpents)", base: 41, odd: 0.7, sort: i => n(i) / bd(i, [12], 10), shield: "fantasy1"}, // Serpents
  // fantasy human
  {name: "Anor (Human)", base: 32, odd: 1, sort: i => n(i) / td(i, 10), shield: "fantasy5"},
  {name: "Dail (Human)", base: 32, odd: 1, sort: i => n(i) / td(i, 13), shield: "roman"},
  {name: "Rohand (Human)", base: 16, odd: 1, sort: i => n(i) / td(i, 16), shield: "round"},
  {
    name: "Dulandir (Human)",
    base: 31,
    odd: 1,
    sort: i => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i],
    shield: "easterling"
  }
];

const darkFantasy = () => [
  // common real-world English
  {name: "Angshire", base: 1, odd: 1, sort: i => n(i) / td(i, 10) / sf(i), shield: "heater"},
  {name: "Enlandic", base: 1, odd: 1, sort: i => n(i) / td(i, 12), shield: "heater"},
  {name: "Westen", base: 1, odd: 1, sort: i => n(i) / td(i, 10), shield: "heater"},
  {name: "Nortumbic", base: 1, odd: 1, sort: i => n(i) / td(i, 7), shield: "heater"},
  {name: "Mercian", base: 1, odd: 1, sort: i => n(i) / td(i, 9), shield: "heater"},
  {name: "Kentian", base: 1, odd: 1, sort: i => n(i) / td(i, 12), shield: "heater"},
  // rare real-world western
  {name: "Norse", base: 6, odd: 0.7, sort: i => n(i) / td(i, 5) / sf(i), shield: "oldFrench"},
  {name: "Schwarzen", base: 0, odd: 0.3, sort: i => n(i) / td(i, 10) / bd(i, [6, 8]), shield: "gonfalon"},
  {name: "Luarian", base: 2, odd: 0.3, sort: i => n(i) / td(i, 12) / bd(i, [6, 8]), shield: "oldFrench"},
  {name: "Hetallian", base: 3, odd: 0.3, sort: i => n(i) / td(i, 15), shield: "oval"},
  {name: "Astellian", base: 4, odd: 0.3, sort: i => n(i) / td(i, 16), shield: "spanish"},
  // rare real-world exotic
  {
    name: "Kiswaili",
    base: 28,
    odd: 0.05,
    sort: i => n(i) / td(i, 29) / bd(i, [1, 3, 5, 7]),
    shield: "vesicaPiscis"
  },
  {name: "Yoruba", base: 21, odd: 0.05, sort: i => n(i) / td(i, 15) / bd(i, [5, 7]), shield: "vesicaPiscis"},
  {name: "Koryo", base: 10, odd: 0.05, sort: i => n(i) / td(i, 12) / t[i], shield: "round"},
  {name: "Hantzu", base: 11, odd: 0.05, sort: i => n(i) / td(i, 13), shield: "banner"},
  {name: "Yamoto", base: 12, odd: 0.05, sort: i => n(i) / td(i, 15) / t[i], shield: "round"},
  {name: "Guantzu", base: 30, odd: 0.05, sort: i => n(i) / td(i, 17), shield: "banner"},
  {
    name: "Ulus",
    base: 31,
    odd: 0.05,
    sort: i => (n(i) / td(i, 5) / bd(i, [2, 4, 10], 7)) * t[i],
    shield: "banner"
  },
  {name: "Turan", base: 16, odd: 0.05, sort: i => n(i) / td(i, 12), shield: "round"},
  {
    name: "Berberan",
    base: 17,
    odd: 0.05,
    sort: i => (n(i) / td(i, 19) / bd(i, [1, 2, 3], 7)) * t[i],
    shield: "round"
  },
  {
    name: "Eurabic",
    base: 18,
    odd: 0.05,
    sort: i => (n(i) / td(i, 26) / bd(i, [1, 2], 7)) * t[i],
    shield: "round"
  },
  {name: "Slovan", base: 5, odd: 0.05, sort: i => (n(i) / td(i, 6)) * t[i], shield: "round"},
  {
    name: "Keltan",
    base: 22,
    odd: 0.1,
    sort: i => n(i) / td(i, 11) ** 0.5 / bd(i, [6, 8]),
    shield: "vesicaPiscis"
  },
  {name: "Elladan", base: 7, odd: 0.2, sort: i => (n(i) / td(i, 18) / sf(i)) * h[i], shield: "boeotian"},
  {name: "Romian", base: 8, odd: 0.2, sort: i => n(i) / td(i, 14) / t[i], shield: "roman"},
  // fantasy races
  {name: "Eldar", base: 33, odd: 0.5, sort: i => (n(i) / bd(i, [6, 7, 8, 9], 10)) * t[i], shield: "fantasy5"}, // Elves
  {name: "Trow", base: 34, odd: 0.8, sort: i => (n(i) / bd(i, [7, 8, 9, 12], 10)) * t[i], shield: "hessen"}, // Dark Elves
  {name: "Durinn", base: 35, odd: 0.8, sort: i => n(i) + h[i], shield: "erebor"}, // Dwarven
  {name: "Kobblin", base: 36, odd: 0.8, sort: i => t[i] - s[i], shield: "moriaOrc"}, // Goblin
  {name: "Uruk", base: 37, odd: 0.8, sort: i => (h[i] * t[i]) / bd(i, [1, 2, 10, 11]), shield: "urukHai"}, // Orc
  {name: "Yotunn", base: 38, odd: 0.8, sort: i => td(i, -10), shield: "pavise"}, // Giant
  {name: "Drake", base: 39, odd: 0.9, sort: i => -s[i], shield: "fantasy2"}, // Draconic
  {name: "Rakhnid", base: 40, odd: 0.9, sort: i => t[i] - s[i], shield: "horsehead2"}, // Arachnid
  {name: "Aj'Snaga", base: 41, odd: 0.9, sort: i => n(i) / bd(i, [12], 10), shield: "fantasy1"} // Serpents
];

const random = (culturesNumber: number) =>
  new Array(culturesNumber).map(() => {
    const rnd = rand(nameBases.length - 1);
    const name = Names.getBaseShort(rnd);
    return {name, base: rnd, odd: 1, shield: COA.getRandomShield()};
  });

export const cultureSets: {[K in TCultureSetName]: (culturesNumber: number) => ICultureConfig[]} = {
  world,
  european,
  oriental,
  english,
  antique,
  highFantasy,
  darkFantasy,
  random
};
