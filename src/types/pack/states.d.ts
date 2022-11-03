interface IState {
  i: number;
  name: string;
  center: number;
  capital: number;
  color: Hex | CssUrls;
  type: TCultureType;
  culture: number;
  expansionism: number;
  form: TStateForm;
  formName: string;
  fullName: string;
  pole: TPoint;
  coa: ICoa | string;
  area: number;
  cells: number;
  burgs: number;
  rural: number;
  urban: number;
  neighbors: number[];
  relations: TRelation[];
  alert: number;
  regiments: IRegiment[];
  removed?: boolean;
}

type TNeutrals = {
  i: 0;
  name: string;
};

type TStates = [TNeutrals, ...IState[]];

interface ICoa {
  t1: string;
  division: {};
  ordinaries: {}[];
  charges: {}[];
  shield: string;
  t1: string;
}

type TStateForm = "Monarchy" | "Republic" | "Theocracy" | "Union" | "Anarchy";

type TRelation =
  | "Ally"
  | "Friendly"
  | "Neutral"
  | "Suspicion"
  | "Rival"
  | "Unknown"
  | "Suzerain"
  | "Vassal"
  | "Enemy"
  | "x";

interface IMilitaryUnitConfig {
  name: string;
  icon: string;
  crew: number;
  power: number;
  rural: number;
  urban: number;
  type: TMilitaryUnitType;
  separate: Logical;
  biomes?: number[]; // allowed biomes
  states?: number[]; // allowed states
  cultures?: number[]; // allowed cultures
  religions?: number[]; // allowed religions
}

interface IRegiment {
  i: number;
  icon: string;
  name: string;
  state: number; // stateId
  cell: number; // base cell
  x: number; // current position x
  y: number; // current position y
  bx: number; // base position x
  by: number; // base position y
  total: number;
  units: {[key: string]: number};
  isNaval: boolean;
}

type TMilitaryUnitType = "melee" | "ranged" | "mounted" | "machinery" | "naval" | "armored" | "aviation" | "magical";
