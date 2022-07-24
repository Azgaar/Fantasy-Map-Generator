// const methods = {
//   random: (number) => number >= 100 || (number > 0 && number / 100 > Math.random()),
//   nth: (number) => !(cellId % number),
//   minHabitability: (min) => biomesData.habitability[pack.cells.biome[cellId]] >= min,
//   habitability: () => biomesData.habitability[cells.biome[cellId]] > Math.random() * 100,
//   elevation: () => pack.cells.h[cellId] / 100 > Math.random(),
//   biome: (...biomes) => biomes.includes(pack.cells.biome[cellId]),
//   minHeight: (heigh) => pack.cells.h[cellId] >= heigh,
//   maxHeight: (heigh) => pack.cells.h[cellId] <= heigh,
//   minTemp: (temp) => grid.cells.temp[pack.cells.g[cellId]] >= temp,
//   maxTemp: (temp) => grid.cells.temp[pack.cells.g[cellId]] <= temp,
//   shore: (...rings) => rings.includes(pack.cells.t[cellId]),
//   type: (...types) => types.includes(pack.features[cells.f[cellId]].group),
//   river: () => pack.cells.r[cellId]
// };
// const allMethods = '{' + Object.keys(methods).join(', ') + '}';

// const model = 'minHeight(60) || (biome(12) && nth(7)) || (minHeight(20) && nth(10))',
// const fn = new Function(allMethods, 'return ' + model);

// const passed = fn({...methods});

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
  sort?: string;
}

const world = () => [
  {name: "Shwazen", base: 0, odd: 0.7, sort: "n / td(10) / bd([6, 8])", shield: "hessen"},
  {name: "Angshire", base: 1, odd: 1, sort: "n / td(10) / sf(i)", shield: "heater"},
  {name: "Luari", base: 2, odd: 0.6, sort: "n / td(12) / bd([6, 8])", shield: "oldFrench"},
  {name: "Tallian", base: 3, odd: 0.6, sort: "n / td(15)", shield: "horsehead2"},
  {name: "Astellian", base: 4, odd: 0.6, sort: "n / td(16)", shield: "spanish"},
  {name: "Slovan", base: 5, odd: 0.7, sort: "(n / td(6)) * t", shield: "round"},
  {name: "Norse", base: 6, odd: 0.7, sort: "n / td(5)", shield: "heater"},
  {name: "Elladan", base: 7, odd: 0.7, sort: "(n / td(18)) * h", shield: "boeotian"},
  {name: "Romian", base: 8, odd: 0.7, sort: "n / td(15)", shield: "roman"},
  {name: "Soumi", base: 9, odd: 0.3, sort: "(n / td(5) / bd([9])) * t", shield: "pavise"},
  {name: "Koryo", base: 10, odd: 0.1, sort: "n / td(12) / t", shield: "round"},
  {name: "Hantzu", base: 11, odd: 0.1, sort: "n / td(13)", shield: "banner"},
  {name: "Yamoto", base: 12, odd: 0.1, sort: "n / td(15) / t", shield: "round"},
  {name: "Portuzian", base: 13, odd: 0.4, sort: "n / td(17) / sf(i)", shield: "spanish"},
  {name: "Nawatli", base: 14, odd: 0.1, sort: "h / td(18) / bd([7])", shield: "square"},
  {name: "Vengrian", base: 15, odd: 0.2, sort: "(n / td(11) / bd([4])) * t", shield: "wedged"},
  {name: "Turchian", base: 16, odd: 0.2, sort: "n / td(13)", shield: "round"},
  {name: "Berberan", base: 17, odd: 0.1, sort: "(n / td(19) / bd([1, 2, 3], 7)) * t", shield: "round"},
  {name: "Eurabic", base: 18, odd: 0.2, sort: "(n / td(26) / bd([1, 2], 7)) * t", shield: "round"},
  {name: "Inuk", base: 19, odd: 0.05, sort: "td(-1) / bd([10, 11]) / sf(i)", shield: "square"},
  {name: "Euskati", base: 20, odd: 0.05, sort: "(n / td(15)) * h", shield: "spanish"},
  {name: "Yoruba", base: 21, odd: 0.05, sort: "n / td(15) / bd([5, 7])", shield: "vesicaPiscis"},
  {name: "Keltan", base: 22, odd: 0.05, sort: "(n / td(11) / bd([6, 8])) * t", shield: "vesicaPiscis"},
  {name: "Efratic", base: 23, odd: 0.05, sort: "(n / td(22)) * t", shield: "diamond"},
  {name: "Tehrani", base: 24, odd: 0.1, sort: "(n / td(18)) * h", shield: "round"},
  {name: "Maui", base: 25, odd: 0.05, sort: "n / td(24) / sf(i) / t", shield: "round"},
  {name: "Carnatic", base: 26, odd: 0.05, sort: "n / td(26)", shield: "round"},
  {name: "Inqan", base: 27, odd: 0.05, sort: "h / td(13)", shield: "square"},
  {name: "Kiswaili", base: 28, odd: 0.1, sort: "n / td(29) / bd([1, 3, 5, 7])", shield: "vesicaPiscis"},
  {name: "Vietic", base: 29, odd: 0.1, sort: "n / td(25) / bd([7], 7) / t", shield: "banner"},
  {name: "Guantzu", base: 30, odd: 0.1, sort: "n / td(17)", shield: "banner"},
  {name: "Ulus", base: 31, odd: 0.1, sort: "(n / td(5) / bd([2, 4, 10], 7)) * t", shield: "banner"}
];

