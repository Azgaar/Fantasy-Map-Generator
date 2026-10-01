// The map's lore in `options.map.lore`: its name, calendar and the author's description. See docs/architecture/configuration.md
import { Names } from "@/generators/names-generator";
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
}

export const Lore = new LoreModel();
