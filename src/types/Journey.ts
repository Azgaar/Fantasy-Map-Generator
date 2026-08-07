export type JourneyPoint = [number, number, number]; // [x, y, cellId]

/**
 * The travel domain of a transport type — determines both pathfinding strategy and endpoint validation.
 *   land  → walks, wheels, hooves: land-only (endpoints must be on land or coastal). Uses road network if possible.
 *   water → boats, ships: water-only (endpoints must be in water or coastal). Uses sea findPath.
 *   air   → flight, magic: unrestricted; goes in a direct line, ignores terrain.
 */
export type TransportDomain = "land" | "water" | "air";

export interface TransportType {
  i: number;
  name: string;
  speed: number; // in the app's current distance unit per hour (e.g. mph if distanceUnit is "mi")
  domain: TransportDomain;
  color?: string;
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
}

export interface Journey {
  i: number;
  name: string;
  visible: boolean;
  color: string;
  segments: Segment[];
  note?: string;
  lock?: boolean;
}
