interface ICulture {
  i: number;
  type: TCultureType;
  name: string;
  base: number;
  center: number;
  code: string;
  color: Hex | CssUrl;
  expansionism: number;
  origins: number[];
  shield: string;
  removed?: boolean;
}

type IWilderness = {
  i: 0;
  name: string;
  base: number;
  origins: [null];
  shield: string;
};

type TCultures = [IWilderness, ...ICulture[]];

type TCultureType =
  | "Generic" // no bonuses, standard penalties
  | "Lake" // low water cross penalty and high for growth not along coastline
  | "Naval" // low water cross penalty and high for non-along-coastline growth
  | "River" // no River cross penalty, penalty for non-River growth
  | "Nomadic" // high penalty in forest biomes and near coastline
  | "Hunting" // high penalty in non-native biomes
  | "Highland"; // no penalty for hills and moutains, high for other elevations
