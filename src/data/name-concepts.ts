/** What a place must offer for a concept to fit its name; a concept with no tag fits anywhere */
export type SiteTag =
  | "big"
  | "small"
  | "capital"
  | "citadel"
  | "walls"
  | "temple"
  | "port"
  | "coast"
  | "island"
  | "lake"
  | "stream"
  | "river"
  | "mouth"
  | "hill"
  | "mountain"
  | "plain"
  | "forest"
  | "marsh"
  | "desert"
  | "cold"
  | "hot"
  | "ore"
  | "nomadic"
  | "north"
  | "south"
  | "east"
  | "west";

interface ConceptData {
  fits?: SiteTag[];
  weight?: number;
  terrain?: true; // the lie of the land: what a name of three parts is built around, as in Red-hill-town
  countable?: true; // there may be several of it in one place: Three Towers
  water?: true; // what a water is, not what a burg stands by
  implies?: string; // the describing word it says already: no Stone Rock
}

/** What a burg is by its size: never drawn, the burg's group says which */
const SETTLEMENTS = {
  city: {},
  town: {},
  village: {},
  hamlet: {}
} satisfies Record<string, ConceptData>;

/** What stands at a place. A name base gives these their endings in this order, so the common ones come first */
const PLACES = {
  home: { weight: 6 },
  farm: { fits: ["small", "plain"], weight: 7 },
  hall: { weight: 4 },
  field: { fits: ["plain"], weight: 8, terrain: true },
  wood: { fits: ["forest"], weight: 8, terrain: true },
  hill: { fits: ["hill"], weight: 9, terrain: true, countable: true },
  ford: { fits: ["stream", "river"], weight: 9, terrain: true, countable: true },
  fort: { fits: ["citadel", "hill"], weight: 6 },
  bridge: { fits: ["stream", "river"], weight: 8, countable: true },
  harbour: { fits: ["port"], weight: 5 },
  valley: { fits: ["stream", "hill"], weight: 6, terrain: true },
  market: { fits: ["big"], weight: 5 },
  castle: { fits: ["citadel", "hill"], weight: 5 },
  mouth: { fits: ["mouth"], weight: 6 },
  mount: { fits: ["mountain"], weight: 6, terrain: true, countable: true },
  shore: { fits: ["coast"], weight: 4, terrain: true },
  island: { fits: ["island"], weight: 6, terrain: true, countable: true },
  lake: { fits: ["lake"], weight: 6, terrain: true, countable: true },
  haven: { fits: ["port"], weight: 4 },
  marsh: { fits: ["marsh"], weight: 5, terrain: true, implies: "wet" },
  spring: { fits: ["stream", "hill"], weight: 6, terrain: true, countable: true },
  meadow: { fits: ["plain"], weight: 7, terrain: true },
  grove: { fits: ["forest"], weight: 5, terrain: true, countable: true },
  bank: { fits: ["stream", "river"], weight: 4, terrain: true },
  mill: { fits: ["stream"], weight: 6, countable: true },
  bay: { fits: ["coast"], weight: 5, terrain: true },
  cape: { fits: ["coast"], weight: 4, terrain: true },
  cliff: { fits: ["coast", "mountain"], weight: 4, terrain: true, countable: true },
  tower: { fits: ["hill", "coast"], weight: 4, countable: true },
  ridge: { fits: ["mountain", "hill"], weight: 5, terrain: true },
  pass: { fits: ["mountain"], weight: 4, terrain: true },
  heath: { fits: ["plain", "cold"], weight: 5, terrain: true },
  pool: { fits: ["lake", "marsh"], weight: 5, terrain: true, countable: true },
  well: { fits: ["desert", "nomadic"], weight: 5, countable: true },
  camp: { fits: ["nomadic", "desert"], weight: 4 },
  mine: { fits: ["ore"], weight: 4 },
  quarry: { fits: ["ore", "mountain"], weight: 3, implies: "stone" },
  temple: { fits: ["temple"], weight: 3 },
  abbey: { weight: 4 },
  river: { fits: ["river"], weight: 5, water: true },
  brook: { fits: ["stream"], weight: 6, water: true },
  water: { fits: ["river", "stream", "lake"], weight: 5, water: true },
  keep: { fits: ["citadel", "hill"], weight: 3 },
  hold: { fits: ["hill", "mountain"], weight: 3 },
  watch: { fits: ["hill", "coast", "mountain"], weight: 3 },
  rest: { weight: 2 },
  end: { fits: ["coast", "mountain"], weight: 3 },
  landing: { fits: ["port", "river"], weight: 3 },
  gate: { fits: ["mountain", "hill"], weight: 4 },
  wall: { fits: ["walls"], weight: 3 },
  rock: { fits: ["coast", "hill", "mountain"], weight: 5, terrain: true, countable: true, implies: "stone" },
  crag: { fits: ["mountain", "coast"], weight: 4, terrain: true, countable: true, implies: "stone" },
  fell: { fits: ["mountain", "hill", "cold"], weight: 4, terrain: true },
  run: { fits: ["stream", "river"], weight: 3, water: true },
  falls: { fits: ["stream", "river"], weight: 4, terrain: true, countable: true },
  garden: { fits: ["plain"], weight: 3 },
  hedge: { fits: ["plain"], weight: 2 },
  den: { fits: ["forest", "hill"], weight: 3 },
  nest: { fits: ["mountain", "hill", "coast"], weight: 2 },
  roost: { fits: ["mountain", "hill"], weight: 2 },
  hearth: { fits: ["cold"], weight: 2 },
  court: { fits: ["capital", "big"], weight: 3 },
  seat: { fits: ["capital", "hill"], weight: 2 },
  tooth: { fits: ["mountain"], weight: 1, countable: true },
  horn: { fits: ["mountain", "coast"], weight: 3, countable: true },
  spear: { fits: ["coast", "mountain"], weight: 1 },
  shield: { weight: 1 },
  heart: { weight: 1 },
  eye: { fits: ["lake"], weight: 1, water: true },
  hand: { weight: 1 },
  finger: { fits: ["coast"], weight: 1, countable: true },
  claw: { fits: ["coast"], weight: 1 },
  head: { fits: ["coast", "hill"], weight: 4 },
  point: { fits: ["coast"], weight: 4 },
  reef: { fits: ["coast"], weight: 3 },
  sands: { fits: ["desert", "coast"], weight: 4, terrain: true, implies: "sand" },
  dune: { fits: ["desert", "coast"], weight: 3, terrain: true, implies: "sand" },
  waste: { fits: ["desert", "cold"], weight: 3, terrain: true },
  fen: { fits: ["marsh"], weight: 4, terrain: true, implies: "wet" },
  glade: { fits: ["forest"], weight: 4, terrain: true },
  glen: { fits: ["hill", "stream"], weight: 4, terrain: true },
  hollow: { fits: ["forest", "hill"], weight: 4, terrain: true },
  gorge: { fits: ["mountain", "stream"], weight: 3, terrain: true },
  peak: { fits: ["mountain"], weight: 4, terrain: true, countable: true },
  spire: { fits: ["mountain"], weight: 2, countable: true },
  cave: { fits: ["mountain", "hill"], weight: 3, terrain: true, countable: true },
  forge: { fits: ["ore"], weight: 3 },
  barrow: { fits: ["plain", "hill"], weight: 3, terrain: true, countable: true },
  grave: { weight: 1 },
  shrine: { weight: 3 },
  hermitage: { fits: ["forest", "mountain"], weight: 2 },
  crossing: { fits: ["river", "stream"], weight: 4 },
  ferry: { fits: ["river"], weight: 4 },
  fork: { fits: ["mouth"], weight: 3, countable: true },
  bend: { fits: ["river"], weight: 4, terrain: true },
  beacon: { fits: ["coast", "hill"], weight: 3 },
  square: { fits: ["big"], weight: 2 },
  inn: { weight: 2 },
  barn: { fits: ["plain", "small"], weight: 2 },
  vineyard: { fits: ["hot", "hill"], weight: 3 },
  pasture: { fits: ["plain", "hill"], weight: 4 },
  lodge: { fits: ["forest"], weight: 3 },
  table: { fits: ["plain", "hill"], weight: 1 },
  tarn: { fits: ["mountain", "lake"], weight: 3, water: true },
  tree: { fits: ["forest"], weight: 3, countable: true },
  way: { weight: 3 },
  dike: { fits: ["coast", "marsh", "plain"], weight: 3 },
  song: { weight: 1 },
  hope: { weight: 1 },
  guard: { weight: 3 },
  stair: { fits: ["mountain"], weight: 1 }
} satisfies Record<string, ConceptData>;

