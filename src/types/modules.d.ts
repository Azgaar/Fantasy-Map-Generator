declare module "lineclip" {
  export function polygon(points: TPoints, bbox: [number, number, number, number]): TPoints;
  export function lineclip(points: TPoints, bbox: [number, number, number, number], result: TPoints): TPoints;
}
