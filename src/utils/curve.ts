import { curveCatmullRom, line } from "d3-shape";
import type { Point } from "@/types/global";

export function sampleCatmullRom(points: readonly Point[], alpha: number): Point[] {
  const context = new CurveSamplingContext();
  line<Point>()
    .x(point => point[0])
    .y(point => point[1])
    .curve(curveCatmullRom.alpha(alpha))
    .context(context as unknown as CanvasRenderingContext2D)(points);
  return context.points;
}

class CurveSamplingContext {
  readonly points: Point[] = [];
  private current: Point = [0, 0];

  moveTo(x: number, y: number): void {
    this.current = [x, y];
    this.points.push(this.current);
  }

  lineTo(x: number, y: number): void {
    this.current = [x, y];
    this.points.push(this.current);
  }

  bezierCurveTo(
    control1X: number,
    control1Y: number,
    control2X: number,
    control2Y: number,
    x: number,
    y: number
  ): void {
    const [startX, startY] = this.current;
    const approximateLength =
      Math.hypot(control1X - startX, control1Y - startY) +
      Math.hypot(control2X - control1X, control2Y - control1Y) +
      Math.hypot(x - control2X, y - control2Y);
    const samples = Math.max(2, Math.ceil(approximateLength / 3));
    for (let sample = 1; sample <= samples; sample++) {
      const t = sample / samples;
      const inverse = 1 - t;
      this.points.push([
        inverse ** 3 * startX + 3 * inverse ** 2 * t * control1X + 3 * inverse * t ** 2 * control2X + t ** 3 * x,
        inverse ** 3 * startY + 3 * inverse ** 2 * t * control1Y + 3 * inverse * t ** 2 * control2Y + t ** 3 * y
      ]);
    }
    this.current = [x, y];
  }

  closePath(): void {}
}
