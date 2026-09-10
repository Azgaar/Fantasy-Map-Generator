/**
 * The travel domain of a transport type: determines both pathfinding strategy and endpoint validation.
 *   land: walks, wheels, hooves: land-only (endpoints must be on land or coastal). Uses road network if possible.
 *   water: boats, ships: water-only (endpoints must be in water or coastal). Uses sea findPath.
 *   air: flight, magic: unrestricted; goes in a direct line, ignores terrain.
 *   flight: airplanes: skyport to skyport along an existing air route (fork: burgs with skyPort).
 *   rotor: helicopters: a straight line that stays within half its range of a skyport, so it can turn back.
 *   stay: no movement: for story-telling delays (tavern rest, waiting).
 */
export type TransportDomain = "land" | "water" | "air" | "flight" | "rotor" | "stay";

export interface Transport {
  i: number;
  name: string;
  speed: number; // km/h; the UI converts it to the user distance unit
  domain: TransportDomain;
  /** Hours of travel a day sustains with this transport: a caravan walks 8, a dirigible drifts 24 */
  hoursPerDay?: number; // absent in maps saved before it became configurable
  /** rotor only: km it can fly before it must be back at a skyport */
  range?: number;
  icon?: string;
}

export const MAX_HOURS_PER_DAY = 24;
export const DEFAULT_ROTOR_RANGE = 600; // km

/** Fallback travel hours per day, by domain: used for transports saved before the setting existed */
const FALLBACK_HOURS_PER_DAY: Record<TransportDomain, number> = {
  land: 8,
  water: 12,
  air: 8,
  flight: 12,
  rotor: 6,
  stay: MAX_HOURS_PER_DAY
};

const DEFAULT_TRANSPORTS: readonly Transport[] = [
  { i: 1, name: "On foot (laden)", speed: 3, domain: "land", hoursPerDay: 8 },
  { i: 2, name: "On foot (light)", speed: 5, domain: "land", hoursPerDay: 8 },
  { i: 3, name: "Horseback (no spare horse)", speed: 7, domain: "land", hoursPerDay: 8 },
  { i: 4, name: "Horseback (spare horse)", speed: 12, domain: "land", hoursPerDay: 10 },
  { i: 5, name: "Carriage", speed: 6, domain: "land", hoursPerDay: 10 },
  { i: 6, name: "Stagecoach", speed: 10, domain: "land", hoursPerDay: 12 },
  { i: 7, name: "Train", speed: 40, domain: "land", hoursPerDay: 24 },
  { i: 8, name: "Automobile", speed: 50, domain: "land", hoursPerDay: 10 },
  { i: 9, name: "Modern Automobile", speed: 80, domain: "land", hoursPerDay: 12 },
  { i: 10, name: "Rowboat", speed: 4, domain: "water", hoursPerDay: 8 },
  { i: 11, name: "Sailing boat", speed: 6, domain: "water", hoursPerDay: 12 },
  { i: 12, name: "Sailing Ship", speed: 10, domain: "water", hoursPerDay: 24 },
  { i: 13, name: "Steamship", speed: 25, domain: "water", hoursPerDay: 24 },
  { i: 14, name: "Modern Ship", speed: 35, domain: "water", hoursPerDay: 24 },
  { i: 15, name: "Aircraft", speed: 120, domain: "flight", hoursPerDay: 4 },
  { i: 16, name: "Dirigible", speed: 20, domain: "air", hoursPerDay: 24 },
  { i: 17, name: "Helicopter", speed: 220, domain: "rotor", hoursPerDay: 6, range: DEFAULT_ROTOR_RANGE },
  { i: 18, name: "Modern Airplane", speed: 800, domain: "flight", hoursPerDay: 12 },
  { i: 19, name: "Teleport", speed: 10000, domain: "air", hoursPerDay: 24 },
  { i: 20, name: "Stay", speed: 0, domain: "stay", hoursPerDay: 24 }
];

class TransportsModule {
  get all(): Transport[] {
    const transports = options.map.transports;
    for (let i = 0; i < transports.length; i++) transports[i] = this.upgrade(transports[i]);
    return transports;
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

  /**
   * Hours of travel a day sustains with the named transport. Journeys convert travel hours
   * into days with it, so a dirigible's 24 h/day day covers three times a walker's 8 h/day one.
   */
  getHoursPerDay(name: string): number {
    const transport = this.get(name);
    return transport ? this.resolveHoursPerDay(transport) : FALLBACK_HOURS_PER_DAY[this.getDomain(name)];
  }

  /** Configured hours per day, or the domain fallback when the value is missing or out of range */
  resolveHoursPerDay(transport: Transport): number {
    const hours = Number(transport.hoursPerDay);
    if (Number.isFinite(hours) && hours > 0 && hours <= MAX_HOURS_PER_DAY) return hours;
    return FALLBACK_HOURS_PER_DAY[transport.domain] ?? FALLBACK_HOURS_PER_DAY.land;
  }

  /** Range in km of a rotor transport; unknown names and unset values take the default helicopter's */
  getRange(name: string): number {
    const range = Number(this.get(name)?.range);
    return Number.isFinite(range) && range > 0 ? range : DEFAULT_ROTOR_RANGE;
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
    options.map.transports = transports;
    Options.save();
  }

  /** Sets stored before aviation was bound to skyports carry the default airplanes and helicopter as plain air */
  private upgrade(transport: Transport): Transport {
    if (transport.domain !== "air") return transport;
    const current = DEFAULT_TRANSPORTS.find(entry => entry.name === transport.name && entry.domain !== "air");
    if (!current) return transport;
    return { ...transport, domain: current.domain, range: transport.range ?? current.range };
  }
}

declare global {
  var Transports: TransportsModule;
}

// biome-ignore lint/suspicious/noRedeclare: legacy seam
export const Transports = new TransportsModule();
window.Transports = Transports;
