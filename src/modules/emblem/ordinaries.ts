export const ordinaries = {
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
    saltireParted: 1,
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
    label: 1,
  },
  data: {
    bar: {
      positionsOn: { defdefdef: 1 },
      positionsOff: { abc: 2, abcgzi: 1, jlh: 5, bgi: 2, ach: 1 },
    },
    bend: {
      positionsOn: { ee: 2, jo: 1, joe: 1 },
      positionsOff: { ccg: 2, ccc: 1 },
    },
    bendSinister: {
      positionsOn: { ee: 1, lm: 1, lem: 4 },
      positionsOff: { aai: 2, aaa: 1 },
    },
    bendlet: {
      positionsOn: { joejoejoe: 1 },
      positionsOff: { ccg: 2, ccc: 1 },
    },
    bendletSinister: {
      positionsOn: { lemlemlem: 1 },
      positionsOff: { aai: 2, aaa: 1 },
    },
    bordure: {
      positionsOn: { ABCDEFGHIJKL: 1 },
      positionsOff: { e: 4, jleh: 2, kenken: 1, peqpeq: 1 },
    },
    canton: {
      positionsOn: { yyyy: 1 },
      positionsOff: { e: 5, beh: 1, def: 1, bdefh: 1, kn: 1 },
    },
    chevron: {
      positionsOn: { ach: 3, hhh: 1 },
    },
    chevronReversed: {
      positionsOff: { bbb: 1 },
    },
    chief: {
      positionsOn: { abc: 5, bbb: 1 },
      positionsOff: { emo: 2, emoz: 1, ez: 2 },
    },
    cross: {
      positionsOn: { eeee: 1, behdfbehdf: 3, behbehbeh: 2 },
      positionsOff: { acgi: 1 },
    },
    crossParted: {
      positionsOn: { e: 5, ee: 1 },
    },
    fess: {
      positionsOn: { ee: 1, def: 3 },
      positionsOff: { abc: 3, abcz: 1 },
    },
    fessCotissed: {
      positionsOn: { ee: 1, def: 3 },
    },
    fessDoubleCotissed: {
      positionsOn: { ee: 1, defdef: 3 },
    },
    flaunches: {
      positionsOff: { e: 3, kn: 1, beh: 3 },
    },
    gemelle: {
      positionsOff: { abc: 1 },
    },
    gyron: {
      positionsOff: { bh: 1 },
    },
    label: {
      positionsOff: { defgzi: 2, eh: 3, defdefhmo: 1, egiegi: 1, pqn: 5 },
    },
    mount: {
      positionsOff: { e: 5, def: 1, bdf: 3 },
    },
    orle: {
      positionsOff: { e: 4, jleh: 1, kenken: 1, peqpeq: 1 },
    },
    pale: {
      positionsOn: { ee: 12, beh: 10, kn: 3, bb: 1 },
      positionsOff: { yyy: 1 },
    },
    pall: {
      positionsOn: { ee: 1, jleh: 5, jlhh: 3 },
      positionsOff: { BCKFEILGJbdmfo: 1 },
    },
    pallReversed: {
      positionsOn: { ee: 1, bemo: 5 },
      positionsOff: { aczac: 1 },
    },
    pile: {
      positionsOn: { bbb: 1 },
      positionsOff: { acdfgi: 1, acac: 1 },
    },
    pileInBend: {
      positionsOn: { eeee: 1, eeoo: 1 },
      positionsOff: { cg: 1 },
    },
    pileInBendSinister: {
      positionsOn: { eeee: 1, eemm: 1 },
      positionsOff: { ai: 1 },
    },
    point: {
      positionsOff: { e: 2, def: 1, bdf: 3, acbdef: 1 },
    },
    quarter: {
      positionsOn: { jjj: 1 },
      positionsOff: { e: 1 },
    },
    saltire: {
      positionsOn: { ee: 5, jlemo: 1 },
    },
    saltireParted: {
      positionsOn: { e: 5, ee: 1 },
    },
    terrace: {
      positionsOff: { e: 5, def: 1, bdf: 3 },
    },
  } as Record<
    string,
    {
      positionsOn?: Record<string, number>;
      positionsOff?: Record<string, number>;
    }
  >,
};
