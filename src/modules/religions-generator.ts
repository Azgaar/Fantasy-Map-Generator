import { quadtree } from "d3";
import {
  abbreviate,
  byId,
  each,
  gauss,
  getAdjective,
  getMixedColor,
  getRandomColor,
  isWater,
  ra,
  rand,
  rw,
  trimVowels,
} from "../utils";

declare global {
  var Religions: ReligionsModule;
}

interface ReligionBase {
  type: "Folk" | "Organized" | "Cult" | "Heresy";
  form: string;
  culture: number;
  center: number;
}

interface NamedReligion extends ReligionBase {
  name: string;
  deity: string | null;
  expansion: string;
  expansionism: number;
  color: string;
}

export interface Religion extends NamedReligion {
  i: number;
  code?: string;
  origins?: number[] | null;
  lock?: boolean;
  removed?: boolean;
  cells?: number;
  area?: number;
  rural?: number;
  urban?: number;
}

// name generation approach and relative chance to be selected
const approach: Record<string, number> = {
  Number: 1,
  Being: 3,
  Adjective: 5,
  "Color + Animal": 5,
  "Adjective + Animal": 5,
  "Adjective + Being": 5,
  "Adjective + Genitive": 1,
  "Color + Being": 3,
  "Color + Genitive": 3,
  "Being + of + Genitive": 2,
  "Being + of the + Genitive": 1,
  "Animal + of + Genitive": 1,
  "Adjective + Being + of + Genitive": 2,
  "Adjective + Animal + of + Genitive": 2,
};

// turn weighted array into simple array
const approaches: string[] = [];
for (const a in approach) {
  for (let j = 0; j < approach[a]; j++) {
    approaches.push(a);
  }
}

