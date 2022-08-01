import {rand} from "utils/probabilityUtils";
import {NAMEBASE as NB, defaultNameBases} from "./namebases";

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
  name: string; // culture name
  base: number; // NB id
  chance: number; // selection chance [0, 1]
  shield: string; // emblem type name
  sort?: string; // string to create a function to compare cells and place culture center
}

const world = () => [
  {name: "Shwazen", base: NB.German, chance: 0.7, sort: "score() / temp(10) / biome([6, 8])", shield: "hessen"},
  {name: "Angshire", base: NB.English, chance: 1, sort: "score() / temp(10) / oceanCoast()", shield: "heater"},
  {name: "Luari", base: NB.French, chance: 0.6, sort: "score() / temp(12) / biome([6, 8])", shield: "oldFrench"},
  {name: "Tallian", base: NB.Italian, chance: 0.6, sort: "score() / temp(15)", shield: "horsehead2"},
  {name: "Astellian", base: NB.Castillian, chance: 0.6, sort: "score() / temp(16)", shield: "spanish"},
  {name: "Slovan", base: NB.Ruthenian, chance: 0.7, sort: "score() / temp(6) * coastDist()", shield: "round"},
  {name: "Norse", base: NB.Nordic, chance: 0.7, sort: "score() / temp(5)", shield: "heater"},
  {name: "Elladan", base: NB.Greek, chance: 0.7, sort: "score() / temp(18) * height()", shield: "boeotian"},
  {name: "Romian", base: NB.Roman, chance: 0.7, sort: "score() / temp(15)", shield: "roman"},
  {name: "Soumi", base: NB.Finnic, chance: 0.3, sort: "score() / temp(5) / biome([9]) * coastDist()", shield: "pavise"},
  {name: "Koryo", base: NB.Korean, chance: 0.1, sort: "score() / temp(12) / coastDist()", shield: "round"},
  {name: "Hantzu", base: NB.Chinese, chance: 0.1, sort: "score() / temp(13)", shield: "banner"},
  {name: "Yamoto", base: NB.Japanese, chance: 0.1, sort: "score() / temp(15) / coastDist()", shield: "round"},
  {name: "Portuzian", base: NB.Portuguese, chance: 0.4, sort: "score() / temp(17) / oceanCoast()", shield: "spanish"},
  {name: "Nawatli", base: NB.Nahuatl, chance: 0.1, sort: "height() / temp(18) / biome([7])", shield: "square"},
  {
    name: "Vengrian",
    base: NB.Hungarian,
    chance: 0.2,
    sort: "score() / temp(11) / biome([4]) * coastDist()",
    shield: "wedged"
  },
  {name: "Turchian", base: NB.Turkish, chance: 0.2, sort: "score() / temp(13)", shield: "round"},
  {
    name: "Berberan",
    base: NB.Berber,
    chance: 0.1,
    sort: "score() / temp(19) / biome([1, 2, 3], 7) * coastDist()",
    shield: "round"
  },
  {
    name: "Eurabic",
    base: NB.Arabic,
    chance: 0.2,
    sort: "score() / temp(26) / biome([1, 2], 7) * coastDist()",
    shield: "round"
  },
  {name: "Inuk", base: NB.Inuit, chance: 0.05, sort: "temp(-1) / biome([10, 11]) / oceanCoast()", shield: "square"},
  {name: "Euskati", base: NB.Basque, chance: 0.05, sort: "score() / temp(15) * height()", shield: "spanish"},
  {name: "Yoruba", base: NB.Nigerian, chance: 0.05, sort: "score() / temp(15) / biome([5, 7])", shield: "vesicaPiscis"},
  {
    name: "Keltan",
    base: NB.Celtic,
    chance: 0.05,
    sort: "score() / temp(11) / biome([6, 8]) * coastDist()",
    shield: "vesicaPiscis"
  },
  {name: "Efratic", base: NB.Mesopotamian, chance: 0.05, sort: "score() / temp(22) * coastDist()", shield: "diamond"},
  {name: "Tehrani", base: NB.Iranian, chance: 0.1, sort: "score() / temp(18) * height()", shield: "round"},
  {
    name: "Maui",
    base: NB.Hawaiian,
    chance: 0.05,
    sort: "score() / temp(24) / oceanCoast() / coastDist()",
    shield: "round"
  },
  {name: "Carnatic", base: NB.Karnataka, chance: 0.05, sort: "score() / temp(26)", shield: "round"},
  {name: "Inqan", base: NB.Quechua, chance: 0.05, sort: "height() / temp(13)", shield: "square"},
  {
    name: "Kiswaili",
    base: NB.Swahili,
    chance: 0.1,
    sort: "score() / temp(29) / biome([1, 3, 5, 7])",
    shield: "vesicaPiscis"
  },
  {
    name: "Vietic",
    base: NB.Vietnamese,
    chance: 0.1,
    sort: "score() / temp(25) / biome([7], 7) / coastDist()",
    shield: "banner"
  },
  {name: "Guantzu", base: NB.Cantonese, chance: 0.1, sort: "score() / temp(17)", shield: "banner"},
  {
    name: "Ulus",
    base: NB.Mongolian,
    chance: 0.1,
    sort: "score() / temp(5) / biome([2, 4, 10], 7) * coastDist()",
    shield: "banner"
  }
];

