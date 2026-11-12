declare module "gifenc" {
  type Palette = number[][];

  interface FrameOptions {
    palette?: Palette;
    delay?: number;
    transparent?: boolean;
    transparentIndex?: number;
    repeat?: number;
    dispose?: number;
  }

  interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, options?: FrameOptions): void;
    finish(): void;
    bytes(): Uint8Array<ArrayBuffer>;
  }

  export function GIFEncoder(): Encoder;
  export function quantize(rgba: Uint8ClampedArray, maxColors: number): Palette;
  export function applyPalette(rgba: Uint8ClampedArray, palette: Palette): Uint8Array;
}
