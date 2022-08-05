interface IState {
  i: number;
  name: string;
  culture: number;
  type: TCultureType;
  fullName: string;
  removed?: boolean;
  coa: ICoa | string;
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
  shield: "heater";
  t1: "purpure";
}
