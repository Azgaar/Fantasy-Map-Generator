interface IPack {
  cells: {
    i: number[];
    g: number[];
    h: number[];
    pop: number[];
    burg: number[];
  };
  states: IState[];
  cultures: ICulture[];
  provinces: IProvince[];
  burgs: IBurg[];
  religions: IReligion[];
}

interface IState {
  i: number;
  name: string;
  removed?: boolean;
}

interface ICulture {
  i: number;
  name: string;
  removed?: boolean;
}

interface IProvince {
  i: number;
  name: string;
  removed?: boolean;
}

interface IBurg {
  i: number;
  name: string;
  cell: number;
  x: number;
  y: number;
  population: number;
  removed?: boolean;
}

interface IReligion {
  i: number;
  name: string;
  removed?: boolean;
}
