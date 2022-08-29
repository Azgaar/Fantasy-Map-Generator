interface IState {
  i: number;
  name: string;
  center: number;
  color: Hex | CssUrls;
  type: TCultureType;
  culture: number;
  expansionism: number;
  fullName: string;
  capital: Logical;
  coa: ICoa | string;
  // pole: TPoint ?
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
