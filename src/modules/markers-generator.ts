import { mean } from "d3";
import type { PackedGraph } from "../types/PackedGraph";
import { capitalize, convertTemperature, gauss, generateDate, getAdjective, last, P, ra, rand, rn, rw } from "../utils";

declare global {
  var Markers: MarkersModule;
}

type MarkerConfig = {
  type: string;
  icon: string;
  dx?: number;
  dy?: number;
  px?: number;
  min: number;
  each: number;
  multiplier: number;
  list: (pack: PackedGraph) => number[];
  add: (id: string, cell: number) => void;
};

interface Marker {
  i: number;
  type: string;
  icon: string;
  dx?: number;
  dy?: number;
  px?: number;
  cell: number;
  lock?: boolean;
}

class MarkersModule {
  private config: MarkerConfig[];
  private occupied: boolean[];

  constructor() {
    this.config = this.getDefaultConfig();
    this.occupied = [];
  }

  getConfig() {
    return this.config;
  }

  setConfig(newConfig: MarkerConfig[]) {
    this.config = newConfig;
  }

  generate() {
    this.resetConfig();
    pack.markers = [];
    this.generateTypes();
  }

  regenerate() {
    pack.markers = pack.markers.filter(({ i, lock, cell }) => {
      if (lock) {
        this.occupied[cell] = true;
        return true;
      }
      const id = `marker${i}`;
      document.getElementById(id)?.remove();
      const index = notes.findIndex(note => note.id === id);
      if (index !== -1) notes.splice(index, 1);
      return false;
    });

    this.generateTypes();
  }

  add(marker: Marker) {
    const base = this.config.find(c => c.type === marker.type);
    if (base) {
      const { icon, type, dx, dy, px } = base;
      marker = this.addMarker({ icon, type, dx, dy, px }, marker);
      base.add(`marker${marker.i}`, marker.cell);
      return marker;
    }

    const i = last(pack.markers)?.i + 1 || 0;
    pack.markers.push({ ...marker, i });
    this.occupied[marker.cell] = true;
    return { ...marker, i };
  }

  deleteMarker(markerId: number) {
    const noteId = `marker${markerId}`;
    notes = notes.filter(note => note.id !== noteId);
    pack.markers = pack.markers.filter(m => m.i !== markerId);
  }

  private getDefaultConfig(): MarkerConfig[] {
    const culturesSet = (document.getElementById("culturesSet") as HTMLSelectElement | null)?.value || "";
    const isFantasy = culturesSet.includes("Fantasy");

    /*
      Default markers config:
      type - short description (snake-case)
      icon - unicode character or url to image
      dx: icon offset in x direction, in pixels
      dy: icon offset in y direction, in pixels
      min: minimum number of candidates to add at least 1 marker
      each: how many of the candidates should be added as markers
      multiplier: multiply markers quantity to add
      list: function to select candidates
      add: function to add marker legend
    */
    return [
      {
        type: "volcanoes",
        icon: "🌋",
        dx: 52,
        px: 13,
        min: 10,
        each: 500,
        multiplier: 10,
        list: this.listVolcanoes.bind(this),
        add: this.addVolcano.bind(this)
      },
      {
        type: "hot-springs",
        icon: "🏝️",
        dy: 52,
        min: 30,
        each: 200,
        multiplier: 5,
        list: this.listHotSprings.bind(this),
        add: this.addHotSpring.bind(this)
      },
      {
        type: "water-sources",
        icon: "💧",
        min: 1,
        each: 1000,
        multiplier: 1,
        list: this.listWaterSources.bind(this),
        add: this.addWaterSource.bind(this)
      },
      {
        type: "mines",
        icon: "⛏️",
        dx: 48,
        px: 13,
        min: 1,
        each: 15,
        multiplier: 25,
        list: this.listMines.bind(this),
        add: this.addMine.bind(this)
      },
      {
        type: "gem-mines",
        icon: "💎",
        dx: 48,
        px: 13,
        min: 10,
        each: 20,
        multiplier: 5,
        list: this.listGemMines.bind(this),
        add: this.addGemMines.bind(this)
      },
      {
        type: "bridges",
        icon: "🌉",
        px: 14,
        min: 10,
        each: 5,
        multiplier: 10,
        list: this.listBridges.bind(this),
        add: this.addBridge.bind(this)
      },
      {
        type: "inns",
        icon: "🍻",
        px: 14,
        min: 1,
        each: 100,
        multiplier: 20,
        list: this.listInns.bind(this),
        add: this.addInn.bind(this)
      },
      {
        type: "lighthouses",
        icon: "🚨",
        px: 14,
        min: 1,
        each: 2,
        multiplier: 1,
        list: this.listLighthouses.bind(this),
        add: this.addLighthouse.bind(this)
      },
      {
        type: "waterfalls",
        icon: "⟱",
        dy: 54,
        px: 16,
        min: 10,
        each: 5,
        multiplier: 3,
        list: this.listWaterfalls.bind(this),
        add: this.addWaterfall.bind(this)
      },
      {
        type: "battlefields",
        icon: "⚔️",
        dy: 52,
        min: 20,
        each: 50,
        multiplier: 1,
        list: this.listBattlefields.bind(this),
        add: this.addBattlefield.bind(this)
      },
      {
        type: "dungeons",
        icon: "🗝️",
        dy: 51,
        px: 13,
        min: 10,
        each: 50,
        multiplier: 7,
        list: this.listDungeons.bind(this),
        add: this.addDungeon.bind(this)
      },
      {
        type: "lake-monsters",
        icon: "🐉",
        dy: 48,
        min: 5,
        each: 20,
        multiplier: 5,
        list: this.listLakeMonsters.bind(this),
        add: this.addLakeMonster.bind(this)
      },
      {
        type: "sea-monsters",
        icon: "🦑",
        min: 50,
        each: 50,
        multiplier: 10,
        list: this.listSeaMonsters.bind(this),
        add: this.addSeaMonster.bind(this)
      },
      {
        type: "hill-monsters",
        icon: "👹",
        dy: 54,
        px: 13,
        min: 30,
        each: 60,
        multiplier: 20,
        list: this.listHillMonsters.bind(this),
        add: this.addHillMonster.bind(this)
      },
      {
        type: "Spiders",
        icon: "🕷️",
        dy: 54,
        px: 13,
        min: 10,
        each: 60,
        multiplier: 10,
        list: this.listSpiders.bind(this),
        add: this.addSpiders.bind(this)
      },
      {
        type: "sacred-mountains",
        icon: "🗻",
        dy: 48,
        min: 20,
        each: 50,
        multiplier: 30,
        list: this.listSacredMountains.bind(this),
        add: this.addSacredMountain.bind(this)
      },
      {
        type: "sacred-forests",
        icon: "🌳",
        min: 20,
        each: 200,
        multiplier: 30,
        list: this.listSacredForests.bind(this),
        add: this.addSacredForest.bind(this)
      },
      {
        type: "sacred-pineries",
        icon: "🌲",
        px: 13,
        min: 10,
        each: 100,
        multiplier: 30,
        list: this.listSacredPineries.bind(this),
        add: this.addSacredPinery.bind(this)
      },
      {
        type: "sacred-palm-groves",
        icon: "🌴",
        px: 13,
        min: 20,
        each: 100,
        multiplier: 5,
        list: this.listSacredPalmGroves.bind(this),
        add: this.addSacredPalmGrove.bind(this)
      },
      {
        type: "brigands",
        icon: "💰",
        px: 13,
        min: 50,
        each: 100,
        multiplier: 6,
        list: this.listBrigands.bind(this),
        add: this.addBrigands.bind(this)
      },
      {
        type: "pirates",
        icon: "🏴‍☠️",
        dx: 51,
        min: 40,
        each: 100,
        multiplier: 3,
        list: this.listPirates.bind(this),
        add: this.addPirates.bind(this)
      },
      {
        type: "statues",
        icon: "🗿",
        min: 80,
        each: 1200,
        multiplier: 1,
        list: this.listStatues.bind(this),
        add: this.addStatue.bind(this)
      },
      {
        type: "ruins",
        icon: "🏺",
        min: 80,
        each: 1200,
        multiplier: 5,
        list: this.listRuins.bind(this),
        add: this.addRuins.bind(this)
      },
      {
        type: "citadel",
        icon: "🏯",
        min: 80,
        each: 500,
        multiplier: 10,
        list: this.listCitadel.bind(this),
        add: this.addCitadel.bind(this)
      },
      {
        type: "libraries",
        icon: "📚",
        min: 10,
        each: 1200,
        multiplier: 1,
        list: this.listLibraries.bind(this),
        add: this.addLibrary.bind(this)
      },
      {
        type: "circuses",
        icon: "🎪",
        min: 80,
        each: 1000,
        multiplier: 1,
        list: this.listCircuses.bind(this),
        add: this.addCircus.bind(this)
      },
      {
        type: "jousts",
        icon: "🤺",
        dx: 48,
        min: 5,
        each: 500,
        multiplier: 2,
        list: this.listJousts.bind(this),
        add: this.addJoust.bind(this)
      },
      {
        type: "fairs",
        icon: "🎠",
        min: 50,
        each: 1000,
        multiplier: 1,
        list: this.listFairs.bind(this),
        add: this.addFair.bind(this)
      },
      {
        type: "canoes",
        icon: "🛶",
        min: 1000,
        each: 2000,
        multiplier: 3,
        list: this.listCanoes.bind(this),
        add: this.addCanoe.bind(this)
      },
      {
        type: "migration",
        icon: "🐗",
        min: 20,
        each: 150,
        multiplier: 10,
        list: this.listMigrations.bind(this),
        add: this.addMigration.bind(this)
      },
      {
        type: "dances",
        icon: "💃🏽",
        min: 5,
        each: 60,
        multiplier: 21,
        list: this.listDances.bind(this),
        add: this.addDances.bind(this)
      },
      {
        type: "mirage",
        icon: "💦",
        min: 10,
        each: 400,
        multiplier: 1,
        list: this.listMirage.bind(this),
        add: this.addMirage.bind(this)
      },
      {
        type: "caves",
        icon: "🦇",
        min: 60,
        each: 200,
        multiplier: 25,
        list: this.listCaves.bind(this),
        add: this.addCave.bind(this)
      },
      {
        type: "portals",
        icon: "🌀",
        px: 14,
        min: 20,
        each: 58,
        multiplier: 5,
        list: this.listPortals.bind(this),
        add: this.addPortal.bind(this)
      },
      {
        type: "rifts",
        icon: "🎆",
        min: 5,
        each: 100,
        multiplier: 15,
        list: this.listRifts.bind(this),
        add: this.addRift.bind(this)
      },
      {
        type: "disturbed-burials",
        icon: "💀",
        min: 20,
        each: 3000,
        multiplier: +isFantasy,
        list: this.listDisturbedBurial.bind(this),
        add: this.addDisturbedBurial.bind(this)
      },
      {
        type: "necropolises",
        icon: "🪦",
        min: 20,
        each: 1000,
        multiplier: 1,
        list: this.listNecropolis.bind(this),
        add: this.addNecropolis.bind(this)
      },
      {
        type: "encounters",
        icon: "🧙",
        min: 10,
        each: 600,
        multiplier: 1,
        list: this.listEncounters.bind(this),
        add: this.addEncounter.bind(this)
      }
    ];
  }

