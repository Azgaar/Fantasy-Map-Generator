import type { TransportType } from "@/types/Journey";

// Speeds are in the app's current distance unit per hour (mph when distanceUnitInput is "mi").
// Values below are reasonable sustained travel speeds in miles per hour.
export const DEFAULT_TRANSPORT_TYPES: TransportType[] = [
  { i: 0, name: "On Foot", speed: 3, domain: "land", color: "#8b5a2b" },
  { i: 1, name: "Horse", speed: 8, domain: "land", color: "#a0522d" },
  { i: 2, name: "Carriage", speed: 5, domain: "land", color: "#654321" },
  { i: 3, name: "Boat", speed: 6, domain: "water", color: "#3a6ea5" },
  { i: 4, name: "Ship", speed: 10, domain: "water", color: "#1f4e79" },
  { i: 5, name: "Airship", speed: 20, domain: "air", color: "#8a2be2" }
];

export const getDefaultTransportTypes = (): TransportType[] => DEFAULT_TRANSPORT_TYPES.map(t => ({ ...t }));

declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy main.js
  var getDefaultTransportTypes: () => TransportType[];
}
window.getDefaultTransportTypes = getDefaultTransportTypes;
