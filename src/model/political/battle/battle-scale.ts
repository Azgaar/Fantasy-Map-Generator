// The size of a battle: a field unit is a metre, a tick is eight seconds. See docs/domain/battles.md.

export const TICK_SECONDS = 8;
const RANKS = 5; // a battalion stands so deep, a metre a man along its front
export const DEFAULT_BATTALION = 300; // men: the size the battle was balanced at
export const COLS = 100; // the grid of a field of any size: a node is 1% of its width
export const ROWS = 60;

const FRONTS = 1000 / 44; // battalion fronts across the field
const SIEGE_SHARE = 0.12; // of the field's width a besieged burg's radius is, at least
const MIN_WIDTH = 250;
const MAX_WIDTH = 10000;

export interface FieldSize {
  width: number;
  height: number;
  cell: number; // of a grid node
  front: number; // a full battalion's
}

/** The field for battalions of so many men; a siege narrows it to its burg */
export function getFieldSize(men: number, siegeRadius = Infinity): FieldSize {
  const front = men / RANKS;
  const width = Math.min(Math.max(Math.min(front * FRONTS, siegeRadius / SIEGE_SHARE), MIN_WIDTH), MAX_WIDTH);
  return { width, height: (width * ROWS) / COLS, cell: width / COLS, front };
}

export const toMetresPerTick = (kmh: number): number => (kmh / 3.6) * TICK_SECONDS;
export const toMetresPerSecond = (metresPerTick: number): number => metresPerTick / TICK_SECONDS;

/** Ticks in so many minutes */
export const minutesToTicks = (minutes: number): number => Math.round((minutes * 60) / TICK_SECONDS);

/** Time elapsed by a tick: m:ss, h:mm:ss past an hour */
export function formatClock(tick: number): string {
  const seconds = Math.round(tick * TICK_SECONDS);
  const pad = (value: number): string => String(value).padStart(2, "0");
  const [hours, minutes] = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60)];
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds % 60)}` : `${minutes}:${pad(seconds % 60)}`;
}
