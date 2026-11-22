// Interface names for ids the data stores in English: a select shows the label, keeps the id as its value

import type { Expense } from "@/data/expenses";
import type { LabelType } from "@/model/annotations/labels-generator";
import type { ProsperityLevel } from "@/model/economy/prosperity";
import type { Sampling } from "@/model/graph/lattice";
import type { TransportDomain } from "@/model/story/journeys/transports-generator";
import type { DemandCategory } from "@/types/economy";
import { t } from "@/utils/i18n";
import type { Concept } from "./name-concepts";

export const FEATURE_SUBTYPE_LABELS: Record<string, string> = {
  continent: t("Continent"),
  island: t("Island"),
  isle: t("Isle"),
  lake_island: t("Lake island"),
  freshwater: t("Freshwater lake"),
  salt: t("Salt lake"),
  dry: t("Dry lake"),
  sinkhole: t("Sinkhole lake"),
  frozen: t("Frozen lake"),
  lava: t("Lava lake"),
  ocean: t("Ocean"),
  sea: t("Sea"),
  gulf: t("Gulf"),
  lake: t("Lake")
};

export const LABEL_TYPE_LABELS: Record<LabelType, string> = {
  state: t("State"),
  province: t("Province"),
  burg: t("Burg"),
  river: t("River"),
  route: t("Route"),
  added: t("Added")
};

export const LABEL_MODE_LABELS: Record<string, string> = { auto: t("Auto"), short: t("Short"), full: t("Full") };

export const RELIGION_EXPANSION_LABELS: Record<string, string> = {
  global: t("global"),
  state: t("state"),
  culture: t("culture")
};

export const RELIGION_TYPE_LABELS: Record<string, string> = {
  Folk: t("Folk"),
  Organized: t("Organized"),
  Cult: t("Cult"),
  Heresy: t("Heresy")
};

export const CULTURE_TYPE_LABELS: Record<string, string> = {
  Generic: t("Generic"),
  Hunting: t("Hunting"),
  Highland: t("Highland"),
  River: t("River"),
  Lake: t("Lake"),
  Naval: t("Naval"),
  Nomadic: t("Nomadic")
};

export const TRANSPORT_DOMAIN_LABELS: Record<TransportDomain, string> = {
  land: t("land"),
  water: t("water"),
  air: t("air"),
  stay: t("stay")
};

export const SHIELD_LABELS: Record<string, string> = {
  heater: t("Heater"),
  spanish: t("Spanish"),
  french: t("French"),
  horsehead: t("Horsehead"),
  horsehead2: t("Horsehead Edgy"),
  polish: t("Polish"),
  hessen: t("Hessen"),
  swiss: t("Swiss"),
  boeotian: t("Boeotian"),
  roman: t("Roman"),
  kite: t("Kite"),
  oldFrench: t("Old French"),
  renaissance: t("Renaissance"),
  baroque: t("Baroque"),
  targe: t("Targe"),
  targe2: `${t("Targe")} 2`,
  pavise: t("Pavise"),
  wedged: t("Wedged"),
  embowed: t("Embowed"),
  flag: t("Flag"),
  pennon: t("Pennon"),
  guidon: t("Guidon"),
  banner: t("Banner"),
  dovetail: t("Dovetail"),
  gonfalon: t("Gonfalon"),
  pennant: t("Pennant"),
  round: t("Round"),
  oval: t("Oval"),
  vesicaPiscis: t("Vesica Piscis"),
  square: t("Square"),
  diamond: t("Diamond"),
  hexagon: t("Hexagon"),
  no: t("No shield"),
  fantasy1: `${t("Fantasy")} 1`,
  fantasy2: `${t("Fantasy")} 2`,
  fantasy3: `${t("Fantasy")} 3`,
  fantasy4: `${t("Fantasy")} 4`,
  fantasy5: `${t("Fantasy")} 5`,
  noldor: t("Noldor"),
  gondor: t("Gondor"),
  easterling: t("Easterling"),
  erebor: t("Erebor"),
  ironHills: t("Iron Hills"),
  urukHai: t("UrukHai"),
  moriaOrc: t("Moria Orc")
};

