export type JourneyPoint = [number, number, number]; // [x, y, cellId]

/**
 * The travel domain of a transport type — determines both pathfinding strategy and endpoint validation.
 *   land  → walks, wheels, hooves: land-only (endpoints must be on land or coastal). Uses road network if possible.
 *   water → boats, ships: water-only (endpoints must be in water or coastal). Uses sea findPath.
 *   air   → flight, magic: unrestricted; goes in a direct line, ignores terrain.
 *   stay  → no movement: for story-telling delays (tavern rest, waiting). Uses seg.duration for travel time.
 */
export type TransportDomain = "land" | "water" | "air" | "stay";

export interface TransportType {
  i: number;
  name: string;
  speed: number; // in the app's current distance unit per hour (e.g. mph if distanceUnit is "mi"). 0 for "stay" types.
  domain: TransportDomain;
  icon?: string;
}

export interface Segment {
  id: number;
  name: string;
  visible: boolean;
  color?: string;
  from?: number;
  to?: number;
  transportType: string; // name of TransportType
  speed: number; // in current distance-unit per hour
  distance: number; // px
  points: JourneyPoint[];
  note?: string;
  /**
   * Land-domain only: if true, pathfinder avoids the road network — useful for
   * off-road travel (smuggling, cross-country, wilderness). When false/undefined,
   * pathfinder prefers roads (the default behaviour).
   */
  avoidRoads?: boolean;
  /**
   * Stay-domain only: elapsed time in hours (e.g. a tavern rest, waiting for a caravan).
   * The segment contributes this duration to totals; distance is ignored.
   */
  duration?: number;
  /**
   * True when the segment's path was drawn by the user cell-by-cell rather than
   * produced by the pathfinder. Recompute will overwrite it, so the editor asks
   * before recomputing a custom path.
   */
  custom?: boolean;
}

export interface Journey {
  i: number;
  name: string;
  visible: boolean;
  /**
   * Optional override of the `#journeys` layer stroke (set in the Style panel).
   * Left undefined the journey follows the layer style; a segment's own `color`
   * overrides this in turn.
   */
  color?: string;
  segments: Segment[];
  note?: string;
  lock?: boolean;
}