/** What tells a place apart */
const MODIFIERS = {
  new: { weight: 10 },
  old: { weight: 9 },
  great: { fits: ["big", "capital"], weight: 7 },
  little: { fits: ["small"], weight: 7 },
  long: { weight: 6 },
  broad: { fits: ["plain", "river"], weight: 5 },
  deep: { fits: ["lake", "river", "forest"], weight: 5 },
  high: { fits: ["hill", "mountain"], weight: 6 },
  low: { fits: ["plain", "coast", "marsh"], weight: 5 },
  upper: { fits: ["hill", "mountain"], weight: 6 },
  lower: { fits: ["plain", "coast"], weight: 6 },
  middle: { weight: 5 },
  north: { fits: ["north"], weight: 8 },
  south: { fits: ["south"], weight: 8 },
  east: { fits: ["east"], weight: 8 },
  west: { fits: ["west"], weight: 8 },
  black: { weight: 8 },
  white: { weight: 8 },
  red: { weight: 7 },
  green: { fits: ["forest", "plain"], weight: 7 },
  golden: { fits: ["plain", "desert"], weight: 4 },
  grey: { weight: 5 },
  blue: { fits: ["coast", "lake", "river"], weight: 3 },
  dark: { fits: ["forest", "marsh"], weight: 4 },
  bright: { weight: 3 },
  oak: { fits: ["forest"], weight: 7 },
  pine: { fits: ["forest", "cold"], weight: 4 },
  birch: { fits: ["forest", "cold"], weight: 5 },
  ash: { fits: ["forest"], weight: 6 },
  elm: { fits: ["forest"], weight: 5 },
  willow: { fits: ["stream", "river", "marsh"], weight: 5 },
  thorn: { fits: ["plain", "desert"], weight: 5 },
  reed: { fits: ["marsh", "lake", "stream"], weight: 4 },
  rose: { weight: 3 },
  apple: { fits: ["plain"], weight: 5 },
  wolf: { fits: ["forest", "cold"], weight: 5 },
  bear: { fits: ["forest", "mountain", "cold"], weight: 4 },
  eagle: { fits: ["mountain", "hill", "coast"], weight: 4 },
  deer: { fits: ["forest"], weight: 5 },
  horse: { fits: ["plain", "nomadic"], weight: 5 },
  ox: { fits: ["plain"], weight: 4 },
  sheep: { fits: ["hill", "plain"], weight: 4 },
  goat: { fits: ["mountain", "hill"], weight: 4 },
  fox: { fits: ["forest", "plain"], weight: 4 },
  boar: { fits: ["forest"], weight: 4 },
  raven: { weight: 4 },
  hawk: { fits: ["hill", "plain"], weight: 4 },
  swan: { fits: ["lake", "river"], weight: 4 },
  crane: { fits: ["marsh", "lake"], weight: 3 },
  gull: { fits: ["coast"], weight: 3 },
  seal: { fits: ["coast", "cold"], weight: 3 },
  fish: { fits: ["coast", "lake", "river", "stream"], weight: 4 },
  otter: { fits: ["river", "stream"], weight: 3 },
  stone: { fits: ["hill", "mountain"], weight: 7 },
  iron: { fits: ["ore"], weight: 4 },
  copper: { fits: ["ore"], weight: 3 },
  silver: { fits: ["ore"], weight: 4 },
  gold: { fits: ["ore"], weight: 4 },
  salt: { fits: ["ore", "coast", "desert"], weight: 5 },
  sand: { fits: ["desert", "coast"], weight: 4 },
  clay: { fits: ["plain", "river"], weight: 3 },
  chalk: { fits: ["hill", "coast"], weight: 3 },
  cold: { fits: ["cold"], weight: 5 },
  warm: { fits: ["hot"], weight: 3 },
  dry: { fits: ["desert"], weight: 4 },
  wet: { fits: ["marsh"], weight: 3 },
  wind: { fits: ["coast", "hill", "plain"], weight: 4 },
  mist: { fits: ["marsh", "lake", "coast"], weight: 3 },
  snow: { fits: ["cold", "mountain"], weight: 4 },
  storm: { fits: ["coast"], weight: 3 },
  quiet: { weight: 3 },
  wild: { weight: 3 },
  fair: { weight: 4 },
  holy: { weight: 5 },
  free: { weight: 3 },
  king: { fits: ["capital"], weight: 5 },
  queen: { fits: ["capital"], weight: 3 },
  lord: { weight: 3 },
  priest: { weight: 5 },
  merchant: { fits: ["big", "port"], weight: 3 },
  hunter: { fits: ["forest"], weight: 3 },
  fisher: { fits: ["coast", "lake", "river"], weight: 3 },
  smith: { fits: ["ore", "big"], weight: 3 },
  shepherd: { fits: ["hill", "plain"], weight: 3 },
  winter: { fits: ["cold", "north"], weight: 4 },
  summer: { fits: ["hot", "south"], weight: 4 },
  autumn: { weight: 2 },
  dusk: { fits: ["west"], weight: 2 },
  dawn: { fits: ["east"], weight: 2 },
  night: { weight: 2 },
  sun: { fits: ["hot", "desert", "south"], weight: 3 },
  moon: { weight: 3 },
  star: { weight: 3 },
  sky: { fits: ["mountain"], weight: 2 },
  cloud: { fits: ["mountain", "hill"], weight: 2 },
  rain: { fits: ["forest", "marsh"], weight: 2 },
  frost: { fits: ["cold"], weight: 3 },
  ice: { fits: ["cold"], weight: 3 },
  thunder: { fits: ["mountain", "coast"], weight: 2 },
  shadow: { fits: ["forest", "mountain"], weight: 3 },
  fire: { fits: ["hot", "desert"], weight: 3 },
  ember: { weight: 2 },
  cinder: { weight: 1 },
  smoke: { weight: 2 },
  blood: { weight: 2 },
  bone: { fits: ["desert", "cold"], weight: 2 },
  dust: { fits: ["desert"], weight: 1 },
  mud: { fits: ["marsh", "river"], weight: 3 },
  moss: { fits: ["forest", "marsh"], weight: 3 },
  amber: { fits: ["coast"], weight: 2 },
  pearl: { fits: ["coast"], weight: 2 },
  glass: { weight: 1 },
  crystal: { fits: ["mountain"], weight: 2 },
  tin: { fits: ["ore"], weight: 2 },
  bronze: { fits: ["ore"], weight: 2 },
  steel: { fits: ["ore"], weight: 2 },
  coal: { fits: ["ore"], weight: 3 },
  flint: { fits: ["hill", "mountain"], weight: 3 },
  marble: { fits: ["mountain"], weight: 2 },
  slate: { fits: ["mountain"], weight: 3 },
  honey: { fits: ["plain", "forest"], weight: 3 },
  milk: { fits: ["plain"], weight: 1 },
  wine: { fits: ["hot", "hill"], weight: 3 },
  wheat: { fits: ["plain"], weight: 4 },
  barley: { fits: ["plain"], weight: 3 },
  rye: { fits: ["plain", "cold"], weight: 3 },
  hay: { fits: ["plain"], weight: 3 },
  flax: { fits: ["plain"], weight: 2 },
  wool: { fits: ["hill", "plain"], weight: 2 },
  hop: { fits: ["plain"], weight: 2 },
  pea: { weight: 1 },
  dun: { weight: 2 },
  pale: { weight: 2 },
  crimson: { weight: 2 },
  yellow: { fits: ["desert", "plain"], weight: 2 },
  last: { weight: 2 },
  far: { weight: 3 },
  lone: { fits: ["small"], weight: 3 },
  lost: { weight: 2 },
  hidden: { fits: ["forest", "mountain"], weight: 2 },
  broken: { weight: 2 },
  burnt: { weight: 3 },
  drowned: { fits: ["coast", "marsh", "lake"], weight: 2 },
  bitter: { weight: 2 },
  sweet: { weight: 3 },
  hard: { fits: ["cold", "mountain"], weight: 2 },
  strong: { weight: 2 },
  sharp: { fits: ["mountain", "coast"], weight: 2 },
  dread: { weight: 1 },
  grim: { weight: 2 },
  merry: { weight: 3 },
  weeping: { fits: ["stream", "marsh"], weight: 2 },
  whispering: { fits: ["forest"], weight: 2 },
  haunted: { weight: 1 },
  sleeping: { weight: 2 },
  wandering: { fits: ["nomadic"], weight: 2 },
  singing: { fits: ["stream", "forest"], weight: 2 },
  crooked: { fits: ["river", "stream"], weight: 3 },
  barren: { fits: ["desert", "cold"], weight: 2 },
  bleak: { fits: ["cold"], weight: 2 },
  proud: { fits: ["capital"], weight: 2 },
  rich: { fits: ["big"], weight: 3 },
  poor: { fits: ["small"], weight: 2 },
  cursed: { weight: 1 },
  blessed: { weight: 2 },
  narrow: { fits: ["mountain", "stream"], weight: 3 },
  steep: { fits: ["mountain", "hill"], weight: 3 },
  flat: { fits: ["plain"], weight: 3 },
  round: { fits: ["hill"], weight: 3 },
  swift: { fits: ["stream", "river"], weight: 3 },
  clear: { fits: ["lake", "stream"], weight: 3 },
  true: { weight: 2 },
  dead: { fits: ["desert", "cold", "marsh"], weight: 2 },
  lucky: { weight: 2 },
  dragon: { fits: ["mountain"], weight: 3 },
  griffin: { fits: ["mountain", "hill"], weight: 1 },
  serpent: { fits: ["marsh", "desert", "coast"], weight: 2 },
  kraken: { fits: ["coast"], weight: 1 },
  lion: { fits: ["hot", "desert", "plain"], weight: 3 },
  ram: { fits: ["hill", "mountain"], weight: 3 },
  hound: { weight: 3 },
  cat: { fits: ["forest"], weight: 2 },
  hare: { fits: ["plain"], weight: 3 },
  badger: { fits: ["forest", "hill"], weight: 3 },
  beaver: { fits: ["river", "stream", "lake"], weight: 3 },
  rat: { fits: ["big", "port"], weight: 1 },
  bat: { fits: ["mountain", "forest"], weight: 1 },
  owl: { fits: ["forest"], weight: 3 },
  crow: { weight: 4 },
  heron: { fits: ["marsh", "lake", "river"], weight: 3 },
  goose: { fits: ["lake", "marsh", "plain"], weight: 3 },
  duck: { fits: ["lake", "marsh", "river"], weight: 3 },
  dove: { weight: 3 },
  lark: { fits: ["plain"], weight: 3 },
  nightingale: { fits: ["forest"], weight: 2 },
  stork: { fits: ["plain", "marsh"], weight: 3 },
  pike: { fits: ["river", "lake"], weight: 2 },
  salmon: { fits: ["river", "cold"], weight: 3 },
  eel: { fits: ["river", "marsh"], weight: 1 },
  crab: { fits: ["coast"], weight: 2 },
  whale: { fits: ["coast", "cold"], weight: 2 },
  toad: { fits: ["marsh"], weight: 2 },
  lizard: { fits: ["desert"], weight: 1 },
  spider: { fits: ["forest"], weight: 1 },
  bee: { fits: ["plain", "forest"], weight: 3 },
  bison: { fits: ["plain", "forest"], weight: 2 },
  lynx: { fits: ["forest", "cold"], weight: 2 },
  sable: { fits: ["cold", "forest"], weight: 2 },
  camel: { fits: ["desert", "nomadic"], weight: 1 },
  rooster: { weight: 2 },
  holly: { fits: ["forest"], weight: 3 },
  ivy: { weight: 2 },
  yew: { fits: ["forest"], weight: 3 },
  alder: { fits: ["river", "marsh", "stream"], weight: 4 },
  hazel: { fits: ["forest"], weight: 4 },
  rowan: { fits: ["forest", "hill", "cold"], weight: 3 },
  linden: { fits: ["forest", "plain"], weight: 4 },
  beech: { fits: ["forest", "hill"], weight: 4 },
  maple: { fits: ["forest"], weight: 3 },
  aspen: { fits: ["forest", "cold"], weight: 3 },
  poplar: { fits: ["river", "plain"], weight: 3 },
  spruce: { fits: ["forest", "cold", "mountain"], weight: 3 },
  cedar: { fits: ["mountain", "forest"], weight: 3 },
  heather: { fits: ["hill", "cold"], weight: 3 },
  nettle: { weight: 2 },
  poppy: { fits: ["plain", "hot"], weight: 2 },
  cherry: { fits: ["plain"], weight: 3 },
  pear: { fits: ["plain"], weight: 3 },
  berry: { fits: ["forest"], weight: 3 },
  mushroom: { fits: ["forest"], weight: 2 },
  flower: { fits: ["plain"], weight: 2 },
  leaf: { fits: ["forest"], weight: 2 },
  acorn: { fits: ["forest"], weight: 2 },
  grass: { fits: ["plain"], weight: 3 },
  lady: { weight: 3 },
  maiden: { weight: 3 },
  widow: { weight: 2 },
  knight: { weight: 3 },
  monk: { weight: 3 },
  hermit: { fits: ["forest", "mountain"], weight: 2 },
  witch: { fits: ["forest", "marsh"], weight: 2 },
  giant: { fits: ["mountain"], weight: 2 },
  ghost: { weight: 1 },
  god: { weight: 3 },
  devil: { weight: 2 },
  thief: { weight: 2 },
  robber: { fits: ["forest"], weight: 2 },
  beggar: { weight: 1 },
  pilgrim: { weight: 2 },
  sailor: { fits: ["port", "coast"], weight: 2 },
  raider: { fits: ["coast"], weight: 2 },
  miller: { fits: ["stream"], weight: 3 },
  weaver: { weight: 1 },
  potter: { fits: ["plain", "river"], weight: 1 },
  tanner: { weight: 1 },
  carpenter: { fits: ["forest"], weight: 1 },
  cooper: { weight: 1 },
  archer: { weight: 2 },
  warden: { weight: 2 },
  warrior: { weight: 2 },
  elder: { weight: 3 },
  orphan: { fits: ["small"], weight: 1 },
  fool: { weight: 1 },
  crone: { weight: 2 },
  brother: { weight: 1 },
  sister: { weight: 1 },
  friend: { weight: 1 },
  sword: { weight: 1 },
  axe: { fits: ["forest"], weight: 1 },
  hammer: { fits: ["ore"], weight: 1 },
  arrow: { weight: 1 },
  bell: { weight: 1 },
  harp: { weight: 1 },
  cup: { weight: 1 },
  wheel: { weight: 1 },
  anchor: { fits: ["port"], weight: 2 },
  sail: { fits: ["port", "coast"], weight: 1 },
  boat: { fits: ["river", "lake", "port"], weight: 1 },
  ship: { fits: ["port"], weight: 1 },
  candle: { weight: 1 },
  ring: { weight: 1 },
  feast: { weight: 1 },
  cross: { weight: 2 },
  treasure: { weight: 1 },
  skull: { weight: 1 },
  feather: { weight: 1 },
  wing: { weight: 1 },
  gallows: { weight: 1 },
  peace: { weight: 1 },
  glory: { weight: 1 },
  love: { weight: 1 },
  victory: { weight: 1 },
  wonder: { weight: 1 }
} satisfies Record<string, ConceptData>;