export const HEIGHTMAP_SCHEME_LABELS: Record<string, string> = {
  bright: t("Bright"),
  light: t("Light"),
  natural: t("Natural"),
  green: t("Green"),
  olive: t("Olive"),
  livid: t("Livid"),
  monochrome: t("Monochrome")
};

export const STYLE_PRESET_LABELS: Record<string, string> = {
  default: t("Default"),
  ink: t("Ink"),
  ancient: t("Ancient"),
  cinderwood: t("Cinderwood"),
  clean: t("Clean"),
  atlas: t("Atlas"),
  light: t("Light"),
  pale: t("Pale"),
  watercolor: t("Watercolor"),
  frostbite: t("Frostbite"),
  gloom: t("Gloom"),
  darkSeas: t("Dark Seas"),
  cyberpunk: t("Cyberpunk"),
  night: t("Night"),
  monochrome: t("Monochrome")
};

export const DEMAND_CATEGORY_LABELS: Record<DemandCategory, string> = {
  food: t("food"),
  utilities: t("utilities"),
  construction: t("construction"),
  military: t("military"),
  luxury: t("luxury")
};

export const EXPENSE_LABELS: Record<Expense, string> = {
  court: t("Court and clergy"),
  administration: t("Administration"),
  infrastructure: t("Infrastructure"),
  military: t("Military")
};

export const PROSPERITY_LEVEL_LABELS: Record<ProsperityLevel, string> = {
  Desolate: t("Desolate"),
  Destitute: t("Destitute"),
  Poor: t("Poor"),
  Modest: t("Modest"),
  Comfortable: t("Comfortable"),
  Thriving: t("Thriving"),
  Affluent: t("Affluent"),
  Opulent: t("Opulent"),
  Splendid: t("Splendid"),
  Peerless: t("Peerless")
};

export const ERA_LABELS: Record<string, string> = {
  Paleolithic: t("Paleolithic"),
  Mesolithic: t("Mesolithic"),
  Neolithic: t("Neolithic"),
  "Copper Age": t("Copper Age"),
  "Bronze Age": t("Bronze Age"),
  "Late Bronze Age": t("Late Bronze Age"),
  "Iron Age": t("Iron Age"),
  "Classical Age": t("Classical Age"),
  "Late Antiquity": t("Late Antiquity"),
  "Early Middle Ages": t("Early Middle Ages"),
  "High Middle Ages": t("High Middle Ages"),
  "Commercial Revolution": t("Commercial Revolution"),
  "Late Middle Ages": t("Late Middle Ages"),
  Renaissance: t("Renaissance"),
  "Age of Discovery": t("Age of Discovery"),
  "Scientific Revolution": t("Scientific Revolution"),
  Enlightenment: t("Enlightenment"),
  "Industrial Revolution": t("Industrial Revolution"),
  "Machine Age": t("Machine Age"),
  "Space Age": t("Space Age"),
  "Post-human": t("Post-human")
};

/** the map's SVG filters, by element id */
export const FILTER_LABELS: Record<string, string> = {
  blurFilter: `${t("Blur")} 0.2`,
  blur1: `${t("Blur")} 1`,
  blur3: `${t("Blur")} 3`,
  blur5: `${t("Blur")} 5`,
  blur7: `${t("Blur")} 7`,
  blur10: `${t("Blur")} 10`,
  splotch: t("Splotch"),
  bluredSplotch: t("Blurred Splotch"),
  dropShadow: `${t("Shadow")} 2`,
  dropShadow01: `${t("Shadow")} 0.1`,
  dropShadow05: `${t("Shadow")} 0.5`,
  outline: t("Outline"),
  pencil: t("Pencil"),
  turbulence: t("Turbulence"),
  "filter-grayscale": t("Grayscale"),
  "filter-sepia": t("Sepia"),
  "filter-dingy": t("Dingy"),
  "filter-tint": t("Tint"),
  paper: t("Paper"),
  crumpled: t("Crumpled")
};

export const VIGNETTE_PRESET_LABELS: Record<string, string> = {
  default: t("Default"),
  neon: t("Neon"),
  smoke: t("Smoke"),
  wound: t("Wound"),
  paper: t("Paper"),
  granite: t("Granite"),
  spotlight: t("Spotlight")
};