const base = {
  number: [
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
  ],
  being: [
    "Ancestor",
    "Ancient",
    "Avatar",
    "Brother",
    "Champion",
    "Chief",
    "Council",
    "Creator",
    "Deity",
    "Divine One",
    "Elder",
    "Enlightened Being",
    "Father",
    "Forebear",
    "Forefather",
    "Giver",
    "God",
    "Goddess",
    "Guardian",
    "Guide",
    "Hierach",
    "Lady",
    "Lord",
    "Maker",
    "Master",
    "Mother",
    "Numen",
    "Oracle",
    "Overlord",
    "Protector",
    "Reaper",
    "Ruler",
    "Sage",
    "Seer",
    "Sister",
    "Spirit",
    "Supreme Being",
    "Transcendent",
    "Virgin",
  ],
  animal: [
    "Antelope",
    "Ape",
    "Badger",
    "Basilisk",
    "Bear",
    "Beaver",
    "Bison",
    "Boar",
    "Buffalo",
    "Camel",
    "Cat",
    "Centaur",
    "Cerberus",
    "Chimera",
    "Cobra",
    "Cockatrice",
    "Crane",
    "Crocodile",
    "Crow",
    "Cyclope",
    "Deer",
    "Dog",
    "Direwolf",
    "Drake",
    "Dragon",
    "Eagle",
    "Elephant",
    "Elk",
    "Falcon",
    "Fox",
    "Goat",
    "Goose",
    "Gorgon",
    "Gryphon",
    "Hare",
    "Hawk",
    "Heron",
    "Hippogriff",
    "Horse",
    "Hound",
    "Hyena",
    "Ibis",
    "Jackal",
    "Jaguar",
    "Kitsune",
    "Kraken",
    "Lark",
    "Leopard",
    "Lion",
    "Manticore",
    "Mantis",
    "Marten",
    "Minotaur",
    "Moose",
    "Mule",
    "Narwhal",
    "Owl",
    "Ox",
    "Panther",
    "Pegasus",
    "Phoenix",
    "Python",
    "Rat",
    "Raven",
    "Roc",
    "Rook",
    "Scorpion",
    "Serpent",
    "Shark",
    "Sheep",
    "Snake",
    "Sphinx",
    "Spider",
    "Swan",
    "Tiger",
    "Turtle",
    "Unicorn",
    "Viper",
    "Vulture",
    "Walrus",
    "Wolf",
    "Wolverine",
    "Worm",
    "Wyvern",
    "Yeti",
  ],
  adjective: [
    "Aggressive",
    "Almighty",
    "Ancient",
    "Beautiful",
    "Benevolent",
    "Big",
    "Blind",
    "Blond",
    "Bloody",
    "Brave",
    "Broken",
    "Brutal",
    "Burning",
    "Calm",
    "Celestial",
    "Cheerful",
    "Crazy",
    "Cruel",
    "Dead",
    "Deadly",
    "Devastating",
    "Distant",
    "Disturbing",
    "Divine",
    "Dying",
    "Eternal",
    "Ethernal",
    "Empyreal",
    "Enigmatic",
    "Enlightened",
    "Evil",
    "Explicit",
    "Fair",
    "Far",
    "Fat",
    "Fatal",
    "Favorable",
    "Flying",
    "Friendly",
    "Frozen",
    "Giant",
    "Good",
    "Grateful",
    "Great",
    "Happy",
    "High",
    "Holy",
    "Honest",
    "Huge",
    "Hungry",
    "Illustrious",
    "Immutable",
    "Ineffable",
    "Infallible",
    "Inherent",
    "Last",
    "Latter",
    "Lost",
    "Loud",
    "Lucky",
    "Mad",
    "Magical",
    "Main",
    "Major",
    "Marine",
    "Mythical",
    "Mystical",
    "Naval",
    "New",
    "Noble",
    "Old",
    "Otherworldly",
    "Patient",
    "Peaceful",
    "Pregnant",
    "Prime",
    "Proud",
    "Pure",
    "Radiant",
    "Resplendent",
    "Sacred",
    "Sacrosanct",
    "Sad",
    "Scary",
    "Secret",
    "Selected",
    "Serene",
    "Severe",
    "Silent",
    "Sleeping",
    "Slumbering",
    "Sovereign",
    "Strong",
    "Sunny",
    "Superior",
    "Supernatural",
    "Sustainable",
    "Transcendent",
    "Transcendental",
    "Troubled",
    "Unearthly",
    "Unfathomable",
    "Unhappy",
    "Unknown",
    "Unseen",
    "Waking",
    "Wild",
    "Wise",
    "Worried",
    "Young",
  ],
  genitive: [
    "Cold",
    "Day",
    "Death",
    "Doom",
    "Fate",
    "Fire",
    "Fog",
    "Frost",
    "Gates",
    "Heaven",
    "Home",
    "Ice",
    "Justice",
    "Life",
    "Light",
    "Lightning",
    "Love",
    "Nature",
    "Night",
    "Pain",
    "Snow",
    "Springs",
    "Summer",
    "Thunder",
    "Time",
    "Victory",
    "War",
    "Winter",
  ],
  theGenitive: [
    "Abyss",
    "Blood",
    "Dawn",
    "Earth",
    "East",
    "Eclipse",
    "Fall",
    "Harvest",
    "Moon",
    "North",
    "Peak",
    "Rainbow",
    "Sea",
    "Sky",
    "South",
    "Stars",
    "Storm",
    "Sun",
    "Tree",
    "Underworld",
    "West",
    "Wild",
    "Word",
    "World",
  ],
  color: [
    "Amber",
    "Black",
    "Blue",
    "Bright",
    "Bronze",
    "Brown",
    "Coral",
    "Crimson",
    "Dark",
    "Emerald",
    "Golden",
    "Green",
    "Grey",
    "Indigo",
    "Lavender",
    "Light",
    "Magenta",
    "Maroon",
    "Orange",
    "Pink",
    "Plum",
    "Purple",
    "Red",
    "Ruby",
    "Sapphire",
    "Teal",
    "Turquoise",
    "White",
    "Yellow",
  ],
};