/** How many there are, weighed against one another */
const NUMERALS = {
  two: { weight: 6 },
  three: { weight: 9 },
  five: { weight: 6 },
  seven: { weight: 9 },
  nine: { weight: 3 },
  ten: { weight: 3 },
  hundred: { weight: 2 },
  thousand: { weight: 1 }
} satisfies Record<string, ConceptData>;

/** What a state is */
const LANDS = {
  land: { weight: 10 },
  realm: { fits: ["big"], weight: 7 },
  march: { fits: ["small"], weight: 4 },
  domain: { fits: ["small"], weight: 3 },
  reach: { weight: 2 },
  country: { fits: ["small"], weight: 4 },
  crown: { weight: 1 },
  folk: { weight: 1 },
  coast: { fits: ["coast"], weight: 3 },
  isles: { fits: ["island"], weight: 3 }
} satisfies Record<string, ConceptData>;

const KINDS = { settlement: SETTLEMENTS, generic: PLACES, modifier: MODIFIERS, numeral: NUMERALS, land: LANDS };

/** The closed vocabulary names are made of: the English word is the id and the gloss */
export const CONCEPTS = { ...SETTLEMENTS, ...PLACES, ...MODIFIERS, ...NUMERALS, ...LANDS };

export type Concept = keyof typeof CONCEPTS;

