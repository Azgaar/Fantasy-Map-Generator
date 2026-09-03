export interface BrushStroke {
  /** Report the pointer position: the first call stamps there, later ones lay stamps along the way */
  moveTo(x: number, y: number): void;
}

/**
 * A brush stroke that stamps by distance travelled, not by pointer event. Pointer events arrive once per
 * displayed frame, so applying a brush per event paints faster on a high-refresh monitor and leaves gaps
 * on a fast swipe. Placing a stamp every `spacing` pixels from the last one makes the result depend on
 * the gesture only, the way raster painters do it. Jitter in place travels nowhere, so it stamps nothing
 */
export function createBrushStroke(spacing: number, stamp: (x: number, y: number) => void): BrushStroke {
  let stampX = 0;
  let stampY = 0;
  let started = false;

  return {
    moveTo(x, y) {
      if (!started) {
        started = true;
        stampX = x;
        stampY = y;
        stamp(x, y);
        return;
      }

      // every full spacing from the last stamp towards the pointer, so a fast swipe has no gaps
      let distance = Math.hypot(x - stampX, y - stampY);
      while (distance >= spacing) {
        const t = spacing / distance;
        stampX += (x - stampX) * t;
        stampY += (y - stampY) * t;
        stamp(stampX, stampY);
        distance -= spacing;
      }
    }
  };
}