const european = () => [
  {name: "Shwazen", base: 0, odd: 1, sort: "n / td(10) / bd([6, 8])", shield: "swiss"},
  {name: "Angshire", base: 1, odd: 1, sort: "n / td(10) / sf(i)", shield: "wedged"},
  {name: "Luari", base: 2, odd: 1, sort: "n / td(12) / bd([6, 8])", shield: "french"},
  {name: "Tallian", base: 3, odd: 1, sort: "n / td(15)", shield: "horsehead"},
  {name: "Astellian", base: 4, odd: 1, sort: "n / td(16)", shield: "spanish"},
  {name: "Slovan", base: 5, odd: 1, sort: "(n / td(6)) * t", shield: "polish"},
  {name: "Norse", base: 6, odd: 1, sort: "n / td(5)", shield: "heater"},
  {name: "Elladan", base: 7, odd: 1, sort: "(n / td(18)) * h", shield: "boeotian"},
  {name: "Romian", base: 8, odd: 0.2, sort: "n / td(15) / t", shield: "roman"},
  {name: "Soumi", base: 9, odd: 1, sort: "(n / td(5) / bd([9])) * t", shield: "pavise"},
  {name: "Portuzian", base: 13, odd: 1, sort: "n / td(17) / sf(i)", shield: "renaissance"},
  {name: "Vengrian", base: 15, odd: 1, sort: "(n / td(11) / bd([4])) * t", shield: "horsehead2"},
  {name: "Turchian", base: 16, odd: 0.05, sort: "n / td(14)", shield: "round"},
  {name: "Euskati", base: 20, odd: 0.05, sort: "(n / td(15)) * h", shield: "oldFrench"},
  {name: "Keltan", base: 22, odd: 0.05, sort: "(n / td(11) / bd([6, 8])) * t", shield: "oval"}
];