export type Kind = keyof typeof KINDS;

export const isConcept = (word: string): word is Concept => Object.hasOwn(CONCEPTS, word);

export const conceptsOf = (kind: Kind): Concept[] => Object.keys(KINDS[kind]) as Concept[];

const KIND_OF = new Map(
  (Object.keys(KINDS) as Kind[]).flatMap(kind => conceptsOf(kind).map(concept => [concept, kind]))
);

export const kindOf = (concept: Concept): Kind => KIND_OF.get(concept)!;

/** The settlement a burg group's burgs are named as; a group of another name goes by the size it takes */
const GROUP_SETTLEMENTS: Record<string, Concept> = {
  capital: "city",
  city: "city",
  town: "town",
  village: "village",
  hamlet: "hamlet",
  fort: "fort",
  monastery: "abbey",
  caravanserai: "camp",
  trading_post: "market"
};

/** Whether a concept is what a burg may be by its group */
export const settles = (concept: Concept): boolean => Object.values(GROUP_SETTLEMENTS).includes(concept);

export function settlementOf(group?: { name: string; min?: number; max?: number; percentile?: number }): Concept {
  if (!group) return "town";
  const named = GROUP_SETTLEMENTS[group.name];
  if (named) return named;
  if (group.percentile !== undefined && group.percentile >= 80) return "city";
  if (group.max !== undefined) return group.max <= 0.2 ? "hamlet" : group.max <= 3 ? "village" : "town";
  return group.min !== undefined && group.min >= 10 ? "city" : "town";
}

const dataOf = (concept: Concept): ConceptData => CONCEPTS[concept];

export const weightOf = (concept: Concept): number => dataOf(concept).weight ?? 0;

/** The site tags a concept asks for; none when it fits anywhere */
export const fitsOf = (concept: Concept): SiteTag[] | undefined => dataOf(concept).fits;

export const isTerrain = (concept: Concept): boolean => Boolean(dataOf(concept).terrain);
export const isCountable = (concept: Concept): boolean => Boolean(dataOf(concept).countable);
export const isWater = (concept: Concept): boolean => Boolean(dataOf(concept).water);

/** The describing word a concept says already */
export const impliedBy = (concept: Concept): Concept | undefined => dataOf(concept).implies as Concept | undefined;

/** What tells one of two neighbours from the other: a neighbour told apart by one of a group is told by no other of it */
export const OPPOSITES: Concept[][] = [
  ["north", "south", "east", "west"],
  ["upper", "lower", "middle", "high", "low"],
  ["new", "old"],
  ["little", "great"]
];
