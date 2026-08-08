import { getDefaultTransportTypes } from "@/data/transport-types";
import type { Journey, Segment } from "@/types/Journey";
import { DEFAULT_JOURNEY_COLOR } from "@/utils/journey-metrics";
import { findJourneyPath } from "@/utils/journey-pathfinding";

declare global {
  var Journeys: JourneysModule;
}

class JourneysModule {
  /**
   * On a fresh random map, seed one demo journey so the Journeys layer is not
   * empty when a user first opens it. Picks two capitals (or largest burgs)
   * on the same landmass and routes overland between them.
   *
   * Skipped when journeys already exist (loaded save, template map) or when
   * the map has fewer than 2 usable burgs.
   */
  public generateDemo(): void {
    if (!pack.transportTypes?.length) pack.transportTypes = getDefaultTransportTypes();
    if (!pack.journeys) pack.journeys = [];
    if (pack.journeys.length) return;

    const burgs = (pack.burgs ?? []).filter(b => b?.i && !b.removed && b.cell !== undefined);
    if (burgs.length < 2) return;

    const capitals = burgs.filter(b => b.capital);
    const pool = capitals.length >= 2 ? capitals : [...burgs].sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

    const overland = pack.transportTypes.find(t => t.domain === "land");
    if (!overland) return;

    for (let i = 0; i < Math.min(pool.length, 6); i++) {
      for (let j = i + 1; j < Math.min(pool.length, 6); j++) {
        const from = pool[i].cell;
        const to = pool[j].cell;
        const result = findJourneyPath(from, to, "land");
        if (result.errorCode || result.points.length < 2) continue;

        const seg: Segment = {
          id: 0,
          name: `${pool[i].name ?? "Start"} → ${pool[j].name ?? "End"}`,
          visible: true,
          from,
          to,
          transportType: overland.name,
          speed: overland.speed,
          distance: result.distance,
          points: result.points
        };
        const journey: Journey = {
          i: 0,
          name: "Sample Journey",
          visible: true,
          color: DEFAULT_JOURNEY_COLOR,
          segments: [seg]
        };
        pack.journeys.push(journey);
        return;
      }
    }
  }
}

window.Journeys = new JourneysModule();