const european = () => [
  {name: "Shwazen", base: NB.German, chance: 1, sort: "score() / temp(10) / biome([6, 8])", shield: "swiss"},
  {name: "Angshire", base: NB.English, chance: 1, sort: "score() / temp(10) / oceanCoast()", shield: "wedged"},
  {name: "Luari", base: NB.French, chance: 1, sort: "score() / temp(12) / biome([6, 8])", shield: "french"},
  {name: "Tallian", base: NB.Italian, chance: 1, sort: "score() / temp(15)", shield: "horsehead"},
  {name: "Astellian", base: NB.Castillian, chance: 1, sort: "score() / temp(16)", shield: "spanish"},
  {name: "Slovan", base: NB.Ruthenian, chance: 1, sort: "score() / temp(6) * coastDist()", shield: "polish"},
  {name: "Norse", base: NB.Nordic, chance: 1, sort: "score() / temp(5)", shield: "heater"},
  {name: "Elladan", base: NB.Greek, chance: 1, sort: "score() / temp(18) * height()", shield: "boeotian"},
  {name: "Romian", base: NB.Roman, chance: 0.2, sort: "score() / temp(15) / coastDist()", shield: "roman"},
  {name: "Soumi", base: NB.Finnic, chance: 1, sort: "score() / temp(5) / biome([9]) * coastDist()", shield: "pavise"},
  {name: "Portuzian", base: NB.Portuguese, chance: 1, sort: "score() / temp(17) / oceanCoast()", shield: "renaissance"},
  {
    name: "Vengrian",
    base: NB.Hungarian,
    chance: 1,
    sort: "score() / temp(11) / biome([4]) * coastDist()",
    shield: "horsehead2"
  },
  {name: "Turchian", base: NB.Turkish, chance: 0.05, sort: "score() / temp(14)", shield: "round"},
  {name: "Euskati", base: NB.Basque, chance: 0.05, sort: "score() / temp(15) * height()", shield: "oldFrench"},
  {
    name: "Keltan",
    base: NB.Celtic,
    chance: 0.05,
    sort: "score() / temp(11) / biome([6, 8]) * coastDist()",
    shield: "oval"
  }
];

const oriental = () => [
  {name: "Koryo", base: NB.Korean, chance: 1, sort: "score() / temp(12) / coastDist()", shield: "round"},
  {name: "Hantzu", base: NB.Chinese, chance: 1, sort: "score() / temp(13)", shield: "banner"},
  {name: "Yamoto", base: NB.Japanese, chance: 1, sort: "score() / temp(15) / coastDist()", shield: "round"},
  {name: "Turchian", base: NB.Turkish, chance: 1, sort: "score() / temp(12)", shield: "round"},
  {
    name: "Berberan",
    base: NB.Berber,
    chance: 0.2,
    sort: "score() / temp(19) / biome([1, 2, 3], 7) * coastDist()",
    shield: "oval"
  },
  {
    name: "Eurabic",
    base: NB.Arabic,
    chance: 1,
    sort: "score() / temp(26) / biome([1, 2], 7) * coastDist()",
    shield: "oval"
  },
  {name: "Efratic", base: NB.Mesopotamian, chance: 0.1, sort: "score() / temp(22) * coastDist()", shield: "round"},
  {name: "Tehrani", base: NB.Iranian, chance: 1, sort: "score() / temp(18) * height()", shield: "round"},
  {
    name: "Maui",
    base: NB.Hawaiian,
    chance: 0.2,
    sort: "score() / temp(24) / oceanCoast() / coastDist()",
    shield: "vesicaPiscis"
  },
  {name: "Carnatic", base: NB.Karnataka, chance: 0.5, sort: "score() / temp(26)", shield: "round"},
  {
    name: "Vietic",
    base: NB.Vietnamese,
    chance: 0.8,
    sort: "score() / temp(25) / biome([7], 7) / coastDist()",
    shield: "banner"
  },
  {name: "Guantzu", base: NB.Cantonese, chance: 0.5, sort: "score() / temp(17)", shield: "banner"},
  {
    name: "Ulus",
    base: NB.Mongolian,
    chance: 1,
    sort: "score() / temp(5) / biome([2, 4, 10], 7) * coastDist()",
    shield: "banner"
  }
];

