export interface ChargeDataEntry {
  colors?: number;
  sinister?: boolean;
  reversed?: boolean;
  positions?: Record<string, number>;
  natural?: string;
}

export const chargeData: Record<string, ChargeDataEntry> = {
  agnusDei: {
    colors: 2,
    sinister: true,
  },
  angel: {
    colors: 2,
    positions: { e: 1 },
  },
  anvil: {
    sinister: true,
  },
  apple: {
    colors: 2,
  },
  arbalest: {
    colors: 3,
    reversed: true,
  },
  archer: {
    colors: 3,
    sinister: true,
  },
  armEmbowedHoldingSabre: {
    colors: 3,
    sinister: true,
  },
  armEmbowedVambraced: {
    sinister: true,
  },
  armEmbowedVambracedHoldingSword: {
    colors: 3,
    sinister: true,
  },
  armillarySphere: {
    positions: { e: 1 },
  },
  arrow: {
    colors: 3,
    reversed: true,
  },
  arrowsSheaf: {
    colors: 3,
    reversed: true,
  },
  axe: {
    colors: 2,
    sinister: true,
  },
  badgerStatant: {
    colors: 2,
    sinister: true,
  },
  banner: {
    colors: 2,
  },
  basilisk: {
    colors: 3,
    sinister: true,
  },
  bearPassant: {
    colors: 3,
    sinister: true,
  },
  bearRampant: {
    colors: 3,
    sinister: true,
  },
  bee: {
    colors: 3,
    reversed: true,
  },
  bell: {
    colors: 2,
  },
  boarHeadErased: {
    colors: 3,
    sinister: true,
  },
  boarRampant: {
    colors: 3,
    sinister: true,
    positions: { e: 12, beh: 1, kn: 1, jln: 2 },
  },
  boat: {
    colors: 2,
  },
  bookClosed: {
    colors: 3,
    sinister: true,
  },
  bookClosed2: {
    sinister: true,
  },
  bookOpen: {
    colors: 3,
  },
  bow: {
    sinister: true,
  },
  bowWithArrow: {
    colors: 3,
    reversed: true,
  },
  bowWithThreeArrows: {
    colors: 3,
  },
  bucket: {
    colors: 2,
  },
  bugleHorn: {
    colors: 2,
  },
  bugleHorn2: {
    colors: 2,
  },
  bullHeadCaboshed: {
    colors: 2,
  },
  bullPassant: {
    colors: 3,
    sinister: true,
  },
  butterfly: {
    colors: 3,
    reversed: true,
  },
  camel: {
    colors: 2,
    sinister: true,
  },
  cancer: {
    reversed: true,
  },
  cannon: {
    colors: 2,
    sinister: true,
  },
  caravel: {
    colors: 3,
    sinister: true,
  },
  castle: {
    colors: 2,
  },
  castle2: {
    colors: 3,
  },
  catPassantGuardant: {
    colors: 2,
    sinister: true,
  },
  cavalier: {
    colors: 3,
    sinister: true,
    positions: { e: 1 },
  },
  centaur: {
    colors: 3,
    sinister: true,
  },
  chalice: {
    colors: 2,
  },
  cinquefoil: {
    reversed: true,
  },
  cock: {
    colors: 3,
    sinister: true,
  },
  comet: {
    reversed: true,
  },
  cowStatant: {
    colors: 3,
    sinister: true,
  },
  cossack: {
    colors: 3,
    sinister: true,
  },
  crescent: {
    reversed: true,
  },
  crocodile: {
    colors: 2,
    sinister: true,
  },
  crosier: {
    sinister: true,
  },
  crossbow: {
    colors: 3,
    sinister: true,
  },
  crossGamma: {
    sinister: true,
  },
  crossLatin: {
    reversed: true,
  },
  crossTau: {
    reversed: true,
  },
  crossTriquetra: {
    reversed: true,
  },
  crown: {
    colors: 2,
    positions: {
      e: 10,
      abcdefgzi: 1,
      beh: 3,
      behdf: 2,
      acegi: 1,
      kn: 1,
      pq: 2,
      abc: 1,
      jln: 4,
      jleh: 1,
      def: 2,
      abcpqh: 3,
    },
  },
  crown2: {
    colors: 3,
    positions: {
      e: 10,
      abcdefgzi: 1,
      beh: 3,
      behdf: 2,
      acegi: 1,
      kn: 1,
      pq: 2,
      abc: 1,
      jln: 4,
      jleh: 1,
      def: 2,
      abcpqh: 3,
    },
  },
  deerHeadCaboshed: {
    colors: 2,
  },
  dolphin: {
    colors: 2,
    sinister: true,
  },
  donkeyHeadCaboshed: {
    colors: 2,
  },
  dove: {
    colors: 2,
    natural: "argent",
    sinister: true,
  },
  doveDisplayed: {
    colors: 2,
    natural: "argent",
    sinister: true,
  },
  dragonfly: {
    colors: 2,
    reversed: true,
  },
  dragonPassant: {
    colors: 3,
    sinister: true,
  },
  dragonRampant: {
    colors: 3,
    sinister: true,
  },
  drakkar: {
    colors: 3,
    sinister: true,
  },
  drawingCompass: {
    sinister: true,
  },
  drum: {
    colors: 3,
  },
  duck: {
    colors: 3,
    sinister: true,
  },
  eagle: {
    colors: 3,
    sinister: true,
    positions: { e: 15, beh: 1, kn: 1, abc: 1, jlh: 2, def: 2, pq: 1 },
  },
  eagleTwoHeads: {
    colors: 3,
  },
  elephant: {
    colors: 2,
    sinister: true,
  },
  elephantHeadErased: {
    colors: 2,
    sinister: true,
  },
  falchion: {
    colors: 2,
    reversed: true,
  },
  falcon: {
    colors: 3,
    sinister: true,
  },
  fan: {
    colors: 2,
    reversed: true,
  },
  fasces: {
    colors: 3,
    sinister: true,
  },
  feather: {
    sinister: true,
  },
  flamberge: {
    colors: 2,
    reversed: true,
  },
  flangedMace: {
    reversed: true,
  },
  fly: {
    colors: 3,
    reversed: true,
  },
  foot: {
    sinister: true,
  },
  fountain: {
    natural: "azure",
  },
  frog: {
    reversed: true,
  },
  garb: {
    colors: 2,
    natural: "or",
    positions: {
      e: 1,
      def: 3,
      abc: 2,
      beh: 1,
      kn: 1,
      jln: 3,
      jleh: 1,
      abcpqh: 1,
      joe: 1,
      lme: 1,
    },
  },
  gauntlet: {
    sinister: true,
    reversed: true,
  },
  goat: {
    colors: 3,
    sinister: true,
  },
  goutte: {
    reversed: true,
  },
  grapeBunch: {
    colors: 3,
    sinister: true,
  },
  grapeBunch2: {
    colors: 3,
    sinister: true,
  },
  grenade: {
    colors: 2,
  },
  greyhoundCourant: {
    colors: 3,
    sinister: true,
    positions: { e: 10, def: 1, abc: 1, bdefh: 1, jlh: 1, abcpqh: 1 },
  },
  greyhoundRampant: {
    colors: 2,
    sinister: true,
    positions: { e: 10, def: 1, abc: 1, bdefh: 1, jlh: 1, abcpqh: 1 },
  },
  greyhoundSejant: {
    colors: 3,
    sinister: true,
  },
  griffinPassant: {
    colors: 3,
    sinister: true,
    positions: { e: 10, def: 2, abc: 2, bdefh: 1, kn: 1, jlh: 2, abcpqh: 1 },
  },
  griffinRampant: {
    colors: 3,
    sinister: true,
    positions: { e: 10, def: 1, abc: 1, bdefh: 1, jlh: 1, abcpqh: 1 },
  },
  hand: {
    sinister: true,
    reversed: true,
    positions: { e: 10, jln: 2, kn: 1, jeo: 1, abc: 2, pqe: 1 },
  },
  harp: {
    colors: 2,
    sinister: true,
  },
  hatchet: {
    colors: 2,
    sinister: true,
  },
  head: {
    colors: 2,
    sinister: true,
    positions: { e: 1 },
  },
  headWreathed: {
    colors: 3,
    sinister: true,
    positions: { e: 1 },
  },
  hedgehog: {
    colors: 3,
    sinister: true,
  },
  helmet: {
    sinister: true,
  },
  helmetCorinthian: {
    colors: 3,
    sinister: true,
  },
  helmetGreat: {
    sinister: true,
  },
  helmetZischagge: {
    sinister: true,
  },
  heron: {
    colors: 2,
    sinister: true,
  },
  hindStatant: {
    colors: 2,
    sinister: true,
  },
  hook: {
    sinister: true,
  },
  horseHeadCouped: {
    sinister: true,
  },
  horsePassant: {
    colors: 2,
    sinister: true,
  },
  horseRampant: {
    colors: 3,
    sinister: true,
  },
  horseSalient: {
    colors: 2,
    sinister: true,
  },
  horseshoe: {
    reversed: true,
  },
  hourglass: {
    colors: 3,
  },
  ladybird: {
    colors: 3,
    reversed: true,
  },
  lamb: {
    colors: 2,
    sinister: true,
  },
  lambPassantReguardant: {
    colors: 2,
    sinister: true,
  },
  lanceWithBanner: {
    colors: 3,
    sinister: true,
  },
  laurelWreath: {
    colors: 2,
  },
  lighthouse: {
    colors: 3,
  },
  lionHeadCaboshed: {
    colors: 2,
  },
  lionHeadErased: {
    colors: 2,
    sinister: true,
  },
  lionPassant: {
    colors: 3,
    sinister: true,
    positions: { e: 10, def: 1, abc: 1, bdefh: 1, jlh: 1, abcpqh: 1 },
  },
  lionPassantGuardant: {
    colors: 3,
    sinister: true,
  },
  lionRampant: {
    colors: 3,
    sinister: true,
    positions: { e: 10, def: 2, abc: 2, bdefh: 1, kn: 1, jlh: 2, abcpqh: 1 },
  },
  lionSejant: {
    colors: 3,
    sinister: true,
  },
  lizard: {
    reversed: true,
  },
  lochaberAxe: {
    colors: 2,
    sinister: true,
  },
  log: {
    sinister: true,
  },
  lute: {
    colors: 2,
    sinister: true,
  },
  lymphad: {
    colors: 3,
    sinister: true,
    positions: { e: 1 },
  },
  mace: {
    colors: 2,
  },
  maces: {
    colors: 2,
  },
  mallet: {
    colors: 2,
  },
  mantle: {
    colors: 3,
  },
  martenCourant: {
    colors: 3,
    sinister: true,
  },
  mascle: {
    positions: {
      e: 15,
      abcdefgzi: 3,
      beh: 3,
      bdefh: 4,
      acegi: 1,
      kn: 3,
      joe: 2,
      abc: 3,
      jlh: 8,
      jleh: 1,
      df: 3,
      abcpqh: 4,
      pqe: 3,
      eknpq: 3,
    },
  },
  mastiffStatant: {
    colors: 3,
    sinister: true,
  },
  mitre: {
    colors: 3,
  },
  monk: {
    sinister: true,
  },
  moonInCrescent: {
    sinister: true,
  },
  mullet: {
    reversed: true,
  },
  mullet7: {
    reversed: true,
  },
  oak: {
    colors: 3,
  },
  orb: {
    colors: 3,
  },
  ouroboros: {
    sinister: true,
  },
  owl: {
    colors: 2,
    sinister: true,
  },
  owlDisplayed: {
    colors: 2,
  },
  palmTree: {
    colors: 3,
  },
  parrot: {
    colors: 2,
    sinister: true,
  },
  peacock: {
    colors: 3,
    sinister: true,
  },
  peacockInPride: {
    colors: 3,
    sinister: true,
  },
  pear: {
    colors: 2,
  },
  pegasus: {
    colors: 3,
    sinister: true,
  },
  pike: {
    colors: 2,
    sinister: true,
  },
  pineTree: {
    colors: 2,
  },
  plaice: {
    colors: 2,
    sinister: true,
  },
  plough: {
    colors: 2,
    sinister: true,
  },
  ploughshare: {
    sinister: true,
  },
  porcupine: {
    colors: 2,
    sinister: true,
  },
  portcullis: {
    colors: 2,
  },
  rabbitSejant: {
    colors: 2,
    sinister: true,
  },
  rake: {
    reversed: true,
  },
  rapier: {
    colors: 2,
    sinister: true,
    reversed: true,
  },
  ramHeadErased: {
    colors: 3,
    sinister: true,
  },
  ramPassant: {
    colors: 3,
    sinister: true,
  },
  ratRampant: {
    colors: 2,
    sinister: true,
  },
  raven: {
    colors: 2,
    natural: "sable",
    sinister: true,
    positions: { e: 15, beh: 1, kn: 1, jeo: 1, abc: 3, jln: 3, def: 1 },
  },
  rhinoceros: {
    colors: 2,
    sinister: true,
  },
  rose: {
    colors: 3,
  },
  sabre: {
    colors: 2,
    sinister: true,
  },
  sabre2: {
    colors: 2,
    sinister: true,
    reversed: true,
  },
  sabresCrossed: {
    colors: 2,
    reversed: true,
  },
  sagittarius: {
    colors: 3,
    sinister: true,
  },
  salmon: {
    colors: 2,
    sinister: true,
  },
  saw: {
    colors: 2,
  },
  scale: {
    colors: 2,
  },
  scaleImbalanced: {
    colors: 2,
    sinister: true,
  },
  scissors: {
    reversed: true,
  },
  scorpion: {
    reversed: true,
  },
  scrollClosed: {
    colors: 2,
    sinister: true,
  },
  scythe: {
    colors: 2,
    sinister: true,
    reversed: true,
  },
  scythe2: {
    sinister: true,
  },
  serpent: {
    colors: 2,
    sinister: true,
  },
  shield: {
    colors: 2,
    sinister: true,
  },
  sickle: {
    colors: 2,
    sinister: true,
    reversed: true,
  },
  snail: {
    colors: 2,
    sinister: true,
  },
  snake: {
    colors: 2,
    sinister: true,
  },
  spear: {
    colors: 2,
    reversed: true,
  },
  spiral: {
    sinister: true,
    reversed: true,
  },
  squirrel: {
    sinister: true,
  },
  stagLodgedRegardant: {
    colors: 3,
    sinister: true,
  },
  stagPassant: {
    colors: 2,
    sinister: true,
  },
  stirrup: {
    colors: 2,
  },
  swallow: {
    colors: 2,
    sinister: true,
  },
  swan: {
    colors: 3,
    sinister: true,
  },
  swanErased: {
    colors: 3,
    sinister: true,
  },
  sword: {
    colors: 2,
    reversed: true,
  },
  talbotPassant: {
    colors: 3,
    sinister: true,
  },
  talbotSejant: {
    colors: 3,
    sinister: true,
  },
  tower: {
    colors: 2,
  },
  tree: {
    positions: { e: 1 },
  },
  trefoil: {
    reversed: true,
  },
  trowel: {
    colors: 2,
    sinister: true,
    reversed: true,
  },
  unicornRampant: {
    colors: 3,
    sinister: true,
  },
  wasp: {
    colors: 3,
    reversed: true,
  },
  wheatStalk: {
    colors: 2,
  },
  windmill: {
    colors: 3,
    sinister: true,
  },
  wing: {
    sinister: true,
  },
  wingSword: {
    colors: 3,
    sinister: true,
  },
  wolfHeadErased: {
    colors: 2,
    sinister: true,
  },
  wolfPassant: {
    colors: 3,
    sinister: true,
    positions: { e: 10, def: 1, abc: 1, bdefh: 1, jlh: 1, abcpqh: 1 },
  },
  wolfRampant: {
    colors: 3,
    sinister: true,
  },
  wolfStatant: {
    colors: 3,
    sinister: true,
  },
  wyvern: {
    colors: 3,
    sinister: true,
    positions: { e: 10, jln: 1 },
  },
  wyvernWithWingsDisplayed: {
    colors: 3,
    sinister: true,
  },
};
