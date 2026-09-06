// What is true about the map: saved into .map; docs/architecture/configuration.md
import { type FactsData, factsSchema } from "@/components/facts-schema";
import { Pins } from "@/components/pins";
import { getPointsNumber } from "@/data/graph-density";
import { Burgs } from "@/generators/burgs-generator";
import { Coastline } from "@/generators/coastline-generator";
import { Labels } from "@/generators/labels-generator";
import { Military } from "@/generators/military-generator";
import { Names } from "@/generators/names-generator";
import { Transports } from "@/generators/transports-generator";
import { gauss, P, rand } from "@/utils/probabilityUtils";
import { parseSections } from "@/utils/schemaUtils";

declare global {
  var Facts: FactsModel;
  /** what is true about the map on screen, written where the map changes and saved to the file */
  var facts: FactsData;
}

class FactsModel {
  /** A new map before anything has run: every value present, each from the module that owns it */
  getDefault(): FactsData {
    return {
      seed: "",
      graph: { width: 1280, height: 800, points: 10000 },
      geography: {
        mapSize: 100,
        latitude: 50,
        longitude: 50,
        coordinates: { latT: 180, latN: 90, latS: -90, lonT: 320, lonW: -160, lonE: 160 }
      },
      climate: {
        temperature: { equator: 27, northPole: -30, southPole: -15 },
        precipitation: 100,
        winds: [225, 45, 225, 315, 135, 315]
      },
      cultures: { set: "world" },
      lore: { name: "", description: "", calendar: { year: 1000, era: "Era", eraShort: "E" } },
      units: {
        distance: { unit: this.isImperial() ? "mi" : "km", scale: 3 },
        area: { unit: "square" },
        height: { unit: this.isImperial() ? "ft" : "m", exponent: 2 },
        temperature: { unit: this.isFahrenheit() ? "°F" : "°C" },
        population: { scale: 1000, urbanization: { rate: 1, density: 10 } }
      },
      style: { preset: "default" },
      burgs: { groups: Burgs.getDefaultGroups() },
      labels: { resizeOnZoom: true, groups: Labels.getDefaultGroups() },
      military: { units: Military.getDefaultOptions() },
      transports: Transports.getDefaults(),
      coastline: Coastline.getDefaultSettings()
    };
  }

  /** Establish the facts a new map starts from */
  apply(): void {
    const fresh = this.getDefault();
    fresh.seed = facts.seed; // setSeed resolved it and reseeded the PRNG before the roll

    const { graph, cultures } = options.generation;
    fresh.graph = { width: graph.width, height: graph.height, points: getPointsNumber(graph.density) };
    fresh.cultures = { set: cultures.set };

    // the user's own sets or defaults
    fresh.military.units = Options.recall("military") ?? fresh.military.units;
    fresh.transports = Options.recall("transports") ?? fresh.transports;
    fresh.burgs.groups = Options.recall("burgGroups") ?? fresh.burgs.groups;
    fresh.labels.groups = Options.recall("labelGroups") ?? fresh.labels.groups;
    fresh.coastline = Options.recall("coastline") ?? fresh.coastline;

    globalThis.facts = fresh;
    this.rollUnpinned();
  }

  /**
   * Take a parsed object as the facts of the map now on screen. Replaces wholesale: a section the
   * file lacked comes back as its default, never as the previous map's value
   */
  adopt(data: FactsData): void {
    globalThis.facts = data;
    const defaults = this.getDefault();
    if (!facts.burgs.groups?.length) facts.burgs.groups = defaults.burgs.groups;
    if (!facts.labels.groups?.length) facts.labels.groups = defaults.labels.groups;
    if (!facts.military.units?.length) facts.military.units = defaults.military.units;
    if (!facts.transports?.length) facts.transports = defaults.transports;

    Burgs.ensureDefaultGroup(facts.burgs.groups);
    Labels.restoreMissingTypes(facts.labels.groups);
  }

