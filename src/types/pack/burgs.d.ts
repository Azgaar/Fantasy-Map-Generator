interface IBurg {
  i: number;
  name: string;
  feature: number;
  state: number;
  culture: number;
  cell: number;
  x: number;
  y: number;
  population: number;
  type: TCultureType;
  coa: ICoa | "custom";
  capital: Logical; // 1 - capital, 0 - burg
  port: number; // port feature id, 0 - not a port
  citadel: Logical;
  plaza: Logical;
  walls: Logical;
  shanty: Logical;
  temple: Logical;
  MFCG?: string | number; // MFCG link of seed
  removed?: boolean;
}

type TNoBurg = {
  i: 0;
  name: undefined;
};

type TBurgs = [TNoBurg, ...IBurg[]];
