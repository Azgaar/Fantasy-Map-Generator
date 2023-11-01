"use strict";

window.COA = (function () {
  const tinctures = {
    field: {metals: 3, colours: 4, stains: +P(0.03), patterns: 1},
    division: {metals: 5, colours: 8, stains: +P(0.03), patterns: 1},
    charge: {metals: 2, colours: 3, stains: +P(0.05), patterns: 0},
    metals: {argent: 3, or: 2},
    colours: {gules: 5, azure: 4, sable: 3, purpure: 3, vert: 2},
    stains: {murrey: 1, sanguine: 1, tenné: 1},
    patterns: {
      semy: 8,
      ermine: 6,
      vair: 4,
      counterVair: 1,
      vairInPale: 1,
      vairEnPointe: 2,
      vairAncien: 2,
      potent: 2,
      counterPotent: 1,
      potentInPale: 1,
      potentEnPointe: 1,
      chequy: 8,
      lozengy: 5,
      fusily: 2,
      pally: 8,
      barry: 10,
      gemelles: 1,
      bendy: 8,
      bendySinister: 4,
      palyBendy: 2,
      barryBendy: 1,
      pappellony: 2,
      pappellony2: 3,
      scaly: 1,
      plumetty: 1,
      masoned: 6,
      fretty: 3,
      grillage: 1,
      chainy: 1,
      maily: 2,
      honeycombed: 1
    }
  };

  const chargeData = {
    agnusDei: {
      colors: 2,
      sinister: true
    },
    angel: {
      colors: 2,
      positions: {e: 1}
    },
    anvil: {
      sinister: true
    },
    apple: {
      colors: 2
    },
    arbalest: {
      colors: 3,
      reversed: true
    },
    archer: {
      colors: 3,
      sinister: true
    },
    armEmbowedHoldingSabre: {
      colors: 3,
      sinister: true
    },
    armEmbowedVambraced: {
      sinister: true
    },
    armEmbowedVambracedHoldingSword: {
      colors: 3,
      sinister: true
    },
    armillarySphere: {
      positions: {e: 1}
    },
    arrow: {
      colors: 3,
      reversed: true
    },
    arrowsSheaf: {
      colors: 3,
      reversed: true
    },
    axe: {
      colors: 2,
      sinister: true
    },
    badgerStatant: {
      colors: 2,
      sinister: true
    },
    banner: {
      colors: 2
    },
    basilisk: {
      colors: 3,
      sinister: true
    },
    bearPassant: {
      colors: 3,
      sinister: true
    },
    bearRampant: {
      colors: 3,
      sinister: true
    },
    bee: {
      colors: 3,
      reversed: true
    },
    bell: {
      colors: 2
    },
    boarHeadErased: {
      colors: 3,
      sinister: true
    },
    boarRampant: {
      colors: 3,
      sinister: true,
      positions: {e: 12, beh: 1, kn: 1, jln: 2}
    },
    boat: {
      colors: 2
    },
    bookClosed: {
      colors: 3,
      sinister: true
    },
    bookClosed2: {
      sinister: true
    },
    bookOpen: {
      colors: 3
    },
    bow: {
      sinister: true
    },
    bowWithArrow: {
      colors: 3,
      reversed: true
    },
    bowWithThreeArrows: {
      colors: 3
    },
    bucket: {
      colors: 2
    },
    bugleHorn: {
      colors: 2
    },
    bugleHorn2: {
      colors: 2
    },
    bullHeadCaboshed: {
      colors: 2
    },
    bullPassant: {
      colors: 3,
      sinister: true
    },
    butterfly: {
      colors: 3,
      reversed: true
    },
    camel: {
      colors: 2,
      sinister: true
    },
    cancer: {
      reversed: true
    },
    cannon: {
      colors: 2,
      sinister: true
    },
    caravel: {
      colors: 3,
      sinister: true
    },
    castle: {
      colors: 2
    },
    castle2: {
      colors: 3
    },
    catPassantGuardant: {
      colors: 2,
      sinister: true
    },
    cavalier: {
      colors: 3,
      sinister: true,
      positions: {e: 1}
    },
    centaur: {
      colors: 3,
      sinister: true
    },
    chalice: {
      colors: 2
    },
    cinquefoil: {
      reversed: true
    },
    cock: {
      colors: 3,
      sinister: true
    },
    comet: {
      reversed: true
    },
    cowStatant: {
      colors: 3,
      sinister: true
    },
    cossack: {
      colors: 3,
      sinister: true
    },
    crescent: {
      reversed: true
    },
    crocodile: {
      colors: 2,
      sinister: true
    },
    crosier: {
      sinister: true
    },
    crossbow: {
      colors: 3,
      sinister: true
    },
    crossGamma: {
      sinister: true
    },
    crossLatin: {
      reversed: true
    },
    crossTau: {
      reversed: true
    },
    crossTriquetra: {
      reversed: true
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
        abcpqh: 3
      }
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
        abcpqh: 3
      }
    },
    deerHeadCaboshed: {
      colors: 2
    },
    dolphin: {
      colors: 2,
      sinister: true
    },
    donkeyHeadCaboshed: {
      colors: 2
    },
    dove: {
      colors: 2,
      natural: "argent",
      sinister: true
    },
    doveDisplayed: {
      colors: 2,
      natural: "argent",
      sinister: true
    },
    dragonfly: {
      colors: 2,
      reversed: true
    },
    dragonPassant: {
      colors: 3,
      sinister: true
    },
    dragonRampant: {
      colors: 3,
      sinister: true
    },
    drakkar: {
      colors: 3,
      sinister: true
    },
    drawingCompass: {
      sinister: true
    },
    drum: {
      colors: 3
    },
    duck: {
      colors: 3,
      sinister: true
    },
    eagle: {
      colors: 3,
      sinister: true,
      positions: {e: 15, beh: 1, kn: 1, abc: 1, jlh: 2, def: 2, pq: 1}
    },
    eagleTwoHeads: {
      colors: 3
    },
    elephant: {
      colors: 2,
      sinister: true
    },
    elephantHeadErased: {
      colors: 2,
      sinister: true
    },
    falchion: {
      colors: 2,
      reversed: true
    },
    falcon: {
      colors: 3,
      sinister: true
    },
    fan: {
      colors: 2,
      reversed: true
    },
    fasces: {
      colors: 3,
      sinister: true
    },
    feather: {
      sinister: true
    },
    flamberge: {
      colors: 2,
      reversed: true
    },
    flangedMace: {
      reversed: true
    },
    fly: {
      colors: 3,
      reversed: true
    },
    foot: {
      sinister: true
    },
    fountain: {
      natural: "azure"
    },
    frog: {
      reversed: true
    },
    garb: {
      colors: 2,
      natural: "or",
      positions: {e: 1, def: 3, abc: 2, beh: 1, kn: 1, jln: 3, jleh: 1, abcpqh: 1, joe: 1, lme: 1}
    },
    gauntlet: {
      sinister: true,
      reversed: true
    },
    goat: {
      colors: 3,
      sinister: true
    },
    goutte: {
      reversed: true
    },
    grapeBunch: {
      colors: 3,
      sinister: true
    },
    grapeBunch2: {
      colors: 3,
      sinister: true
    },
    grenade: {
      colors: 2
    },
    greyhoundCourant: {
      colors: 3,
      sinister: true,
      positions: {e: 10, def: 1, abc: 1, bdefh: 1, jlh: 1, abcpqh: 1}
    },
    greyhoundRampant: {
      colors: 2,
      sinister: true,
      positions: {e: 10, def: 1, abc: 1, bdefh: 1, jlh: 1, abcpqh: 1}
    },
    greyhoundSejant: {
      colors: 3,
      sinister: true
    },
    griffinPassant: {
      colors: 3,
      sinister: true,
      positions: {e: 10, def: 2, abc: 2, bdefh: 1, kn: 1, jlh: 2, abcpqh: 1}
    },
    griffinRampant: {
      colors: 3,
      sinister: true,
      positions: {e: 10, def: 1, abc: 1, bdefh: 1, jlh: 1, abcpqh: 1}
    },
    hand: {
      sinister: true,
      reversed: true,
      positions: {e: 10, jln: 2, kn: 1, jeo: 1, abc: 2, pqe: 1}
    },
    harp: {
      colors: 2,
      sinister: true
    },
    hatchet: {
      colors: 2,
      sinister: true
    },
    head: {
      colors: 2,
      sinister: true,
      positions: {e: 1}
    },
    headWreathed: {
      colors: 3,
      sinister: true,
      positions: {e: 1}
    },
    hedgehog: {
      colors: 3,
      sinister: true
    },
    helmet: {
      sinister: true
    },
    helmetCorinthian: {
      colors: 3,
      sinister: true
    },
    helmetGreat: {
      sinister: true
    },
    helmetZischagge: {
      sinister: true
    },
    heron: {
      colors: 2,
      sinister: true
    },
    hindStatant: {
      colors: 2,
      sinister: true
    },
    hook: {
      sinister: true
    },
    horseHeadCouped: {
      sinister: true
    },
    horsePassant: {
      colors: 2,
      sinister: true
    },
    horseRampant: {
      colors: 3,
      sinister: true
    },
    horseSalient: {
      colors: 2,
      sinister: true
    },
    horseshoe: {
      reversed: true
    },
    hourglass: {
      colors: 3
    },
    ladybird: {
      colors: 3,
      reversed: true
    },
    lamb: {
      colors: 2,
      sinister: true
    },
    lambPassantReguardant: {
      colors: 2,
      sinister: true
    },
    lanceWithBanner: {
      colors: 3,
      sinister: true
    },
    laurelWreath: {
      colors: 2
    },
    lighthouse: {
      colors: 3
    },
    lionHeadCaboshed: {
      colors: 2
    },
    lionHeadErased: {
      colors: 2,
      sinister: true
    },
    lionPassant: {
      colors: 3,
      sinister: true,
      positions: {e: 10, def: 1, abc: 1, bdefh: 1, jlh: 1, abcpqh: 1}
    },
    lionPassantGuardant: {
      colors: 3,
      sinister: true
    },
    lionRampant: {
      colors: 3,
      sinister: true,
      positions: {e: 10, def: 2, abc: 2, bdefh: 1, kn: 1, jlh: 2, abcpqh: 1}
    },
    lionSejant: {
      colors: 3,
      sinister: true
    },
    lizard: {
      reversed: true
    },
    lochaberAxe: {
      colors: 2,
      sinister: true
    },
    log: {
      sinister: true
    },
    lute: {
      colors: 2,
      sinister: true
    },
    lymphad: {
      colors: 3,
      sinister: true,
      positions: {e: 1}
    },
    mace: {
      colors: 2
    },
    maces: {
      colors: 2
    },
    mallet: {
      colors: 2
    },
    mantle: {
      colors: 3
    },
    martenCourant: {
      colors: 3,
      sinister: true
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
        eknpq: 3
      }
    },
    mastiffStatant: {
      colors: 3,
      sinister: true
    },
    mitre: {
      colors: 3
    },
    monk: {
      sinister: true
    },
    moonInCrescent: {
      sinister: true
    },
    mullet: {
      reversed: true
    },
    mullet7: {
      reversed: true
    },
    oak: {
      colors: 3
    },
    orb: {
      colors: 3
    },
    ouroboros: {
      sinister: true
    },
    owl: {
      colors: 2,
      sinister: true
    },
    owlDisplayed: {
      colors: 2
    },
    palmTree: {
      colors: 3
    },
    parrot: {
      colors: 2,
      sinister: true
    },
    peacock: {
      colors: 3,
      sinister: true
    },
    peacockInPride: {
      colors: 3,
      sinister: true
    },
    pear: {
      colors: 2
    },
    pegasus: {
      colors: 3,
      sinister: true
    },
    pike: {
      colors: 2,
      sinister: true
    },
    pineTree: {
      colors: 2
    },
    plaice: {
      colors: 2,
      sinister: true
    },
    plough: {
      colors: 2,
      sinister: true
    },
    ploughshare: {
      sinister: true
    },
    porcupine: {
      colors: 2,
      sinister: true
    },
    portcullis: {
      colors: 2
    },
    rabbitSejant: {
      colors: 2,
      sinister: true
    },
    rake: {
      reversed: true
    },
    rapier: {
      colors: 2,
      sinister: true,
      reversed: true
    },
    ramHeadErased: {
      colors: 3,
      sinister: true
    },
    ramPassant: {
      colors: 3,
      sinister: true
    },
    ratRampant: {
      colors: 2,
      sinister: true
    },
    raven: {
      colors: 2,
      natural: "sable",
      sinister: true,
      positions: {e: 15, beh: 1, kn: 1, jeo: 1, abc: 3, jln: 3, def: 1}
    },
    rhinoceros: {
      colors: 2,
      sinister: true
    },
    rose: {
      colors: 3
    },
    sabre: {
      colors: 2,
      sinister: true
    },
    sabre2: {
      colors: 2,
      sinister: true,
      reversed: true
    },
    sabresCrossed: {
      colors: 2,
      reversed: true
    },
    sagittarius: {
      colors: 3,
      sinister: true
    },
    salmon: {
      colors: 2,
      sinister: true
    },
    saw: {
      colors: 2
    },
    scale: {
      colors: 2
    },
    scaleImbalanced: {
      colors: 2,
      sinister: true
    },
    scissors: {
      reversed: true
    },
    scorpion: {
      reversed: true
    },
    scrollClosed: {
      colors: 2,
      sinister: true
    },
    scythe: {
      colors: 2,
      sinister: true,
      reversed: true
    },
    scythe2: {
      sinister: true
    },
    serpent: {
      colors: 2,
      sinister: true
    },
    shield: {
      colors: 2,
      sinister: true
    },
    sickle: {
      colors: 2,
      sinister: true,
      reversed: true
    },
    snail: {
      colors: 2,
      sinister: true
    },
    snake: {
      colors: 2,
      sinister: true
    },
    spear: {
      colors: 2,
      reversed: true
    },
    spiral: {
      sinister: true,
      reversed: true
    },
    squirrel: {
      sinister: true
    },
    stagLodgedRegardant: {
      colors: 3,
      sinister: true
    },
    stagPassant: {
      colors: 2,
      sinister: true
    },
    stirrup: {
      colors: 2
    },
    swallow: {
      colors: 2,
      sinister: true
    },
    swan: {
      colors: 3,
      sinister: true
    },
    swanErased: {
      colors: 3,
      sinister: true
    },
    sword: {
      colors: 2,
      reversed: true
    },
    talbotPassant: {
      colors: 3,
      sinister: true
    },
    talbotSejant: {
      colors: 3,
      sinister: true
    },
    tower: {
      colors: 2
    },
    tree: {
      positions: {e: 1}
    },
    trefoil: {
      reversed: true
    },
    trowel: {
      colors: 2,
      sinister: true,
      reversed: true
    },
    unicornRampant: {
      colors: 3,
      sinister: true
    },
    wasp: {
      colors: 3,
      reversed: true
    },
    wheatStalk: {
      colors: 2
    },
    windmill: {
      colors: 3,
      sinister: true
    },
    wing: {
      sinister: true
    },
    wingSword: {
      colors: 3,
      sinister: true
    },
    wolfHeadErased: {
      colors: 2,
      sinister: true
    },
    wolfPassant: {
      colors: 3,
      sinister: true,
      positions: {e: 10, def: 1, abc: 1, bdefh: 1, jlh: 1, abcpqh: 1}
    },
    wolfRampant: {
      colors: 3,
      sinister: true
    },
    wolfStatant: {
      colors: 3,
      sinister: true
    },
    wyvern: {
      colors: 3,
      sinister: true,
      positions: {e: 10, jln: 1}
    },
    wyvernWithWingsDisplayed: {
      colors: 3,
      sinister: true
    }
  };

  const charges = {
    types: {
      conventional: 33, // 40 charges
      crosses: 13, // 30 charges
      beasts: 7, // 41 charges
      beastHeads: 3, // 10 charges
      birds: 3, // 16 charges
      reptiles: 2, // 5 charges
      bugs: 2, // 8 charges
      fishes: 1, // 3 charges
      molluscs: 1, // 2 charges
      plants: 3, // 18 charges
      fantastic: 5, // 14 charges
      agriculture: 2, // 8 charges
      arms: 5, // 32 charges
      bodyparts: 2, // 12 charges
      people: 2, // 4 charges
      architecture: 3, // 11 charges
      seafaring: 3, // 9 charges
      tools: 3, // 15 charges
      miscellaneous: 5, // 30 charges
      inescutcheon: 3, // 43 charges
      ornaments: 0, // 9 charges
      uploaded: 0
    },
    typesNature: {
      simpleShapes: 1,
      beasts: 7,
      beastHeads: 3,
      birds: 3,
      reptiles: 2,
      bugs: 2,
      fishes: 1,
      molluscs: 1,
      plants: 3,
      fantastic: 5,
      inescutcheon: 1
    },
    typesNatureAndThings: {
      simpleShapes: 2,
      beasts: 7,
      beastHeads: 3,
      birds: 3,
      reptiles: 2,
      bugs: 2,
      fishes: 1,
      molluscs: 1,
      plants: 3,
      fantastic: 5,
      agriculture: 2,
      arms: 5,
      architecture: 3,
      seafaring: 3,
      tools: 3,
      miscellaneous: 5,
      inescutcheon: 1
    },
    typesThings: {
      simpleShapes: 3,
      agriculture: 2,
      arms: 8,
      architecture: 3,
      seafaring: 3,
      tools: 5,
      miscellaneous: 5,
      inescutcheon: 1
    },
    typesLimited: {
      conventional: 33,
      beasts: 7,
      beastHeads: 3,
      birds: 3,
      reptiles: 2,
      bugs: 2,
      fishes: 1,
      molluscs: 1,
      plants: 3,
      fantastic: 5,
      agriculture: 2,
      arms: 5,
      architecture: 3,
      seafaring: 3,
      tools: 3,
      miscellaneous: 5,
      inescutcheon: 3
    },
    typesShapes: {
      simpleShapes: 1
    },
    single: {
      conventional: 10,
      crosses: 8,
      beasts: 7,
      beastHeads: 3,
      birds: 3,
      reptiles: 2,
      bugs: 2,
      fishes: 1,
      molluscs: 1,
      plants: 3,
      fantastic: 5,
      agriculture: 2,
      arms: 5,
      bodyparts: 2,
      people: 2,
      architecture: 3,
      seafaring: 3,
      tools: 3,
      miscellaneous: 5,
      inescutcheon: 1
    },
    semy: {
      conventional: 4,
      crosses: 1
    },
    singleNature: {
      simpleShapes: 1,
      beasts: 7,
      beastHeads: 3,
      birds: 3,
      reptiles: 2,
      bugs: 2,
      fishes: 1,
      molluscs: 1,
      plants: 3,
      fantastic: 5,
      inescutcheon: 1
    },
    singleNatureAndThings: {
      simpleShapes: 2,
      beasts: 7,
      beastHeads: 3,
      birds: 3,
      reptiles: 2,
      bugs: 2,
      fishes: 1,
      molluscs: 1,
      plants: 3,
      fantastic: 5,
      agriculture: 2,
      arms: 5,
      architecture: 3,
      seafaring: 3,
      tools: 3,
      miscellaneous: 5,
      inescutcheon: 1
    },
    singleThings: {
      simpleShapes: 3,
      agriculture: 2,
      arms: 5,
      architecture: 3,
      seafaring: 3,
      tools: 3,
      miscellaneous: 5,
      inescutcheon: 1
    },
    singleLimited: {
      conventional: 12,
      beasts: 7,
      beastHeads: 3,
      birds: 3,
      reptiles: 2,
      bugs: 2,
      fishes: 1,
      molluscs: 1,
      plants: 3,
      fantastic: 5,
      agriculture: 2,
      arms: 5,
      architecture: 3,
      seafaring: 3,
      tools: 3,
      miscellaneous: 5,
      inescutcheon: 1
    },
    singleShapes: {
      simpleShapes: 1
    },
    semy: {conventional: 4, crosses: 1},
    semyLimited: {conventional: 1},
    semyShapes: {simpleShapes: 1},
    simpleShapes: {
      lozenge: 2,
      fusil: 8,
      mascle: 5,
      rustre: 3,
      lozengePloye: 1,
      roundel: 10,
      annulet: 7,
      mullet: 4,
      mulletPierced: 1,
      mullet4: 5,
      mullet6: 4,
      mullet6Pierced: 1,
      mullet7: 1,
      mullet8: 5,
      billet: 1,
      delf: 8,
      triangle: 8,
      trianglePierced: 4,
      carreau: 1,
      spiral: 1
    },
    conventional: {
      annulet: 4,
      billet: 3,
      carreau: 1,
      comet: 1,
      compassRose: 1,
      crescent: 5,
      delf: 3,
      estoile: 1,
      fleurDeLis: 6,
      fountain: 1,
      fusil: 4,
      gear: 1,
      goutte: 4,
      heart: 4,
      lozenge: 2,
      lozengeFaceted: 3,
      lozengePloye: 1,
      mascle: 4,
      moonInCrescent: 1,
      mullet: 5,
      mullet10: 1,
      mullet4: 3,
      mullet6: 4,
      mullet6Faceted: 1,
      mullet6Pierced: 1,
      mullet7: 1,
      mullet8: 1,
      mulletFaceted: 1,
      mulletPierced: 1,
      pique: 2,
      roundel: 4,
      roundel2: 3,
      rustre: 2,
      spiral: 1,
      sun: 3,
      sunInSplendour: 1,
      sunInSplendour2: 1,
      trefle: 2,
      triangle: 3,
      trianglePierced: 1
    },
    crosses: {
      crossHummetty: 15,
      crossVoided: 1,
      crossPattee: 2,
      crossPatteeAlisee: 1,
      crossFormee: 1,
      crossFormee2: 2,
      crossPotent: 2,
      crossJerusalem: 1,
      crosslet: 1,
      crossClechy: 3,
      crossBottony: 1,
      crossFleury: 3,
      crossPatonce: 1,
      crossPommy: 1,
      crossGamma: 1,
      crossArrowed: 1,
      crossFitchy: 1,
      crossCercelee: 1,
      crossMoline: 2,
      crossFourchy: 1,
      crossAvellane: 1,
      crossErminee: 1,
      crossBiparted: 1,
      crossMaltese: 3,
      crossTemplar: 2,
      crossCeltic: 1,
      crossCeltic2: 1,
      crossTriquetra: 1,
      crossCarolingian: 1,
      crossOccitan: 1,
      crossSaltire: 3,
      crossBurgundy: 1,
      crossLatin: 3,
      crossPatriarchal: 1,
      crossOrthodox: 1,
      crossCalvary: 1,
      crossDouble: 1,
      crossTau: 1,
      crossSantiago: 1,
      crossAnkh: 1
    },
    beasts: {
      agnusDei: 1,
      badgerStatant: 1,
      bearPassant: 1,
      bearRampant: 3,
      boarRampant: 1,
      bullPassant: 1,
      camel: 1,
      catPassantGuardant: 1,
      cowStatant: 1,
      dolphin: 1,
      elephant: 1,
      goat: 1,
      greyhoundCourant: 1,
      greyhoundRampant: 1,
      greyhoundSejant: 1,
      hedgehog: 1,
      hindStatant: 1,
      horsePassant: 1,
      horseRampant: 2,
      horseSalient: 1,
      lamb: 1,
      lambPassantReguardant: 1,
      lionPassant: 3,
      lionPassantGuardant: 2,
      lionRampant: 7,
      lionSejant: 2,
      martenCourant: 1,
      mastiffStatant: 1,
      porcupine: 1,
      rabbitSejant: 1,
      ramPassant: 1,
      ratRampant: 1,
      rhinoceros: 1,
      squirrel: 1,
      stagLodgedRegardant: 1,
      stagPassant: 1,
      talbotPassant: 1,
      talbotSejant: 1,
      wolfPassant: 1,
      wolfRampant: 1,
      wolfStatant: 1
    },
    beastHeads: {
      boarHeadErased: 1,
      bullHeadCaboshed: 1,
      deerHeadCaboshed: 1,
      donkeyHeadCaboshed: 1,
      elephantHeadErased: 1,
      horseHeadCouped: 1,
      lionHeadCaboshed: 2,
      lionHeadErased: 2,
      ramHeadErased: 1,
      wolfHeadErased: 2
    },
    birds: {
      cock: 3,
      dove: 2,
      doveDisplayed: 1,
      duck: 1,
      eagle: 9,
      falcon: 2,
      heron: 1,
      owl: 1,
      owlDisplayed: 1,
      parrot: 1,
      peacock: 1,
      peacockInPride: 1,
      raven: 2,
      swallow: 1,
      swan: 2,
      swanErased: 1
    },
    reptiles: {
      crocodile: 1,
      frog: 1,
      lizard: 1,
      ouroboros: 1,
      snake: 1
    },
    bugs: {
      bee: 1,
      butterfly: 1,
      cancer: 1,
      dragonfly: 1,
      fly: 1,
      ladybird: 1,
      scorpion: 1,
      wasp: 1
    },
    fishes: {
      pike: 1,
      plaice: 1,
      salmon: 1
    },
    molluscs: {
      escallop: 4,
      snail: 1
    },
    plants: {
      apple: 1,
      cinquefoil: 1,
      earOfWheat: 1,
      grapeBunch: 1,
      grapeBunch2: 1,
      mapleLeaf: 1,
      oak: 1,
      palmTree: 1,
      pear: 1,
      pineCone: 1,
      pineTree: 1,
      quatrefoil: 1,
      rose: 1,
      sextifoil: 1,
      thistle: 1,
      tree: 1,
      trefoil: 1,
      wheatStalk: 1
    },
    fantastic: {
      angel: 3,
      basilisk: 1,
      centaur: 1,
      dragonPassant: 3,
      dragonRampant: 2,
      eagleTwoHeads: 2,
      griffinPassant: 1,
      griffinRampant: 2,
      pegasus: 1,
      sagittarius: 1,
      serpent: 1,
      unicornRampant: 1,
      wyvern: 1,
      wyvernWithWingsDisplayed: 1
    },
    agriculture: {
      garb: 2,
      millstone: 1,
      plough: 1,
      ploughshare: 1,
      rake: 1,
      scythe: 1,
      scythe2: 1,
      sickle: 1
    },
    arms: {
      arbalest: 1,
      arbalest2: 1,
      arrow: 1,
      arrowsSheaf: 1,
      axe: 3,
      bow: 1,
      bowWithArrow: 2,
      bowWithThreeArrows: 1,
      cannon: 1,
      falchion: 1,
      flamberge: 1,
      flangedMace: 1,
      gauntlet: 1,
      grenade: 1,
      hatchet: 3,
      helmet: 2,
      helmetCorinthian: 1,
      helmetGreat: 2,
      helmetZischagge: 1,
      lanceHead: 1,
      lanceWithBanner: 1,
      lochaberAxe: 1,
      mace: 1,
      maces: 1,
      mallet: 1,
      rapier: 1,
      sabre: 1,
      sabre2: 1,
      sabresCrossed: 1,
      shield: 1,
      spear: 1,
      sword: 4
    },
    bodyparts: {
      armEmbowedHoldingSabre: 1,
      armEmbowedVambraced: 1,
      armEmbowedVambracedHoldingSword: 1,
      bone: 1,
      crossedBones: 2,
      foot: 1,
      hand: 4,
      head: 1,
      headWreathed: 1,
      skeleton: 2,
      skull: 2,
      skull2: 1
    },
    people: {
      archer: 1,
      cavalier: 3,
      cossack: 1,
      monk: 1
    },
    architecture: {
      bridge: 1,
      bridge2: 1,
      castle: 2,
      castle2: 1,
      column: 1,
      lighthouse: 1,
      palace: 1,
      pillar: 1,
      portcullis: 1,
      tower: 2,
      windmill: 1
    },
    seafaring: {
      anchor: 6,
      armillarySphere: 1,
      boat: 2,
      boat2: 1,
      caravel: 1,
      drakkar: 1,
      lymphad: 2,
      raft: 1,
      shipWheel: 1
    },
    tools: {
      anvil: 2,
      drawingCompass: 2,
      fan: 1,
      hook: 1,
      ladder: 1,
      ladder2: 1,
      pincers: 1,
      saw: 1,
      scale: 1,
      scaleImbalanced: 1,
      scalesHanging: 1,
      scissors: 1,
      scissors2: 1,
      shears: 1,
      trowel: 1
    },
    miscellaneous: {
      attire: 2,
      banner: 2,
      bell: 3,
      bookClosed: 1,
      bookClosed2: 1,
      bookOpen: 1,
      bucket: 1,
      buckle: 1,
      bugleHorn: 2,
      bugleHorn2: 1,
      chain: 2,
      chalice: 2,
      cowHorns: 3,
      crosier: 1,
      crown: 3,
      crown2: 2,
      drum: 1,
      fasces: 1,
      feather: 3,
      harp: 2,
      horseshoe: 3,
      hourglass: 2,
      key: 3,
      laurelWreath: 2,
      laurelWreath2: 1,
      log: 1,
      lute: 2,
      lyre: 1,
      mitre: 1,
      orb: 1,
      pot: 2,
      ramsHorn: 1,
      sceptre: 1,
      scrollClosed: 1,
      snowflake: 1,
      stagsAttires: 1,
      stirrup: 2,
      wheel: 3,
      wing: 2,
      wingSword: 1
    },
    inescutcheon: {
      inescutcheonHeater: 1,
      inescutcheonSpanish: 1,
      inescutcheonFrench: 1,
      inescutcheonHorsehead: 1,
      inescutcheonHorsehead2: 1,
      inescutcheonPolish: 1,
      inescutcheonHessen: 1,
      inescutcheonSwiss: 1,
      inescutcheonBoeotian: 1,
      inescutcheonRoman: 1,
      inescutcheonKite: 1,
      inescutcheonOldFrench: 1,
      inescutcheonRenaissance: 1,
      inescutcheonBaroque: 1,
      inescutcheonTarge: 1,
      inescutcheonTarge2: 1,
      inescutcheonPavise: 1,
      inescutcheonWedged: 1,
      inescutcheonFlag: 1,
      inescutcheonPennon: 1,
      inescutcheonGuidon: 1,
      inescutcheonBanner: 1,
      inescutcheonDovetail: 1,
      inescutcheonGonfalon: 1,
      inescutcheonPennant: 1,
      inescutcheonRound: 1,
      inescutcheonOval: 1,
      inescutcheonVesicaPiscis: 1,
      inescutcheonSquare: 1,
      inescutcheonDiamond: 1,
      inescutcheonNo: 1,
      inescutcheonFantasy1: 1,
      inescutcheonFantasy2: 1,
      inescutcheonFantasy3: 1,
      inescutcheonFantasy4: 1,
      inescutcheonFantasy5: 1,
      inescutcheonNoldor: 1,
      inescutcheonGondor: 1,
      inescutcheonEasterling: 1,
      inescutcheonErebor: 1,
      inescutcheonIronHills: 1,
      inescutcheonUrukHai: 1,
      inescutcheonMoriaOrc: 1
    },
    ornaments: {
      mantle: 0,
      ribbon1: 3,
      ribbon2: 2,
      ribbon3: 1,
      ribbon4: 1,
      ribbon5: 1,
      ribbon6: 1,
      ribbon7: 1,
      ribbon8: 1
    },
    data: chargeData,
    excludeNoCharges: [
    ],
    excludeUnusualCharges: [
      "roundel2",
      "mulletFaceted",
      "mullet6Faceted",
      "compassRose",
      "heart",
      "trefle",
      "pique",
      "fleurDeLis",
      "sunInSplendour",
      "sunInSplendour2",
      "moonInCrescent",
      "fountain",
      "agnusDei",
      "crown2",
      "mitre",
      "orb",
      "fasces",
      "cannon",
      "angel",
      "centaur",
      "sagittarius"
    ],
    excludeThingCharges: [
      "garb",
      "millstone",
      "plough",
      "ploughshare",
      "rake",
      "scythe",
      "scythe2",
      "sickle",
      "arbalest",
      "arbalest2",
      "arrow",
      "arrowsSheaf",
      "axe",
      "bow",
      "bowWithArrow",
      "bowWithThreeArrows",
      "cannon",
      "falchion",
      "flamberge",
      "flangedMace",
      "gauntlet",
      "grenade",
      "hatchet",
      "helmet",
      "helmetCorinthian",
      "helmetGreat",
      "helmetZischagge",
      "lanceHead",
      "lanceWithBanner",
      "lochaberAxe",
      "mace",
      "maces",
      "mallet",
      "rapier",
      "sabre",
      "sabre2",
      "sabresCrossed",
      "shield",
      "spear",
      "sword",
      "bridge",
      "bridge2",
      "castle",
      "castle2",
      "column",
      "lighthouse",
      "palace",
      "pillar",
      "portcullis",
      "tower",
      "windmill",
      "anchor",
      "armillarySphere",
      "boat",
      "boat2",
      "caravel",
      "drakkar",
      "lymphad",
      "raft",
      "shipWheel",
      "anvil",
      "drawingCompass",
      "fan",
      "hook",
      "ladder",
      "ladder2",
      "pincers",
      "saw",
      "scale",
      "scaleImbalanced",
      "scalesHanging",
      "scissors",
      "scissors2",
      "shears",
      "trowel",
      "attire",
      "banner",
      "bell",
      "bookClosed",
      "bookClosed2",
      "bookOpen",
      "bucket",
      "buckle",
      "bugleHorn",
      "bugleHorn2",
      "chain",
      "chalice",
      "cowHorns",
      "crosier",
      "crown",
      "crown2",
      "drum",
      "fasces",
      "feather",
      "harp",
      "horseshoe",
      "hourglass",
      "key",
      "laurelWreath",
      "laurelWreath2",
      "log",
      "lute",
      "lyre",
      "mitre",
      "orb",
      "pot",
      "ramsHorn",
      "sceptre",
      "scrollClosed",
      "snowflake",
      "stagsAttires",
      "stirrup",
      "wheel",
      "wing",
      "wingSword",
      "angel",
      "centaur",
      "sagittarius"
    ],
    excludeNatureCharges: [
      "agnusDei",
      "badgerStatant",
      "bearPassant",
      "bearRampant",
      "boarRampant",
      "bullPassant",
      "camel",
      "catPassantGuardant",
      "cowStatant",
      "dolphin",
      "elephant",
      "goat",
      "greyhoundCourant",
      "greyhoundRampant",
      "greyhoundSejant",
      "hedgehog",
      "hindStatant",
      "horsePassant",
      "horseRampant",
      "horseSalient",
      "lamb",
      "lambPassantReguardant",
      "lionPassant",
      "lionPassantGuardant",
      "lionRampant",
      "lionSejant",
      "martenCourant",
      "mastiffStatant",
      "porcupine",
      "rabbitSejant",
      "ramPassant",
      "ratRampant",
      "rhinoceros",
      "squirrel",
      "stagLodgedRegardant",
      "stagPassant",
      "talbotPassant",
      "talbotSejant",
      "wolfPassant",
      "wolfRampant",
      "wolfStatant",
      "boarHeadErased",
      "bullHeadCaboshed",
      "deerHeadCaboshed",
      "donkeyHeadCaboshed",
      "elephantHeadErased",
      "horseHeadCouped",
      "lionHeadCaboshed",
      "lionHeadErased",
      "ramHeadErased",
      "wolfHeadErased",
      "cock",
      "dove",
      "doveDisplayed",
      "duck",
      "eagle",
      "falcon",
      "heron",
      "owl",
      "owlDisplayed",
      "parrot",
      "peacock",
      "peacockInPride",
      "raven",
      "swallow",
      "swan",
      "swanErased",
      "crocodile",
      "frog",
      "lizard",
      "ouroboros",
      "snake",
      "bee",
      "butterfly",
      "cancer",
      "dragonfly",
      "fly",
      "ladybird",
      "scorpion",
      "wasp",
      "pike",
      "plaice",
      "salmon",
      "escallop",
      "snail",
      "apple",
      "cinquefoil",
      "earOfWheat",
      "grapeBunch",
      "grapeBunch2",
      "mapleLeaf",
      "oak",
      "palmTree",
      "pear",
      "pineCone",
      "pineTree",
      "quatrefoil",
      "rose",
      "sextifoil",
      "thistle",
      "tree",
      "trefoil",
      "wheatStalk",
      "angel",
      "basilisk",
      "centaur",
      "dragonPassant",
      "dragonRampant",
      "eagleTwoHeads",
      "griffinPassant",
      "griffinRampant",
      "pegasus",
      "sagittarius",
      "serpent",
      "unicornRampant",
      "wyvern",
      "wyvernWithWingsDisplayed"
    ]
  };

  // charges specific to culture or burg type (FMG-only config, not coming from Armoria)
  const typeMapping = {
    Naval: {
      anchor: 3,
      drakkar: 1,
      lymphad: 2,
      caravel: 1,
      shipWheel: 1,
      armillarySphere: 1,
      escallop: 1,
      dolphin: 1,
      plaice: 1
    },
    Highland: {tower: 1, raven: 1, wolfHeadErased: 1, wolfPassant: 1, goat: 1, axe: 1},
    River: {
      garb: 1,
      rake: 1,
      raft: 1,
      boat: 2,
      drakkar: 2,
      hook: 2,
      pike: 2,
      bullHeadCaboshed: 1,
      apple: 1,
      pear: 1,
      plough: 1,
      earOfWheat: 1,
      salmon: 1,
      cancer: 1,
      bridge: 1,
      bridge2: 2,
      sickle: 1,
      scythe: 1,
      grapeBunch: 1,
      wheatStalk: 1,
      windmill: 1,
      crocodile: 1
    },
    Lake: {
      hook: 3,
      cancer: 2,
      escallop: 1,
      pike: 2,
      heron: 1,
      boat: 1,
      boat2: 2,
      salmon: 1,
      cancer: 1,
      sickle: 1,
      windmill: 1,
      swanErased: 1,
      swan: 1,
      frog: 1,
      wasp: 1
    },
    Nomadic: {
      pot: 1,
      buckle: 1,
      wheel: 2,
      sabre: 2,
      sabresCrossed: 1,
      bow: 2,
      arrow: 1,
      horseRampant: 1,
      horseSalient: 1,
      crescent: 1,
      camel: 3,
      scorpion: 1,
      falcon: 1
    },
    Hunting: {
      bugleHorn: 2,
      bugleHorn2: 1,
      stagsAttires: 2,
      attire: 2,
      hatchet: 1,
      bowWithArrow: 2,
      arrowsSheaf: 1,
      lanceHead: 1,
      saw: 1,
      deerHeadCaboshed: 1,
      wolfStatant: 1,
      oak: 1,
      pineCone: 1,
      pineTree: 1,
      oak: 1,
      owl: 1,
      falcon: 1,
      peacock: 1,
      boarHeadErased: 2,
      horseHeadCouped: 1,
      rabbitSejant: 1,
      wolfRampant: 1,
      wolfPassant: 1,
      wolfStatant: 1,
      greyhoundCourant: 1,
      greyhoundRampant: 1,
      greyhoundSejant: 1,
      mastiffStatant: 1,
      talbotPassant: 1,
      talbotSejant: 1,
      stagPassant: 21
    },
    // selection based on type
    City: {
      key: 4,
      bell: 3,
      lute: 1,
      tower: 1,
      pillar: 1,
      castle: 1,
      castle2: 1,
      portcullis: 1,
      mallet: 1,
      cannon: 1,
      anvil: 1,
      buckle: 1,
      horseshoe: 1,
      stirrup: 1,
      lanceWithBanner: 1,
      bookClosed: 1,
      scissors: 1,
      scissors2: 1,
      shears: 1,
      pincers: 1,
      bridge: 2,
      archer: 1,
      cannon: 1,
      shield: 1,
      arbalest: 1,
      arbalest2: 1,
      bowWithThreeArrows: 1,
      spear: 1,
      lochaberAxe: 1,
      armEmbowedHoldingSabre: 1,
      grenade: 1,
      maces: 1,
      grapeBunch: 1,
      cock: 1,
      ramHeadErased: 1,
      ratRampant: 1,
      hourglass: 1,
      scale: 1,
      scrollClosed: 1
    },
    Capital: {
      crown: 2,
      crown2: 2,
      laurelWreath: 1,
      orb: 1,
      lute: 1,
      lyre: 1,
      banner: 1,
      castle: 1,
      castle2: 1,
      palace: 1,
      crown2: 2,
      column: 1,
      lionRampant: 1,
      stagLodgedRegardant: 1,
      drawingCompass: 1,
      rapier: 1,
      scaleImbalanced: 1,
      scalesHanging: 1
    },
    Сathedra: {
      crossHummetty: 3,
      mitre: 3,
      chalice: 1,
      orb: 1,
      crosier: 2,
      lamb: 1,
      monk: 2,
      angel: 3,
      crossLatin: 2,
      crossPatriarchal: 1,
      crossOrthodox: 1,
      crossCalvary: 1,
      agnusDei: 3,
      bookOpen: 1,
      sceptre: 1,
      bone: 1,
      skull: 1
    }
  };

  const positions = {
    conventional: {
      e: 20,
      abcdefgzi: 3,
      beh: 3,
      behdf: 2,
      acegi: 1,
      kn: 3,
      bhdf: 1,
      jeo: 1,
      abc: 3,
      jln: 6,
      jlh: 3,
      kmo: 2,
      jleh: 1,
      def: 3,
      abcpqh: 4,
      ABCDEFGHIJKL: 1
    },
    complex: {e: 40, beh: 1, kn: 1, jeo: 1, abc: 2, jln: 7, jlh: 2, def: 1, abcpqh: 1},
    divisions: {
      perPale: {e: 15, pq: 5, jo: 2, jl: 2, ABCDEFGHIJKL: 1},
      perFess: {e: 12, kn: 4, jkl: 2, gizgiz: 1, jlh: 3, kmo: 1, ABCDEFGHIJKL: 1},
      perBend: {e: 5, lm: 5, bcfdgh: 1},
      perBendSinister: {e: 1, jo: 1},
      perCross: {e: 4, jlmo: 1, j: 1, jo: 2, jl: 1},
      perChevron: {e: 1, jlh: 1, dfk: 1, dfbh: 2, bdefh: 1},
      perChevronReversed: {e: 1, mok: 2, dfh: 2, dfbh: 1, bdefh: 1},
      perSaltire: {bhdf: 8, e: 3, abcdefgzi: 1, bh: 1, df: 1, ABCDEFGHIJKL: 1},
      perPile: {ee: 3, be: 2, abceh: 1, abcabc: 1, jleh: 1}
    },
    inescutcheon: {e: 4, jln: 1}
  };

  const lines = {
    straight: 50,
    wavy: 8,
    engrailed: 4,
    invecked: 3,
    rayonne: 3,
    embattled: 1,
    raguly: 1,
    urdy: 1,
    dancetty: 1,
    indented: 2,
    dentilly: 1,
    bevilled: 1,
    angled: 1,
    flechy: 1,
    barby: 1,
    enclavy: 1,
    escartely: 1,
    arched: 2,
    archedReversed: 1,
    nowy: 1,
    nowyReversed: 1,
    embattledGhibellin: 1,
    embattledNotched: 1,
    embattledGrady: 1,
    dovetailedIndented: 1,
    dovetailed: 1,
    potenty: 1,
    potentyDexter: 1,
    potentySinister: 1,
    nebuly: 2,
    seaWaves: 1,
    dragonTeeth: 1,
    firTrees: 1
  };

  const excludeComplexLines = [
    "engrailed",
    "invecked",
    "raguly",
    "urdy",
    "dentilly",
    "bevilled",
    "flechy",
    "barby",
    "enclavy",
    "escartely",
    "nowy",
    "nowyReversed",
    "embattledGhibellin",
    "embattledNotched",
    "embattledGrady",
    "dovetailedIndented",
    "dovetailed",
    "potenty",
    "potentyDexter",
    "potentySinister",
    "nebuly",
    "firTrees"
  ];

  const excludeNonStraightLines = [
    "wavy",
    "engrailed",
    "invecked",
    "rayonne",
    "embattled",
    "raguly",
    "urdy",
    "dancetty",
    "indented",
    "dentilly",
    "bevilled",
    "angled",
    "flechy",
    "barby",
    "enclavy",
    "escartely",
    "arched",
    "archedReversed",
    "nowy",
    "nowyReversed",
    "embattledGhibellin",
    "embattledNotched",
    "embattledGrady",
    "dovetailedIndented",
    "dovetailed",
    "potenty",
    "potentyDexter",
    "potentySinister",
    "nebuly",
    "seaWaves",
    "dragonTeeth",
    "firTrees"
  ];

  const divisions = {
    variants: {
      perPale: 5,
      perFess: 5,
      perBend: 2,
      perBendSinister: 1,
      perChevron: 1,
      perChevronReversed: 1,
      perCross: 5,
      perPile: 1,
      perSaltire: 1,
      gyronny: 1,
      chevronny: 1
    },
    perPale: lines,
    perFess: lines,
    perBend: lines,
    perBendSinister: lines,
    perChevron: lines,
    perChevronReversed: lines,
    perCross: {
      straight: 20,
      wavy: 5,
      engrailed: 4,
      invecked: 3,
      rayonne: 1,
      embattled: 1,
      raguly: 1,
      urdy: 1,
      indented: 2,
      dentilly: 1,
      bevilled: 1,
      angled: 1,
      embattledGhibellin: 1,
      embattledGrady: 1,
      dovetailedIndented: 1,
      dovetailed: 1,
      potenty: 1,
      potentyDexter: 1,
      potentySinister: 1,
      nebuly: 1
    },
    perPile: lines
  };

  const ordinaries = {
    lined: {
      pale: 7,
      fess: 5,
      bend: 3,
      bendSinister: 2,
      chief: 5,
      bar: 2,
      gemelle: 1,
      fessCotissed: 1,
      fessDoubleCotissed: 1,
      bendlet: 2,
      bendletSinister: 1,
      terrace: 3,
      cross: 6,
      crossParted: 1,
      saltire: 2,
      saltireParted: 1
    },
    straight: {
      bordure: 8,
      orle: 4,
      mount: 1,
      point: 2,
      flaunches: 1,
      gore: 1,
      gyron: 1,
      quarter: 1,
      canton: 2,
      pall: 3,
      pallReversed: 2,
      chevron: 4,
      chevronReversed: 3,
      pile: 2,
      pileInBend: 2,
      pileInBendSinister: 1,
      piles: 1,
      pilesInPoint: 2,
      label: 1
    },
    data: {
      bar: {
        positionsOn: {defdefdef: 1},
        positionsOff: {abc: 2, abcgzi: 1, jlh: 5, bgi: 2, ach: 1}
      },
      bend: {
        positionsOn: {ee: 2, jo: 1, joe: 1},
        positionsOff: {ccg: 2, ccc: 1}
      },
      bendSinister: {
        positionsOn: {ee: 1, lm: 1, lem: 4},
        positionsOff: {aai: 2, aaa: 1}
      },
      bendlet: {
        positionsOn: {joejoejoe: 1},
        positionsOff: {ccg: 2, ccc: 1}
      },
      bendletSinister: {
        positionsOn: {lemlemlem: 1},
        positionsOff: {aai: 2, aaa: 1}
      },
      bordure: {
        positionsOn: {ABCDEFGHIJKL: 1},
        positionsOff: {e: 4, jleh: 2, kenken: 1, peqpeq: 1}
      },
      canton: {
        positionsOn: {yyyy: 1},
        positionsOff: {e: 5, beh: 1, def: 1, bdefh: 1, kn: 1}
      },
      chevron: {
        positionsOn: {ach: 3, hhh: 1}
      },
      chevronReversed: {
        positionsOff: {bbb: 1}
      },
      chief: {
        positionsOn: {abc: 5, bbb: 1},
        positionsOff: {emo: 2, emoz: 1, ez: 2}
      },
      cross: {
        positionsOn: {eeee: 1, behdfbehdf: 3, behbehbeh: 2},
        positionsOff: {acgi: 1}
      },
      crossParted: {
        positionsOn: {e: 5, ee: 1}
      },
      fess: {
        positionsOn: {ee: 1, def: 3},
        positionsOff: {abc: 3, abcz: 1}
      },
      fessCotissed: {
        positionsOn: {ee: 1, def: 3}
      },
      fessDoubleCotissed: {
        positionsOn: {ee: 1, defdef: 3}
      },
      flaunches: {
        positionsOff: {e: 3, kn: 1, beh: 3}
      },
      gemelle: {
        positionsOff: {abc: 1}
      },
      gyron: {
        positionsOff: {bh: 1}
      },
      label: {
        positionsOff: {defgzi: 2, eh: 3, defdefhmo: 1, egiegi: 1, pqn: 5}
      },
      mount: {
        positionsOff: {e: 5, def: 1, bdf: 3}
      },
      orle: {
        positionsOff: {e: 4, jleh: 1, kenken: 1, peqpeq: 1}
      },
      pale: {
        positionsOn: {ee: 12, beh: 10, kn: 3, bb: 1},
        positionsOff: {yyy: 1}
      },
      pall: {
        positionsOn: {ee: 1, jleh: 5, jlhh: 3},
        positionsOff: {BCKFEILGJbdmfo: 1}
      },
      pallReversed: {
        positionsOn: {ee: 1, bemo: 5},
        positionsOff: {aczac: 1}
      },
      pile: {
        positionsOn: {bbb: 1},
        positionsOff: {acdfgi: 1, acac: 1}
      },
      pileInBend: {
        positionsOn: {eeee: 1, eeoo: 1},
        positionsOff: {cg: 1}
      },
      pileInBendSinister: {
        positionsOn: {eeee: 1, eemm: 1},
        positionsOff: {ai: 1}
      },
      point: {
        positionsOff: {e: 2, def: 1, bdf: 3, acbdef: 1}
      },
      quarter: {
        positionsOn: {jjj: 1},
        positionsOff: {e: 1}
      },
      saltire: {
        positionsOn: {ee: 5, jlemo: 1}
      },
      saltireParted: {
        positionsOn: {e: 5, ee: 1}
      },
      terrace: {
        positionsOff: {e: 5, def: 1, bdf: 3}
      }
    }
  };

  const shields = {
    types: {basic: 10, regional: 2, historical: 1, specific: 1, banner: 1, simple: 2, fantasy: 1, middleEarth: 0},
    basic: {heater: 12, spanish: 6, french: 1},
    regional: {horsehead: 1, horsehead2: 1, polish: 1, hessen: 1, swiss: 1},
    historical: {boeotian: 1, roman: 2, kite: 1, oldFrench: 5, renaissance: 2, baroque: 2},
    specific: {targe: 1, targe2: 0, pavise: 5, wedged: 10},
    banner: {flag: 1, pennon: 0, guidon: 0, banner: 0, dovetail: 1, gonfalon: 5, pennant: 0},
    simple: {round: 12, oval: 6, vesicaPiscis: 1, square: 1, diamond: 2, no: 0},
    fantasy: {fantasy1: 2, fantasy2: 2, fantasy3: 1, fantasy4: 1, fantasy5: 3},
    middleEarth: {noldor: 1, gondor: 1, easterling: 1, erebor: 1, ironHills: 1, urukHai: 1, moriaOrc: 1}
  };

  const getCharges = function (cultures, culture) {
    if (cultures[culture].charges) return cultures[culture].charges;
    ERROR && console.error("Shield charges option is not defined on culture level", cultures[culture]);
    return "Limited";
  };

  const getLines = function (cultures, culture) {
    if (cultures[culture].lines) return cultures[culture].lines;
    ERROR && console.error("Shield lines option is not defined on culture level", cultures[culture]);
    return "Straight";
  };

  const getTinctures = function (cultures, culture) {
    if (cultures[culture].tinctures) return cultures[culture].tinctures;
    ERROR && console.error("Shield tinctures option is not defined on culture level", cultures[culture]);
    return "TinctureOnly";
  };

  const generate = function (parent, kinship, dominion, type, cultures, culture) {
    if (!parent || parent.custom) {
      parent = null;
      kinship = 0;
      dominion = 0;
    }

    const chargesSetting = getCharges(cultures, culture);
    const linesSetting = getLines(cultures, culture);
    const tincturesSetting = getTinctures(cultures, culture);

    let chargesTypesSet = charges.types;
    let chargesSingleSet = charges.single;
    let chargesSemySet = charges.semy;

    let excludeChargesSet = charges.excludeNoCharges;
    let excludeCultureChargesSet = charges.excludeNoCharges;
    let excludeLinesSet = [];
    let excludeTincturesSet = [];

    let allowCharges = true;
    let allowOrdinaries = true;
    let allowTypeMapping = true;

    if (chargesSetting === "Shapes") {
      chargesTypesSet = charges.typesShapes;
      chargesSingleSet = charges.singleShapes;
      chargesSemySet = charges.semyShapes;
      excludeChargesSet = charges.excludeUnusualCharges;
      allowTypeMapping = false;
    } else if (chargesSetting === "Limited") {
      chargesTypesSet = charges.typesLimited;
      chargesSingleSet = charges.singleLimited;
      chargesSemySet = charges.semyLimited;
      excludeChargesSet = charges.excludeUnusualCharges;
      excludeCultureChargesSet = charges.excludeUnusualCharges;
    } else if (chargesSetting === "Nature") {
      chargesTypesSet = charges.typesNature;
      chargesSingleSet = charges.singleNature;
      chargesSemySet = null;
      excludeChargesSet = charges.excludeUnusualCharges;
      excludeCultureChargesSet = charges.excludeThingCharges;
    } else if (chargesSetting === "Nature&Things") {
      chargesTypesSet = charges.typesLimited;
      chargesSingleSet = charges.singleLimited;
      chargesSemySet = charges.semyShapes;
      excludeChargesSet = charges.excludeUnusualCharges;
      excludeCultureChargesSet = charges.excludeUnusualCharges;
    } else if (chargesSetting === "Things") {
      chargesTypesSet = charges.typesThings;
      chargesSingleSet = charges.singleThings;
      chargesSemySet = charges.semyShapes;
      excludeChargesSet = charges.excludeUnusualCharges;
      excludeCultureChargesSet = charges.excludeNatureCharges;
    } else if (chargesSetting === "None") {
      let allowCharges = false;
      chargesTypesSet = charges.typesShapes;
      chargesSingleSet = charges.singleShapes;
      chargesSemySet = charges.semyShapes;
      excludeChargesSet = charges.excludeUnusualCharges;
      allowTypeMapping = false;
    }

    if (linesSetting === "Limited") {
      excludeLinesSet = excludeComplexLines;
    } else if (linesSetting === "Straight") {
      excludeLinesSet = excludeNonStraightLines;
    } else if (linesSetting === "None") {
      // This option disables oridinaries
      allowOrdinaries = false;
      excludeLinesSet = excludeNonStraightLines;
    }

    if (tincturesSetting === "NoPatterns") {
      excludeTincturesSet = ['patterns']
    } else if (tincturesSetting === "NoStains") {
      excludeTincturesSet = ['patterns', 'stains']
    }

    let usedPattern = null;
    let usedTinctures = [];

    const t1 = P(kinship) ? parent.t1 : getTincture("field", excludeTincturesSet);
    if (t1.includes("-")) usedPattern = t1;
    const coa = {t1};

    let addCharge = allowCharges && P(usedPattern ? 0.5 : 0.93) ? true : false;
    // 80% for charge if not chargesSetting == "None"

    const linedOrdinary =
      (addCharge && P(0.3)) || P(0.5)
        ? parent?.ordinaries && P(kinship)
          ? parent.ordinaries[0].ordinary
          : rw(ordinaries.lined)
        : null;


    const ordinary =
      allowOrdinaries && ((!addCharge && P(0.65)) || P(0.3)) ? (linedOrdinary ? linedOrdinary : rw(ordinaries.straight)) : null; // 36% for ordinary if allowOrdinaries is true

    const rareDivided = ["chief", "terrace", "chevron", "quarter", "flaunches"].includes(ordinary);

    const divisioned = (() => {
      if (rareDivided) return P(0.03);
      if (addCharge && ordinary) return P(0.03);
      if (addCharge) return P(0.3);
      if (ordinary) return P(0.7);
      return P(0.995);
    })();

    const division = (() => {
      if (divisioned) {
        if (parent?.division && P(kinship - 0.1)) return parent.division.division;
        return rw(divisions.variants);
      }
      return null;
    })();

    if (division) {
      const t = getTincture("division", excludeTincturesSet, usedTinctures, P(0.98) ? coa.t1 : null);
      coa.division = {division, t};
      if (divisions[division])
        coa.division.line = usedPattern || (ordinary && P(0.7))
          ? "straight" : rwx(divisions[division], excludeLinesSet);
    }

    if (ordinary) {
      coa.ordinaries = [{ordinary, t: getTincture("charge", excludeTincturesSet, usedTinctures, coa.t1)}];
	if (linedOrdinary) coa.ordinaries[0].line = usedPattern || (division && P(0.7)) ? "straight" : rwx(lines, excludeLinesSet);
      if (division && !addCharge && !usedPattern && P(0.5) && ordinary !== "bordure" && ordinary !== "orle") {
        if (P(0.8)) coa.ordinaries[0].divided = "counter";
        // 40%
        else if (P(0.6)) coa.ordinaries[0].divided = "field";
        // 6%
        else coa.ordinaries[0].divided = "division"; // 4%
      }
    }

    if (addCharge) {
      const charge = (() => {
        if (parent?.charges && P(kinship - 0.1)) return parent.charges[0].charge;
        if (type && allowTypeMapping && type !== "Generic" && P(0.3))
          return rwx(typeMapping[type], excludeCultureChargesSet);
        return selectCharge(ordinary || divisioned ? chargesTypesSet : chargesSingleSet, chargesTypesSet, chargesSingleSet, excludeCultureChargesSet);
      })();
      const chargeData = charges.data[charge] || {};

      let p = "e";
      let t = "gules";

      const ordinaryData = ordinaries.data[ordinary];
      const tOrdinary = coa.ordinaries ? coa.ordinaries[0].t : null;

      if (ordinaryData?.positionsOn && P(0.8)) {
        // place charge over ordinary (use tincture of field type)
        p = rw(ordinaryData.positionsOn);
        t = !usedPattern && P(0.3) ? coa.t1 : getTincture("charge", excludeTincturesSet, [], tOrdinary);
      } else if (ordinaryData?.positionsOff && P(0.95)) {
        // place charge out of ordinary (use tincture of ordinary type)
        p = rw(ordinaryData.positionsOff);
        t = !usedPattern && P(0.3) ? tOrdinary : getTincture("charge", excludeTincturesSet, usedTinctures, coa.t1);
      } else if (positions.divisions[division]) {
        // place charge in fields made by division
        p = rw(positions.divisions[division]);
        t = getTincture("charge", excludeTincturesSet, tOrdinary ? usedTinctures.concat(tOrdinary) : usedTinctures, coa.t1);
      } else if (chargeData.positions) {
        // place charge-suitable position
        p = rw(chargeData.positions);
        t = getTincture("charge", excludeTincturesSet, usedTinctures, coa.t1);
      } else {
        // place in standard position (use new tincture)
        p = usedPattern ? "e" : charges.conventional[charge] ? rw(positions.conventional) : rw(positions.complex);
        t = getTincture("charge", excludeTincturesSet, usedTinctures.concat(tOrdinary), coa.t1);
      }

      if (chargeData.natural && chargeData.natural !== t && chargeData.natural !== tOrdinary) t = chargeData.natural;

      const item = {charge: charge, t, p};
      const colors = chargeData.colors || 1;
      if (colors > 1) item.t2 = P(0.25) ? getTincture("charge", excludeTincturesSet, usedTinctures, coa.t1) : t;
      if (colors > 2 && item.t2) item.t3 = P(0.5) ? getTincture("charge", excludeTincturesSet, usedTinctures, coa.t1) : t;
      coa.charges = [item];

      if (p === "ABCDEFGHIKL" && P(0.95)) {
        // add central charge if charge is in bordure
        coa.charges[0].charge = rwx(chargesSingleSet, excludeChargesSet);
        const charge = selectCharge(chargesSingleSet, chargesTypesSet, chargesSingleSet, excludeChargesSet)
;
        const t = getTincture("charge", excludeTincturesSet, usedTinctures, coa.t1);
        coa.charges.push({charge, t, p: "e"});
      } else if (P(0.8) && charge === "inescutcheon") {
        // add charge to inescutcheon
        const charge = selectCharge(chargesTypesSet, chargesTypesSet, chargesSingleSet, excludeChargesSet)
;
        const t2 = getTincture("charge", excludeTincturesSet, [], t);
        coa.charges.push({charge, t: t2, p, size: 0.5});
      } else if (division && !ordinary) {
        const allowCounter = !usedPattern && (!coa.line || coa.line === "straight");
        // dimidiation: second charge at division basic positons
        if (P(0.3) && ["perPale", "perFess"].includes(division) && coa.line === "straight") {
          coa.charges[0].divided = "field";
          if (P(0.95)) {
            const p2 = p === "e" || P(0.5) ? "e" : rw(positions.divisions[division]);
            const charge = selectCharge(chargesSingleSet, chargesTypesSet, chargesSingleSet, excludeChargesSet)
;
            const t = getTincture("charge", excludeTincturesSet, usedTinctures, coa.division.t);
            coa.charges.push({charge, t, p: p2, divided: "division"});
          }
        } else if (allowCounter && P(0.4)) coa.charges[0].divided = "counter";
        // counterchanged, 40%
        else if (["perPale", "perFess", "perBend", "perBendSinister"].includes(division) && P(0.8)) {
          // place 2 charges in division standard positions
          const [p1, p2] =
            division === "perPale"
              ? ["p", "q"]
              : division === "perFess"
              ? ["k", "n"]
              : division === "perBend"
              ? ["l", "m"]
              : ["j", "o"]; // perBendSinister
          coa.charges[0].p = p1;

          const charge = selectCharge(chargesSingleSet, chargesTypesSet, chargesSingleSet, excludeChargesSet)
;
          const t = getTincture("charge", excludeTincturesSet, usedTinctures, coa.division.t);
          coa.charges.push({charge, t, p: p2});
        } else if (["perCross", "perSaltire"].includes(division) && P(0.5)) {
          // place 4 charges in division standard positions
          const [p1, p2, p3, p4] = division === "perCross" ? ["j", "l", "m", "o"] : ["b", "d", "f", "h"];
          coa.charges[0].p = p1;

          const c2 = selectCharge(chargesSingleSet, chargesTypesSet, chargesSingleSet, excludeChargesSet)
;
          const t2 = getTincture("charge", excludeTincturesSet, [], coa.division.t);

          const c3 = selectCharge(chargesSingleSet, chargesTypesSet, chargesSingleSet, excludeChargesSet)
;
          const t3 = getTincture("charge", excludeTincturesSet, [], coa.division.t);

          const c4 = selectCharge(chargesSingleSet, chargesTypesSet, chargesSingleSet, excludeChargesSet)
;
          const t4 = getTincture("charge", excludeTincturesSet, [], coa.t1);
          coa.charges.push({charge: c2, t: t2, p: p2}, {charge: c3, t: t3, p: p3}, {charge: c4, t: t4, p: p4});
        } else if (allowCounter && p.length > 1) coa.charges[0].divided = "counter"; // counterchanged, 40%
      }

      coa.charges.forEach(c => defineChargeAttributes(ordinary, division, c));
    }

    // dominions have canton with parent coa
    if (P(dominion) && parent.charges) {
      const invert = isSameType(parent.t1, coa.t1);
      const t = invert ? getTincture("division", excludeTincturesSet, usedTinctures, coa.t1) : parent.t1;
      const canton = {ordinary: "canton", t};

      coa.charges?.forEach((charge, i) => {
        if (charge.size === 1.5) charge.size = 1.4;
        charge.p = charge.p.replaceAll(/[ajy]/g, "");
        if (!charge.p) coa.charges.splice(i, 1);
      });

      let charge = parent.charges[0].charge;
      if (charge === "inescutcheon" && parent.charges[1]) charge = parent.charges[1].charge;

      let t2 = invert ? parent.t1 : parent.charges[0].t;
      if (isSameType(t, t2)) t2 = getTincture("charge", excludeTincturesSet, usedTinctures, t);

      if (!coa.charges) coa.charges = [];
      coa.charges.push({charge, t: t2, p: "y", size: 0.5});

      coa.ordinaries ? coa.ordinaries.push(canton) : (coa.ordinaries = [canton]);
    }

    function selectCharge(set, chargesTypesSet, chargesSingleSet, exclude) {
      const type = set ? rw(set) : ordinary || divisioned ? rw(chargesTypesSet) : rw(chargesSingleSet);
      return type === "inescutcheon" ? "inescutcheon" : rwx(charges[type], exclude);
    }

    // select tincture: element type (field, division, charge), used field tinctures, field type to follow RoT
    function getTincture(element, exclude, fields = [], RoT) {
      const base = RoT ? (RoT.includes("-") ? RoT.split("-")[1] : RoT) : null;

      let type = rwx(tinctures[element], exclude); // metals, colours, stains, patterns
      if (RoT && type !== "patterns") type = getType(base) === "metals" ? "colours" : "metals"; // follow RoT
      if (type === "metals" && fields.includes("or") && fields.includes("argent")) type = "colours"; // exclude metals overuse
      let tincture = rwx(tinctures[type], exclude);

      while (tincture === base || fields.includes(tincture)) {
        tincture = rw(tinctures[type]);
      } // follow RoT

      if (type !== "patterns" && element !== "charge") usedTinctures.push(tincture); // add field tincture

      if (type === "patterns") {
        usedPattern = tincture;
        tincture = definePattern(tincture, element);
      }

      return tincture;
    }

    function defineChargeAttributes(ordinary, division, c) {
      // define size
      c.size = (c.size || 1) * getSize(c.p, ordinary, division);

      // clean-up position
      c.p = [...new Set(c.p)].join("");

      // define orientation
      if (P(0.02) && charges.data[c.charge]?.sinister) c.sinister = 1;
      if (P(0.02) && charges.data[c.charge]?.reversed) c.reversed = 1;
    }

    function getType(t) {
      const tincture = t.includes("-") ? t.split("-")[1] : t;
      if (Object.keys(tinctures.metals).includes(tincture)) return "metals";
      if (Object.keys(tinctures.colours).includes(tincture)) return "colours";
      if (Object.keys(tinctures.stains).includes(tincture)) return "stains";
    }

    function isSameType(t1, t2) {
      return type(t1) === type(t2);

      function type(tincture) {
        if (Object.keys(tinctures.metals).includes(tincture)) return "metals";
        if (Object.keys(tinctures.colours).includes(tincture)) return "colours";
        if (Object.keys(tinctures.stains).includes(tincture)) return "stains";
        else return "pattern";
      }
    }

    function definePattern(pattern, element, size = "") {
      let t1 = null,
        t2 = null;
      if (P(0.1)) size = "-small";
      else if (P(0.1)) size = "-smaller";
      else if (P(0.01)) size = "-big";
      else if (P(0.005)) size = "-smallest";

      // apply standard tinctures
      if (P(0.5) && ["vair", "vairInPale", "vairEnPointe"].includes(pattern)) {
        t1 = "azure";
        t2 = "argent";
      } else if (P(0.8) && pattern === "ermine") {
        t1 = "argent";
        t2 = "sable";
      } else if (pattern === "pappellony") {
        if (P(0.2)) {
          t1 = "gules";
          t2 = "or";
        } else if (P(0.2)) {
          t1 = "argent";
          t2 = "sable";
        } else if (P(0.2)) {
          t1 = "azure";
          t2 = "argent";
        }
      } else if (pattern === "masoned") {
        if (P(0.3)) {
          t1 = "gules";
          t2 = "argent";
        } else if (P(0.3)) {
          t1 = "argent";
          t2 = "sable";
        } else if (P(0.1)) {
          t1 = "or";
          t2 = "sable";
        }
      } else if (pattern === "fretty") {
        if (t2 === "sable" || P(0.35)) {
          t1 = "argent";
          t2 = "gules";
        } else if (P(0.25)) {
          t1 = "sable";
          t2 = "or";
        } else if (P(0.15)) {
          t1 = "gules";
          t2 = "argent";
        }
      } else if ((pattern === "semy") && (chargesSemySet !== null)) pattern += "_of_" + selectCharge(chargesSemySet, chargesTypesSet, chargesSingleSet, excludeChargesSet);

      if (!t1 || !t2) {
        const startWithMetal = P(0.7);
        t1 = startWithMetal ? rw(tinctures.metals) : rw(tinctures.colours);
        t2 = startWithMetal ? rw(tinctures.colours) : rw(tinctures.metals);
      }

      // division should not be the same tincture as base field
      if (element === "division") {
        if (usedTinctures.includes(t1)) t1 = replaceTincture(t1);
        if (usedTinctures.includes(t2)) t2 = replaceTincture(t2);
      }

      usedTinctures.push(t1, t2);
      return `${pattern}-${t1}-${t2}${size}`;
    }

    function replaceTincture(t, n) {
      const type = getType(t);
      while (!n || n === t) {
        n = rw(tinctures[type]);
      }
      return n;
    }

    function getSize(p, o = null, d = null) {
      if (p === "e" && (o === "bordure" || o === "orle")) return 1.1;
      if (p === "e") return 1.5;
      if (p === "jln" || p === "jlh") return 0.7;
      if (p === "abcpqh" || p === "ez" || p === "be") return 0.5;
      if (["a", "b", "c", "d", "f", "g", "h", "i", "bh", "df"].includes(p)) return 0.5;
      if (["j", "l", "m", "o", "jlmo"].includes(p) && d === "perCross") return 0.6;
      if (p.length > 10) return 0.18; // >10 (bordure)
      if (p.length > 7) return 0.3; // 8, 9, 10
      if (p.length > 4) return 0.4; // 5, 6, 7
      if (p.length > 2) return 0.5; // 3, 4
      return 0.7; // 1, 2
    }

    return coa;
  };

  const getShield = function (culture, state) {
    const emblemShape = document.getElementById("emblemShape");
    const shapeGroup = emblemShape.selectedOptions[0]?.parentNode.label || "Diversiform";
    if (shapeGroup !== "Diversiform") return emblemShape.value;

    if (emblemShape.value === "state" && state && pack.states[state].coa) return pack.states[state].coa.shield;
    if (pack.cultures[culture].shield) return pack.cultures[culture].shield;
    ERROR && console.error("Shield shape is not defined on culture level", pack.cultures[culture]);
    return "heater";
  };

  const toString = coa => JSON.stringify(coa).replaceAll("#", "%23");
  const copy = coa => JSON.parse(JSON.stringify(coa));

  return {generate, toString, copy, getShield, shields};
})();
