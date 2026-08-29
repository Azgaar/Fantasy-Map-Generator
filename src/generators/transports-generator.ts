/**
 * The travel domain of a transport type: determines both pathfinding strategy and endpoint validation.
 *   land: walks, wheels, hooves: land-only (endpoints must be on land or coastal). Uses road network if possible.
 *   water: boats, ships: water-only (endpoints must be in water or coastal). Uses sea findPath.
 *   air: flight, magic: unrestricted; goes in a direct line, ignores terrain.
 *   stay: no movement: for story-telling delays (tavern rest, waiting).
 */
export type TransportDomain = "land" | "water" | "air" | "stay";

export interface Transport {
  i: number;
  name: string;
  speed: number; // km/h; the UI converts it to the user distance unit
  domain: TransportDomain;
  icon?: string;
}

const STORAGE_KEY = "options-transports";

// Speeds are in km/h and are converted to the user distance unit for display only.
// Reference sustained travel distances (they already account for rests, so a day is `hoursPerDay`, 8 by default):
// Travel on foot, with luggage: 15 km / 9 miles. (75 km / 46 miles per week)
// Travel on foot, minimum luggage: 20-22 km / 12.5-14 miles. (100-110 km, 65 miles per week)
// Travel on horseback, no spare horse: 30-40 km, 19-25 miles. (150-200 km, 95-125 miles per week)
// Travel on horseback, with a spare horse: 40-60 km, 25-37 miles. (200-300 km, 125-185 miles per week)
// Sea transport: 200 kilometres (120 mi) a day
// Oxen cart: 2-3 km / hour. <30km a day.

const DEFAULT_TRANSPORTS: readonly Transport[] = [
  { i: 1, name: "On foot", speed: 3, domain: "land" },
  { i: 2, name: "Horse", speed: 8, domain: "land" },
  { i: 3, name: "Carriage", speed: 5, domain: "land" },
  { i: 4, name: "Boat", speed: 6, domain: "water" },
  { i: 5, name: "Ship", speed: 10, domain: "water" },
  { i: 6, name: "Airship", speed: 20, domain: "air" },
  { i: 7, name: "Stay", speed: 0, domain: "stay" }
];

class TransportsModule {
  get all(): Transport[] {
    options.transports ??= this.getStored();
    return options.transports;
  }

  getDefaults(): Transport[] {
    return DEFAULT_TRANSPORTS.map(transport => ({ ...transport }));
  }

  /** Segments reference transports by name, so a renamed or removed one no longer resolves */
  get(name: string): Transport | undefined {
    return this.all.find(transport => transport.name === name);
  }

  /** Domain of the named transport; unknown names are treated as unrestricted */
  getDomain(name: string): TransportDomain {
    return this.get(name)?.domain ?? "air";
  }

  /** First transport able to travel the domain, undefined if the user removed them all */
  getByDomain(domain: TransportDomain): Transport | undefined {
    return this.all.find(transport => transport.domain === domain);
  }

  getNextId(): number {
    return this.all.length ? Math.max(...this.all.map(transport => transport.i)) + 1 : 0;
  }

  /** Replace the whole set, e.g. on removal or defaults restore */
  set(transports: Transport[]): void {
    options.transports = transports;
    this.save();
  }

  /** Keep the current set as the starting point for the next map */
  save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.all));
  }

  /** The set the user configured last, falling back to the defaults if there is none or it is unreadable */
  private getStored(): Transport[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return this.getDefaults();

      const parsed = JSON.parse(stored) as Transport[];
      return parsed.length ? parsed : this.getDefaults();
    } catch (error) {
      ERROR && console.error("Invalid stored transports", error);
      return this.getDefaults();
    }
  }
}

declare global {
  var Transports: TransportsModule;
}

window.Transports = new TransportsModule();
