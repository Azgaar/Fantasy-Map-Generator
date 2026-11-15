// The size of a battle: a field unit is a metre, a tick is eight seconds. See docs/domain/battles.md.

export const TICK_SECONDS = 8;
const RANKS = 5; // a battalion stands so deep, a metre a man along its front
export const DEFAULT_BATTALION = 300; // men: the size the battle was balanced at
export const COLS = 100; // the grid of a field of any size: a node is 1% of its width
export const ROWS = 60;
export const SURROUND = [4, 4]; // grid nodes of ground round each side of the field, across and down: drawn, never fought on

const FRONTS = 1000 / 44; // battalion fronts across the field
const SIEGE_LAND = 340; // metres of land round a besieged burg, the ring at most, and a battalion front more behind it
const SIEGE_ZOOM = 1.5; // a siege field is at most so many times as wide as its battalions or its ring ask for
const MIN_WIDTH = 250;
const MAX_WIDTH = 10000;

export interface FieldSize {
  width: number;
  height: number;
  cell: number; // of a grid node
  front: number; // a full battalion's
}

class BattleScaleModule {
  /** The field for battalions of so many men; a siege takes in its whole burg and the land about it, top to bottom */
  getFieldSize(men: number, siegeRadius = Infinity): FieldSize {
    const front = men / RANKS;
    const army = front * FRONTS;
    const ring = SIEGE_LAND + front;
    const siege = Number.isFinite(siegeRadius)
      ? Math.min(this.toWidth(ring + siegeRadius), Math.max(army, this.toWidth(ring)) * SIEGE_ZOOM)
      : 0;
    const width = Math.min(Math.max(army, siege, MIN_WIDTH), MAX_WIDTH);
    return { width, height: (width * ROWS) / COLS, cell: width / COLS, front };
  }

  /** The radius a besieged burg is drawn with: its own, smaller where its field is too small for it */
  fitSiegeBurg(radius: number, size: FieldSize): number {
    return Math.min(radius, size.height / 2 - SIEGE_LAND - size.front);
  }

  private toWidth(halfHeight: number): number {
    return (2 * halfHeight * COLS) / ROWS;
  }

  toMetresPerTick(kmh: number): number {
    return (kmh / 3.6) * TICK_SECONDS;
  }

  toMetresPerSecond(metresPerTick: number): number {
    return metresPerTick / TICK_SECONDS;
  }

  /** Ticks in so many minutes */
  minutesToTicks(minutes: number): number {
    return Math.round((minutes * 60) / TICK_SECONDS);
  }

  /** Time elapsed by a tick: m:ss, h:mm:ss past an hour */
  formatClock(tick: number): string {
    const seconds = Math.round(tick * TICK_SECONDS);
    const pad = (value: number): string => String(value).padStart(2, "0");
    const [hours, minutes] = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60)];
    return hours ? `${hours}:${pad(minutes)}:${pad(seconds % 60)}` : `${minutes}:${pad(seconds % 60)}`;
  }
}

export const BattleScale = new BattleScaleModule();
