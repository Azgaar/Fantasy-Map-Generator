interface IPack {
  vertices: {
    p: TPoints;
    v: number[][];
    c: number[][];
  };
  features: IFeature[];
  cells: {
    i: IntArray;
    p: TPoints;
    v: number[][];
    c: number[][];
    g: IntArray;
    h: IntArray;
    t: IntArray;
    f: IntArray;
    biome: IntArray;
    pop: Float32Array;
    area: IntArray;
    state: IntArray;
    culture: IntArray;
    religion: IntArray;
    province: IntArray;
    burg: IntArray;
    q: d3.Quadtree<number[]>;
  };
  states: IState[];
  cultures: ICulture[];
  provinces: IProvince[];
  burgs: IBurg[];
  rivers: IRiver[];
  religions: IReligion[];
}

interface IFeature {
  i: number;
  name: string;
}

interface IState {
  i: number;
  name: string;
  fullName: string;
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
  fullName: string;
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
  type: "Folk" | "Orgamized" | "Cult" | "Heresy";
  removed?: boolean;
}

interface IRiver {
  i: number;
  name: string;
  basin: number;
  parent: number;
  type: string;
  source: number;
  mouth: number;
  sourceWidth: number;
  width: number;
  widthFactor: number;
  length: number;
  discharge: number;
  cells: number[];
}
