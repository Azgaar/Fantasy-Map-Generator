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
  coa: ICoa | "string";
  capital: Logical; // 1 - capital, 0 - burg
  port: number; // port feature id, 0 - not a port
  shanty?: number;
  MFCG?: string | number;
  removed?: boolean;
}

type TNoBurg = {
  i: 0;
  name: undefined;
};

type TBurgs = [TNoBurg, ...IBurg[]];
