export interface BrushStroke {
  moveTo(x: number, y: number): void;
}

// Interpolate spaced stamps; stampOnMove also covers each pointer position.
export function createBrushStroke(
  spacing: number,
  stamp: (x: number, y: number) => void,
  stampOnMove = false
): BrushStroke {
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

      if (stampOnMove && (x !== stampX || y !== stampY)) {
        stampX = x;
        stampY = y;
        stamp(x, y);
      }
    }
  };
}
