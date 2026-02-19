export const shields: {
  types: Record<string, number>;
  [key: string]: Record<string, number>;
} = {
  types: {
    basic: 10,
    regional: 2,
    historical: 1,
    specific: 1,
    banner: 1,
    simple: 2,
    fantasy: 1,
    middleEarth: 0,
  },
  basic: { heater: 12, spanish: 6, french: 1 },
  regional: { horsehead: 1, horsehead2: 1, polish: 1, hessen: 1, swiss: 1 },
  historical: {
    boeotian: 1,
    roman: 2,
    kite: 1,
    oldFrench: 5,
    renaissance: 2,
    baroque: 2,
  },
  specific: { targe: 1, targe2: 0, pavise: 5, wedged: 10 },
  banner: {
    flag: 1,
    pennon: 0,
    guidon: 0,
    banner: 0,
    dovetail: 1,
    gonfalon: 5,
    pennant: 0,
  },
  simple: { round: 12, oval: 6, vesicaPiscis: 1, square: 1, diamond: 2, no: 0 },
  fantasy: { fantasy1: 2, fantasy2: 2, fantasy3: 1, fantasy4: 1, fantasy5: 3 },
  middleEarth: {
    noldor: 1,
    gondor: 1,
    easterling: 1,
    erebor: 1,
    ironHills: 1,
    urukHai: 1,
    moriaOrc: 1,
  },
};