  /**
   * Every fact with no request of its own, in one place: rolled unless the user pinned it, and put
   * back at the pinned value where they did. The block below it has no roll at all - the pipeline
   * or a fact-owning editor writes those, and a pin is the whole of what carries them to a new map.
   * The lat/lon box is not touched here: the pipeline re-derives it right after this runs
   */
  private rollUnpinned(): void {
    const { geography, climate, units, lore } = facts;
    const { temperature } = climate;

    temperature.equator = Pins.rolls("temperatureEquator")
      ? gauss(25, 7, 20, 35, 0)
      : Pins.valueOr("temperatureEquator", temperature.equator);
    temperature.northPole = Pins.rolls("temperatureNorthPole")
      ? gauss(-25, 7, -40, 10, 0)
      : Pins.valueOr("temperatureNorthPole", temperature.northPole);
    temperature.southPole = Pins.rolls("temperatureSouthPole")
      ? gauss(-15, 7, -40, 10, 0)
      : Pins.valueOr("temperatureSouthPole", temperature.southPole);
    climate.precipitation = Pins.rolls("prec") ? gauss(100, 40, 5, 500) : Pins.valueOr("prec", climate.precipitation);
    units.distance.scale = Pins.rolls("distanceScale")
      ? gauss(3, 1, 1, 5)
      : Pins.valueOr("distanceScale", units.distance.scale);
    lore.calendar.year = Pins.rolls("year") ? rand(100, 2000) : Pins.valueOr("year", lore.calendar.year);

    if (Pins.rolls("era")) {
      lore.calendar.era = this.randomEra();
      lore.calendar.eraShort = this.shortEra();
    } else {
      lore.calendar.era = Pins.valueOr("era", lore.calendar.era);
      lore.calendar.eraShort = Pins.valueOr("eraShort", lore.calendar.eraShort);
    }

    lore.name = Pins.valueOr("mapName", lore.name);
    geography.mapSize = Pins.valueOr("mapSize", geography.mapSize);
    geography.latitude = Pins.valueOr("latitude", geography.latitude);
    geography.longitude = Pins.valueOr("longitude", geography.longitude);
    units.distance.unit = Pins.valueOr("distanceUnit", units.distance.unit);
    units.area.unit = Pins.valueOr("areaUnit", units.area.unit);
    units.height.unit = Pins.valueOr("heightUnit", units.height.unit);
    units.height.exponent = Pins.valueOr("heightExponent", units.height.exponent);
    units.temperature.unit = Pins.valueOr("temperatureScale", units.temperature.unit);
    units.population.scale = Pins.valueOr("populationRate", units.population.scale);
    units.population.urbanization.rate = Pins.valueOr("urbanization", units.population.urbanization.rate);
    units.population.urbanization.density = Pins.valueOr("urbanDensity", units.population.urbanization.density);
  }

  private locale(): string {
    return typeof navigator === "undefined" ? "" : navigator.language;
  }

  private isImperial(): boolean {
    return ["en-US", "en-GB"].includes(this.locale());
  }

  private isFahrenheit(): boolean {
    return this.locale() === "en-US";
  }

  /** Validate an untrusted settings object from a `.map`, repairing what it can */
  parse(json: unknown): FactsData {
    return parseSections<FactsData>(factsSchema, this.getDefault(), json, "Facts.parse");
  }

  randomEra(): string {
    return `${Names.getBaseShort(P(0.7) ? 1 : rand(Names.nameBases.length))} Era`;
  }

  shortEra(): string {
    return facts.lore.calendar.era
      .split(" ")
      .filter(Boolean)
      .map(word => word[0].toUpperCase())
      .join("");
  }
}

// biome-ignore lint/suspicious/noRedeclare: legacy seam
export const Facts = new FactsModel();

globalThis.facts = Facts.getDefault();
globalThis.Facts = Facts;
