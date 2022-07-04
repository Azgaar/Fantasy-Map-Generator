interface IBiomesData {
  i: number[];
  name: string[];
  color: Hex[];
  habitability: number[];
  cost: number[];
  icons: string[];
  iconsDensity: number[];
  biomesMartix: [Uint8Array, Uint8Array, Uint8Array, Uint8Array, Uint8Array];
}
