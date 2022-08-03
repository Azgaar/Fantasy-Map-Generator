interface IState {
  i: number;
  name: string;
  fullName: string;
  removed?: boolean;
}

type TNeutrals = {
  i: 0;
  name: string;
};

type TStates = [TNeutrals, ...IState[]];
