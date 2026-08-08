import type { TransportType } from "@/types/Journey";

// Speeds are in the app's current distance unit per hour (mph when distanceUnitInput is "mi").
// Values below are reasonable sustained travel speeds in miles per hour.
export const DEFAULT_TRANSPORT_TYPES: TransportType[] = [
  { i: 0, name: "On Foot", speed: 3, domain: "land" },
  { i: 1, name: "Horse", speed: 8, domain: "land" },
  { i: 2, name: "Carriage", speed: 5, domain: "land" },
  { i: 3, name: "Boat", speed: 6, domain: "water" },
  { i: 4, name: "Ship", speed: 10, domain: "water" },
  { i: 5, name: "Airship", speed: 20, domain: "air" },
  { i: 6, name: "Stay", speed: 0, domain: "stay" }
];

export const getDefaultTransportTypes = (): TransportType[] => DEFAULT_TRANSPORT_TYPES.map(t => ({ ...t }));
