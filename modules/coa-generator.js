'use strict';

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

  const charges = {
    // categories selection
    types: {
      conventional: 30,
      crosses: 10,
      animals: 2,
      animalHeads: 1,
      birds: 2,
      fantastic: 3,
      plants: 1,
      agriculture: 1,
      arms: 3,
      bodyparts: 1,
      people: 1,
      architecture: 1,
      miscellaneous: 3,
      inescutcheon: 3
    },
    single: {
      conventional: 12,
      crosses: 8,
      plants: 2,
      animals: 10,
      animalHeads: 2,
      birds: 4,
      fantastic: 7,
      agriculture: 1,
      arms: 6,
      bodyparts: 1,
      people: 2,
      architecture: 1,
      miscellaneous: 10,
      inescutcheon: 5
    },
    semy: {conventional: 12, crosses: 3, plants: 1},
    // generic categories
    conventional: {
      lozenge: 2,
      fusil: 4,
      mascle: 4,
      rustre: 2,
      lozengeFaceted: 3,
      lozengePloye: 1,
      roundel: 4,
      roundel2: 3,
      annulet: 4,
      mullet: 5,
      mulletPierced: 1,
      mulletFaceted: 1,
      mullet4: 3,
      mullet6: 4,
      mullet6Pierced: 1,
      mullet6Faceted: 1,
      mullet7: 1,
      mullet8: 1,
      mullet10: 1,
      estoile: 1,
      compassRose: 1,
      billet: 5,
      delf: 0,
      triangle: 3,
      trianglePierced: 1,
      goutte: 4,
      heart: 4,
      pique: 2,
      carreau: 1,
      trefle: 2,
      fleurDeLis: 6,
      sun: 3,
      sunInSplendour: 1,
      crescent: 5,
      fountain: 1
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
    animals: {
      lionRampant: 5,
      lionPassant: 2,
      lionPassantGuardant: 1,
      wolfRampant: 1,
      wolfPassant: 1,
      wolfStatant: 1,
      greyhoundCourant: 1,
      boarRampant: 1,
      horseRampant: 2,
      horseSalient: 1,
      bearRampant: 2,
      bearPassant: 1,
      bullPassant: 1,
      goat: 1,
      lamb: 1,
      elephant: 1,
      camel: 1
    },
    animalHeads: {wolfHeadErased: 1, bullHeadCaboshed: 1, deerHeadCaboshed: 1, lionHeadCaboshed: 2},
    fantastic: {dragonPassant: 2, dragonRampant: 2, wyvern: 1, wyvernWithWingsDisplayed: 1, griffinPassant: 1, griffinRampant: 1, eagleTwoHeards: 2, unicornRampant: 1, pegasus: 1, serpent: 1},
    birds: {eagle: 9, raven: 1, cock: 3, parrot: 1, swan: 2, swanErased: 1, heron: 1, owl: 1},
    plants: {tree: 1, oak: 1, cinquefoil: 1, rose: 1},
    agriculture: {garb: 1, rake: 1},
    arms: {sword: 5, sabre: 1, sabresCrossed: 1, hatchet: 2, axe: 2, lochaberAxe: 1, mallet: 1, bowWithArrow: 2, bow: 1, arrow: 1, arrowsSheaf: 1, helmet: 2},
    bodyparts: {hand: 4, head: 1, headWreathed: 1},
    people: {cavalier: 3, monk: 1, angel: 2},
    architecture: {tower: 1, castle: 1},
    miscellaneous: {
      crown: 3,
      orb: 1,
      chalice: 1,
      key: 1,
      buckle: 1,
      bugleHorn: 1,
      bugleHorn2: 1,
      bell: 2,
      pot: 1,
      bucket: 1,
      horseshoe: 3,
      attire: 1,
      stagsAttires: 1,
      ramsHorn: 1,
      cowHorns: 2,
      wing: 1,
      wingSword: 1,
      lute: 1,
      harp: 1,
      wheel: 2,
      crosier: 1,
      fasces: 1,
      log: 1
    },
    // selection based on culture type:
    Naval: {anchor: 3, boat: 1, lymphad: 2, armillarySphere: 1, escallop: 1, dolphin: 1},
    Highland: {tower: 1, raven: 1, wolfHeadErased: 1, wolfPassant: 1, goat: 1, axe: 1},
    River: {tower: 1, garb: 1, rake: 1, boat: 1, pike: 2, bullHeadCaboshed: 1},
    Lake: {cancer: 2, escallop: 1, pike: 2, heron: 1, boat: 1, boat2: 2},
    Nomadic: {pot: 1, buckle: 1, wheel: 2, sabre: 2, sabresCrossed: 1, bow: 2, arrow: 1, horseRampant: 1, horseSalient: 1, crescent: 1, camel: 3},
    Hunting: {bugleHorn: 2, bugleHorn2: 1, stagsAttires: 2, attire: 2, hatchet: 1, bowWithArrow: 1, arrowsSheaf: 1, deerHeadCaboshed: 1, wolfStatant: 1, oak: 1},
    // selection based on type
    City: {key: 3, bell: 2, lute: 1, tower: 1, castle: 1, mallet: 1},
    Capital: {crown: 4, orb: 1, lute: 1, castle: 3, tower: 1},
    Сathedra: {chalice: 1, orb: 1, crosier: 2, lamb: 1, monk: 2, angel: 3, crossLatin: 2, crossPatriarchal: 1, crossOrthodox: 1, crossCalvary: 1},
    // specific cases
    natural: {fountain: 'azure', garb: 'or', raven: 'sable'}, // charges to mainly use predefined colours
    sinister: [
      // charges that can be sinister
      'crossGamma',
      'lionRampant',
      'lionPassant',
      'wolfRampant',
      'wolfPassant',
      'wolfStatant',
      'wolfHeadErased',
      'greyhoundСourant',
      'boarRampant',
      'horseRampant',
      'horseSalient',
      'bullPassant',
      'bearRampant',
      'bearPassant',
      'goat',
      'lamb',
      'elephant',
      'eagle',
      'raven',
      'cock',
      'parrot',
      'swan',
      'swanErased',
      'heron',
      'pike',
      'dragonPassant',
      'dragonRampant',
      'wyvern',
      'wyvernWithWingsDisplayed',
      'griffinPassant',
      'griffinRampant',
      'unicornRampant',
      'pegasus',
      'serpent',
      'hatchet',
      'lochaberAxe',
      'hand',
      'wing',
      'wingSword',
      'lute',
      'harp',
      'bow',
      'head',
      'headWreathed',
      'knight',
      'lymphad',
      'log',
      'crosier',
      'dolphin',
      'sabre',
      'monk',
      'owl',
      'axe',
      'camel',
      'fasces',
      'lionPassantGuardant',
      'helmet'
    ],
    reversed: [
      // charges that can be reversed
      'goutte',
      'mullet',
      'mullet7',
      'crescent',
      'crossTau',
      'cancer',
      'sword',
      'sabresCrossed',
      'hand',
      'horseshoe',
      'bowWithArrow',
      'arrow',
      'arrowsSheaf',
      'rake',
      'crossTriquetra',
      'crossLatin',
      'crossTau'
    ]
  };

  const positions = {
    conventional: {e: 20, abcdefgzi: 3, beh: 3, behdf: 2, acegi: 1, kn: 3, bhdf: 1, jeo: 1, abc: 3, jln: 6, jlh: 3, kmo: 2, jleh: 1, def: 3, abcpqh: 4, ABCDEFGHIJKL: 1},
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
    ordinariesOn: {
      pale: {ee: 12, beh: 10, kn: 3, bb: 1},
      fess: {ee: 1, def: 3},
      bar: {defdefdef: 1},
      fessCotissed: {ee: 1, def: 3},
      fessDoubleCotissed: {ee: 1, defdef: 3},
      bend: {ee: 2, jo: 1, joe: 1},
      bendSinister: {ee: 1, lm: 1, lem: 4},
      bendlet: {joejoejoe: 1},
      bendletSinister: {lemlemlem: 1},
      bordure: {ABCDEFGHIJKL: 1},
      chief: {abc: 5, bbb: 1},
      quarter: {jjj: 1},
      canton: {yyyy: 1},
      cross: {eeee: 1, behdfbehdf: 3, behbehbeh: 2},
      crossParted: {e: 5, ee: 1},
      saltire: {ee: 5, jlemo: 1},
      saltireParted: {e: 5, ee: 1},
      pall: {ee: 1, jleh: 5, jlhh: 3},
      pallReversed: {ee: 1, bemo: 5},
      pile: {bbb: 1},
      pileInBend: {eeee: 1, eeoo: 1},
      pileInBendSinister: {eeee: 1, eemm: 1}
    },
    ordinariesOff: {
      pale: {yyy: 1},
      fess: {abc: 3, abcz: 1},
      bar: {abc: 2, abcgzi: 1, jlh: 5, bgi: 2, ach: 1},
      gemelle: {abc: 1},
      bend: {ccg: 2, ccc: 1},
      bendSinister: {aai: 2, aaa: 1},
      bendlet: {ccg: 2, ccc: 1},
      bendletSinister: {aai: 2, aaa: 1},
      bordure: {e: 4, jleh: 2, kenken: 1, peqpeq: 1},
      orle: {e: 4, jleh: 1, kenken: 1, peqpeq: 1},
      chief: {emo: 2, emoz: 1, ez: 2},
      terrace: {e: 5, def: 1, bdf: 3},
      mount: {e: 5, def: 1, bdf: 3},
      point: {e: 2, def: 1, bdf: 3, acbdef: 1},
      flaunches: {e: 3, kn: 1, beh: 3},
      gyron: {bh: 1},
      quarter: {e: 1},
      canton: {e: 5, beh: 1, def: 1, bdefh: 1, kn: 1},
      cross: {acgi: 1},
      pall: {BCKFEILGJbdmfo: 1},
      pallReversed: {aczac: 1},
      chevron: {ach: 3, hhh: 1},
      chevronReversed: {bbb: 1},
      pile: {acdfgi: 1, acac: 1},
      pileInBend: {cg: 1},
      pileInBendSinister: {ai: 1},
      label: {defgzi: 2, eh: 3, defdefhmo: 1, egiegi: 1, pqn: 5}
    },
    // charges
    inescutcheon: {e: 4, jln: 1},
    mascle: {e: 15, abcdefgzi: 3, beh: 3, bdefh: 4, acegi: 1, kn: 3, joe: 2, abc: 3, jlh: 8, jleh: 1, df: 3, abcpqh: 4, pqe: 3, eknpq: 3},
    lionRampant: {e: 10, def: 2, abc: 2, bdefh: 1, kn: 1, jlh: 2, abcpqh: 1},
    lionPassant: {e: 10, def: 1, abc: 1, bdefh: 1, jlh: 1, abcpqh: 1},
    wolfPassant: {e: 10, def: 1, abc: 1, bdefh: 1, jlh: 1, abcpqh: 1},
    greyhoundСourant: {e: 10, def: 1, abc: 1, bdefh: 1, jlh: 1, abcpqh: 1},
    griffinRampant: {e: 10, def: 2, abc: 2, bdefh: 1, kn: 1, jlh: 2, abcpqh: 1},
    griffinPassant: {e: 10, def: 1, abc: 1, bdefh: 1, jlh: 1, abcpqh: 1},
    boarRampant: {e: 12, beh: 1, kn: 1, jln: 2},
    eagle: {e: 15, beh: 1, kn: 1, abc: 1, jlh: 2, def: 2, pq: 1},
    raven: {e: 15, beh: 1, kn: 1, jeo: 1, abc: 3, jln: 3, def: 1},
    wyvern: {e: 10, jln: 1},
    garb: {e: 1, def: 3, abc: 2, beh: 1, kn: 1, jln: 3, jleh: 1, abcpqh: 1, joe: 1, lme: 1},
    crown: {e: 10, abcdefgzi: 1, beh: 3, behdf: 2, acegi: 1, kn: 1, pq: 2, abc: 1, jln: 4, jleh: 1, def: 2, abcpqh: 3},
    hand: {e: 10, jln: 2, kn: 1, jeo: 1, abc: 2, pqe: 1},
    armillarySphere: {e: 1},
    tree: {e: 1},
    lymphad: {e: 1},
    head: {e: 1},
    headWreathed: {e: 1},
    cavalier: {e: 1},
    angel: {e: 1}
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

  const divisions = {
    variants: {perPale: 5, perFess: 5, perBend: 2, perBendSinister: 1, perChevron: 1, perChevronReversed: 1, perCross: 5, perPile: 1, perSaltire: 1, gyronny: 1, chevronny: 1},
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

  const generate = function (parent, kinship, dominion, type) {
    if (!parent || parent === 'custom') {
      parent = null;
      kinship = 0;
      dominion = 0;
    }
    let usedPattern = null,
      usedTinctures = [];

    const t1 = P(kinship) ? parent.t1 : getTincture('field');
    if (t1.includes('-')) usedPattern = t1;
    const coa = {t1};

    let charge = P(usedPattern ? 0.5 : 0.93) ? true : false; // 80% for charge
    const linedOrdinary = (charge && P(0.3)) || P(0.5) ? (parent?.ordinaries && P(kinship) ? parent.ordinaries[0].ordinary : rw(ordinaries.lined)) : null;
    const ordinary = (!charge && P(0.65)) || P(0.3) ? (linedOrdinary ? linedOrdinary : rw(ordinaries.straight)) : null; // 36% for ordinary
    const rareDivided = ['chief', 'terrace', 'chevron', 'quarter', 'flaunches'].includes(ordinary);
    const divisioned = rareDivided ? P(0.03) : charge && ordinary ? P(0.03) : charge ? P(0.3) : ordinary ? P(0.7) : P(0.995); // 33% for division
    const division = divisioned ? (parent?.division && P(kinship - 0.1) ? parent.division.division : rw(divisions.variants)) : null;
    if (charge) charge = parent?.charges && P(kinship - 0.1) ? parent.charges[0].charge : type && type !== 'Generic' && P(0.2) ? rw(charges[type]) : selectCharge();

    if (division) {
      const t = getTincture('division', usedTinctures, P(0.98) ? coa.t1 : null);
      coa.division = {division, t};
      if (divisions[division]) coa.division.line = usedPattern || (ordinary && P(0.7)) ? 'straight' : rw(divisions[division]);
    }

    if (ordinary) {
      coa.ordinaries = [{ordinary, t: getTincture('charge', usedTinctures, coa.t1)}];
      if (linedOrdinary) coa.ordinaries[0].line = usedPattern || (division && P(0.7)) ? 'straight' : rw(lines);
      if (division && !charge && !usedPattern && P(0.5) && ordinary !== 'bordure' && ordinary !== 'orle') {
        if (P(0.8)) coa.ordinaries[0].divided = 'counter';
        // 40%
        else if (P(0.6)) coa.ordinaries[0].divided = 'field';
        // 6%
        else coa.ordinaries[0].divided = 'division'; // 4%
      }
    }

    if (charge) {
      let p = 'e',
        t = 'gules';
      const ordinaryT = coa.ordinaries ? coa.ordinaries[0].t : null;
      if (positions.ordinariesOn[ordinary] && P(0.8)) {
        // place charge over ordinary (use tincture of field type)
        p = rw(positions.ordinariesOn[ordinary]);
        while (charges.natural[charge] === ordinaryT) charge = selectCharge();
        t = !usedPattern && P(0.3) ? coa.t1 : getTincture('charge', [], ordinaryT);
      } else if (positions.ordinariesOff[ordinary] && P(0.95)) {
        // place charge out of ordinary (use tincture of ordinary type)
        p = rw(positions.ordinariesOff[ordinary]);
        while (charges.natural[charge] === coa.t1) charge = selectCharge();
        t = !usedPattern && P(0.3) ? ordinaryT : getTincture('charge', usedTinctures, coa.t1);
      } else if (positions.divisions[division]) {
        // place charge in fields made by division
        p = rw(positions.divisions[division]);
        while (charges.natural[charge] === coa.t1) charge = selectCharge();
        t = getTincture('charge', ordinaryT ? usedTinctures.concat(ordinaryT) : usedTinctures, coa.t1);
      } else if (positions[charge]) {
        // place charge-suitable position
        p = rw(positions[charge]);
        while (charges.natural[charge] === coa.t1) charge = selectCharge();
        t = getTincture('charge', usedTinctures, coa.t1);
      } else {
        // place in standard position (use new tincture)
        p = usedPattern ? 'e' : charges.conventional[charge] ? rw(positions.conventional) : rw(positions.complex);
        while (charges.natural[charge] === coa.t1) charge = selectCharge();
        t = getTincture('charge', usedTinctures.concat(ordinaryT), coa.t1);
      }

      if (charges.natural[charge]) t = charges.natural[charge]; // natural tincture
      coa.charges = [{charge, t, p}];

      if (p === 'ABCDEFGHIKL' && P(0.95)) {
        // add central charge if charge is in bordure
        coa.charges[0].charge = rw(charges.conventional);
        const charge = selectCharge(charges.single);
        const t = getTincture('charge', usedTinctures, coa.t1);
        coa.charges.push({charge, t, p: 'e'});
      } else if (P(0.8) && charge === 'inescutcheon') {
        // add charge to inescutcheon
        const charge = selectCharge(charges.types);
        const t2 = getTincture('charge', [], t);
        coa.charges.push({charge, t: t2, p, size: 0.5});
      } else if (division && !ordinary) {
        const allowCounter = !usedPattern && (!coa.line || coa.line === 'straight');

        // dimidiation: second charge at division basic positons
        if (P(0.3) && ['perPale', 'perFess'].includes(division) && coa.line === 'straight') {
          coa.charges[0].divided = 'field';
          if (P(0.95)) {
            const p2 = p === 'e' || P(0.5) ? 'e' : rw(positions.divisions[division]);
            const charge = selectCharge(charges.single);
            const t = getTincture('charge', usedTinctures, coa.division.t);
            coa.charges.push({charge, t, p: p2, divided: 'division'});
          }
        } else if (allowCounter && P(0.4)) coa.charges[0].divided = 'counter';
        // counterchanged, 40%
        else if (['perPale', 'perFess', 'perBend', 'perBendSinister'].includes(division) && P(0.8)) {
          // place 2 charges in division standard positions
          const [p1, p2] = division === 'perPale' ? ['p', 'q'] : division === 'perFess' ? ['k', 'n'] : division === 'perBend' ? ['l', 'm'] : ['j', 'o']; // perBendSinister
          coa.charges[0].p = p1;

          const charge = selectCharge(charges.single);
          const t = getTincture('charge', usedTinctures, coa.division.t);
          coa.charges.push({charge, t, p: p2});
        } else if (['perCross', 'perSaltire'].includes(division) && P(0.5)) {
          // place 4 charges in division standard positions
          const [p1, p2, p3, p4] = division === 'perCross' ? ['j', 'l', 'm', 'o'] : ['b', 'd', 'f', 'h'];
          coa.charges[0].p = p1;

          const c2 = selectCharge(charges.single);
          const t2 = getTincture('charge', [], coa.division.t);

          const c3 = selectCharge(charges.single);
          const t3 = getTincture('charge', [], coa.division.t);

          const c4 = selectCharge(charges.single);
          const t4 = getTincture('charge', [], coa.t1);
          coa.charges.push({charge: c2, t: t2, p: p2}, {charge: c3, t: t3, p: p3}, {charge: c4, t: t4, p: p4});
        } else if (allowCounter && p.length > 1) coa.charges[0].divided = 'counter'; // counterchanged, 40%
      }

      coa.charges.forEach((c) => defineChargeAttributes(c));
      function defineChargeAttributes(c) {
        // define size
        c.size = (c.size || 1) * getSize(c.p, ordinary, division);

        // clean-up position
        c.p = [...new Set(c.p)].join('');

        // define orientation
        if (P(0.02) && charges.sinister.includes(c.charge)) c.sinister = 1;
        if (P(0.02) && charges.reversed.includes(c.charge)) c.reversed = 1;
      }
    }

    // dominions have canton with parent coa
    if (P(dominion) && parent.charges) {
      const invert = isSameType(parent.t1, coa.t1);
      const t = invert ? getTincture('division', usedTinctures, coa.t1) : parent.t1;
      const canton = {ordinary: 'canton', t};
      if (coa.charges) {
        coa.charges.forEach((charge, i) => {
          if (charge.size === 1.5) charge.size = 1.4;
          if (charge.p.includes('a')) charge.p = charge.p.replaceAll('a', '');
          if (charge.p.includes('j')) charge.p = charge.p.replaceAll('j', '');
          if (charge.p.includes('y')) charge.p = charge.p.replaceAll('y', '');
          if (!charge.p) coa.charges.splice(i, 1);
        });
      }

      let charge = parent.charges[0].charge;
      if (charge === 'inescutcheon' && parent.charges[1]) charge = parent.charges[1].charge;

      let t2 = invert ? parent.t1 : parent.charges[0].t;
      if (isSameType(t, t2)) t2 = getTincture('charge', usedTinctures, t);

      if (!coa.charges) coa.charges = [];
      coa.charges.push({charge, t: t2, p: 'y', size: 0.5});

      coa.ordinaries ? coa.ordinaries.push(canton) : (coa.ordinaries = [canton]);
    }

    function selectCharge(set) {
      const type = set ? rw(set) : ordinary || divisioned ? rw(charges.types) : rw(charges.single);
      return type === 'inescutcheon' ? 'inescutcheon' : rw(charges[type]);
    }

    // select tincture: element type (field, division, charge), used field tinctures, field type to follow RoT
    function getTincture(element, fields = [], RoT) {
      const base = RoT ? (RoT.includes('-') ? RoT.split('-')[1] : RoT) : null;

      let type = rw(tinctures[element]); // metals, colours, stains, patterns
      if (RoT && type !== 'patterns') type = getType(base) === 'metals' ? 'colours' : 'metals'; // follow RoT
      if (type === 'metals' && fields.includes('or') && fields.includes('argent')) type = 'colours'; // exclude metals overuse
      let tincture = rw(tinctures[type]);

      while (tincture === base || fields.includes(tincture)) {
        tincture = rw(tinctures[type]);
      } // follow RoT

      if (type !== 'patterns' && element !== 'charge') usedTinctures.push(tincture); // add field tincture

      if (type === 'patterns') {
        usedPattern = tincture;
        tincture = definePattern(tincture, element);
      }

      return tincture;
    }

    function getType(t) {
      const tincture = t.includes('-') ? t.split('-')[1] : t;
      if (Object.keys(tinctures.metals).includes(tincture)) return 'metals';
      if (Object.keys(tinctures.colours).includes(tincture)) return 'colours';
      if (Object.keys(tinctures.stains).includes(tincture)) return 'stains';
    }

    function isSameType(t1, t2) {
      return type(t1) === type(t2);

      function type(tincture) {
        if (Object.keys(tinctures.metals).includes(tincture)) return 'metals';
        if (Object.keys(tinctures.colours).includes(tincture)) return 'colours';
        if (Object.keys(tinctures.stains).includes(tincture)) return 'stains';
        else return 'pattern';
      }
    }

    function definePattern(pattern, element, size = '') {
      let t1 = null,
        t2 = null;
      if (P(0.1)) size = '-small';
      else if (P(0.1)) size = '-smaller';
      else if (P(0.01)) size = '-big';
      else if (P(0.005)) size = '-smallest';

      // apply standard tinctures
      if (P(0.5) && ['vair', 'vairInPale', 'vairEnPointe'].includes(pattern)) {
        t1 = 'azure';
        t2 = 'argent';
      } else if (P(0.8) && pattern === 'ermine') {
        t1 = 'argent';
        t2 = 'sable';
      } else if (pattern === 'pappellony') {
        if (P(0.2)) {
          t1 = 'gules';
          t2 = 'or';
        } else if (P(0.2)) {
          t1 = 'argent';
          t2 = 'sable';
        } else if (P(0.2)) {
          t1 = 'azure';
          t2 = 'argent';
        }
      } else if (pattern === 'masoned') {
        if (P(0.3)) {
          t1 = 'gules';
          t2 = 'argent';
        } else if (P(0.3)) {
          t1 = 'argent';
          t2 = 'sable';
        } else if (P(0.1)) {
          t1 = 'or';
          t2 = 'sable';
        }
      } else if (pattern === 'fretty') {
        if (t2 === 'sable' || P(0.35)) {
          t1 = 'argent';
          t2 = 'gules';
        } else if (P(0.25)) {
          t1 = 'sable';
          t2 = 'or';
        } else if (P(0.15)) {
          t1 = 'gules';
          t2 = 'argent';
        }
      } else if (pattern === 'semy') pattern += '_of_' + selectCharge(charges.semy);

      if (!t1 || !t2) {
        const startWithMetal = P(0.7);
        t1 = startWithMetal ? rw(tinctures.metals) : rw(tinctures.colours);
        t2 = startWithMetal ? rw(tinctures.colours) : rw(tinctures.metals);
      }

      // division should not be the same tincture as base field
      if (element === 'division') {
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
      if (p === 'e' && (o === 'bordure' || o === 'orle')) return 1.1;
      if (p === 'e') return 1.5;
      if (p === 'jln' || p === 'jlh') return 0.7;
      if (p === 'abcpqh' || p === 'ez' || p === 'be') return 0.5;
      if (['a', 'b', 'c', 'd', 'f', 'g', 'h', 'i', 'bh', 'df'].includes(p)) return 0.5;
      if (['j', 'l', 'm', 'o', 'jlmo'].includes(p) && d === 'perCross') return 0.6;
      if (p.length > 10) return 0.18; // >10 (bordure)
      if (p.length > 7) return 0.3; // 8, 9, 10
      if (p.length > 4) return 0.4; // 5, 6, 7
      if (p.length > 2) return 0.5; // 3, 4
      return 0.7; // 1, 2
    }

    return coa;
  };

  const getShield = function (culture, state) {
    const emblemShape = document.getElementById('emblemShape');
    const shapeGroup = emblemShape.selectedOptions[0]?.parentNode.label || 'Diversiform';
    if (shapeGroup !== 'Diversiform') return emblemShape.value;

    if (emblemShape.value === 'state' && state && pack.states[state].coa) return pack.states[state].coa.shield;
    if (pack.cultures[culture].shield) return pack.cultures[culture].shield;
    console.error('Shield shape is not defined on culture level', pack.cultures[culture]);
    return 'heater';
  };

  const toString = (coa) => JSON.stringify(coa).replaceAll('#', '%23');
  const copy = (coa) => JSON.parse(JSON.stringify(coa));

  return {generate, toString, copy, getShield, shields};
})();