  private resetConfig() {
    this.config = this.getDefaultConfig();
  }

  private generateTypes() {
    TIME && console.time("addMarkers");

    this.config.forEach(({ type, icon, dx, dy, px, min, each, multiplier, list, add }) => {
      if (multiplier === 0) return;

      const candidates = Array.from(list(pack));
      let quantity = this.getQuantity(candidates, min, each, multiplier);
      // uncomment for debugging:
      // console.info(`${icon} ${type}: each ${each} of ${candidates.length}, min ${min} candidates. Got ${quantity}`);

      while (quantity && candidates.length) {
        const [cell] = this.extractAnyElement(candidates);
        const marker = this.addMarker({ icon, type, dx, dy, px }, { cell });
        if (!marker) continue;
        add(`marker${marker.i}`, cell);
        quantity--;
      }
    });

    this.occupied = [];
    TIME && console.timeEnd("addMarkers");
  }

  private getQuantity(array: any[], min: number, each: number, multiplier: number) {
    if (!array.length || array.length < min / multiplier) return 0;
    const requestQty = Math.ceil((array.length / each) * multiplier);
    return array.length < requestQty ? array.length : requestQty;
  }

  private extractAnyElement(array: any[]) {
    const index = Math.floor(Math.random() * array.length);
    return array.splice(index, 1);
  }

  private addMarker(base: any, marker: any) {
    if (marker.cell === undefined) return;
    const i = last(pack.markers)?.i + 1 || 0;
    const [x, y] = this.getMarkerCoordinates(marker.cell);
    marker = { ...base, x, y, ...marker, i };
    pack.markers.push(marker);
    this.occupied[marker.cell] = true;
    return marker;
  }

  private getMarkerCoordinates(cell: number) {
    const { cells, burgs } = pack;
    const burgId = cells.burg[cell];

    if (burgId) {
      const { x, y } = burgs[burgId];
      return [x, y];
    }

    return cells.p[cell];
  }