const getEnglishName: () => string = () => Names.getBase(1, 5, 9, "", 0);

const english = () => [
  {name: getEnglishName(), base: NB.English, chance: 1, shield: "heater"},
  {name: getEnglishName(), base: NB.English, chance: 1, shield: "wedged"},
  {name: getEnglishName(), base: NB.English, chance: 1, shield: "swiss"},
  {name: getEnglishName(), base: NB.English, chance: 1, shield: "oldFrench"},
  {name: getEnglishName(), base: NB.English, chance: 1, shield: "swiss"},
  {name: getEnglishName(), base: NB.English, chance: 1, shield: "spanish"},
  {name: getEnglishName(), base: NB.English, chance: 1, shield: "hessen"},
  {name: getEnglishName(), base: NB.English, chance: 1, shield: "fantasy5"},
  {name: getEnglishName(), base: NB.English, chance: 1, shield: "fantasy4"},
  {name: getEnglishName(), base: NB.English, chance: 1, shield: "fantasy1"}
];

const antique = () => [
  {name: "Roman", base: NB.Roman, chance: 1, sort: "score() / temp(14) / coastDist()", shield: "roman"},
  {name: "Roman", base: NB.Roman, chance: 1, sort: "score() / temp(15) / oceanCoast()", shield: "roman"},
  {name: "Roman", base: NB.Roman, chance: 1, sort: "score() / temp(16) / oceanCoast()", shield: "roman"},
  {name: "Roman", base: NB.Roman, chance: 1, sort: "score() / temp(17) / coastDist()", shield: "roman"},
  {
    name: "Hellenic",
    base: NB.Greek,
    chance: 1,
    sort: "score() / temp(18) / oceanCoast() * height()",
    shield: "boeotian"
  },
  {
    name: "Hellenic",
    base: NB.Greek,
    chance: 1,
    sort: "score() / temp(19) / oceanCoast() * height()",
    shield: "boeotian"
  },
  {name: "Macedonian", base: NB.Greek, chance: 0.5, sort: "score() / temp(12) * height()", shield: "round"},
  {name: "Celtic", base: NB.Celtic, chance: 1, sort: "score() / temp(11) ** 0.5 / biome([6, 8])", shield: "round"},
  {name: "Germanic", base: NB.German, chance: 1, sort: "score() / temp(10) ** 0.5 / biome([6, 8])", shield: "round"},
  {name: "Persian", base: NB.Iranian, chance: 0.8, sort: "score() / temp(18) * height()", shield: "oval"},
  {
    name: "Scythian",
    base: NB.Iranian,
    chance: 0.5,
    sort: "score() / temp(11) ** 0.5 / biome([4])",
    shield: "round"
  },
  {name: "Cantabrian", base: NB.Basque, chance: 0.5, sort: "score() / temp(16) * height()", shield: "oval"},
  {name: "Estian", base: NB.Finnic, chance: 0.2, sort: "score() / temp(5) * coastDist()", shield: "pavise"},
  {name: "Carthaginian", base: NB.Berber, chance: 0.3, sort: "score() / temp(19) / oceanCoast()", shield: "oval"},
  {
    name: "Mesopotamian",
    base: NB.Mesopotamian,
    chance: 0.2,
    sort: "score() / temp(22) / biome([1, 2, 3])",
    shield: "oval"
  }
];