const forms: Record<string, Record<string, number>> = {
  Folk: {
    Shamanism: 4,
    Animism: 4,
    Polytheism: 4,
    "Ancestor Worship": 2,
    "Nature Worship": 1,
    Totemism: 1,
  },
  Organized: {
    Polytheism: 7,
    Monotheism: 7,
    Dualism: 3,
    Pantheism: 2,
    "Non-theism": 2,
  },
  Cult: {
    Cult: 5,
    "Dark Cult": 5,
    Sect: 1,
  },
  Heresy: {
    Heresy: 1,
  },
};

const namingMethods: Record<string, Record<string, number>> = {
  Folk: {
    "Culture + type": 1,
  },

  Organized: {
    "Random + type": 3,
    "Random + ism": 1,
    "Supreme + ism": 5,
    "Faith of + Supreme": 5,
    "Place + ism": 1,
    "Culture + ism": 2,
    "Place + ian + type": 6,
    "Culture + type": 4,
  },

  Cult: {
    "Burg + ian + type": 2,
    "Random + ian + type": 1,
    "Type + of the + meaning": 2,
  },

  Heresy: {
    "Burg + ian + type": 3,
    "Random + ism": 3,
    "Random + ian + type": 2,
    "Type + of the + meaning": 1,
  },
};

const types: Record<string, Record<string, number>> = {
  Shamanism: { Beliefs: 3, Shamanism: 2, Druidism: 1, Spirits: 1 },
  Animism: { Spirits: 3, Beliefs: 1 },
  Polytheism: { Deities: 3, Faith: 1, Gods: 1, Pantheon: 1 },
  "Ancestor Worship": { Beliefs: 1, Forefathers: 2, Ancestors: 2 },
  "Nature Worship": { Beliefs: 3, Druids: 1 },
  Totemism: { Beliefs: 2, Totems: 2, Idols: 1 },

  Monotheism: { Religion: 2, Church: 3, Faith: 1 },
  Dualism: { Religion: 3, Faith: 1, Cult: 1 },
  Pantheism: { Religion: 1, Faith: 1 },
  "Non-theism": { Beliefs: 3, Spirits: 1 },

  Cult: { Cult: 4, Sect: 2, Arcanum: 1, Order: 1, Worship: 1 },
  "Dark Cult": {
    Cult: 2,
    Blasphemy: 1,
    Circle: 1,
    Coven: 1,
    Idols: 1,
    Occultism: 1,
  },
  Sect: { Sect: 3, Society: 1 },

  Heresy: {
    Heresy: 3,
    Sect: 2,
    Apostates: 1,
    Brotherhood: 1,
    Circle: 1,
    Dissent: 1,
    Dissenters: 1,
    Iconoclasm: 1,
    Schism: 1,
    Society: 1,
  },
};

const expansionismMap: Record<string, () => number> = {
  Folk: () => 0,
  Organized: () => gauss(5, 3, 0, 10, 1),
  Cult: () => gauss(0.5, 0.5, 0, 5, 1),
  Heresy: () => gauss(1, 0.5, 0, 5, 1),
};

class ReligionsModule {
  generate() {
    TIME && console.time("generateReligions");
    const lockedReligions =
      pack.religions?.filter((r) => r.i && r.lock && !r.removed) || [];

    const folkReligions = this.generateFolkReligions();
    const organizedReligions = this.generateOrganizedReligions(
      +religionsNumber.value,
      lockedReligions,
    );

    const namedReligions = this.specifyReligions([
      ...folkReligions,
      ...organizedReligions,
    ]);
    const indexedReligions = this.combineReligions(
      namedReligions,
      lockedReligions,
    );
    const religionIds = this.expandReligions(indexedReligions);
    const religions = this.defineOrigins(religionIds, indexedReligions);

    pack.religions = religions;
    pack.cells.religion = religionIds;

    this.checkCenters();

    TIME && console.timeEnd("generateReligions");
  }

