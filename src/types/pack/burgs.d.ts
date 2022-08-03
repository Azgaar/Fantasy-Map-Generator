interface IBurg {
  i: number;
  name: string;
  cell: number;
  x: number;
  y: number;
  population: number;
  capital: Logical; // 1 - capital, 0 - burg
  port: number; // port feature id, 0 - not a port
  shanty?: number;
  MFCG?: string | number;
  removed?: boolean;
}

type TNoBurg = {
  name: undefined;
};

type TBurgs = [TNoBurg, ...IBurg[]];