const oriental = () => [
  {name: "Koryo", base: 10, odd: 1, sort: "n / td(12) / t", shield: "round"},
  {name: "Hantzu", base: 11, odd: 1, sort: "n / td(13)", shield: "banner"},
  {name: "Yamoto", base: 12, odd: 1, sort: "n / td(15) / t", shield: "round"},
  {name: "Turchian", base: 16, odd: 1, sort: "n / td(12)", shield: "round"},
  {name: "Berberan", base: 17, odd: 0.2, sort: "(n / td(19) / bd([1, 2, 3], 7)) * t", shield: "oval"},
  {name: "Eurabic", base: 18, odd: 1, sort: "(n / td(26) / bd([1, 2], 7)) * t", shield: "oval"},
  {name: "Efratic", base: 23, odd: 0.1, sort: "(n / td(22)) * t", shield: "round"},
  {name: "Tehrani", base: 24, odd: 1, sort: "(n / td(18)) * h", shield: "round"},
  {name: "Maui", base: 25, odd: 0.2, sort: "n / td(24) / sf(i) / t", shield: "vesicaPiscis"},
  {name: "Carnatic", base: 26, odd: 0.5, sort: "n / td(26)", shield: "round"},
  {name: "Vietic", base: 29, odd: 0.8, sort: "n / td(25) / bd([7], 7) / t", shield: "banner"},
  {name: "Guantzu", base: 30, odd: 0.5, sort: "n / td(17)", shield: "banner"},
  {name: "Ulus", base: 31, odd: 1, sort: "(n / td(5) / bd([2, 4, 10], 7)) * t", shield: "banner"}
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
  {name: "Roman", base: 8, odd: 1, sort: "n / td(14) / t", shield: "roman"}, // Roman
  {name: "Roman", base: 8, odd: 1, sort: "n / td(15) / sf(i)", shield: "roman"}, // Roman
  {name: "Roman", base: 8, odd: 1, sort: "n / td(16) / sf(i)", shield: "roman"}, // Roman
  {name: "Roman", base: 8, odd: 1, sort: "n / td(17) / t", shield: "roman"}, // Roman
  {name: "Hellenic", base: 7, odd: 1, sort: "(n / td(18) / sf(i)) * h", shield: "boeotian"}, // Greek
  {name: "Hellenic", base: 7, odd: 1, sort: "(n / td(19) / sf(i)) * h", shield: "boeotian"}, // Greek
  {name: "Macedonian", base: 7, odd: 0.5, sort: "(n / td(12)) * h", shield: "round"}, // Greek
  {name: "Celtic", base: 22, odd: 1, sort: "n / td(11) ** 0.5 / bd([6, 8])", shield: "round"},
  {name: "Germanic", base: 0, odd: 1, sort: "n / td(10) ** 0.5 / bd([6, 8])", shield: "round"},
  {name: "Persian", base: 24, odd: 0.8, sort: "(n / td(18)) * h", shield: "oval"}, // Iranian
  {name: "Scythian", base: 24, odd: 0.5, sort: "n / td(11) ** 0.5 / bd([4])", shield: "round"}, // Iranian
  {name: "Cantabrian", base: 20, odd: 0.5, sort: "(n / td(16)) * h", shield: "oval"}, // Basque
  {name: "Estian", base: 9, odd: 0.2, sort: "(n / td(5)) * t", shield: "pavise"}, // Finnic
  {name: "Carthaginian", base: 17, odd: 0.3, sort: "n / td(19) / sf(i)", shield: "oval"}, // Berber
  {name: "Mesopotamian", base: 23, odd: 0.2, sort: "n / td(22) / bd([1, 2, 3])", shield: "oval"} // Mesopotamian
];

const highFantasy = () => [
  // fantasy races
  {name: "Quenian (Elfish)", base: 33, odd: 1, sort: "(n / bd([6, 7, 8, 9], 10)) * t", shield: "gondor"}, // Elves
  {name: "Eldar (Elfish)", base: 33, odd: 1, sort: "(n / bd([6, 7, 8, 9], 10)) * t", shield: "noldor"}, // Elves
  {name: "Trow (Dark Elfish)", base: 34, odd: 0.9, sort: "(n / bd([7, 8, 9, 12], 10)) * t", shield: "hessen"},
  {name: "Lothian (Dark Elfish)", base: 34, odd: 0.3, sort: "(n / bd([7, 8, 9, 12], 10)) * t", shield: "wedged"},
  {name: "Dunirr (Dwarven)", base: 35, odd: 1, sort: "n + h", shield: "ironHills"}, // Dwarfs
  {name: "Khazadur (Dwarven)", base: 35, odd: 1, sort: "n + h", shield: "erebor"}, // Dwarfs
  {name: "Kobold (Goblin)", base: 36, odd: 1, sort: "t - s", shield: "moriaOrc"}, // Goblin
  {name: "Uruk (Orkish)", base: 37, odd: 1, sort: "h * t", shield: "urukHai"}, // Orc
  {name: "Ugluk (Orkish)", base: 37, odd: 0.5, sort: "(h * t) / bd([1, 2, 10, 11])", shield: "moriaOrc"}, // Orc
  {name: "Yotunn (Giants)", base: 38, odd: 0.7, sort: "td(-10)", shield: "pavise"}, // Giant
  {name: "Rake (Drakonic)", base: 39, odd: 0.7, sort: "-s", shield: "fantasy2"}, // Draconic
  {name: "Arago (Arachnid)", base: 40, odd: 0.7, sort: "t - s", shield: "horsehead2"}, // Arachnid
  {name: "Aj'Snaga (Serpents)", base: 41, odd: 0.7, sort: "n / bd([12], 10)", shield: "fantasy1"}, // Serpents
  // fantasy human
  {name: "Anor (Human)", base: 32, odd: 1, sort: "n / td(10)", shield: "fantasy5"},
  {name: "Dail (Human)", base: 32, odd: 1, sort: "n / td(13)", shield: "roman"},
  {name: "Rohand (Human)", base: 16, odd: 1, sort: "n / td(16)", shield: "round"},
  {name: "Dulandir (Human)", base: 31, odd: 1, sort: "(n / td(5) / bd([2, 4, 10], 7)) * t", shield: "easterling"}
];