  private generateFolkReligions(): ReligionBase[] {
    return pack.cultures
      .filter((c) => c.i && !c.removed)
      .map((culture) => ({
        type: "Folk" as const,
        form: rw(forms.Folk),
        culture: culture.i,
        center: culture.center!,
      }));
  }

  private generateOrganizedReligions(
    desiredReligionNumber: number,
    lockedReligions: Religion[],
  ): ReligionBase[] {
    const cells = pack.cells;
    const lockedReligionCount =
      lockedReligions.filter(({ type }) => type !== "Folk").length || 0;
    const requiredReligionsNumber = desiredReligionNumber - lockedReligionCount;
    if (requiredReligionsNumber < 1) return [];

    const candidateCells = getCandidateCells();
    const religionCores = placeReligions();

    const cultsCount = Math.floor((rand(1, 4) / 10) * religionCores.length); // 10-40%
    const heresiesCount = Math.floor((rand(0, 3) / 10) * religionCores.length); // 0-30%
    const organizedCount = religionCores.length - cultsCount - heresiesCount;

    const getType = (index: number): "Organized" | "Cult" | "Heresy" => {
      if (index < organizedCount) return "Organized";
      if (index < organizedCount + cultsCount) return "Cult";
      return "Heresy";
    };

    return religionCores.map((cellId, index) => {
      const type = getType(index);
      const form = rw(forms[type]);
      const cultureId = cells.culture[cellId];

      return { type, form, culture: cultureId, center: cellId };
    });

    function placeReligions(): number[] {
      const religionCells: number[] = [];
      const religionsTree = quadtree<[number, number]>();

      // pre-populate with locked centers
      for (const { center } of lockedReligions) {
        religionsTree.add(cells.p[center]);
      }

      // min distance between religion inceptions
      const spacing = (graphWidth + graphHeight) / 2 / desiredReligionNumber;

      for (const cellId of candidateCells) {
        const [x, y] = cells.p[cellId];

        if (religionsTree.find(x, y, spacing) === undefined) {
          religionCells.push(cellId);
          religionsTree.add([x, y]);

          if (religionCells.length === requiredReligionsNumber)
            return religionCells;
        }
      }

      WARN &&
        console.warn(
          `Placed only ${religionCells.length} of ${requiredReligionsNumber} religions`,
        );
      return religionCells;
    }

    function getCandidateCells(): number[] {
      const validBurgs = pack.burgs.filter((b) => b.i && !b.removed);

      if (validBurgs.length >= requiredReligionsNumber)
        return validBurgs
          .sort((a, b) => b.population! - a.population!)
          .map((burg) => burg.cell);
      return cells.i
        .filter((i) => cells.s[i] > 2)
        .sort((a, b) => cells.s[b] - cells.s[a]);
    }
  }

  private specifyReligions(newReligions: ReligionBase[]): NamedReligion[] {
    const { cells, cultures } = pack;

    const rawReligions = newReligions.map(
      ({ type, form, culture: cultureId, center }) => {
        const supreme = this.getDeityName(cultureId);
        const deity: string | null =
          form === "Non-theism" || form === "Animism"
            ? null
            : (supreme ?? null);

        const stateId = cells.state[center];

        let [name, expansion] = this.generateReligionName(
          type,
          form,
          supreme!,
          center,
        );
        if (expansion === "state" && !stateId) expansion = "global";

        const expansionism = expansionismMap[type]();
        const color = getReligionColor(cultures[cultureId], type);

        return {
          name,
          type,
          form,
          culture: cultureId,
          center,
          deity,
          expansion,
          expansionism,
          color,
        };
      },
    );

    return rawReligions;

    function getReligionColor(
      culture: (typeof pack.cultures)[number],
      type: string,
    ): string {
      if (!culture.i) return getRandomColor();

      if (type === "Folk") return culture.color!;
      if (type === "Heresy") return getMixedColor(culture.color!, 0.35, 0.2);
      if (type === "Cult") return getMixedColor(culture.color!, 0.5, 0);
      return getMixedColor(culture.color!, 0.25, 0.4);
    }
  }

