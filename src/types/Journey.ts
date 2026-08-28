/**
 * The travel domain of a transport type: determines both pathfinding strategy and endpoint validation.
 *   land: walks, wheels, hooves: land-only (endpoints must be on land or coastal). Uses road network if possible.
 *   water: boats, ships: water-only (endpoints must be in water or coastal). Uses sea findPath.
 *   air: flight, magic: unrestricted; goes in a direct line, ignores terrain.
 *   stay: no movement: for story-telling delays (tavern rest, waiting).
 */
export type TransportDomain = "land" | "water" | "air" | "stay";

export interface TransportType {
  i: number;
  name: string;
  speed: number; // current distance unit per hour
  domain: TransportDomain;
  icon?: string;
}

export type JourneyPoint = [number, number, number]; // [x, y, cellId]

export interface JouneySegment {
  id: number;
  name: string;
  color?: string;
  from?: number;
  to?: number;
  transportType: string;
  speed: number; // in current distance-unit per hour
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
  type: string; // what kind of travel this is: "Quest", "Trade caravan", "Pilgrimage"
  color: string; // segments may override it
  segments: JouneySegment[];
  visible?: boolean;
  lock?: boolean;
}