  private listVolcanoes({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] >= 70);
  }

  private addVolcano(id: string, cell: number) {
    const { cells } = pack;

    const proper = Names.getCulture(cells.culture[cell]);
    const name = P(0.3) ? `Mount ${proper}` : P(0.7) ? `${proper} Volcano` : proper;
    const status = P(0.6) ? "Dormant" : P(0.4) ? "Active" : "Erupting";
    notes.push({
      id,
      name,
      legend: `${status} volcano. Height: ${getFriendlyHeight(cells.p[cell])}.`
    });
  }

  private listHotSprings({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] > 50 && cells.culture[i]);
  }

  private addHotSpring(id: string, cell: number) {
    const { cells } = pack;

    const proper = Names.getCulture(cells.culture[cell]);
    const temp = convertTemperature(gauss(35, 15, 20, 100));
    const name = P(0.3) ? `Hot Springs of ${proper}` : P(0.7) ? `${proper} Hot Springs` : proper;
    const legend = `A geothermal springs with naturally heated water that provide relaxation and medicinal benefits. Average temperature is ${temp}.`;

    notes.push({ id, name, legend });
  }

  private listWaterSources({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] > 30 && cells.r[i]);
  }

  private addWaterSource(id: string, cell: number) {
    const { cells } = pack;

    const type = rw({
      "Healing Spring": 5,
      "Purifying Well": 2,
      "Enchanted Reservoir": 1,
      "Creek of Luck": 1,
      "Fountain of Youth": 1,
      "Wisdom Spring": 1,
      "Spring of Life": 1,
      "Spring of Youth": 1,
      "Healing Stream": 1
    });

    const proper = Names.getCulture(cells.culture[cell]);
    const name = `${proper} ${type}`;
    const legend =
      "This legendary water source is whispered about in ancient tales and believed to possess mystical properties. The spring emanates crystal-clear water, shimmering with an otherworldly iridescence that sparkles even in the dimmest light.";

    notes.push({ id, name, legend });
  }

  private listMines({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] > 47 && cells.burg[i]);
  }

  private addMine(id: string, cell: number) {
    const { cells } = pack;

    const resources = {
      salt: 5,
      gold: 2,
      silver: 4,
      copper: 2,
      iron: 3,
      lead: 1,
      tin: 1,
      platinum: 1
    };
    const resource = rw(resources);
    const burg = pack.burgs[cells.burg[cell]];
    const name = `${burg.name} — ${resource} mining town`;
    const population = rn(burg.population! * populationRate * urbanization);
    const legend = `${burg.name} is a mining town of ${population} people just nearby the ${resource} mine.`;
    notes.push({ id, name, legend });
  }

  private listGemMines({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] > 50 && !cells.burg[i]);
  }

  private addGemMines(id: string, cell: number) {
    const { cells } = pack;

    const resources = {
      "Agni mani": 1,
      Alamandine: 1,
      Alestone: 1,
      Alexandrite: 1,
      Algae: 1,
      Amaratha: 1,
      Amber: 1,
      Amethyst: 1,
      Andar: 1,
      Aquamarine: 1,
      Aradite: 1,
      Augelite: 1,
      Aventurine: 1,
      Azurite: 1,
      "Banded agate": 1,
      Beljuril: 1,
      Beryl: 1,
      Heliodor: 1,
      "Black opal": 1,
      "Black pearl": 1,
      "Black sapphire": 1,
      Bloodstone: 1,
      "Blue quartz": 1,
      "Blue sapphire": 1,
      "Blue spinel": 1,
      Bluestone: 1,
      Boakhar: 1,
      Brandeen: 1,
      Carbuncle: 1,
      Carnelian: 1,
      Chalcedony: 1,
      Chrysoberyl: 1,
      Chrysocolla: 1,
      Chrysolite: 1,
      Chrysoprase: 1,
      Citrine: 1,
      Cleiophane: 1,
      Corstal: 1,
      Corundum: 1,
      "Crown of silver": 1,
      Cymophane: 1,
      Datcha: 1,
      Demontoid: 1,
      Diamond: 1,
      Diopside: 1,
      Dioptase: 1,
      Disthene: 1,
      Emerald: 1,
      Epidote: 1,
      Essonite: 1,
      Euclase: 1,
      "Eye agate": 1,
      "Fire agate": 1,
      "Fire opal": 1,
      Flamedance: 1,
      Fluorite: 1,
      "Frost agate": 1,
      Garnet: 1,
      Goldline: 1,
      Greenstone: 1,
      Hambergyle: 1,
      Hematite: 1,
      Hyacinth: 1,
      Hyaline: 1,
      Hyalite: 1,
      Hydrophane: 1,
      Hypersthene: 1,
      Idicolite: 1,
      Iolite: 1,
      Irtios: 1,
      Jacinth: 1,
      Jade: 1,
      Jargoon: 1,
      Jasmal: 1,
      Jasper: 1,
      Jet: 1,
      Kornerupine: 1,
      Kunzite: 1,
      "Lapis lazuli": 1,
      Luriyl: 1,
      "Lynx eye": 1,
      Malachite: 1,
      Malacon: 1,
      Mellochrysos: 1,
      Microcline: 1,
      Moonbar: 1,
      Moonstone: 1,
      Morganite: 1,
      "Moss agate": 1,
      Mykaro: 1,
      Mynteer: 1,
      Nelvine: 1,
      Nephrite: 1,
      Nune: 1,
      Obsidian: 1,
      Octel: 1,
      Olivine: 1,
      Ooline: 1,
      Onyx: 1,
      Ophealine: 1,
      Orbaline: 1,
      Orblen: 1,
      Orl: 1,
      Orprase: 1,
      Pearl: 1,
      Peridot: 1,
      Pyrope: 1,
      Quartz: 1,
      Raindrop: 1,
      "Red Tears": 1,
      Rhodochrosite: 1,
      Rhodolite: 1,
      Rhodonite: 1,
      Rosaline: 1,
      Rubellite: 1,
      Ruby: 1,
      Rusteen: 1,
      Saganite: 1,
      Samarskite: 1,
      Sanidine: 1,
      Sarbossa: 1,
      Sardonyx: 1,
      "Satin spar": 1,
      Scapra: 1,
      Serpentine: 1,
      Shandon: 1,
      Sharpstone: 1,
      Silkstone: 1,
      Sinhalite: 1,
      Skydrop: 1,
      Spessartite: 1,
      Sphene: 1,
      Spinel: 1,
      "Star rose quarts": 1,
      "Star ruby": 1,
      "Star sapphire": 1,
      Sunstone: 1,
      Tabasheer: 1,
      Tanzanite: 1,
      Tchazar: 1,
      Thupartial: 1,
      "Tiger eye": 1,
      Topaz: 1,
      Tourmaline: 1,
      Tremair: 1,
      Turquoise: 1,
      Ulvaen: 1,
      Variscite: 1,
      "Water opal": 1,
      Waterstar: 1,
      "White opal": 1,
      Witherite: 1,
      Wonderstone: 1,
      Woodtine: 1,
      "Yellow sapphire": 1,
      Zarbrina: 1,
      Zendalure: 1,
      Ziose: 1,
      Zircon: 1
    };

    const resource = rw(resources);
    const toponym = Names.getCulture(cells.culture[cell]);
    const name = `${toponym} — ${resource} mine`;
    const legend = `${resource} mine`;
    notes.push({ id, name, legend });
  }

  private listBridges({ cells, burgs }: PackedGraph) {
    const meanFlux = mean(cells.fl.filter(fl => fl)) as number;
    return cells.i.filter(
      i =>
        !this.occupied[i] &&
        cells.burg[i] &&
        cells.t[i] !== 1 &&
        burgs[cells.burg[i]].population! > 20 &&
        cells.r[i] &&
        cells.fl[i] > meanFlux
    );
  }

  private addBridge(id: string, cell: number) {
    const { cells } = pack;

    const burg = pack.burgs[cells.burg[cell]];
    const river = pack.rivers.find(r => r.i === pack.cells.r[cell]);
    const riverName = river ? `${river.name} ${river.type}` : "river";
    const name = river && P(0.2) ? `${river.name} Bridge` : `${burg.name} Bridge`;
    const weightedAdjectives = {
      stone: 10,
      wooden: 1,
      lengthy: 2,
      formidable: 2,
      rickety: 1,
      beaten: 1,
      weathered: 1
    };
    const barriers = [
      "its collapse during the flood",
      "being rumoured to attract trolls",
      "the drying up of local trade",
      "banditry infested the area",
      "the old waypoints crumbled"
    ];
    const legend = P(0.7)
      ? `A ${rw(weightedAdjectives)} bridge spans over the ${riverName} near ${burg.name}.`
      : `An old crossing of the ${riverName}, rarely used since ${ra(barriers)}.`;

    notes.push({ id, name, legend });
  }

  private listInns({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.pop[i] > 5 && Routes.isCrossroad(i));
  }

  private addInn(id: string) {
    const colors = [
      "Dark",
      "Light",
      "Bright",
      "Golden",
      "White",
      "Black",
      "Red",
      "Pink",
      "Purple",
      "Blue",
      "Green",
      "Yellow",
      "Amber",
      "Orange",
      "Brown",
      "Grey"
    ];
    const animals = [
      "Antelope",
      "Ape",
      "Badger",
      "Bear",
      "Beaver",
      "Bison",
      "Boar",
      "Buffalo",
      "Cat",
      "Crane",
      "Crocodile",
      "Crow",
      "Deer",
      "Dog",
      "Eagle",
      "Elk",
      "Fox",
      "Goat",
      "Goose",
      "Hare",
      "Hawk",
      "Heron",
      "Horse",
      "Hyena",
      "Ibis",
      "Jackal",
      "Jaguar",
      "Lark",
      "Leopard",
      "Lion",
      "Mantis",
      "Marten",
      "Moose",
      "Mule",
      "Narwhal",
      "Owl",
      "Panther",
      "Rat",
      "Raven",
      "Rook",
      "Scorpion",
      "Shark",
      "Sheep",
      "Snake",
      "Spider",
      "Swan",
      "Tiger",
      "Turtle",
      "Wolf",
      "Wolverine",
      "Camel",
      "Falcon",
      "Hound",
      "Ox"
    ];
    const adjectives = [
      "New",
      "Good",
      "High",
      "Old",
      "Great",
      "Big",
      "Major",
      "Happy",
      "Main",
      "Huge",
      "Far",
      "Beautiful",
      "Fair",
      "Prime",
      "Ancient",
      "Golden",
      "Proud",
      "Lucky",
      "Fat",
      "Honest",
      "Giant",
      "Distant",
      "Friendly",
      "Loud",
      "Hungry",
      "Magical",
      "Superior",
      "Peaceful",
      "Frozen",
      "Divine",
      "Favorable",
      "Brave",
      "Sunny",
      "Flying"
    ];
    const methods = [
      "Boiled",
      "Grilled",
      "Roasted",
      "Spit-roasted",
      "Stewed",
      "Stuffed",
      "Jugged",
      "Mashed",
      "Baked",
      "Braised",
      "Poached",
      "Marinated",
      "Pickled",
      "Smoked",
      "Dried",
      "Dry-aged",
      "Corned",
      "Fried",
      "Pan-fried",
      "Deep-fried",
      "Dressed",
      "Steamed",
      "Cured",
      "Syrupped",
      "Flame-Broiled"
    ];
    const courses = [
      "beef",
      "pork",
      "bacon",
      "chicken",
      "lamb",
      "chevon",
      "hare",
      "rabbit",
      "hart",
      "deer",
      "antlers",
      "bear",
      "buffalo",
      "badger",
      "beaver",
      "turkey",
      "pheasant",
      "duck",
      "goose",
      "teal",
      "quail",
      "pigeon",
      "seal",
      "carp",
      "bass",
      "pike",
      "catfish",
      "sturgeon",
      "escallop",
      "pie",
      "cake",
      "pottage",
      "pudding",
      "onions",
      "carrot",
      "potato",
      "beet",
      "garlic",
      "cabbage",
      "eggplant",
      "eggs",
      "broccoli",
      "zucchini",
      "pepper",
      "olives",
      "pumpkin",
      "spinach",
      "peas",
      "chickpea",
      "beans",
      "rice",
      "pasta",
      "bread",
      "apples",
      "peaches",
      "pears",
      "melon",
      "oranges",
      "mango",
      "tomatoes",
      "cheese",
      "corn",
      "rat tails",
      "pig ears"
    ];
    const types = [
      "hot",
      "cold",
      "fire",
      "ice",
      "smoky",
      "misty",
      "shiny",
      "sweet",
      "bitter",
      "salty",
      "sour",
      "sparkling",
      "smelly"
    ];
    const drinks = [
      "wine",
      "brandy",
      "gin",
      "whisky",
      "rom",
      "beer",
      "cider",
      "mead",
      "liquor",
      "spirits",
      "vodka",
      "tequila",
      "absinthe",
      "nectar",
      "milk",
      "kvass",
      "kumis",
      "tea",
      "water",
      "juice",
      "sap"
    ];

    const typeName = P(0.3) ? "inn" : "tavern";
    const isAnimalThemed = P(0.7);
    const animal = ra(animals);
    const name = isAnimalThemed
      ? P(0.6)
        ? `${ra(colors)} ${animal}`
        : `${ra(adjectives)} ${animal}`
      : `${ra(adjectives)} ${capitalize(typeName)}`;
    const meal = isAnimalThemed && P(0.3) ? animal : ra(courses);
    const course = `${ra(methods)} ${meal}`.toLowerCase();
    const drink = `${P(0.5) ? ra(types) : ra(colors)} ${ra(drinks)}`.toLowerCase();
    const legend = `A big and famous roadside ${typeName}. Delicious ${course} with ${drink} is served here.`;
    notes.push({ id, name: `The ${name}`, legend });
  }

  private listLighthouses({ cells }: PackedGraph) {
    return cells.i.filter(
      i => !this.occupied[i] && cells.harbor[i] > 6 && cells.c[i].some(c => cells.h[c] < 20 && Routes.isConnected(c))
    );
  }

  private addLighthouse(id: string, cell: number) {
    const { cells } = pack;

    const proper = cells.burg[cell] ? pack.burgs[cells.burg[cell]].name! : Names.getCulture(cells.culture[cell]);
    notes.push({
      id,
      name: `${getAdjective(proper)} Lighthouse`,
      legend: `A lighthouse to serve as a beacon for ships in the open sea.`
    });
  }

  private listWaterfalls({ cells }: PackedGraph) {
    return cells.i.filter(
      i => cells.r[i] && !this.occupied[i] && cells.h[i] >= 50 && cells.c[i].some(c => cells.h[c] < 40 && cells.r[c])
    );
  }

  private addWaterfall(id: string, cell: number) {
    const { cells } = pack;

    const descriptions = [
      "A gorgeous waterfall flows here.",
      "The rapids of an exceptionally beautiful waterfall.",
      "An impressive waterfall has cut through the land.",
      "The cascades of a stunning waterfall.",
      "A river drops down from a great height forming a wondrous waterfall.",
      "A breathtaking waterfall cuts through the landscape."
    ];

    const proper = cells.burg[cell] ? pack.burgs[cells.burg[cell]].name! : Names.getCulture(cells.culture[cell]);
    notes.push({
      id,
      name: `${getAdjective(proper)} Waterfall`,
      legend: `${ra(descriptions)}`
    });
  }

  private listBattlefields({ cells }: PackedGraph) {
    return cells.i.filter(
      i => !this.occupied[i] && cells.state[i] && cells.pop[i] > 2 && cells.h[i] < 50 && cells.h[i] > 25
    );
  }

  private addBattlefield(id: string, cell: number) {
    const { cells, states } = pack;

    const state = states[cells.state[cell]];
    if (!state.campaigns) state.campaigns = States.generateCampaign(state);
    const campaign = ra(state.campaigns);
    const date = generateDate(campaign.start, campaign.end);
    const name = `${Names.getCulture(cells.culture[cell])} Battlefield`;
    const legend = `A historical battle of the ${campaign.name}. \r\nDate: ${date} ${options.era}.`;
    notes.push({ id, name, legend });
  }

  private listDungeons({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.pop[i] && cells.pop[i] < 3);
  }

  private addDungeon(id: string, cell: number) {
    const dungeonSeed = `${seed}${cell}`;
    const name = "Dungeon";
    const legend = `<div>Undiscovered dungeon. See <a href="https://watabou.github.io/one-page-dungeon/?seed=${dungeonSeed}" target="_blank">One page dungeon</a></div><iframe style="pointer-events: none;" src="https://watabou.github.io/one-page-dungeon/?seed=${dungeonSeed}" sandbox="allow-scripts allow-same-origin"></iframe>`;
    notes.push({ id, name, legend });
  }

  private listLakeMonsters({ features }: PackedGraph) {
    return features
      .filter(feature => feature.type === "lake" && feature.group === "freshwater" && !this.occupied[feature.firstCell])
      .map(feature => feature.firstCell);
  }

  private addLakeMonster(id: string, cell: number) {
    const lake = pack.features[pack.cells.f[cell]];

    // Check that the feature is a lake in case the user clicked on a wrong
    // square
    if (lake.type !== "lake") return;

    const name = `${lake.name} Monster`;
    const length = gauss(10, 5, 5, 100);
    const subjects = [
      "Locals",
      "Elders",
      "Inscriptions",
      "Tipplers",
      "Legends",
      "Whispers",
      "Rumors",
      "Journeying folk",
      "Tales"
    ];
    const legend = `${ra(subjects)} say a relic monster of ${length} ${heightUnit.value} long inhabits ${
      lake.name
    } Lake. Truth or lie, folks are afraid to fish in the lake.`;
    notes.push({ id, name, legend });
  }

  private listSeaMonsters({ cells, features }: PackedGraph) {
    return cells.i.filter(
      i => !this.occupied[i] && cells.h[i] < 20 && Routes.isConnected(i) && features[cells.f[i]].type === "ocean"
    );
  }

  private addSeaMonster(id: string, _cell: number) {
    const name = `${Names.getCultureShort(0)} Monster`;
    const length = gauss(25, 10, 10, 100);
    const legend = `Old sailors tell stories of a gigantic sea monster inhabiting these dangerous waters. Rumors say it can be ${length} ${heightUnit.value} long.`;
    notes.push({ id, name, legend });
  }

  private listHillMonsters({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] >= 50 && cells.pop[i]);
  }

  private addHillMonster(id: string, cell: number) {
    const { cells } = pack;

    const adjectives = [
      "great",
      "big",
      "huge",
      "prime",
      "golden",
      "proud",
      "lucky",
      "fat",
      "giant",
      "hungry",
      "magical",
      "superior",
      "terrifying",
      "horrifying",
      "feared"
    ];
    const subjects = [
      "Locals",
      "Elders",
      "Inscriptions",
      "Tipplers",
      "Legends",
      "Whispers",
      "Rumors",
      "Journeying folk",
      "Tales"
    ];
    const species = [
      "Ogre",
      "Troll",
      "Cyclops",
      "Giant",
      "Monster",
      "Beast",
      "Dragon",
      "Undead",
      "Ghoul",
      "Vampire",
      "Hag",
      "Banshee",
      "Bearded Devil",
      "Roc",
      "Hydra",
      "Warg"
    ];
    const modusOperandi = [
      "steals cattle at night",
      "prefers eating children",
      "doesn't mind human flesh",
      "keeps the region at bay",
      "eats kids whole",
      "abducts young women",
      "terrorizes the region",
      "harasses travelers in the area",
      "snatches people from homes",
      "attacks anyone who dares to approach its lair",
      "attacks unsuspecting victims"
    ];

    const monster = ra(species);
    const toponym = Names.getCulture(cells.culture[cell]);
    const name = `${toponym} ${monster}`;
    const legend = `${ra(subjects)} speak of a ${ra(adjectives)} ${monster} who inhabits ${toponym} hills and ${ra(
      modusOperandi
    )}.`;
    notes.push({ id, name, legend });
  }

  private listSpiders({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] <= 50 && cells.h[i] >= 25 && cells.pop[i] <= 4);
  }

  private addSpiders(id: string, cell: number) {
    const { cells } = pack;

    const adjectives = ["prime", "proud", "fat", "hungry", "superior", "terrifying", "horrifying", "feared"];
    const subjects = [
      "Locals",
      "Elders",
      "Inscriptions",
      "Tipplers",
      "Legends",
      "Whispers",
      "Rumors",
      "Journeying folk",
      "Tales"
    ];
    const species = [
      "Giant spider",
      "Giant wolf spider",
      "Mammoth spider",
      "Phase spider",
      "Sword spider",
      "Giant scorpion",
      "Mammoth scorpion"
    ];
    const modusOperandi = [
      "steals goats at night",
      "keeps the region at bay",
      "terrorizes the region",
      "harasses travelers in the area",
      "attacks anyone who dares to approach its lair",
      "attacks unsuspecting victims"
    ];

    const monster = ra(species);
    const toponym = Names.getCulture(cells.culture[cell]);
    const name = `${toponym} ${monster}`;
    const legend = `${ra(subjects)} speak of a ${ra(adjectives)} ${monster} who inhabits ${toponym} and ${ra(modusOperandi)}.`;
    notes.push({ id, name, legend });
  }

  // Sacred mountains spawn on lonely mountains
  private listSacredMountains({ cells }: PackedGraph) {
    return cells.i.filter(
      i =>
        !this.occupied[i] &&
        cells.h[i] >= 70 &&
        cells.c[i].some(c => cells.culture[c]) &&
        cells.c[i].every(c => cells.h[c] < 60)
    );
  }

  private addSacredMountain(id: string, cell: number) {
    const { cells, religions } = pack;

    const culture = cells.c[cell].map(c => cells.culture[c]).find(c => c)!;
    const religion = cells.religion[cell];
    const name = `${Names.getCulture(culture)} Mountain`;
    const height = getFriendlyHeight(cells.p[cell]);
    const legend = `A sacred mountain of ${religions[religion].name}. Height: ${height}.`;
    notes.push({ id, name, legend });
  }

  // Sacred forests spawn on temperate forests
  private listSacredForests({ cells }: PackedGraph) {
    return cells.i.filter(
      i => !this.occupied[i] && cells.culture[i] && cells.religion[i] && [6, 8].includes(cells.biome[i])
    );
  }

  private addSacredForest(id: string, cell: number) {
    const { cells, religions } = pack;

    const culture = cells.culture[cell];
    const religion = cells.religion[cell];
    const name = `${Names.getCulture(culture)} Forest`;
    const legend = `A forest sacred to local ${religions[religion].name}.`;
    notes.push({ id, name, legend });
  }

  // Sacred pineries spawn on boreal forests
  private listSacredPineries({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.culture[i] && cells.religion[i] && cells.biome[i] === 9);
  }

  private addSacredPinery(id: string, cell: number) {
    const { cells, religions } = pack;

    const culture = cells.culture[cell];
    const religion = cells.religion[cell];
    const name = `${Names.getCulture(culture)} Pinery`;
    const legend = `A pinery sacred to local ${religions[religion].name}.`;
    notes.push({ id, name, legend });
  }

  // Sacred palm groves spawn on oasises
  private listSacredPalmGroves({ cells }: PackedGraph) {
    return cells.i.filter(
      i =>
        !this.occupied[i] &&
        cells.culture[i] &&
        cells.religion[i] &&
        cells.biome[i] === 1 &&
        cells.pop[i] > 1 &&
        Routes.isConnected(i)
    );
  }

  private addSacredPalmGrove(id: string, cell: number) {
    const { cells, religions } = pack;

    const culture = cells.culture[cell];
    const religion = cells.religion[cell];
    const name = `${Names.getCulture(culture)} Palm Grove`;
    const legend = `A palm grove sacred to local ${religions[religion].name}.`;
    notes.push({ id, name, legend });
  }

  private listBrigands({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.culture[i] && Routes.hasRoad(i));
  }

  private addBrigands(id: string, cell: number) {
    const { cells } = pack;

    const animals = [
      "Apes",
      "Badgers",
      "Bears",
      "Beavers",
      "Bisons",
      "Boars",
      "Cats",
      "Crows",
      "Dogs",
      "Foxes",
      "Hares",
      "Hawks",
      "Hyenas",
      "Jackals",
      "Jaguars",
      "Leopards",
      "Lions",
      "Owls",
      "Panthers",
      "Rats",
      "Ravens",
      "Rooks",
      "Scorpions",
      "Sharks",
      "Snakes",
      "Spiders",
      "Tigers",
      "Wolfs",
      "Wolverines",
      "Falcons"
    ];
    const types = { brigands: 4, bandits: 3, robbers: 1, highwaymen: 1 };

    const culture = cells.culture[cell];
    const biome = cells.biome[cell];
    const height = cells.h[cell];

    const locality = ((height: number, biome: number) => {
      if (height >= 70) return "highlander";
      if ([1, 2].includes(biome)) return "desert";
      if ([3, 4].includes(biome)) return "mounted";
      if ([5, 6, 7, 8, 9].includes(biome)) return "forest";
      if (biome === 12) return "swamp";
      return "angry";
    })(height, biome);

    const name = `${Names.getCulture(culture)} ${ra(animals)}`;
    const legend = `A gang of ${locality} ${rw(types)}.`;
    notes.push({ id, name, legend });
  }

  // Pirates spawn on sea routes
  private listPirates({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] < 20 && Routes.isConnected(i));
  }

  private addPirates(id: string, _cell: number) {
    const name = "Pirates";
    const legend = "Pirate ships have been spotted in these waters.";
    notes.push({ id, name, legend });
  }

  private listStatues({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] >= 20 && cells.h[i] < 40);
  }

  private addStatue(id: string, cell: number) {
    const { cells } = pack;

    const variants = [
      "Statue",
      "Obelisk",
      "Monument",
      "Column",
      "Monolith",
      "Pillar",
      "Megalith",
      "Stele",
      "Runestone",
      "Sculpture",
      "Effigy",
      "Idol"
    ];
    const scripts = {
      cypriot: "𐠁𐠂𐠃𐠄𐠅𐠈𐠊𐠋𐠌𐠍𐠎𐠏𐠐𐠑𐠒𐠓𐠔𐠕𐠖𐠗𐠘𐠙𐠚𐠛𐠜𐠝𐠞𐠟𐠠𐠡𐠢𐠣𐠤𐠥𐠦𐠧𐠨𐠩𐠪𐠫𐠬𐠭𐠮𐠯𐠰𐠱𐠲𐠳𐠴𐠵𐠷𐠸𐠼𐠿      ",
      geez: "ሀለሐመሠረሰቀበተኀነአከወዐዘየደገጠጰጸፀፈፐ   ",
      coptic: "ⲲⲴⲶⲸⲺⲼⲾⳀⳁⳂⳃⳄⳆⳈⳊⳌⳎⳐⳒⳔⳖⳘⳚⳜⳞⳠⳢⳤ⳥⳧⳩⳪ⳫⳬⳭⳲ⳹⳾   ",
      tibetan: "ༀ༁༂༃༄༅༆༇༈༉༊་༌༐༑༒༓༔༕༖༗༘༙༚༛༜༠༡༢༣༤༥༦༧༨༩༪༫༬༭༮༯༰༱༲༳༴༵༶༷༸༹༺༻༼༽༾༿",
      mongolian: "᠀᠐᠑᠒ᠠᠡᠦᠧᠨᠩᠪᠭᠮᠯᠰᠱᠲᠳᠵᠻᠼᠽᠾᠿᡀᡁᡆᡍᡎᡏᡐᡑᡒᡓᡔᡕᡖᡗᡙᡜᡝᡞᡟᡠᡡᡭᡮᡯᡰᡱᡲᡳᡴᢀᢁᢂᢋᢏᢐᢑᢒᢓᢛᢜᢞᢟᢠᢡᢢᢤᢥᢦ"
    };

    const culture = cells.culture[cell];

    const variant = ra(variants);
    const name = `${Names.getCulture(culture)} ${variant}`;
    const script = scripts[ra(Object.keys(scripts)) as keyof typeof scripts] as string;
    const inscription = Array(rand(40, 100))
      .fill(null)
      .map(() => ra(script.split("")))
      .join("");
    const legend = `An ancient ${variant.toLowerCase()}. It has an inscription, but no one can translate it:
        <div style="font-size: 1.8em; line-break: anywhere;">${inscription}</div>`;
    notes.push({ id, name, legend });
  }

  private listRuins({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.culture[i] && cells.h[i] >= 20 && cells.h[i] < 60);
  }

  private addRuins(id: string, _cell: number) {
    const types = [
      "City",
      "Town",
      "Settlement",
      "Pyramid",
      "Fort",
      "Stronghold",
      "Temple",
      "Sacred site",
      "Mausoleum",
      "Outpost",
      "Fortification",
      "Fortress",
      "Castle"
    ];

    const ruinType = ra(types);
    const name = `Ruined ${ruinType}`;
    const legend = `Ruins of an ancient ${ruinType.toLowerCase()}. Untold riches may lie within.`;
    notes.push({ id, name, legend });
  }

  private listCitadel({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.culture[i] && cells.h[i] >= 20 && Routes.isConnected(i));
  }

  private addCitadel(id: string, _cell: number) {
    const adjectives = [
      "Fantastical",
      "Wondrous",
      "Incomprehensible",
      "Magical",
      "Extraordinary",
      "Unmissable",
      "World-famous",
      "Breathtaking"
    ];

    const adjective = ra(adjectives);
    const name = `${adjective} Citadel`;
    const legend = `This ${adjective.toLowerCase()} citadel radiates magic.`;
    notes.push({ id, name, legend });
  }

  private listLibraries({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.culture[i] && cells.burg[i] && cells.pop[i] > 10);
  }

  private addLibrary(id: string, cell: number) {
    const { cells } = pack;

    const type = rw({ Library: 3, Archive: 1, Collection: 1 });
    const name = `${Names.getCulture(cells.culture[cell])} ${type}`;
    const legend = "A vast collection of knowledge, including many rare and ancient tomes.";

    notes.push({ id, name, legend });
  }

  private listCircuses({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.culture[i] && cells.h[i] >= 20 && Routes.isConnected(i));
  }

  private addCircus(id: string, _cell: number) {
    const adjectives = [
      "Fantastical",
      "Wondrous",
      "Incomprehensible",
      "Magical",
      "Extraordinary",
      "Unmissable",
      "World-famous",
      "Breathtaking"
    ];

    const adjective = ra(adjectives);
    const name = `Travelling ${adjective} Circus`;
    const legend = `Roll up, roll up, this ${adjective.toLowerCase()} circus is here for a limited time only.`;
    notes.push({ id, name, legend });
  }

  private listJousts({ cells, burgs }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.burg[i] && burgs[cells.burg[i]].population! > 20);
  }

  private addJoust(id: string, cell: number) {
    const { cells, burgs } = pack;
    const types = ["Joust", "Competition", "Melee", "Tournament", "Contest"];
    const virtues = ["cunning", "might", "speed", "the greats", "acumen", "brutality"];

    if (!cells.burg[cell]) return;
    const burgName = burgs[cells.burg[cell]].name;
    const type = ra(types);
    const virtue = ra(virtues);

    const name = `${burgName} ${type}`;
    const legend = `Warriors from around the land gather for a ${type.toLowerCase()} of ${virtue} in ${burgName}, with fame, fortune and favour on offer to the victor.`;
    notes.push({ id, name, legend });
  }

  private listFairs({ cells, burgs }: PackedGraph) {
    return cells.i.filter(
      i =>
        !this.occupied[i] &&
        cells.burg[i] &&
        burgs[cells.burg[i]].population! < 20 &&
        burgs[cells.burg[i]].population! > 5
    );
  }

  private addFair(id: string, cell: number) {
    const { cells, burgs } = pack;
    if (!cells.burg[cell]) return;

    const burgName = burgs[cells.burg[cell]].name;
    const type = "Fair";

    const name = `${burgName} ${type}`;
    const legend = `A fair is being held in ${burgName}, with all manner of local and foreign goods and services on offer.`;
    notes.push({ id, name, legend });
  }

  private listCanoes({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.r[i]);
  }

  private addCanoe(id: string, cell: number) {
    const river = pack.rivers.find(r => r.i === pack.cells.r[cell]);

    const name = `Minor Jetty`;
    const riverName = river ? `${river.name} ${river.type}` : "river";
    const legend = `A small location along the ${riverName} to launch boats from sits here, along with a weary looking owner, willing to sell passage along the river.`;
    notes.push({ id, name, legend });
  }

  private listMigrations({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] >= 20 && cells.pop[i] <= 2);
  }

  private addMigration(id: string, _cell: number) {
    const animals = [
      "Antelopes",
      "Apes",
      "Badgers",
      "Bears",
      "Beavers",
      "Bisons",
      "Boars",
      "Buffalo",
      "Cats",
      "Cranes",
      "Crocodiles",
      "Crows",
      "Deer",
      "Dogs",
      "Eagles",
      "Elk",
      "Foxes",
      "Goats",
      "Geese",
      "Hares",
      "Hawks",
      "Herons",
      "Horses",
      "Hyenas",
      "Ibises",
      "Jackals",
      "Jaguars",
      "Larks",
      "Leopards",
      "Lions",
      "Mantises",
      "Martens",
      "Mooses",
      "Mules",
      "Owls",
      "Panthers",
      "Rats",
      "Ravens",
      "Rooks",
      "Scorpions",
      "Sharks",
      "Sheep",
      "Snakes",
      "Spiders",
      "Tigers",
      "Wolves",
      "Wolverines",
      "Camels",
      "Falcons",
      "Hounds",
      "Oxen"
    ];
    const animalChoice = ra(animals);

    const name = `${animalChoice} migration`;
    const legend = `A huge group of ${animalChoice.toLowerCase()} are migrating, whether part of their annual routine, or something more extraordinary.`;
    notes.push({ id, name, legend });
  }

  private listDances({ cells, burgs }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.burg[i] && burgs[cells.burg[i]].population! > 15);
  }

  private addDances(id: string, cell: number) {
    const { cells, burgs } = pack;
    const burgName = burgs[cells.burg[cell]].name;
    const socialTypes = [
      "gala",
      "dance",
      "performance",
      "ball",
      "soiree",
      "jamboree",
      "exhibition",
      "carnival",
      "festival",
      "jubilee",
      "celebration",
      "gathering",
      "fete"
    ];
    const people = [
      "great and the good",
      "nobility",
      "local elders",
      "foreign dignitaries",
      "spiritual leaders",
      "suspected revolutionaries"
    ];
    const socialType = ra(socialTypes);

    const name = `${burgName} ${socialType}`;
    const legend = `A ${socialType} has been organised at ${burgName} as a chance to gather the ${ra(
      people
    )} of the area together to be merry, make alliances and scheme around the crisis.`;
    notes.push({ id, name, legend });
  }

  private listMirage({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.biome[i] === 1);
  }

  private addMirage(id: string, _cell: number) {
    const adjectives = ["Entrancing", "Diaphanous", "Illusory", "Distant", "Peculiar"];

    const mirageAdjective = ra(adjectives);
    const name = `${mirageAdjective} mirage`;
    const legend = `This ${mirageAdjective.toLowerCase()} mirage has been luring travellers out of their way for eons.`;
    notes.push({ id, name, legend });
  }

  private listCaves({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] >= 50 && cells.pop[i]);
  }

  private addCave(id: string, cell: number) {
    const { cells } = pack;

    const formations = {
      Cave: 10,
      Cavern: 8,
      Chasm: 6,
      Ravine: 6,
      Fracture: 5,
      Grotto: 4,
      Pit: 4,
      Sinkhole: 2,
      Hole: 2
    };
    const status = {
      "a good spot to hid treasure": 5,
      "the home of strange monsters": 5,
      "totally empty": 4,
      "endlessly deep and unexplored": 4,
      "completely flooded": 2,
      "slowly filling with lava": 1
    };

    let formation = rw(formations);
    const toponym = Names.getCulture(cells.culture[cell]);
    if (cells.biome[cell] === 11) {
      formation = `Glacial ${formation}`;
    }
    const name = `${toponym} ${formation}`;
    const legend = `The ${name}. Locals claim that it is ${rw(status)}.`;
    notes.push({ id, name, legend });
  }

  private listPortals({ burgs }: PackedGraph) {
    return burgs
      .slice(1, Math.ceil(burgs.length / 10) + 1)
      .filter(({ cell }) => !this.occupied[cell])
      .map(burg => burg.cell);
  }

  private addPortal(id: string, cell: number) {
    const { cells, burgs } = pack;

    if (!cells.burg[cell]) return;
    const burgName = burgs[cells.burg[cell]].name;

    const name = `${burgName} Portal`;
    const legend = `An element of the magic portal system connecting major city. The portals were installed centuries ago, but still work fine.`;
    notes.push({ id, name, legend });
  }

  private listRifts({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.pop[i] <= 3 && biomesData.habitability[cells.biome[i]]);
  }

  private addRift(id: string, _cell: number) {
    const types = ["Demonic", "Interdimensional", "Abyssal", "Cosmic", "Cataclysmic", "Subterranean", "Ancient"];

    const descriptions = [
      "all known nearby beings to flee in terror",
      "cracks in reality itself to form",
      "swarms of foes to spill forth",
      "nearby plants to wither and decay",
      "an emmissary to step through with an all-powerful relic"
    ];

    const riftType = ra(types);
    const name = `${riftType} Rift`;
    const legend = `A rumoured ${riftType.toLowerCase()} rift in this area is causing ${ra(descriptions)}.`;
    notes.push({ id, name, legend });
  }

  private listDisturbedBurial({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] >= 20 && cells.pop[i] > 2);
  }

  private addDisturbedBurial(id: string, _cell: number) {
    const name = "Disturbed Burial";
    const legend = "A burial site has been disturbed in this area, causing the dead to rise and attack the living.";
    notes.push({ id, name, legend });
  }

  private listNecropolis({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] >= 20 && cells.pop[i] < 2);
  }

  private addNecropolis(id: string, cell: number) {
    const { cells } = pack;

    const toponym = Names.getCulture(cells.culture[cell]);
    const type = rw({
      Necropolis: 5,
      Crypt: 2,
      Tomb: 2,
      Graveyard: 1,
      Cemetery: 2,
      Mausoleum: 1,
      Sepulchre: 1
    });

    const name = `${toponym} ${type}`;
    const legend = ra([
      "A foreboding necropolis shrouded in perpetual darkness, where eerie whispers echo through the winding corridors and spectral guardians stand watch over the tombs of long-forgotten souls.",
      "A towering necropolis adorned with macabre sculptures and guarded by formidable undead sentinels. Its ancient halls house the remains of fallen heroes, entombed alongside their cherished relics.",
      "This ethereal necropolis seems suspended between the realms of the living and the dead. Wisps of mist dance around the tombstones, while haunting melodies linger in the air, commemorating the departed.",
      "Rising from the desolate landscape, this sinister necropolis is a testament to necromantic power. Its skeletal spires cast ominous shadows, concealing forbidden knowledge and arcane secrets.",
      "An eerie necropolis where nature intertwines with death. Overgrown tombstones are entwined by thorny vines, and mournful spirits wander among the fading petals of once-vibrant flowers.",
      "A labyrinthine necropolis where each step echoes with haunting murmurs. The walls are adorned with ancient runes, and restless spirits guide or hinder those who dare to delve into its depths.",
      "This cursed necropolis is veiled in perpetual twilight, perpetuating a sense of impending doom. Dark enchantments shroud the tombs, and the moans of anguished souls resound through its crumbling halls.",
      "A sprawling necropolis built within a labyrinthine network of catacombs. Its halls are lined with countless alcoves, each housing the remains of the departed, while the distant sound of rattling bones fills the air.",
      "A desolate necropolis where an eerie stillness reigns. Time seems frozen amidst the decaying mausoleums, and the silence is broken only by the whispers of the wind and the rustle of tattered banners.",
      "A foreboding necropolis perched atop a jagged cliff, overlooking a desolate wasteland. Its towering walls harbor restless spirits, and the imposing gates bear the marks of countless battles and ancient curses."
    ]);

    notes.push({ id, name, legend });
  }

  private listEncounters({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] >= 20 && cells.pop[i] > 1);
  }

  private addEncounter(id: string, cell: number) {
    const name = "Random encounter";
    const encounterSeed = cell; // use just cell Id to not overwhelm the Vercel KV database
    const legend = `<div>You have encountered a character.</div><iframe src="https://deorum.vercel.app/encounter/${encounterSeed}" width="375" height="600" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>`;
    notes.push({ id, name, legend });
  }
}

window.Markers = new MarkersModule();
