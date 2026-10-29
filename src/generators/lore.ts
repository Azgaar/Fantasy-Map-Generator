// The map's lore in `options.map.lore`: its name, calendar and the author's description. See docs/architecture/configuration.md
import { Names } from "@/generators/names-generator";
import type { HistoryMode } from "@/types/history";
import { requireName } from "@/utils/validationUtils";

class LoreModel {
  /** Rename the map; files it is downloaded as take the name */
  rename(name: string): void {
    options.map.lore.name = requireName(name);
  }

  /** Set the current year, a whole number that may be negative; history and battle reports are dated by it */
  setYear(year: number): void {
    if (typeof year !== "number" || !Number.isFinite(year)) throw new Error("The year must be a number");
    options.map.lore.calendar.year = Math.round(year);
  }

  /** Set the era the current year belongs to and its short form, such as "Winter Era" and "WE"; without one the short form is abbreviated from the era */
  setEra(era: string, eraShort?: string): void {
    const { calendar } = options.map.lore;
    calendar.era = requireName(era);
    calendar.eraShort = eraShort === undefined ? Names.getEraShort(calendar.era) : requireName(eraShort);
  }

  /** Set the author's free-text description of the world; empty clears it */
  setDescription(text: string): void {
    if (typeof text !== "string") throw new Error("The description must be text");
    options.map.lore.description = text;
  }

  /** Configure the chronicle generator: how its political past is made, how deep a past it reaches, how many
   * fallen realms it weaves, and what the fallen leave on the map */
  setHistory(config: {
    mode?: HistoryMode;
    span?: number;
    realms?: number;
    density?: number;
    echoes?: boolean;
    ruins?: number;
    renames?: boolean;
  }): void {
    const history = options.map.lore.history;
    if (config.mode !== undefined) {
      if (config.mode !== "archaeologist" && config.mode !== "epochs")
        throw new Error('The history mode must be "archaeologist" or "epochs"');
      history.mode = config.mode;
    }
    if (config.span !== undefined) {
      if (typeof config.span !== "number" || !Number.isFinite(config.span) || config.span < 100)
        throw new Error("The span must be a number of at least 100 years");
      history.span = Math.round(config.span);
    }
    if (config.realms !== undefined) {
      if (
        typeof config.realms !== "number" ||
        !Number.isInteger(config.realms) ||
        config.realms < 0 ||
        config.realms > 10
      )
        throw new Error("The realms count must be a whole number from 0 to 10");
      history.realms = config.realms;
    }
    if (config.density !== undefined) {
      if (
        typeof config.density !== "number" ||
        !Number.isFinite(config.density) ||
        config.density < 0 ||
        config.density > 10
      )
        throw new Error("The density must be a number from 0 to 10");
      history.density = config.density;
    }
    if (config.echoes !== undefined) history.echoes = Boolean(config.echoes);
    if (config.ruins !== undefined) {
      if (
        typeof config.ruins !== "number" ||
        !Number.isInteger(config.ruins) ||
        config.ruins < 1 ||
        config.ruins > 5
      )
        throw new Error("The ruins setting must be a whole number from 1 to 5");
      history.ruins = config.ruins;
    }
    if (config.renames !== undefined) history.renames = Boolean(config.renames);
  }
}

export const Lore = new LoreModel();