const highFantasy = () => [
  // fantasy races
  {
    name: "Quenian (Elfish)",
    base: NB.Elven,
    chance: 1,
    sort: "score() / biome([6, 7, 8, 9], 10) * coastDist()",
    shield: "gondor"
  }, // Elves
  {
    name: "Eldar (Elfish)",
    base: NB.Elven,
    chance: 1,
    sort: "score() / biome([6, 7, 8, 9], 10) * coastDist()",
    shield: "noldor"
  }, // Elves
  {
    name: "Trow (Dark Elfish)",
    base: NB.DarkElven,
    chance: 0.9,
    sort: "score() / biome([7, 8, 9, 12], 10) * coastDist()",
    shield: "hessen"
  },
  {
    name: "Lothian (Dark Elfish)",
    base: NB.DarkElven,
    chance: 0.3,
    sort: "score() / biome([7, 8, 9, 12], 10) * coastDist()",
    shield: "wedged"
  },
  {name: "Dunirr (Dwarven)", base: NB.Dwarven, chance: 1, sort: "score() + height()", shield: "ironHills"}, // Dwarfs
  {name: "Khazadur (Dwarven)", base: NB.Dwarven, chance: 1, sort: "score() + height()", shield: "erebor"}, // Dwarfs
  {name: "Kobold (Goblin)", base: NB.Goblin, chance: 1, sort: "coastDist() - suitability()", shield: "moriaOrc"}, // Goblin
  {name: "Uruk (Orkish)", base: NB.Orc, chance: 1, sort: "height() * coastDist()", shield: "urukHai"}, // Orc
  {
    name: "Ugluk (Orkish)",
    base: NB.Orc,
    chance: 0.5,
    sort: "height() * oceanCoast() / biome([1, 2, 10, 11])",
    shield: "moriaOrc"
  }, // Orc
  {name: "Yotunn (Giants)", base: NB.Giant, chance: 0.7, sort: "temp(-10)", shield: "pavise"}, // Giant
  {name: "Rake (Drakonic)", base: NB.Draconic, chance: 0.7, sort: "- suitability()", shield: "fantasy2"}, // Draconic
  {name: "Arago (Arachnid)", base: NB.Arachnid, chance: 0.7, sort: "coastDist() - suitability()", shield: "horsehead2"}, // Arachnid
  {name: "Aj'Snaga (Serpents)", base: NB.Serpents, chance: 0.7, sort: "score() / biome([12], 10)", shield: "fantasy1"}, // Serpents
  // fantasy human
  {name: "Anor (Human)", base: NB.HumanGeneric, chance: 1, sort: "score() / temp(10)", shield: "fantasy5"},
  {name: "Dail (Human)", base: NB.HumanGeneric, chance: 1, sort: "score() / temp(13)", shield: "roman"},
  {name: "Rohand (Human)", base: NB.Turkish, chance: 1, sort: "score() / temp(16)", shield: "round"},
  {
    name: "Dulandir (Human)",
    base: NB.Mongolian,
    chance: 1,
    sort: "score() / temp(5) / biome([2, 4, 10], 7) * coastDist()",
    shield: "easterling"
  }
];

