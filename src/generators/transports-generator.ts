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

const DEFAULT_TRANSPORTS: readonly Transport[] = [
  { i: 1, name: "On foot (laden)", speed: 3, domain: "land" },
  { i: 2, name: "On foot (light)", speed: 5, domain: "land" },
  { i: 3, name: "Horseback (no spare horse)", speed: 7, domain: "land" },
  { i: 4, name: "Horseback (spare horse)", speed: 12, domain: "land" },
  { i: 5, name: "Carriage", speed: 6, domain: "land" },
  { i: 6, name: "Stagecoach", speed: 10, domain: "land" },
  { i: 7, name: "Train", speed: 40, domain: "land" },
  { i: 8, name: "Automobile", speed: 50, domain: "land" },
  { i: 9, name: "Modern Automobile", speed: 80, domain: "land" },
  { i: 10, name: "Rowboat", speed: 4, domain: "water" },
  { i: 11, name: "Sailing boat", speed: 6, domain: "water" },
  { i: 12, name: "Sailing Ship", speed: 10, domain: "water" },
  { i: 13, name: "Steamship", speed: 25, domain: "water" },
  { i: 14, name: "Modern Ship", speed: 35, domain: "water" },
  { i: 15, name: "Aircraft", speed: 120, domain: "air" },
  { i: 16, name: "Dirigible", speed: 20, domain: "air" },
  { i: 17, name: "Helicopter", speed: 220, domain: "air" },
  { i: 18, name: "Modern Airplane", speed: 800, domain: "air" },
  { i: 19, name: "Teleport", speed: 10000, domain: "air" },
  { i: 20, name: "Stay", speed: 0, domain: "stay" }
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
