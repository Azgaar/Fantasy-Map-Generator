export const getDefaultMilitaryOptions: () => IMilitaryUnitConfig[] = function () {
  return [
    {icon: "⚔️", name: "infantry", rural: 0.25, urban: 0.2, crew: 1, power: 1, type: "melee", separate: 0},
    {icon: "🏹", name: "archers", rural: 0.12, urban: 0.2, crew: 1, power: 1, type: "ranged", separate: 0},
    {icon: "🐴", name: "cavalry", rural: 0.12, urban: 0.03, crew: 2, power: 2, type: "mounted", separate: 0},
    {icon: "💣", name: "artillery", rural: 0, urban: 0.03, crew: 8, power: 12, type: "machinery", separate: 0},
    {icon: "🌊", name: "fleet", rural: 0, urban: 0.015, crew: 100, power: 50, type: "naval", separate: 1}
  ];
};

export const relationsAlertRate: {[key in TRelation]: number} = {
  Vassal: -0.5,
  Ally: -0.2,
  Friendly: -0.1,
  Neutral: 0,
  Unknown: 0,
  x: 0,
  Suspicion: 0.1,
  Suzerain: 0.3,
  Rival: 0.5,
  Enemy: 1
};

export const stateModifier: {[key in TMilitaryUnitType]: {[key in TCultureType]: number}} = {
  melee: {Generic: 1, Nomadic: 0.5, Highland: 1.2, Lake: 1, Naval: 0.7, Hunting: 1.2, River: 1.1},
  ranged: {Generic: 1, Nomadic: 0.9, Highland: 1.3, Lake: 1, Naval: 0.8, Hunting: 2, River: 0.8},
  mounted: {Generic: 1, Nomadic: 2.3, Highland: 0.6, Lake: 0.7, Naval: 0.3, Hunting: 0.7, River: 0.8},
  machinery: {Generic: 1, Nomadic: 0.8, Highland: 1.4, Lake: 1.1, Naval: 1.4, Hunting: 0.4, River: 1.1},
  naval: {Generic: 1, Nomadic: 0.5, Highland: 0.5, Lake: 1.2, Naval: 1.8, Hunting: 0.7, River: 1.2},
  armored: {Generic: 1, Nomadic: 1, Highland: 0.5, Lake: 1, Naval: 1, Hunting: 0.7, River: 1.1},
  aviation: {Generic: 1, Nomadic: 0.5, Highland: 0.5, Lake: 1.2, Naval: 1.2, Hunting: 0.6, River: 1.2},
  magical: {Generic: 1, Nomadic: 1, Highland: 2, Lake: 1, Naval: 1, Hunting: 1, River: 1}
};

type TCellType = "nomadic" | "wetland" | "highland";

export const cellTypeModifier: {[key in TCellType]: {[key in TMilitaryUnitType]: number}} = {
  nomadic: {
    melee: 0.2,
    ranged: 0.5,
    mounted: 3,
    machinery: 0.4,
    naval: 0.3,
    armored: 1.6,
    aviation: 1,
    magical: 0.5
  },
  wetland: {
    melee: 0.8,
    ranged: 2,
    mounted: 0.3,
    machinery: 1.2,
    naval: 1.0,
    armored: 0.2,
    aviation: 0.5,
    magical: 0.5
  },
  highland: {
    melee: 1.2,
    ranged: 1.6,
    mounted: 0.3,
    machinery: 3,
    naval: 1.0,
    armored: 0.8,
    aviation: 0.3,
    magical: 2
  }
};

export const burgTypeModifier: {[key in TCellType]: {[key in TMilitaryUnitType]: number}} = {
  nomadic: {
    melee: 0.3,
    ranged: 0.8,
    mounted: 3,
    machinery: 0.4,
    naval: 1.0,
    armored: 1.6,
    aviation: 1,
    magical: 0.5
  },
  wetland: {
    melee: 1,
    ranged: 1.6,
    mounted: 0.2,
    machinery: 1.2,
    naval: 1.0,
    armored: 0.2,
    aviation: 0.5,
    magical: 0.5
  },
  highland: {melee: 1.2, ranged: 2, mounted: 0.3, machinery: 3, naval: 1.0, armored: 0.8, aviation: 0.3, magical: 2}
};
