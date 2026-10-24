declare module "rgbquant" {
  interface RgbQuantOptions {
    colors?: number;
    method?: 1 | 2;
    initColors?: number;
    minHueCols?: number;
    dithKern?: string | null;
    dithSerp?: boolean;
  }

  export default class RgbQuant {
    constructor(options?: RgbQuantOptions);
    sample(image: HTMLCanvasElement | HTMLImageElement | ImageData): void;
    reduce(image: HTMLCanvasElement | HTMLImageElement | ImageData): Uint8Array;
    palette(tuples: true): [number, number, number][];
    palette(tuples?: false): Uint8Array;
  }
}