const darkFantasy = () => [
  // common real-world English
  {name: "Angshire", base: 1, odd: 1, sort: "n / td(10) / sf(i)", shield: "heater"},
  {name: "Enlandic", base: 1, odd: 1, sort: "n / td(12)", shield: "heater"},
  {name: "Westen", base: 1, odd: 1, sort: "n / td(10)", shield: "heater"},
  {name: "Nortumbic", base: 1, odd: 1, sort: "n / td(7)", shield: "heater"},
  {name: "Mercian", base: 1, odd: 1, sort: "n / td(9)", shield: "heater"},
  {name: "Kentian", base: 1, odd: 1, sort: "n / td(12)", shield: "heater"},
  // rare real-world western
  {name: "Norse", base: 6, odd: 0.7, sort: "n / td(5) / sf(i)", shield: "oldFrench"},
  {name: "Schwarzen", base: 0, odd: 0.3, sort: "n / td(10) / bd([6, 8])", shield: "gonfalon"},
  {name: "Luarian", base: 2, odd: 0.3, sort: "n / td(12) / bd([6, 8])", shield: "oldFrench"},
  {name: "Hetallian", base: 3, odd: 0.3, sort: "n / td(15)", shield: "oval"},
  {name: "Astellian", base: 4, odd: 0.3, sort: "n / td(16)", shield: "spanish"},
  // rare real-world exotic
  {name: "Kiswaili", base: 28, odd: 0.05, sort: "n / td(29) / bd([1, 3, 5, 7])", shield: "vesicaPiscis"},
  {name: "Yoruba", base: 21, odd: 0.05, sort: "n / td(15) / bd([5, 7])", shield: "vesicaPiscis"},
  {name: "Koryo", base: 10, odd: 0.05, sort: "n / td(12) / t", shield: "round"},
  {name: "Hantzu", base: 11, odd: 0.05, sort: "n / td(13)", shield: "banner"},
  {name: "Yamoto", base: 12, odd: 0.05, sort: "n / td(15) / t", shield: "round"},
  {name: "Guantzu", base: 30, odd: 0.05, sort: "n / td(17)", shield: "banner"},
  {name: "Ulus", base: 31, odd: 0.05, sort: "(n / td(5) / bd([2, 4, 10], 7)) * t", shield: "banner"},
  {name: "Turan", base: 16, odd: 0.05, sort: "n / td(12)", shield: "round"},
  {name: "Berberan", base: 17, odd: 0.05, sort: "(n / td(19) / bd([1, 2, 3], 7)) * t", shield: "round"},
  {name: "Eurabic", base: 18, odd: 0.05, sort: "(n / td(26) / bd([1, 2], 7)) * t", shield: "round"},
  {name: "Slovan", base: 5, odd: 0.05, sort: "(n / td(6)) * t", shield: "round"},
  {name: "Keltan", base: 22, odd: 0.1, sort: "n / td(11) ** 0.5 / bd([6, 8])", shield: "vesicaPiscis"},
  {name: "Elladan", base: 7, odd: 0.2, sort: "(n / td(18) / sf(i)) * h", shield: "boeotian"},
  {name: "Romian", base: 8, odd: 0.2, sort: "n / td(14) / t", shield: "roman"},
  // fantasy races
  {name: "Eldar", base: 33, odd: 0.5, sort: "(n / bd([6, 7, 8, 9], 10)) * t", shield: "fantasy5"}, // Elves
  {name: "Trow", base: 34, odd: 0.8, sort: "(n / bd([7, 8, 9, 12], 10)) * t", shield: "hessen"}, // Dark Elves
  {name: "Durinn", base: 35, odd: 0.8, sort: "n + h", shield: "erebor"}, // Dwarven
  {name: "Kobblin", base: 36, odd: 0.8, sort: "t - s", shield: "moriaOrc"}, // Goblin
  {name: "Uruk", base: 37, odd: 0.8, sort: "(h * t) / bd([1, 2, 10, 11])", shield: "urukHai"}, // Orc
  {name: "Yotunn", base: 38, odd: 0.8, sort: "td(-10)", shield: "pavise"}, // Giant
  {name: "Drake", base: 39, odd: 0.9, sort: "-s", shield: "fantasy2"}, // Draconic
  {name: "Rakhnid", base: 40, odd: 0.9, sort: "t - s", shield: "horsehead2"}, // Arachnid
  {name: "Aj'Snaga", base: 41, odd: 0.9, sort: "n / bd([12], 10)", shield: "fantasy1"} // Serpents
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