  // indexes, conditionally renames, and abbreviates religions
  private combineReligions(
    namedReligions: NamedReligion[],
    lockedReligions: Religion[],
  ): Religion[] {
    const indexedReligions: Religion[] = [
      { name: "No religion", i: 0 } as Religion,
    ];

    const { lockedReligionQueue, highestLockedIndex, codes, numberLockedFolk } =
      parseLockedReligions();
    const maxIndex = Math.max(
      highestLockedIndex,
      namedReligions.length + lockedReligions.length + 1 - numberLockedFolk,
    );

    for (
      let index = 1, progress = 0;
      index < maxIndex;
      index = indexedReligions.length
    ) {
      // place locked religion back at its old index
      if (index === lockedReligionQueue[0]?.i) {
        const nextReligion = lockedReligionQueue.shift()!;
        indexedReligions.push(nextReligion);
        continue;
      }

      // slot the new religions
      if (progress < namedReligions.length) {
        const nextReligion = namedReligions[progress];
        progress++;

        if (
          nextReligion.type === "Folk" &&
          lockedReligions.some(
            ({ type, culture }) =>
              type === "Folk" && culture === nextReligion.culture,
          )
        )
          continue; // when there is a locked Folk religion for this culture discard duplicate

        const newName = renameOld(nextReligion);
        const code = abbreviate(newName, codes);
        codes.push(code);
        indexedReligions.push({
          ...nextReligion,
          i: index,
          name: newName,
          code,
        });
        continue;
      }

      indexedReligions.push({
        i: index,
        type: "Folk",
        culture: 0,
        name: "Removed religion",
        removed: true,
      } as Religion);
    }
    return indexedReligions;

    function parseLockedReligions() {
      // copy and sort the locked religions list
      const lockedReligionQueue = lockedReligions
        .map((religion) => {
          // and filter their origins to locked religions
          let newOrigin = religion.origins!.filter((n) =>
            lockedReligions.some(({ i: index }) => index === n),
          );
          if (newOrigin.length === 0) newOrigin = [0];
          return { ...religion, origins: newOrigin };
        })
        .sort((a, b) => a.i - b.i);

      const highestLockedIndex = Math.max(
        ...lockedReligions.map((r) => r.i),
        0,
      );
      const codes =
        lockedReligions.length > 0 ? lockedReligions.map((r) => r.code!) : [];
      const numberLockedFolk = lockedReligions.filter(
        ({ type }) => type === "Folk",
      ).length;

      return {
        lockedReligionQueue,
        highestLockedIndex,
        codes,
        numberLockedFolk,
      };
    }

    // prepend 'Old' to names of folk religions which have organized competitors
    function renameOld({
      name,
      type,
      culture: cultureId,
    }: NamedReligion): string {
      if (type !== "Folk") return name;

      const haveOrganized =
        namedReligions.some(
          ({ type, culture, expansion }) =>
            culture === cultureId &&
            type === "Organized" &&
            expansion === "culture",
        ) ||
        lockedReligions.some(
          ({ type, culture, expansion }) =>
            culture === cultureId &&
            type === "Organized" &&
            expansion === "culture",
        );
      if (haveOrganized && name.slice(0, 3) !== "Old") return `Old ${name}`;
      return name;
    }
  }

