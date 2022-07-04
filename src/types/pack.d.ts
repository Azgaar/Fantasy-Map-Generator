interface IPack {
  cells: {
    i: number[];
    g: number[];
    h: number[];
    pop: number[];
    burg: number[];
  };
  states: [];
  cultures: [];
  provinces: [];
  burgs: IBurg[];
  religions: [];
}

interface IBurg {
  i: number;
  name: string;
  cell: number;
  x: number;
  y: number;
  population: number;
}
