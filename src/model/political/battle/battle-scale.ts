// The size of a battle: a field unit is a metre, a tick is eight seconds. See docs/domain/battles.md.

export const TICK_SECONDS = 8;
const RANKS = 5; // a battalion stands so deep, a metre a man along its front
const WIDEST = 1000; // men a battalion stands in five ranks at most: a bigger one stands deeper on the same front
export const DEFAULT_BATTALION = 300; // men: the size the battle was balanced at
export const COLS = 100; // the grid of a field of any size: a node is 1% of its width
export const ROWS = 60;
export const SURROUND = [2, 2]; // grid nodes of ground round each side of the field, across and down: drawn, never fought on
export const SCENE = [COLS + SURROUND[0] * 2, ROWS + SURROUND[1] * 2]; // grid nodes of the field and the ground round it
export const VIEW_ASPECT = SCENE[0] / SCENE[1]; // the screen and the exports take in the whole scene, even margins round the field

const FRONTS = 1000 / 44; // battalion fronts across the field
const SIEGE_RING = 340; // metres out of the walls the besiegers stand at most: the land round a burg, and a front more
const SIEGE_ZOOM = 1.5; // a siege field is at most so many times as wide as its battalions or its ring ask for
const SIEGE_ARMY = 0.6; // and at least so much of the field its battalions ask for: a ring is shorter than a line
const MIN_WIDTH = 250;

export interface FieldSize {
  width: number;
  height: number;
  cell: number; // of a grid node
  front: number; // a full battalion's
}

class BattleScaleModule {
  /**
   * The field for battalions of so many men; a siege takes in its whole burg and the land about it, top to bottom, as
   * far as the besiegers will stand off the walls
   */
  getFieldSize(men: number, siegeRadius = Infinity, ring = SIEGE_RING): FieldSize {
    const front = Math.min(men, WIDEST) / RANKS;
    const army = front * FRONTS;
    const land = ring + front;
    const siege = Number.isFinite(siegeRadius)
      ? Math.max(
          Math.min(this.toWidth(land + siegeRadius), Math.max(army, this.toWidth(land)) * SIEGE_ZOOM),
          army * SIEGE_ARMY
        )
      : 0;
    const width = Math.max(siege || army, MIN_WIDTH);
    return { width, height: (width * ROWS) / COLS, cell: width / COLS, front };
  }

  /** The radius a besieged burg is drawn with: its own, smaller where its field is too small for it */
  fitSiegeBurg(radius: number, size: FieldSize, ring = SIEGE_RING): number {
    return Math.min(radius, size.height / 2 - ring - size.front);
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
}

export const BattleScale = new BattleScaleModule();
