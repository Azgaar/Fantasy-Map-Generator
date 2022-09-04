interface IState {
  i: number;
  name: string;
  center: number;
  capital: number;
  color: Hex | CssUrls;
  type: TCultureType;
  culture: number;
  expansionism: number;
  form: string;
  formName: string;
  fullName: string;
  coa: ICoa | string;
  // pole: TPoint ?
  area: number;
  cells: number;
  burgs: number;
  rural: number;
  urban: number;
  neighbors: number[];
  relations: TRelation[];
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
