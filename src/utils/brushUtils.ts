export interface BrushStroke {
  moveTo(x: number, y: number): void;
}

// stamps every `spacing` px of pointer travel, not per pointer event: per-event brushes paint faster
// on high-refresh monitors and leave gaps on fast swipes. The first moveTo stamps in place
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
