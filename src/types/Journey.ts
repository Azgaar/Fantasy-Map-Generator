export type JourneyPoint = [number, number, number]; // [x, y, cellId]

export interface JourneySegment {
  i: number;
  name: string;
  color?: string;
  from?: number;
  to?: number;
  transport: string;
  speed: number; // km/h; the UI converts it to the user distance unit
  distance: number; // px
  points: JourneyPoint[];
  avoidRoads?: boolean; // Land-domain only
  duration?: number; // hours; overrides the distance/speed calculation when set
  custom?: boolean; // path drawn by the user cell-by-cell
  visible?: boolean;
}

export interface Journey {
  i: number;
  name: string;
  type: string; // what kind of travel this is: "Quest", "Raid", "Pilgrimage"
  color: string; // segments may override it
  segments: JourneySegment[];
  visible?: boolean;
  lock?: boolean;
}