  // finally generate and stores origins trees
  private defineOrigins(
    religionIds: Uint16Array,
    indexedReligions: Religion[],
  ): Religion[] {
    const religionOriginsParamsMap: Record<
      string,
      { clusterSize: number; maxReligions: number }
    > = {
      Organized: { clusterSize: 100, maxReligions: 2 },
      Cult: { clusterSize: 50, maxReligions: 3 },
      Heresy: { clusterSize: 50, maxReligions: 4 },
    };

    const origins = indexedReligions.map(
      ({ i, type, culture: cultureId, expansion, center }) => {
        if (i === 0) return null; // no religion
        if (type === "Folk") return [0]; // folk religions originate from its parent culture only

        const folkReligion = indexedReligions.find(
          ({ culture, type }) => type === "Folk" && culture === cultureId,
        );
        const isFolkBased =
          folkReligion &&
          cultureId &&
          expansion === "culture" &&
          each(2)(center);
        if (isFolkBased) return [folkReligion.i];

        const { clusterSize, maxReligions } = religionOriginsParamsMap[type];
        const fallbackOrigin = folkReligion?.i || 0;
        return this.getReligionsInRadius(
          pack.cells.c,
          center,
          religionIds,
          i,
          clusterSize,
          maxReligions,
          fallbackOrigin,
        );
      },
    );

    return indexedReligions.map((religion, index) => ({
      ...religion,
      origins: origins[index],
    }));
  }

  private getReligionsInRadius(
    neighbors: number[][],
    center: number,
    religionIds: Uint16Array,
    religionId: number,
    clusterSize: number,
    maxReligions: number,
    fallbackOrigin: number,
  ): number[] {
    const foundReligions = new Set<number>();
    const queue = [center];
    const checked: Record<number, boolean> = {};

    for (let size = 0; queue.length && size < clusterSize; size++) {
      const cellId = queue.shift()!;
      checked[cellId] = true;

      for (const neibId of neighbors[cellId]) {
        if (checked[neibId]) continue;
        checked[neibId] = true;

        const neibReligion = religionIds[neibId];
        if (neibReligion && neibReligion < religionId)
          foundReligions.add(neibReligion);
        if (foundReligions.size >= maxReligions) return [...foundReligions];
        queue.push(neibId);
      }
    }

    return foundReligions.size ? [...foundReligions] : [fallbackOrigin];
  }

  // growth algorithm to assign cells to religions
  private expandReligions(religions: Religion[]): Uint16Array {
    const { cells } = pack;
    const religionIds = this.spreadFolkReligions(religions);

    const queue = new FlatQueue();
    const cost: number[] = [];

    // limit cost for organized religions growth
    const maxExpansionCost =
      (cells.i.length / 20) *
      (byId("growthRate") as HTMLInputElement).valueAsNumber;

    religions
      .filter((r) => r.i && !r.lock && r.type !== "Folk" && !r.removed)
      .forEach((r) => {
        religionIds[r.center] = r.i;
        queue.push({ e: r.center, p: 0, r: r.i, s: cells.state[r.center] }, 0);
        cost[r.center] = 1;
      });

    const religionsMap = new Map(religions.map((r) => [r.i, r]));

    while (queue.length) {
      const { e: cellId, p, r, s: state } = queue.pop();
      const religion = religionsMap.get(r)!;
      const { culture, expansion, expansionism } = religion;

      cells.c[cellId].forEach((nextCell) => {
        if (expansion === "culture" && culture !== cells.culture[nextCell])
          return;
        if (expansion === "state" && state !== cells.state[nextCell]) return;
        if (religionsMap.get(religionIds[nextCell])?.lock) return;

        const cultureCost = culture !== cells.culture[nextCell] ? 10 : 0;
        const stateCost = state !== cells.state[nextCell] ? 10 : 0;
        const passageCost = getPassageCost(cellId, nextCell);

        const cellCost = cultureCost + stateCost + passageCost;
        const totalCost = p + 10 + cellCost / expansionism;
        if (totalCost > maxExpansionCost) return;

        if (!cost[nextCell] || totalCost < cost[nextCell]) {
          if (cells.culture[nextCell]) religionIds[nextCell] = r; // assign religion to cell
          cost[nextCell] = totalCost;

          queue.push({ e: nextCell, p: totalCost, r, s: state }, totalCost);
        }
      });
    }

    return religionIds;

    function getPassageCost(cellId: number, nextCellId: number): number {
      const route = Routes.getRoute(cellId, nextCellId);
      if (isWater(cellId, pack)) return route ? 50 : 500;

      const biomePassageCost = biomesData.cost[cells.biome[nextCellId]];

      if (route) {
        if (route.group === "roads") return 1;
        return biomePassageCost / 3; // trails and other routes
      }

      return biomePassageCost;
    }
  }

