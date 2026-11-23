/** What a place must offer for a concept to fit its name; a concept with no tag fits anywhere */
export type SiteTag =
  | "big"
  | "small"
  | "capital"
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
  kind: "settlement" | "generic" | "modifier" | "land"; // how big a burg is, what stands there, what tells it apart, what a state is
  fits?: SiteTag[];
}

const settlement = (): ConceptData => ({ kind: "settlement" });
const generic = (...fits: SiteTag[]): ConceptData => ({ kind: "generic", fits: fits.length ? fits : undefined });
const modifier = (...fits: SiteTag[]): ConceptData => ({ kind: "modifier", fits: fits.length ? fits : undefined });
const land = (...fits: SiteTag[]): ConceptData => ({ kind: "land", fits: fits.length ? fits : undefined });

/** The closed vocabulary names are made of: the English word is the id and the gloss.
 * A name base gives its generics their endings in this order, so the common ones come first */
export const CONCEPTS = {
  city: settlement(),
  town: settlement(),
  village: settlement(),
  hamlet: settlement(),

  home: generic(),
  farm: generic("small", "plain"),
  hall: generic(),
  field: generic("plain"),
  wood: generic("forest"),
  hill: generic("hill"),
  ford: generic("stream"),
  fort: generic("hill", "capital"),
  bridge: generic("stream", "river"),
  harbour: generic("port"),
  valley: generic("stream", "hill"),
  market: generic("big"),
  castle: generic("capital", "hill"),
  mouth: generic("mouth"),
  mount: generic("mountain"),
  shore: generic("coast"),
  island: generic("island"),
  lake: generic("lake"),
  haven: generic("port"),
  marsh: generic("marsh"),
  spring: generic("stream", "hill"),
  meadow: generic("plain"),
  grove: generic("forest"),
  bank: generic("stream", "river"),
  mill: generic("stream"),
  bay: generic("coast"),
  cape: generic("coast"),
  cliff: generic("coast", "mountain"),
  tower: generic("hill", "coast"),
  ridge: generic("mountain", "hill"),
  pass: generic("mountain"),
  heath: generic("plain", "cold"),
  pool: generic("lake", "marsh"),
  well: generic("desert", "nomadic"),
  camp: generic("nomadic", "desert"),
  mine: generic("ore"),
  quarry: generic("ore", "mountain"),
  temple: generic("capital", "big"),
  abbey: generic(),
  river: generic("river"),
  brook: generic("stream"),
  water: generic("river", "stream", "lake"),

  new: modifier(),
  old: modifier(),
  great: modifier("big", "capital"),
  little: modifier("small"),
  long: modifier(),
  broad: modifier("plain", "river"),
  deep: modifier("lake", "river", "forest"),
  high: modifier("hill", "mountain"),
  low: modifier("plain", "coast", "marsh"),
  upper: modifier("hill", "mountain"),
  lower: modifier("plain", "coast"),
  middle: modifier(),
  north: modifier("north"),
  south: modifier("south"),
  east: modifier("east"),
  west: modifier("west"),
  black: modifier(),
  white: modifier(),
  red: modifier(),
  green: modifier("forest", "plain"),
  golden: modifier("plain", "desert"),
  grey: modifier(),
  blue: modifier("coast", "lake", "river"),
  dark: modifier("forest", "marsh"),
  bright: modifier(),
  oak: modifier("forest"),
  pine: modifier("forest", "cold"),
  birch: modifier("forest", "cold"),
  ash: modifier("forest"),
  elm: modifier("forest"),
  willow: modifier("stream", "river", "marsh"),
  thorn: modifier("plain", "desert"),
  reed: modifier("marsh", "lake", "stream"),
  rose: modifier(),
  apple: modifier("plain"),
  wolf: modifier("forest", "cold"),
  bear: modifier("forest", "mountain", "cold"),
  eagle: modifier("mountain", "hill", "coast"),
  deer: modifier("forest"),
  horse: modifier("plain", "nomadic"),
  ox: modifier("plain"),
  sheep: modifier("hill", "plain"),
  goat: modifier("mountain", "hill"),
  fox: modifier("forest", "plain"),
  boar: modifier("forest"),
  raven: modifier(),
  hawk: modifier("hill", "plain"),
  swan: modifier("lake", "river"),
  crane: modifier("marsh", "lake"),
  gull: modifier("coast"),
  seal: modifier("coast", "cold"),
  fish: modifier("coast", "lake", "river", "stream"),
  otter: modifier("river", "stream"),
  stone: modifier("hill", "mountain"),
  iron: modifier("ore"),
  copper: modifier("ore"),
  silver: modifier("ore"),
  gold: modifier("ore"),
  salt: modifier("ore", "coast", "desert"),
  sand: modifier("desert", "coast"),
  clay: modifier("plain", "river"),
  chalk: modifier("hill", "coast"),
  cold: modifier("cold"),
  warm: modifier("hot"),
  dry: modifier("desert"),
  wet: modifier("marsh"),
  wind: modifier("coast", "hill", "plain"),
  mist: modifier("marsh", "lake", "coast"),
  snow: modifier("cold", "mountain"),
  storm: modifier("coast"),
  quiet: modifier(),
  wild: modifier(),
  fair: modifier(),
  holy: modifier(),
  free: modifier(),
  king: modifier("capital"),
  queen: modifier("capital"),
  lord: modifier(),
  priest: modifier(),
  merchant: modifier("big", "port"),
  hunter: modifier("forest"),
  fisher: modifier("coast", "lake", "river"),
  smith: modifier("ore", "big"),
  shepherd: modifier("hill", "plain"),

  land: land(),
  realm: land(),
  march: land(),
  domain: land(),
  reach: land(),
  country: land(),
  crown: land(),
  folk: land(),
  coast: land("coast"),
  isles: land("island")
} satisfies Record<string, ConceptData>;

export type Concept = keyof typeof CONCEPTS;

export const isConcept = (word: string): word is Concept => Object.hasOwn(CONCEPTS, word);

export const kindOf = (concept: Concept): ConceptData["kind"] => CONCEPTS[concept].kind;

export const conceptsOf = (kind: ConceptData["kind"]): Concept[] =>
  (Object.keys(CONCEPTS) as Concept[]).filter(concept => CONCEPTS[concept].kind === kind);

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

/** The site tags a concept asks for; none when it fits anywhere */
export const fitsOf = (concept: Concept): SiteTag[] | undefined => (CONCEPTS[concept] as ConceptData).fits;
