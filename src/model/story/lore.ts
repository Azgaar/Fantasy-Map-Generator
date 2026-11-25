// The map's lore in `options.map.lore`: its name, calendar and the author's description. See docs/architecture/configuration.md
import { Pins } from "@/model/options/pins";
import { Names } from "@/model/society/names/names-generator";
import { Toponyms } from "@/model/society/names/toponyms-generator";
import { seeded } from "@/utils/probability-utils";
import { requireName } from "@/utils/validation-utils";

class LoreModel {
  /** Name a new map and its era in the bases its cultures use; what the user has pinned stays */
  generate(): void {
    seeded(`${options.map.seed}|lore`, () => {
      const [era, name] = [Names.getEra(), Toponyms.mapName()]; // both, so that a pin moves neither
      if (Pins.rolls("era")) this.setEra(era);
      if (Pins.rolls("mapName")) this.rename(name);
    });
  }

  /** Rename the map; files it is downloaded as take the name */
  rename(name: string): void {
    options.map.lore.name = requireName(name);
  }

  /** Set the current year, a whole number that may be negative; history and battle reports are dated by it */
  setYear(year: number): void {
    if (typeof year !== "number" || !Number.isFinite(year)) throw new Error("The year must be a number");
    const { calendar } = options.map.lore;
    const shift = Math.round(year) - calendar.year;
    calendar.year += shift;

    // move campaigns
    const campaigns = new Set(pack.states.flatMap(s => s.campaigns ?? []));
    for (const campaign of campaigns) {
      campaign.start += shift;
      if (campaign.end !== undefined) campaign.end += shift;
    }
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