/** Icon picker category names: the emoji themes and the built-in set groups, keyed by their English name */
export const ICON_GROUP_LABELS: Record<string, string> = {
  "War & power": t("War & power"),
  "Magic & myth": t("Magic & myth"),
  "Faith & signs": t("Faith & signs"),
  "Shapes & colors": t("Shapes & colors"),
  "Places & travel": t("Places & travel"),
  "Crafts & tools": t("Crafts & tools"),
  "Trade & treasure": t("Trade & treasure"),
  "Arts & leisure": t("Arts & leisure"),
  "Sky & weather": t("Sky & weather"),
  "Reptiles & bugs": t("Reptiles & bugs"),
  "Sea life": t("Sea life"),
  "Food & drink": t("Food & drink"),
  Settlements: t("Settlements"),
  Relief: t("Relief"),
  Goods: t("Goods"),
  Heraldry: t("Heraldry")
};

export const SAMPLING_LABELS: Record<Sampling, string> = {
  square: t("Square grid"),
  hexPointy: t("Hex grid (pointy)"),
  hexFlat: t("Hex grid (flat)"),
  diamond: t("Square 45 degrees grid"),
  triangle: t("Triangle grid (horizontal)")
};

/** The words names are made of, for a meaning read in the interface language */
export const CONCEPT_LABELS: Record<Concept, string> = {
  town: t("town", { context: "toponym" }),
  village: t("village", { context: "toponym" }),
  home: t("home", { context: "toponym" }),
  farm: t("farm", { context: "toponym" }),
  hall: t("hall", { context: "toponym" }),
  field: t("field", { context: "toponym" }),
  wood: t("wood", { context: "toponym" }),
  hill: t("hill", { context: "toponym" }),
  ford: t("ford", { context: "toponym" }),
  fort: t("fort", { context: "toponym" }),
  bridge: t("bridge", { context: "toponym" }),
  harbour: t("harbour", { context: "toponym" }),
  valley: t("valley", { context: "toponym" }),
  market: t("market", { context: "toponym" }),
  castle: t("castle", { context: "toponym" }),
  mouth: t("mouth", { context: "toponym" }),
  mount: t("mount", { context: "toponym" }),
  shore: t("shore", { context: "toponym" }),
  island: t("island", { context: "toponym" }),
  lake: t("lake", { context: "toponym" }),
  haven: t("haven", { context: "toponym" }),
  marsh: t("marsh", { context: "toponym" }),
  spring: t("spring", { context: "toponym" }),
  meadow: t("meadow", { context: "toponym" }),
  grove: t("grove", { context: "toponym" }),
  bank: t("bank", { context: "toponym" }),
  mill: t("mill", { context: "toponym" }),
  bay: t("bay", { context: "toponym" }),
  cape: t("cape", { context: "toponym" }),
  cliff: t("cliff", { context: "toponym" }),
  tower: t("tower", { context: "toponym" }),
  ridge: t("ridge", { context: "toponym" }),
  pass: t("pass", { context: "toponym" }),
  heath: t("heath", { context: "toponym" }),
  pool: t("pool", { context: "toponym" }),
  well: t("well", { context: "toponym" }),
  camp: t("camp", { context: "toponym" }),
  mine: t("mine", { context: "toponym" }),
  quarry: t("quarry", { context: "toponym" }),
  temple: t("temple", { context: "toponym" }),
  river: t("river", { context: "toponym" }),
  brook: t("brook", { context: "toponym" }),
  water: t("water", { context: "toponym" }),
  new: t("new", { context: "toponym" }),
  old: t("old", { context: "toponym" }),
  great: t("great", { context: "toponym" }),
  little: t("little", { context: "toponym" }),
  long: t("long", { context: "toponym" }),
  broad: t("broad", { context: "toponym" }),
  deep: t("deep", { context: "toponym" }),
  high: t("high", { context: "toponym" }),
  low: t("low", { context: "toponym" }),
  upper: t("upper", { context: "toponym" }),
  lower: t("lower", { context: "toponym" }),
  middle: t("middle", { context: "toponym" }),
  north: t("north", { context: "toponym" }),
  south: t("south", { context: "toponym" }),
  east: t("east", { context: "toponym" }),
  west: t("west", { context: "toponym" }),
  black: t("black", { context: "toponym" }),
  white: t("white", { context: "toponym" }),
  red: t("red", { context: "toponym" }),
  green: t("green", { context: "toponym" }),
  golden: t("golden", { context: "toponym" }),
  grey: t("grey", { context: "toponym" }),
  blue: t("blue", { context: "toponym" }),
  dark: t("dark", { context: "toponym" }),
  bright: t("bright", { context: "toponym" }),
  oak: t("oak", { context: "toponym" }),
  pine: t("pine", { context: "toponym" }),
  birch: t("birch", { context: "toponym" }),
  ash: t("ash", { context: "toponym" }),
  elm: t("elm", { context: "toponym" }),
  willow: t("willow", { context: "toponym" }),
  thorn: t("thorn", { context: "toponym" }),
  reed: t("reed", { context: "toponym" }),
  rose: t("rose", { context: "toponym" }),
  apple: t("apple", { context: "toponym" }),
  wolf: t("wolf", { context: "toponym" }),
  bear: t("bear", { context: "toponym" }),
  eagle: t("eagle", { context: "toponym" }),
  deer: t("deer", { context: "toponym" }),
  horse: t("horse", { context: "toponym" }),
  ox: t("ox", { context: "toponym" }),
  sheep: t("sheep", { context: "toponym" }),
  goat: t("goat", { context: "toponym" }),
  fox: t("fox", { context: "toponym" }),
  boar: t("boar", { context: "toponym" }),
  raven: t("raven", { context: "toponym" }),
  hawk: t("hawk", { context: "toponym" }),
  swan: t("swan", { context: "toponym" }),
  crane: t("crane", { context: "toponym" }),
  gull: t("gull", { context: "toponym" }),
  seal: t("seal", { context: "toponym" }),
  fish: t("fish", { context: "toponym" }),
  otter: t("otter", { context: "toponym" }),
  stone: t("stone", { context: "toponym" }),
  iron: t("iron", { context: "toponym" }),
  copper: t("copper", { context: "toponym" }),
  silver: t("silver", { context: "toponym" }),
  gold: t("gold", { context: "toponym" }),
  salt: t("salt", { context: "toponym" }),
  sand: t("sand", { context: "toponym" }),
  clay: t("clay", { context: "toponym" }),
  chalk: t("chalk", { context: "toponym" }),
  cold: t("cold", { context: "toponym" }),
  warm: t("warm", { context: "toponym" }),
  dry: t("dry", { context: "toponym" }),
  wet: t("wet", { context: "toponym" }),
  wind: t("wind", { context: "toponym" }),
  mist: t("mist", { context: "toponym" }),
  snow: t("snow", { context: "toponym" }),
  storm: t("storm", { context: "toponym" }),
  quiet: t("quiet", { context: "toponym" }),
  wild: t("wild", { context: "toponym" }),
  fair: t("fair", { context: "toponym" }),
  holy: t("holy", { context: "toponym" }),
  free: t("free", { context: "toponym" }),
  king: t("king", { context: "toponym" }),
  queen: t("queen", { context: "toponym" }),
  lord: t("lord", { context: "toponym" }),
  priest: t("priest", { context: "toponym" }),
  merchant: t("merchant", { context: "toponym" }),
  hunter: t("hunter", { context: "toponym" }),
  fisher: t("fisher", { context: "toponym" }),
  smith: t("smith", { context: "toponym" }),
  shepherd: t("shepherd", { context: "toponym" }),
  land: t("land", { context: "toponym" }),
  realm: t("realm", { context: "toponym" }),
  march: t("march", { context: "toponym" }),
  domain: t("domain", { context: "toponym" }),
  reach: t("reach", { context: "toponym" }),
  country: t("country", { context: "toponym" }),
  crown: t("crown", { context: "toponym" }),
  folk: t("folk", { context: "toponym" }),
  coast: t("coast", { context: "toponym" }),
  isles: t("isles", { context: "toponym" })
};
