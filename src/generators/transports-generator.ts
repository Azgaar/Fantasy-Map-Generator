import type { Transport, TransportDomain } from "@/types/Journey";

const STORAGE_KEY = "options-transports";

const DEFAULT_TRANSPORTS: readonly Transport[] = [
  { i: 0, name: "On Foot", speed: 3, domain: "land" },
  { i: 1, name: "Horse", speed: 8, domain: "land" },
  { i: 2, name: "Carriage", speed: 5, domain: "land" },
  { i: 3, name: "Boat", speed: 6, domain: "water" },
  { i: 4, name: "Ship", speed: 10, domain: "water" },
  { i: 5, name: "Airship", speed: 20, domain: "air" },
  { i: 6, name: "Stay", speed: 0, domain: "stay" }
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