const darkFantasy = () => [
  // common real-world English
  {name: "Angshire", base: NB.English, chance: 1, sort: "score() / temp(10) / oceanCoast()", shield: "heater"},
  {name: "Enlandic", base: NB.English, chance: 1, sort: "score() / temp(12)", shield: "heater"},
  {name: "Westen", base: NB.English, chance: 1, sort: "score() / temp(10)", shield: "heater"},
  {name: "Nortumbic", base: NB.English, chance: 1, sort: "score() / temp(7)", shield: "heater"},
  {name: "Mercian", base: NB.English, chance: 1, sort: "score() / temp(9)", shield: "heater"},
  {name: "Kentian", base: NB.English, chance: 1, sort: "score() / temp(12)", shield: "heater"},
  // rare real-world western
  {name: "Norse", base: NB.Nordic, chance: 0.7, sort: "score() / temp(5) / oceanCoast()", shield: "oldFrench"},
  {name: "Schwarzen", base: NB.German, chance: 0.3, sort: "score() / temp(10) / biome([6, 8])", shield: "gonfalon"},
  {name: "Luarian", base: NB.French, chance: 0.3, sort: "score() / temp(12) / biome([6, 8])", shield: "oldFrench"},
  {name: "Hetallian", base: NB.Italian, chance: 0.3, sort: "score() / temp(15)", shield: "oval"},
  {name: "Astellian", base: NB.Castillian, chance: 0.3, sort: "score() / temp(16)", shield: "spanish"},
  // rare real-world exotic
  {
    name: "Kiswaili",
    base: NB.Swahili,
    chance: 0.05,
    sort: "score() / temp(29) / biome([1, 3, 5, 7])",
    shield: "vesicaPiscis"
  },
  {name: "Yoruba", base: NB.Nigerian, chance: 0.05, sort: "score() / temp(15) / biome([5, 7])", shield: "vesicaPiscis"},
  {name: "Koryo", base: NB.Korean, chance: 0.05, sort: "score() / temp(12) / coastDist()", shield: "round"},
  {name: "Hantzu", base: NB.Chinese, chance: 0.05, sort: "score() / temp(13)", shield: "banner"},
  {name: "Yamoto", base: NB.Japanese, chance: 0.05, sort: "score() / temp(15) / coastDist()", shield: "round"},
  {name: "Guantzu", base: NB.Cantonese, chance: 0.05, sort: "score() / temp(17)", shield: "banner"},
  {
    name: "Ulus",
    base: NB.Mongolian,
    chance: 0.05,
    sort: "score() / temp(5) / biome([2, 4, 10], 7) * coastDist()",
    shield: "banner"
  },
  {name: "Turan", base: NB.Turkish, chance: 0.05, sort: "score() / temp(12)", shield: "round"},
  {
    name: "Berberan",
    base: NB.Berber,
    chance: 0.05,
    sort: "score() / temp(19) / biome([1, 2, 3], 7) * coastDist()",
    shield: "round"
  },
  {
    name: "Eurabic",
    base: NB.Arabic,
    chance: 0.05,
    sort: "score() / temp(26) / biome([1, 2], 7) * coastDist()",
    shield: "round"
  },
  {name: "Slovan", base: NB.Ruthenian, chance: 0.05, sort: "score() / temp(6) * coastDist()", shield: "round"},
  {
    name: "Keltan",
    base: NB.Celtic,
    chance: 0.1,
    sort: "score() / temp(11) ** 0.5 / biome([6, 8])",
    shield: "vesicaPiscis"
  },
  {
    name: "Elladan",
    base: NB.Greek,
    chance: 0.2,
    sort: "score() / temp(18) / oceanCoast() * height()",
    shield: "boeotian"
  },
  {name: "Romian", base: NB.Roman, chance: 0.2, sort: "score() / temp(14) / coastDist()", shield: "roman"},
  // fantasy races
  {
    name: "Eldar",
    base: NB.Elven,
    chance: 0.5,
    sort: "score() / biome([6, 7, 8, 9], 10) * coastDist()",
    shield: "fantasy5"
  }, // Elves
  {
    name: "Trow",
    base: NB.DarkElven,
    chance: 0.8,
    sort: "score() / biome([7, 8, 9, 12], 10) * coastDist()",
    shield: "hessen"
  }, // Dark Elves
  {name: "Durinn", base: NB.Dwarven, chance: 0.8, sort: "score() + height()", shield: "erebor"}, // Dwarven
  {name: "Kobblin", base: NB.Goblin, chance: 0.8, sort: "coastDist() - suitability()", shield: "moriaOrc"}, // Goblin
  {name: "Uruk", base: NB.Orc, chance: 0.8, sort: "height() * coastDist() / biome([1, 2, 10, 11])", shield: "urukHai"}, // Orc
  {name: "Yotunn", base: NB.Giant, chance: 0.8, sort: "temp(-10)", shield: "pavise"}, // Giant
  {name: "Drake", base: NB.Draconic, chance: 0.9, sort: "- suitability()", shield: "fantasy2"}, // Draconic
  {name: "Rakhnid", base: NB.Arachnid, chance: 0.9, sort: "coastDist() - suitability()", shield: "horsehead2"}, // Arachnid
  {name: "Aj'Snaga", base: NB.Serpents, chance: 0.9, sort: "score() / biome([12], 10)", shield: "fantasy1"} // Serpents
];

const random = (culturesNumber: number) =>
  new Array(culturesNumber).map(() => {
    const rnd = rand(defaultNameBases.length - 1);
    const name = Names.getBaseShort(rnd);
    return {name, base: rnd, chance: 1, shield: COA.getRandomShield()};
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

export const DEFAULT_SORT_STRING = "score()";
