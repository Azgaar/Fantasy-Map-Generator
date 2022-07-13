export const MIN_LAND_HEIGHT = 20;

export const MAX_HEIGHT = 100;

export enum DISTANCE_FIELD {
  UNMARKED = 0,
  WATER_COAST = -1,
  LAND_COAST = 1,
  DEEPER_WATER = -2,
  LANDLOCKED = 2
}
