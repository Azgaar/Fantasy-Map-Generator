declare module "lineclip" {
  export function polygon(points: number[][], bbox: number[], result?: number[][]): number[][];
  export function lineclip(points: number[][], bbox: number[]): number[][];
}