  // folk religions initially get all cells of their culture, and locked religions are retained
  private spreadFolkReligions(religions: Religion[]): Uint16Array {
    const cells = pack.cells;
    const hasPrior = cells.religion && true;
    const religionIds = new Uint16Array(cells.i.length);

    const folkReligions = religions.filter(
      (religion) => religion.type === "Folk" && !religion.removed,
    );
    const cultureToReligionMap = new Map(
      folkReligions.map(({ i, culture }) => [culture, i]),
    );

    for (const cellId of cells.i) {
      const oldId = (hasPrior && cells.religion[cellId]) || 0;
      if (oldId && religions[oldId]?.lock && !religions[oldId]?.removed) {
        religionIds[cellId] = oldId;
        continue;
      }
      const cultureId = cells.culture[cellId];
      religionIds[cellId] = cultureToReligionMap.get(cultureId) || 0;
    }

    return religionIds;
  }

  private checkCenters() {
    const cells = pack.cells;
    pack.religions.forEach((r) => {
      if (!r.i) return;
      // move religion center if it's not within religion area after expansion
      if (cells.religion[r.center] === r.i) return; // in area
      const firstCell = cells.i.find((i) => cells.religion[i] === r.i);
      const cultureHome = pack.cultures[r.culture]?.center;
      if (firstCell)
        r.center = firstCell; // move center, otherwise it's an extinct religion
      else if (r.type === "Folk" && cultureHome) r.center = cultureHome; // reset extinct culture centers
    });
  }

  recalculate() {
    const newReligionIds = this.expandReligions(pack.religions);
    pack.cells.religion = newReligionIds;

    this.checkCenters();
  }

  add(center: number) {
    const { cells, cultures, religions } = pack;
    const religionId = cells.religion[center];
    const i = religions.length;

    const cultureId = cells.culture[center];
    const missingFolk =
      cultureId !== 0 &&
      !religions.some(
        ({ type, culture, removed }) =>
          type === "Folk" && culture === cultureId && !removed,
      );
    const color = missingFolk
      ? cultures[cultureId].color!
      : getMixedColor(religions[religionId].color!, 0.3, 0);

    const type: "Folk" | "Organized" | "Cult" | "Heresy" = missingFolk
      ? "Folk"
      : religions[religionId].type === "Organized"
        ? (rw({ Organized: 4, Cult: 1, Heresy: 2 }) as
            | "Organized"
            | "Cult"
            | "Heresy")
        : (rw({ Organized: 5, Cult: 2 }) as "Organized" | "Cult");
    const form = rw(forms[type]);
    const deity =
      type === "Heresy"
        ? religions[religionId].deity
        : form === "Non-theism" || form === "Animism"
          ? null
          : this.getDeityName(cultureId);

    const [name, expansion] = this.generateReligionName(
      type,
      form,
      deity!,
      center,
    );

    const formName = type === "Heresy" ? religions[religionId].form : form;
    const code = abbreviate(
      name,
      religions.map((r) => r.code!),
    );
    const influences = this.getReligionsInRadius(
      cells.c,
      center,
      cells.religion as Uint16Array,
      i,
      25,
      3,
      0,
    );
    const origins = type === "Folk" ? [0] : influences;

    religions.push({
      i,
      name,
      color,
      culture: cultureId,
      type,
      form: formName,
      deity,
      expansion,
      expansionism: expansionismMap[type](),
      center,
      cells: 0,
      area: 0,
      rural: 0,
      urban: 0,
      origins,
      code,
    });
    cells.religion[center] = i;
  }

