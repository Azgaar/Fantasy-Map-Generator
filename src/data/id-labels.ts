// Interface names for ids the data stores in English: a select shows the label, keeps the id as its value
import { t } from "@/utils/i18n";

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

export const LABEL_TYPE_LABELS: Record<string, string> = {
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

export const TRANSPORT_DOMAIN_LABELS: Record<string, string> = {
  land: t("land"),
  water: t("water"),
  air: t("air"),
  stay: t("stay")
};

/** The label for an id, the id itself when it has none */
export const labelOf = (labels: Record<string, string>, id: string): string => labels[id] ?? id;

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
  targe2: t("Targe2"),
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
  fantasy1: t("Fantasy1"),
  fantasy2: t("Fantasy2"),
  fantasy3: t("Fantasy3"),
  fantasy4: t("Fantasy4"),
  fantasy5: t("Fantasy5"),
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

export const DEMAND_CATEGORY_LABELS: Record<string, string> = {
  food: t("food"),
  utilities: t("utilities"),
  construction: t("construction"),
  military: t("military"),
  luxury: t("luxury")
};

/** the map's SVG filters, by element id */
export const FILTER_LABELS: Record<string, string> = {
  blurFilter: t("Blur 0.2"),
  blur1: t("Blur 1"),
  blur3: t("Blur 3"),
  blur5: t("Blur 5"),
  blur7: t("Blur 7"),
  blur10: t("Blur 10"),
  splotch: t("Splotch"),
  bluredSplotch: t("Blurred Splotch"),
  dropShadow: t("Shadow 2"),
  dropShadow01: t("Shadow 0.1"),
  dropShadow05: t("Shadow 0.5"),
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
