// Ported from VerseEras game/js/world/generators/feral-system/astro/layout.js (2026-10-25).
const GOLDEN_ANGLE = 137.50776405; // degrees

export interface LayoutPosition {
  au: number;
  angleDeg: number;
  x: number;
  y: number;
}

/** Well-spread orbital placement: each body is offset from the last by the golden angle. */
export function layoutPosition(au: number, index: number): LayoutPosition {
  const angleDeg = (index * GOLDEN_ANGLE) % 360;
  const rad = (angleDeg * Math.PI) / 180;
  return {
    au,
    angleDeg,
    x: +(au * Math.cos(rad)).toFixed(4),
    y: +(au * Math.sin(rad)).toFixed(4)
  };
}