  // get supreme deity name
  getDeityName(culture: number): string | undefined {
    if (culture === undefined) {
      ERROR && console.error("Please define a culture");
      return;
    }
    const meaning = this.generateMeaning();
    const cultureName = Names.getCulture(culture);
    return `${cultureName}, The ${meaning}`;
  }

  private generateReligionName(
    variety: string,
    form: string,
    deity: string,
    center: number,
  ): [string, string] {
    const { cells, cultures, burgs, states } = pack;

    const random = () => Names.getCulture(cells.culture[center]);
    const type = rw(types[form]);
    const supreme = deity.split(/[ ,]+/)[0];
    const culture = cultures[cells.culture[center]].name;

    const place = (adj?: boolean): string => {
      const burgId = cells.burg[center];
      const stateId = cells.state[center];

      const base = burgId ? burgs[burgId].name! : states[stateId].name;
      const name = trimVowels(base.split(/[ ,]+/)[0]);
      return adj ? getAdjective(name) : name;
    };

    const m = rw(namingMethods[variety]);
    if (m === "Random + type") return [`${random()} ${type}`, "global"];
    if (m === "Random + ism") return [`${trimVowels(random())}ism`, "global"];
    if (m === "Supreme + ism" && deity)
      return [`${trimVowels(supreme)}ism`, "global"];
    if (m === "Faith of + Supreme" && deity)
      return [
        `${ra(["Faith", "Way", "Path", "Word", "Witnesses"])} of ${supreme}`,
        "global",
      ];
    if (m === "Place + ism") return [`${place()}ism`, "state"];
    if (m === "Culture + ism") return [`${trimVowels(culture!)}ism`, "culture"];
    if (m === "Place + ian + type") return [`${place(true)} ${type}`, "state"];
    if (m === "Culture + type") return [`${culture} ${type}`, "culture"];
    if (m === "Burg + ian + type") return [`${place(true)} ${type}`, "global"];
    if (m === "Random + ian + type")
      return [`${getAdjective(random())} ${type}`, "global"];
    if (m === "Type + of the + meaning")
      return [`${type} of the ${this.generateMeaning()}`, "global"];
    return [`${trimVowels(random())}ism`, "global"]; // else
  }

  private generateMeaning(): string {
    const a = ra(approaches); // select generation approach
    if (a === "Number") return ra(base.number);
    if (a === "Being") return ra(base.being);
    if (a === "Adjective") return ra(base.adjective);
    if (a === "Color + Animal") return `${ra(base.color)} ${ra(base.animal)}`;
    if (a === "Adjective + Animal")
      return `${ra(base.adjective)} ${ra(base.animal)}`;
    if (a === "Adjective + Being")
      return `${ra(base.adjective)} ${ra(base.being)}`;
    if (a === "Adjective + Genitive")
      return `${ra(base.adjective)} ${ra(base.genitive)}`;
    if (a === "Color + Being") return `${ra(base.color)} ${ra(base.being)}`;
    if (a === "Color + Genitive")
      return `${ra(base.color)} ${ra(base.genitive)}`;
    if (a === "Being + of + Genitive")
      return `${ra(base.being)} of ${ra(base.genitive)}`;
    if (a === "Being + of the + Genitive")
      return `${ra(base.being)} of the ${ra(base.theGenitive)}`;
    if (a === "Animal + of + Genitive")
      return `${ra(base.animal)} of ${ra(base.genitive)}`;
    if (a === "Adjective + Being + of + Genitive")
      return `${ra(base.adjective)} ${ra(base.being)} of ${ra(base.genitive)}`;
    if (a === "Adjective + Animal + of + Genitive")
      return `${ra(base.adjective)} ${ra(base.animal)} of ${ra(base.genitive)}`;

    ERROR && console.error("Unknown generation approach");
    return ra(base.being);
  }
}

window.Religions = new ReligionsModule();
