import { mean } from "d3";
import {
  BRIDGE_ADJECTIVES,
  BRIGAND_ANIMALS,
  BRIGAND_TYPES,
  CAVE_FORMATIONS,
  CAVE_STATUSES,
  CIRCUS_ADJECTIVES,
  DANCE_GUESTS,
  DANCE_TYPES,
  ENCOUNTER_KINDS,
  HILL_MONSTER_ADJECTIVES,
  HILL_MONSTER_HABITS,
  HILL_MONSTER_SPECIES,
  INN_ADJECTIVES,
  INN_ANIMALS,
  INN_COLORS,
  INN_COMMON_COURSES,
  INN_COMMON_DRINKS,
  INN_COOKING_METHODS,
  INN_COURSES_BY_GOOD,
  INN_DRINK_KINDS,
  INN_DRINKS_BY_GOOD,
  INN_WARM_COURSES,
  JOUST_TYPES,
  JOUST_VIRTUES,
  LIBRARY_TYPES,
  MARKER_PINS,
  MIGRATING_ANIMALS,
  MIRAGE_ADJECTIVES,
  NECROPOLIS_LEGENDS,
  NECROPOLIS_TYPES,
  RIFT_EFFECTS,
  RIFT_TYPES,
  RUIN_TYPES,
  RUMOR_SOURCES,
  STATUE_SCRIPTS,
  STATUE_VARIANTS,
  WATER_SOURCE_TYPES,
  WATERFALL_DESCRIPTIONS
} from "@/data/markers";
import type { Good } from "@/model/economy/goods-generator";
import { Goods } from "@/model/economy/goods-generator";
import { Markets } from "@/model/economy/markets-generator";
import { Routes } from "@/model/economy/routes-generator";
import { DEAL_KINDS, Trade } from "@/model/economy/trade";
import { Pack } from "@/model/graph/pack-generator";
import { Icons } from "@/model/icons";
import { States } from "@/model/political/states-generator";
import { Names } from "@/model/society/names-generator";
import { Notes } from "@/model/story/notes";
import { convertTemperature, getFriendlyHeight } from "@/model/units";
import type { PackedGraph } from "@/types/packed-graph";
import { last } from "@/utils/array-utils";
import { requireColor } from "@/utils/color-utils";
import { getAdjective, list } from "@/utils/language-utils";
import { rn } from "@/utils/number-utils";
import { gauss, P, ra, rand, rw } from "@/utils/probability-utils";
import { capitalize } from "@/utils/string-utils";
import { requireName, requireOneOf } from "@/utils/validation-utils";

/**
 * Generate a random date within a specified range
 * @param from - Start year (default is 100)
 * @param to - End year (default is 1000)
 * @returns Formatted date string
 */
const generateDate = (from: number = 100, to: number = 1000): string => {
  return new Date(rand(from, to), rand(11), rand(1, 28)).toLocaleDateString("en", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
};

/** Fallback for a marker with no generated name: "hot-springs" -> "Hot springs" */
export function getDefaultMarkerName(type: string | undefined): string {
  return type ? capitalize(type.replaceAll("-", " ")) : "Marker";
}

export interface Marker {
  i: number;
  type: string;
  icon: string;
  x: number;
  y: number;
  dx?: number;
  dy?: number;
  px?: number;
  size?: number;
  pin?: string;
  fill?: string;
  stroke?: string;
  /** the icon's open fill and stroke, over its own paint */
  iconFill?: string;
  iconStroke?: string;
  hidden?: boolean;
  cell: number;
  lock?: boolean;
  pinned?: boolean;
  name: string;
  note?: string;
  tags?: string[];
}

type MarkerConfig = {
  type: string;
  icon: string;
  dx?: number;
  dy?: number;
  px?: number;
  size?: number;
  pin?: string;
  fill?: string;
  stroke?: string;
  min: number;
  each: number;
  multiplier: number;
  list: (pack: PackedGraph) => number[];
  weight?: (cell: number) => number;
  add: (marker: Marker, cell: number) => void;
};

type MarkerBase = Pick<MarkerConfig, "icon" | "type" | "dx" | "dy" | "px" | "size" | "pin" | "fill" | "stroke">;

type MarkerDetails = { name?: string; note?: string; icon?: string };

export type MarkerAppearance = Partial<
  Record<"size" | "px" | "dx" | "dy", number | null> &
    Record<"pin" | "fill" | "stroke" | "iconFill" | "iconStroke", string | null>
>;

const requireNumber = (min: number, max: number) => (value: unknown) => {
  if (typeof value !== "number" || !(value >= min && value <= max))
    throw new Error(`Expected a number from ${min} to ${max}`);
  return value;
};

const APPEARANCE: Record<keyof MarkerAppearance, (value: unknown) => unknown> = {
  size: requireNumber(1, 500),
  px: requireNumber(1, 50),
  dx: requireNumber(0, 100),
  dy: requireNumber(0, 100),
  pin: value => requireOneOf(value, MARKER_PINS, "The pin"),
  fill: requireColor,
  stroke: requireColor,
  iconFill: requireColor,
  iconStroke: requireColor
};

/** The last economy run, summed for marker placement */
type TradeIndex = {
  volume: number[]; // by market: value of its trade
  margin: number[]; // by market: what its center earned on it
  goods: number[]; // by burg: goods it traded
  burgTrade: number[]; // by burg: value of its trade
  tariffs: Map<number, number>; // by state pair
  guilds: Map<number, { good: Good; share: number }>; // by burg: a made good it leads world output of
};

class MarkersModule {
  // built on first use, never in the constructor: the module is instantiated at import time,
  // before model/options/options-model.ts has filled in the options it reads
  private configuration?: MarkerConfig[];
  private occupied: boolean[] = [];
  private tradeIndex?: TradeIndex;
  private tradeSource: unknown = null; // the deals the index sums: each economy run replaces them

  private get config(): MarkerConfig[] {
    this.configuration ??= this.getDefaultConfig();
    return this.configuration;
  }

  private set config(value: MarkerConfig[]) {
    this.configuration = value;
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
    pack.markers = pack.markers.filter(({ lock, cell }) => {
      if (!lock) return false;
      this.occupied[cell] = true;
      return true;
    });

    this.generateTypes();
  }

  add(marker: Marker) {
    const base = this.config.find(c => c.type === marker.type);
    if (base) {
      const { icon, type, dx, dy, px, size, pin, fill, stroke } = base;
      marker = this.addMarker({ icon, type, dx, dy, px, size, pin, fill, stroke }, marker)!; // a full marker has its cell
      base.add(marker, marker.cell);
      return marker;
    }

    const i = last(pack.markers)?.i + 1 || 0;
    const added = { ...marker, i, name: marker.name || getDefaultMarkerName(marker.type), tags: marker.tags ?? [] };
    pack.markers.push(added);
    this.occupied[marker.cell] = true;
    return added;
  }

  /** Rename a marker */
  rename(markerId: number, name: string): void {
    const marker = pack.markers.find(m => m.i === markerId);
    if (!marker) throw new Error(`Marker ${markerId} does not exist`);
    marker.name = requireName(name);
  }

  /** Set a marker's icon: an emoji or an icon id */
  setIcon(markerId: number, icon: string): void {
    this.living(markerId).icon = Icons.reference(icon);
  }

  /** Set a marker's type, a free label such as volcano or ruins */
  setType(markerId: number, type: string): void {
    this.living(markerId).type = requireName(type);
  }

  /** Hide or show a marker */
  setHidden(markerId: number, hidden: boolean): void {
    const marker = this.living(markerId);
    if (hidden) marker.hidden = true;
    else delete marker.hidden;
  }

  /** Move a marker to a map point */
  move(markerId: number, x: number, y: number): void {
    const marker = this.living(markerId);
    const cell = Pack.requireCell(x, y);
    Object.assign(marker, { x: rn(x, 1), y: rn(y, 1), cell });
  }

  /** Pin a marker so it shows even when its type is filtered out, or unpin it */
  setPinned(markerId: number, pinned: boolean): void {
    const marker = this.living(markerId);
    if (pinned) marker.pinned = true;
    else delete marker.pinned;
  }

  /** Lock a marker so regeneration keeps it, or unlock it */
  setLocked(markerId: number, locked: boolean): void {
    const marker = this.living(markerId);
    if (locked) marker.lock = true;
    else delete marker.lock;
  }

  /** Set how a marker looks: size (marker), px (icon size), dx and dy (icon shift, %), pin shape, fill and stroke (pin), iconFill and iconStroke. null restores a default */
  setAppearance(markerId: number, appearance: MarkerAppearance): void {
    const marker = this.living(markerId);
    if (typeof appearance !== "object" || appearance === null) throw new Error("The appearance must be an object");
    const checked: Partial<Record<keyof MarkerAppearance, unknown>> = {};
    for (const [key, value] of Object.entries(appearance)) {
      if (!(key in APPEARANCE))
        throw new Error(`Unknown marker appearance ${key}; known: ${Object.keys(APPEARANCE).join(", ")}`);
      checked[key as keyof MarkerAppearance] = value === null ? null : APPEARANCE[key as keyof MarkerAppearance](value);
    }
    for (const [key, value] of Object.entries(checked)) {
      if (value === null) delete marker[key as keyof MarkerAppearance];
      else Object.assign(marker, { [key]: value });
    }
  }

  private living(markerId: number): Marker {
    const marker = pack.markers.find(m => m.i === markerId);
    if (!marker) throw new Error(`Marker ${markerId} does not exist`);
    return marker;
  }

  /** Place a marker at a map point with details: its name, legend note (HTML, as Notes.write takes) and icon (an emoji or icon id). A type from the markers config, such as volcanoes or ruins, generates all three, each replaced by the one given; any other type needs a note. Returns its id */
  place(x: number, y: number, type: string, details: MarkerDetails = {}): number {
    if (typeof details !== "object" || details === null || Array.isArray(details))
      throw new Error("The marker details must be an object: { name, note, icon }");
    const unknown = Object.keys(details).find(key => !["name", "note", "icon"].includes(key));
    if (unknown) throw new Error(`Unknown marker detail ${unknown}; known: name, note, icon`);
    const { name, note, icon } = details;
    const cell = Pack.requireCell(x, y);
    const marker = { x: rn(x, 2), y: rn(y, 2), cell, type: requireName(type) } as Marker;
    const configured = this.config.some(config => config.type === marker.type);
    if (!configured && !note) throw new Error(`Marker type ${marker.type} generates no legend; give the marker a note`);
    if (name !== undefined) marker.name = requireName(name);
    if (icon !== undefined) marker.icon = Icons.reference(icon);
    else if (!configured) marker.icon = Icons.glyph("❓");
    const added = this.add(marker);
    if (marker.name) added.name = marker.name; // the config type names the marker as it adds it
    if (note) Notes.write(`marker:${added.i}`, note);
    return added.i;
  }

  /** Remove a marker */
  remove(markerId: number) {
    this.living(markerId);
    pack.markers = pack.markers.filter(m => m.i !== markerId);
  }

  private listParty({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.burg[i]);
  }

  private addParty(marker: Marker, _cell: number) {
    if (pack.markers.some(m => m.type === "party" && m.i !== marker.i && m.note)) return;
    marker.name = "The Party";
    marker.note = "Current location of the adventuring party.";
  }

  private getDefaultConfig(): MarkerConfig[] {
    const isFantasy = options.map.cultures.set.includes("Fantasy");

    /*
      Default markers config:
      type - short description (snake-case)
      icon - the glyph drawn in the pin, stored as its icon reference
      dx: icon offset in x direction, in pixels
      dy: icon offset in y direction, in pixels
      min: minimum number of candidates to add at least 1 marker
      each: how many of the candidates should be added as markers
      multiplier: multiply markers quantity to add
      list: function to select candidates
      add: function to add marker legend
    */
    const config: MarkerConfig[] = [
      {
        type: "volcanoes",
        icon: "🌋",
        dx: 52,
        px: 13,
        min: 10,
        each: 500,
        multiplier: 1,
        list: this.listVolcanoes.bind(this),
        add: this.addVolcano.bind(this)
      },
      {
        type: "hot-springs",
        icon: "♨️",
        dy: 52,
        min: 30,
        each: 1200,
        multiplier: 1,
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
      // before mines: a guild town often mines what its guild works
      {
        type: "guild-halls",
        icon: "🏛️",
        min: 1,
        each: 1,
        multiplier: 1,
        list: this.listGuildHalls.bind(this),
        add: this.addGuildHall.bind(this)
      },
      {
        type: "mines",
        icon: "⛏️",
        dx: 48,
        px: 13,
        min: 1,
        each: 6,
        multiplier: 1,
        list: this.listMines.bind(this),
        weight: this.weighMines.bind(this),
        add: this.addMine.bind(this)
      },
      {
        type: "bridges",
        icon: "🌉",
        px: 14,
        min: 1,
        each: 5,
        multiplier: 1,
        list: this.listBridges.bind(this),
        weight: cell => Math.sqrt(this.trade.burgTrade[pack.cells.burg[cell]] || 0),
        add: this.addBridge.bind(this)
      },
      {
        type: "merchant-houses",
        icon: "⚖️",
        min: 3,
        each: 8,
        multiplier: 1,
        list: this.listMerchantHouses.bind(this),
        weight: cell => Math.max(0, this.trade.margin[pack.cells.market?.[cell]] || 0),
        add: this.addMerchantHouse.bind(this)
      },
      {
        type: "inns",
        icon: "🍻",
        px: 14,
        min: 1,
        each: 10,
        multiplier: 1,
        list: this.listInns.bind(this),
        weight: this.weighInns.bind(this),
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
        icon: "💦",
        dy: 54,
        px: 16,
        min: 1,
        each: 5,
        multiplier: 1,
        list: this.listWaterfalls.bind(this),
        add: this.addWaterfall.bind(this)
      },
      {
        type: "battlefields",
        icon: "⚔️",
        dy: 52,
        min: 50,
        each: 700,
        multiplier: 1,
        list: this.listBattlefields.bind(this),
        add: this.addBattlefield.bind(this)
      },
      {
        type: "dungeons",
        icon: "🗝️",
        dy: 51,
        px: 13,
        min: 30,
        each: 200,
        multiplier: 1,
        list: this.listDungeons.bind(this),
        add: this.addDungeon.bind(this)
      },
      {
        type: "lake-monsters",
        icon: "🐉",
        dy: 48,
        min: 2,
        each: 10,
        multiplier: 1,
        list: this.listLakeMonsters.bind(this),
        add: this.addLakeMonster.bind(this)
      },
      {
        type: "sea-monsters",
        icon: "🦑",
        min: 50,
        each: 700,
        multiplier: 1,
        list: this.listSeaMonsters.bind(this),
        add: this.addSeaMonster.bind(this)
      },
      {
        type: "hill-monsters",
        icon: "👹",
        dy: 54,
        px: 13,
        min: 30,
        each: 600,
        multiplier: 1,
        list: this.listHillMonsters.bind(this),
        add: this.addHillMonster.bind(this)
      },
      {
        type: "sacred-mountains",
        icon: "🗻",
        dy: 48,
        min: 1,
        each: 5,
        multiplier: 1,
        list: this.listSacredMountains.bind(this),
        add: this.addSacredMountain.bind(this)
      },
      {
        type: "sacred-forests",
        icon: "🌳",
        min: 30,
        each: 1000,
        multiplier: 1,
        list: this.listSacredForests.bind(this),
        add: this.addSacredForest.bind(this)
      },
      {
        type: "sacred-pineries",
        icon: "🌲",
        px: 13,
        min: 30,
        each: 800,
        multiplier: 1,
        list: this.listSacredPineries.bind(this),
        add: this.addSacredPinery.bind(this)
      },
      {
        type: "sacred-palm-groves",
        icon: "🌴",
        px: 13,
        min: 1,
        each: 100,
        multiplier: 1,
        list: this.listSacredPalmGroves.bind(this),
        add: this.addSacredPalmGrove.bind(this)
      },
      {
        type: "brigands",
        icon: "💰",
        px: 13,
        min: 50,
        each: 100,
        multiplier: 1,
        list: this.listBrigands.bind(this),
        weight: this.weighBrigands.bind(this),
        add: this.addBrigands.bind(this)
      },
      {
        type: "pirates",
        icon: "🏴‍☠️",
        dx: 51,
        min: 40,
        each: 400,
        multiplier: 1,
        list: this.listPirates.bind(this),
        weight: this.weighPirates.bind(this),
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
        multiplier: 1,
        list: this.listRuins.bind(this),
        add: this.addRuins.bind(this)
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
        multiplier: 1,
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
        weight: this.weighFairs.bind(this),
        add: this.addFair.bind(this)
      },
      {
        type: "customs-houses",
        icon: "🛃",
        min: 1,
        each: 3,
        multiplier: 1,
        list: this.listCustomsHouses.bind(this),
        weight: this.weighCustomsHouses.bind(this),
        add: this.addCustomsHouse.bind(this)
      },
      {
        type: "canoes",
        icon: "🛶",
        min: 500,
        each: 2000,
        multiplier: 1,
        list: this.listCanoes.bind(this),
        add: this.addCanoe.bind(this)
      },
      {
        type: "migration",
        icon: "🐗",
        min: 20,
        each: 1000,
        multiplier: 1,
        list: this.listMigrations.bind(this),
        add: this.addMigration.bind(this)
      },
      {
        type: "dances",
        icon: "💃🏽",
        min: 50,
        each: 1000,
        multiplier: 1,
        list: this.listDances.bind(this),
        add: this.addDances.bind(this)
      },
      {
        type: "mirage",
        icon: "꩜",
        min: 10,
        each: 600,
        multiplier: 1,
        list: this.listMirage.bind(this),
        add: this.addMirage.bind(this)
      },
      {
        type: "caves",
        icon: "🦇",
        min: 60,
        each: 1000,
        multiplier: 1,
        list: this.listCaves.bind(this),
        add: this.addCave.bind(this)
      },
      {
        type: "portals",
        icon: "🌀",
        px: 14,
        min: 16,
        each: 8,
        multiplier: +isFantasy,
        list: this.listPortals.bind(this),
        add: this.addPortal.bind(this)
      },
      {
        type: "rifts",
        icon: "🎆",
        min: 5,
        each: 3000,
        multiplier: +isFantasy,
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
      },
      {
        type: "party",
        icon: "🚩",
        size: 46,
        pin: "pin",
        fill: "#ffffff",
        stroke: "#d4351c",
        min: 1,
        each: Number.MAX_SAFE_INTEGER,
        multiplier: 1,
        list: this.listParty.bind(this),
        add: this.addParty.bind(this)
      }
    ];
    return config.map(marker => ({ ...marker, icon: Icons.glyph(marker.icon) }));
  }

  private resetConfig() {
    this.config = this.getDefaultConfig();
  }

  private generateTypes() {
    this.config.forEach(
      ({ type, icon, dx, dy, px, size, pin, fill, stroke, min, each, multiplier, list, weight, add }) => {
        if (multiplier === 0) return;

        const candidates = Array.from(list(pack));
        const weights = weight && candidates.map(weight);
        let quantity = this.getQuantity(candidates, min, each, multiplier);
        // uncomment for debugging:
        // console.info(`${icon} ${type}: each ${each} of ${candidates.length}, min ${min} candidates. Got ${quantity}`);

        while (quantity && candidates.length) {
          const [cell] = weights ? this.extractWeighted(candidates, weights) : this.extractAnyElement(candidates);
          const marker = this.addMarker({ icon, type, dx, dy, px, size, pin, fill, stroke }, { cell });
          if (!marker) continue;
          add(marker, cell);
          quantity--;
        }
      }
    );

    this.occupied = [];
  }

  private getQuantity(array: unknown[], min: number, each: number, multiplier: number) {
    if (!array.length || array.length < min / multiplier) return 0;
    const requestQty = Math.ceil((array.length / each) * multiplier);
    return Math.min(array.length, requestQty);
  }

  private extractAnyElement<T>(array: T[]): T[] {
    const index = Math.floor(Math.random() * array.length);
    return array.splice(index, 1);
  }

  /** One draw over the weights, as extractAnyElement; uniform when no candidate weighs anything */
  private extractWeighted<T>(array: T[], weights: number[]): T[] {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const roll = Math.random();
    let index = Math.floor(roll * array.length);
    if (total) {
      let rest = roll * total - weights[0];
      index = 0;
      while (rest >= 0 && index < weights.length - 1) rest -= weights[++index];
    }
    weights.splice(index, 1);
    return array.splice(index, 1);
  }

  private get trade(): TradeIndex {
    if (!this.tradeIndex || this.tradeSource !== pack.deals) {
      this.tradeIndex = this.indexTrade();
      this.tradeSource = pack.deals;
    }
    return this.tradeIndex;
  }

  private indexTrade(): TradeIndex {
    const { burgs, markets } = pack;
    const volume: number[] = [];
    const margin: number[] = [];
    const traded: Set<number>[] = [];
    const burgTrade: number[] = [];
    const tariffs = new Map<number, number>();
    for (const deal of pack.deals ?? []) {
      const [burgId, marketId, goodId, kind, units, price, , tariff] = deal;
      if (kind === DEAL_KINDS.kept) continue;
      volume[marketId] = (volume[marketId] || 0) + units * price;
      burgTrade[burgId] = (burgTrade[burgId] || 0) + units * price;
      margin[marketId] = (margin[marketId] || 0) + Trade.getMargin(deal);
      traded[burgId] ??= new Set();
      traded[burgId].add(goodId);
      if (!tariff) continue;
      const own = Markets.getState(Markets.ofBurg(burgs[burgId]));
      const key = this.getStatePair(own, Markets.getState(Markets.get(marketId)));
      tariffs.set(key, (tariffs.get(key) || 0) + tariff);
    }
    for (const { i, rural } of markets ?? []) {
      if (!rural) continue;
      volume[i] = (volume[i] || 0) + rural.earned + rural.spent;
      margin[i] = (margin[i] || 0) + (rural.margin || 0);
    }
    return { volume, margin, goods: traded.map(goods => goods.size), burgTrade, tariffs, guilds: this.indexGuilds() };
  }

  /** Burgs making at least GUILD_SHARE of the world's output of a made good */
  private indexGuilds(): Map<number, { good: Good; share: number }> {
    const made = new Map<number, { total: number; burg: number; units: number }>();
    for (const burg of pack.burgs) {
      if (!burg.i || burg.removed) continue;
      for (const [goodId, units] of burg.production ?? []) {
        if (!Goods.get(goodId)?.recipes?.length) continue;
        const entry = made.get(goodId) ?? { total: 0, burg: 0, units: 0 };
        entry.total += units;
        if (units > entry.units) Object.assign(entry, { burg: burg.i, units });
        made.set(goodId, entry);
      }
    }
    const guilds = new Map<number, { good: Good; share: number }>();
    const GUILD_SHARE = 0.3; // of world output of a made good, for a burg to keep its guild hall
    for (const [goodId, { total, burg, units }] of made) {
      const share = units / total;
      if (share < GUILD_SHARE || share <= (guilds.get(burg)?.share ?? 0)) continue;
      guilds.set(burg, { good: Goods.get(goodId)!, share });
    }
    return guilds;
  }

  private getStatePair(a: number, b: number) {
    return a < b ? a * 65536 + b : b * 65536 + a;
  }

  /** The cell's market's trade, square-rooted so the busiest markets don't take every marker */
  private getMarketTrade(cell: number): number {
    return Math.sqrt(this.trade.volume[pack.cells.market?.[cell]] || 0);
  }

  private addMarker(base: MarkerBase, draft: Partial<Marker>): Marker | undefined {
    const { cell } = draft;
    if (cell === undefined) return;
    const i = last(pack.markers)?.i + 1 || 0;
    const [x, y] = this.getMarkerCoordinates(cell);
    const type = draft.type ?? base.type;
    const marker: Marker = {
      ...base,
      x,
      y,
      ...draft,
      cell,
      i,
      name: draft.name || getDefaultMarkerName(type),
      tags: draft.tags ?? []
    };
    pack.markers.push(marker);
    this.occupied[cell] = true;
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

  private addVolcano(marker: Marker, cell: number) {
    const { cells } = pack;

    const proper = Names.getCulture(cells.culture[cell]);
    const name = P(0.3) ? `Mount ${proper}` : P(0.7) ? `${proper} Volcano` : proper;
    const status = P(0.6) ? "Dormant" : P(0.4) ? "Active" : "Erupting";
    marker.name = name;
    marker.note = `${status} volcano. Height: ${getFriendlyHeight(cells.p[cell], pack, grid)}.`;
  }

  private listHotSprings({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] > 50 && cells.culture[i]);
  }

  private addHotSpring(marker: Marker, cell: number) {
    const { cells } = pack;

    const proper = Names.getCulture(cells.culture[cell]);
    const temp = convertTemperature(gauss(35, 15, 20, 100));
    const name = P(0.3) ? `Hot Springs of ${proper}` : P(0.7) ? `${proper} Hot Springs` : proper;
    const legend = `A geothermal springs with naturally heated water that provide relaxation and medicinal benefits. Average temperature is ${temp}.`;

    marker.name = name;
    marker.note = legend;
  }

  private listWaterSources({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] > 30 && cells.r[i]);
  }

  private addWaterSource(marker: Marker, cell: number) {
    const { cells } = pack;

    const type = rw(WATER_SOURCE_TYPES);

    const proper = Names.getCulture(cells.culture[cell]);
    const name = `${proper} ${type}`;
    const legend =
      "This legendary water source is whispered about in ancient tales and believed to possess mystical properties. The spring emanates crystal-clear water, shimmering with an otherworldly iridescence that sparkles even in the dimmest light.";

    marker.name = name;
    marker.note = legend;
  }

  /** The ore or mineral the cell's burg extracts in the last production run */
  private getMinedGood(cell: number): Good | undefined {
    const good = Goods.get(pack.cells.good[cell]);
    if (!good?.tags.some(tag => tag === "ore" || tag === "mineral")) return;
    const burg = pack.burgs[pack.cells.burg[cell]];
    const extracts = burg?.production?.some(([goodId]) => goodId === good.i); // a raw good comes from the local bonus
    return extracts ? good : undefined;
  }

  /** Names of the goods the cell's market had in stock or traded in the last production run */
  private getMarketGoods(cell: number): Set<string> {
    const marketId = pack.cells.market?.[cell];
    const market = Markets.get(marketId);
    if (!market) return new Set();

    const goodIds = Object.keys(market.goods)
      .filter(id => market.goods[+id].stock > 0)
      .map(Number);
    for (const [, dealMarket, goodId] of pack.deals ?? []) {
      if (dealMarket === marketId) goodIds.push(goodId);
    }
    return new Set(goodIds.map(id => Goods.get(id)?.name).filter(name => name !== undefined));
  }

  /** The ore or mineral deposit under the cell's burg, mined or not */
  private getDeposit(cell: number): Good | undefined {
    const good = Goods.get(pack.cells.good[cell]);
    if (!pack.cells.burg[cell] || !good?.tags.some(tag => tag === "ore" || tag === "mineral")) return;
    return good;
  }

  private listMines({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && this.getDeposit(i));
  }

  /** Rich deposits draw miners: gold, silver and gemstones most */
  private weighMines(cell: number) {
    const deposit = this.getDeposit(cell);
    if (!deposit) return 0;
    return deposit.value ** 2 * (deposit.tags.includes("luxury") ? 4 : 1);
  }

  private addMine(marker: Marker, cell: number) {
    const { cells } = pack;

    const mined = this.getMinedGood(cell);
    const resource = (mined ?? this.getDeposit(cell))?.name.toLowerCase() ?? "ore";
    const burg = pack.burgs[cells.burg[cell]];
    if (!burg?.i) return;
    if (!mined && pack.deals?.length) {
      marker.name = `${burg.name} — old ${resource} mine`;
      marker.note = `The ${resource} mine by ${burg.name} is played out. Its shafts stand empty, and the miners have long gone to work the fields.`;
      return;
    }
    const population = rn(
      burg.population! * options.map.units.population.scale * options.map.units.population.urbanization.rate
    );
    marker.name = `${burg.name} — ${resource} mining town`;
    marker.note = `${burg.name} is a mining town of ${population} people just nearby the ${resource} mine.`;
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

  private addBridge(marker: Marker, cell: number) {
    const { cells } = pack;

    const burg = pack.burgs[cells.burg[cell]];
    const river = pack.rivers.find(r => r.i === pack.cells.r[cell]);
    const riverName = river ? `${river.name} ${river.type}` : "river";
    const name = river && P(0.2) ? `${river.name} Bridge` : `${burg.name} Bridge`;
    const legend = `A ${rw(BRIDGE_ADJECTIVES)} bridge spans over the ${riverName} at ${burg.name}. Carts and pack trains cross it from dawn to dusk, bound for the market.`;

    marker.name = name;
    marker.note = legend;
  }

  private listInns({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.pop[i] > 5 && Routes.isCrossroad(i));
  }

  private weighInns(cell: number) {
    return this.getMarketTrade(cell);
  }

  private addInn(marker: Marker, cell: number) {
    const typeName = P(0.3) ? "inn" : "tavern";
    const isAnimalThemed = P(0.7);
    const animal = ra(INN_ANIMALS);
    const name = isAnimalThemed
      ? P(0.6)
        ? `${ra(INN_COLORS)} ${animal}`
        : `${ra(INN_ADJECTIVES)} ${animal}`
      : `${ra(INN_ADJECTIVES)} ${capitalize(typeName)}`;
    const local = this.getMarketGoods(cell);
    const localFare = (byGood: Record<string, string[]>) =>
      Object.entries(byGood).flatMap(([good, fare]) => (local.has(good) ? fare : []));
    const pick = (localItems: string[], common: string[]) =>
      localItems.length && P(0.7) ? ra(localItems) : ra(common);

    const isWarm = grid.cells.temp[pack.cells.g[cell]] >= 18;
    const courses = isWarm ? [...INN_COMMON_COURSES, ...INN_WARM_COURSES] : INN_COMMON_COURSES;
    const localCourses = localFare(INN_COURSES_BY_GOOD);
    const isAnimalServed = [...courses, ...localCourses].includes(animal.toLowerCase());
    const meal = isAnimalThemed && isAnimalServed && P(0.5) ? animal : pick(localCourses, courses);
    const course = `${ra(INN_COOKING_METHODS)} ${meal}`.toLowerCase();
    const drink =
      `${P(0.5) ? ra(INN_DRINK_KINDS) : ra(INN_COLORS)} ${pick(localFare(INN_DRINKS_BY_GOOD), INN_COMMON_DRINKS)}`.toLowerCase();
    const legend = `A big and famous roadside ${typeName}. Delicious ${course} with ${drink} is served here.`;
    marker.name = `The ${name}`;
    marker.note = legend;
  }

  private listLighthouses({ cells }: PackedGraph) {
    return cells.i.filter(
      i => !this.occupied[i] && cells.harbor[i] > 6 && cells.c[i].some(c => cells.h[c] < 20 && Routes.isConnected(c))
    );
  }

  private addLighthouse(marker: Marker, cell: number) {
    const { cells } = pack;

    const proper = cells.burg[cell] ? pack.burgs[cells.burg[cell]].name! : Names.getCulture(cells.culture[cell]);
    marker.name = `${getAdjective(proper)} Lighthouse`;
    marker.note = `A lighthouse to serve as a beacon for ships in the open sea.`;
  }

  private listWaterfalls({ cells }: PackedGraph) {
    return cells.i.filter(
      i => cells.r[i] && !this.occupied[i] && cells.h[i] >= 50 && cells.c[i].some(c => cells.h[c] < 40 && cells.r[c])
    );
  }

  private addWaterfall(marker: Marker, cell: number) {
    const { cells } = pack;

    const proper = cells.burg[cell] ? pack.burgs[cells.burg[cell]].name! : Names.getCulture(cells.culture[cell]);
    marker.name = `${getAdjective(proper)} Waterfall`;
    marker.note = ra(WATERFALL_DESCRIPTIONS);
  }

  private listBattlefields({ cells }: PackedGraph) {
    return cells.i.filter(
      i => !this.occupied[i] && cells.state[i] && cells.pop[i] > 2 && cells.h[i] < 50 && cells.h[i] > 25
    );
  }

  private addBattlefield(marker: Marker, cell: number) {
    const { cells, states } = pack;

    const state = states[cells.state[cell]];
    if (!state.campaigns) state.campaigns = States.generateCampaign(state);
    const campaign = ra(state.campaigns);
    const date = generateDate(campaign.start, campaign.end);
    const name = `${Names.getCulture(cells.culture[cell])} Battlefield`;
    const legend = `A historical battle of the ${campaign.name}. \r\nDate: ${date} ${options.map.lore.calendar.era}.`;
    marker.name = name;
    marker.note = legend;
  }

  private listDungeons({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.pop[i] && cells.pop[i] < 3);
  }

  private addDungeon(marker: Marker, cell: number) {
    const dungeonSeed = `${options.map.seed}${cell}`;
    const name = "Dungeon";
    const legend = `<div>Undiscovered dungeon. See <a href="https://watabou.github.io/one-page-dungeon/?seed=${dungeonSeed}" target="_blank">One page dungeon</a></div><iframe style="pointer-events: none;" src="https://watabou.github.io/one-page-dungeon/?seed=${dungeonSeed}" sandbox="allow-scripts allow-same-origin"></iframe>`;
    marker.name = name;
    marker.note = legend;
  }

  private listLakeMonsters({ features }: PackedGraph) {
    return features
      .filter(
        feature => feature.type === "lake" && feature.subtype === "freshwater" && !this.occupied[feature.firstCell]
      )
      .map(feature => feature.firstCell);
  }

  private addLakeMonster(marker: Marker, cell: number) {
    const lake = pack.features[pack.cells.f[cell]];

    // Check that the feature is a lake in case the user clicked on a wrong
    // square
    if (lake.type !== "lake") return;

    const name = `${lake.name} Monster`;
    const length = gauss(10, 5, 5, 100);
    const legend = `${ra(RUMOR_SOURCES)} say a relic monster of ${length} ${options.map.units.height.unit} long inhabits ${
      lake.name
    } Lake. Truth or lie, folks are afraid to fish in the lake.`;
    marker.name = name;
    marker.note = legend;
  }

  private listSeaMonsters({ cells, features }: PackedGraph) {
    return cells.i.filter(
      i => !this.occupied[i] && cells.h[i] < 20 && Routes.isConnected(i) && features[cells.f[i]].type === "ocean"
    );
  }

  private addSeaMonster(marker: Marker, _cell: number) {
    const name = `${Names.getCultureShort(0)} Monster`;
    const length = gauss(25, 10, 10, 100);
    const legend = `Old sailors tell stories of a gigantic sea monster inhabiting these dangerous waters. Rumors say it can be ${length} ${options.map.units.height.unit} long.`;
    marker.name = name;
    marker.note = legend;
  }

  private listHillMonsters({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] >= 50 && cells.pop[i]);
  }

  private addHillMonster(marker: Marker, cell: number) {
    const { cells } = pack;

    const monster = ra(HILL_MONSTER_SPECIES);
    const toponym = Names.getCulture(cells.culture[cell]);
    const name = `${toponym} ${monster}`;
    const legend = `${ra(RUMOR_SOURCES)} speak of a ${ra(HILL_MONSTER_ADJECTIVES)} ${monster} who inhabits ${toponym} hills and ${ra(
      HILL_MONSTER_HABITS
    )}.`;
    marker.name = name;
    marker.note = legend;
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

  private addSacredMountain(marker: Marker, cell: number) {
    const { cells, religions } = pack;

    const culture = cells.c[cell].map(c => cells.culture[c]).find(c => c)!;
    const religion = cells.religion[cell] || cells.c[cell].map(c => cells.religion[c]).find(r => r);
    const name = `${Names.getCulture(culture)} Mountain`;
    const height = getFriendlyHeight(cells.p[cell], pack, grid);
    const sacredTo = religion ? ` of ${religions[religion].name}` : "";
    const legend = `A sacred mountain${sacredTo}. Height: ${height}.`;
    marker.name = name;
    marker.note = legend;
  }

  // Sacred forests spawn on temperate forests
  private listSacredForests({ cells }: PackedGraph) {
    return cells.i.filter(
      i => !this.occupied[i] && cells.culture[i] && cells.religion[i] && [6, 8].includes(cells.biome[i])
    );
  }

  private addSacredForest(marker: Marker, cell: number) {
    const { cells, religions } = pack;

    const culture = cells.culture[cell];
    const religion = cells.religion[cell];
    const name = `${Names.getCulture(culture)} Forest`;
    const legend = `A forest sacred to local ${religions[religion].name}.`;
    marker.name = name;
    marker.note = legend;
  }

  // Sacred pineries spawn on boreal forests
  private listSacredPineries({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.culture[i] && cells.religion[i] && cells.biome[i] === 9);
  }

  private addSacredPinery(marker: Marker, cell: number) {
    const { cells, religions } = pack;

    const culture = cells.culture[cell];
    const religion = cells.religion[cell];
    const name = `${Names.getCulture(culture)} Pinery`;
    const legend = `A pinery sacred to local ${religions[religion].name}.`;
    marker.name = name;
    marker.note = legend;
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

  private addSacredPalmGrove(marker: Marker, cell: number) {
    const { cells, religions } = pack;

    const culture = cells.culture[cell];
    const religion = cells.religion[cell];
    const name = `${Names.getCulture(culture)} Palm Grove`;
    const legend = `A palm grove sacred to local ${religions[religion].name}.`;
    marker.name = name;
    marker.note = legend;
  }

  private listBrigands({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.culture[i] && Routes.hasRoad(i));
  }

  /** Brigands prey on busy markets' roads where the land is poor */
  private weighBrigands(cell: number) {
    return this.getMarketTrade(cell) * (1.2 - (pack.cells.prosperity?.[cell] || 0) / 100);
  }

  private addBrigands(marker: Marker, cell: number) {
    const { cells } = pack;

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

    const name = `${Names.getCulture(culture)} ${ra(BRIGAND_ANIMALS)}`;
    const legend = `A gang of ${locality} ${rw(BRIGAND_TYPES)}.`;
    marker.name = name;
    marker.note = legend;
  }

  // Pirates spawn on sea routes
  private listPirates({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] < 20 && Routes.isConnected(i));
  }

  /** Pirates prey on the sea routes between busy markets: the busiest route through the cell */
  private weighPirates(cell: number) {
    const { cells, routes } = pack;
    let best = 0;
    for (const routeId of new Set(Object.values(cells.routes[cell] ?? {}))) {
      const points = routes.find(route => route.i === routeId)?.points;
      if (!points?.length) continue;
      best = Math.max(best, this.getMarketTrade(points[0][2]) + this.getMarketTrade(last(points)[2]));
    }
    return best;
  }

  private addPirates(marker: Marker, _cell: number) {
    const name = "Pirates";
    const legend = "Pirate ships have been spotted in these waters.";
    marker.name = name;
    marker.note = legend;
  }

  private listStatues({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] >= 20 && cells.h[i] < 40);
  }

  private addStatue(marker: Marker, cell: number) {
    const { cells } = pack;

    const culture = cells.culture[cell];

    const variant = ra(STATUE_VARIANTS);
    const name = `${Names.getCulture(culture)} ${variant}`;
    const script = STATUE_SCRIPTS[ra(Object.keys(STATUE_SCRIPTS)) as keyof typeof STATUE_SCRIPTS] as string;
    const inscription = Array(rand(40, 100))
      .fill(null)
      .map(() => ra(script.split("")))
      .join("");
    const legend = `An ancient ${variant.toLowerCase()}. It has an inscription, but no one can translate it:
        <div style="font-size: 1.8em; line-break: anywhere;">${inscription}</div>`;
    marker.name = name;
    marker.note = legend;
  }

  private listRuins({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.culture[i] && cells.h[i] >= 20 && cells.h[i] < 60);
  }

  private addRuins(marker: Marker, _cell: number) {
    const ruinType = ra(RUIN_TYPES);
    const name = `Ruined ${ruinType}`;
    const legend = `Ruins of an ancient ${ruinType.toLowerCase()}. Untold riches may lie within.`;
    marker.name = name;
    marker.note = legend;
  }

  private listLibraries({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.culture[i] && cells.burg[i] && cells.pop[i] > 10);
  }

  private addLibrary(marker: Marker, cell: number) {
    const { cells } = pack;

    const type = rw(LIBRARY_TYPES);
    const name = `${Names.getCulture(cells.culture[cell])} ${type}`;
    const legend = "A vast collection of knowledge, including many rare and ancient tomes.";

    marker.name = name;
    marker.note = legend;
  }

  private listCircuses({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.culture[i] && cells.h[i] >= 20 && Routes.isConnected(i));
  }

  private addCircus(marker: Marker, _cell: number) {
    const adjective = ra(CIRCUS_ADJECTIVES);
    const name = `Travelling ${adjective} Circus`;
    const legend = `Roll up, roll up, this ${adjective.toLowerCase()} circus is here for a limited time only.`;
    marker.name = name;
    marker.note = legend;
  }

  private listJousts({ cells, burgs }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.burg[i] && burgs[cells.burg[i]].population! > 20);
  }

  private addJoust(marker: Marker, cell: number) {
    const { cells, burgs } = pack;

    if (!cells.burg[cell]) return;
    const burgName = burgs[cells.burg[cell]].name;
    const type = ra(JOUST_TYPES);
    const virtue = ra(JOUST_VIRTUES);

    const name = `${burgName} ${type}`;
    const legend = `Warriors from around the land gather for a ${type.toLowerCase()} of ${virtue} in ${burgName}, with fame, fortune and favour on offer to the victor.`;
    marker.name = name;
    marker.note = legend;
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

  private weighFairs(cell: number) {
    return this.trade.goods[pack.cells.burg[cell]] || 0;
  }

  private addFair(marker: Marker, cell: number) {
    const { cells, burgs } = pack;
    if (!cells.burg[cell]) return;

    const burg = burgs[cells.burg[cell]];
    const burgName = burg.name;
    const type = "Fair";

    const made = (burg.production ?? [])
      .toSorted((a, b) => b[1] - a[1])
      .map(([goodId]) => Goods.get(goodId)?.name.toLowerCase())
      .filter(name => name !== undefined);
    const wares = [...new Set(made)].slice(0, 3);
    const offer = wares.length
      ? `offering local ${list(wares)} alongside foreign goods and services`
      : "with all manner of local and foreign goods and services on offer";

    const name = `${burgName} ${type}`;
    const legend = `A fair is being held in ${burgName}, ${offer}.`;
    marker.name = name;
    marker.note = legend;
  }

  /** The neighbor state a road leads to from the cell that it trades with under the most tariffs */
  private getCustomsBorder(cell: number): { state: number; tariffs: number } | undefined {
    const { cells, routes } = pack;
    const own = cells.state[cell];
    let border: { state: number; tariffs: number } | undefined;
    for (const [neighbor, routeId] of Object.entries(cells.routes[cell] ?? {})) {
      const state = cells.state[+neighbor];
      if (!own || !state || state === own) continue;
      if (routes.find(route => route.i === routeId)?.group !== "roads") continue;
      const tariffs = this.trade.tariffs.get(this.getStatePair(own, state)) || 0;
      if (tariffs > (border?.tariffs ?? 0)) border = { state, tariffs };
    }
    return border;
  }

  /** One road crossing for each pair of states that trade under tariffs */
  private listCustomsHouses({ cells }: PackedGraph) {
    const crossings = new Map<number, number>(); // by state pair
    for (const i of cells.i) {
      if (this.occupied[i] || !cells.routes[i]) continue;
      const border = this.getCustomsBorder(i);
      const pair = border && this.getStatePair(cells.state[i], border.state);
      if (pair !== undefined && !crossings.has(pair)) crossings.set(pair, i);
    }
    return [...crossings.values()];
  }

  private weighCustomsHouses(cell: number) {
    return this.getCustomsBorder(cell)?.tariffs ?? 0;
  }

  private addCustomsHouse(marker: Marker, cell: number) {
    const { cells, states } = pack;
    const state = states[cells.state[cell]];
    const border = this.getCustomsBorder(cell);
    const from = border ? ` from ${states[border.state].name}` : "";
    const place = cells.burg[cell] ? pack.burgs[cells.burg[cell]].name! : Names.getCulture(cells.culture[cell]);
    marker.name = `${place} Customs House`;
    marker.note = `A customs house of ${state?.name || "the state"} on the road${from}. Carts queue at its barrier while the wardens weigh their loads and collect the tariffs.`;
  }

  private listGuildHalls({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && this.trade.guilds.has(cells.burg[i]));
  }

  private addGuildHall(marker: Marker, cell: number) {
    const burg = pack.burgs[pack.cells.burg[cell]];
    const guild = burg && this.trade.guilds.get(burg.i);
    if (!guild) {
      marker.name = burg?.i ? `${burg.name} Guild Hall` : "Guild Hall";
      marker.note = "The hall of a craft guild that keeps the secrets of its trade.";
      return;
    }
    const good = guild.good.name.toLowerCase();
    marker.name = `${burg.name} ${capitalize(good)} Guild`;
    const mined = this.getMinedGood(cell);
    const isWorked = mined && guild.good.recipes?.some(recipe => mined.i in recipe);
    const source = isWorked ? `, worked from the ${mined.name.toLowerCase()} of its own mines` : "";
    marker.note = `${burg.name} is famed for its ${good}${source}. The guild hall of its makers keeps the secrets of the craft, and its masters set the price far beyond the town.`;
  }

  private listMerchantHouses({ cells, burgs }: PackedGraph) {
    return (pack.markets ?? [])
      .map(market => burgs[market.centerBurgId]?.cell)
      .filter((cell): cell is number => cell !== undefined && !this.occupied[cell] && cells.burg[cell] > 0);
  }

  private addMerchantHouse(marker: Marker, cell: number) {
    const { cells, burgs } = pack;
    const burg = burgs[cells.burg[cell]];
    const marketId = cells.market?.[cell];
    const margin = this.trade.margin[marketId] || 0;
    const richer = (pack.markets ?? []).filter(({ i }) => (this.trade.margin[i] || 0) > margin).length;
    const rank = richer ? "one of the richest" : "the richest";
    marker.name = `House of ${Names.getCulture(cells.culture[cell])}`;
    marker.note = `A merchant family of ${burg?.name || "the town"}, ${rank} in the land. Its factors buy and sell across the whole market, and a share of every deal ends in its coffers.`;
  }

  private listCanoes({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.r[i]);
  }

  private addCanoe(marker: Marker, cell: number) {
    const river = pack.rivers.find(r => r.i === pack.cells.r[cell]);

    const name = `Minor Jetty`;
    const riverName = river ? `${river.name} ${river.type}` : "river";
    const legend = `A small location along the ${riverName} to launch boats from sits here, along with a weary looking owner, willing to sell passage along the river.`;
    marker.name = name;
    marker.note = legend;
  }

  private listMigrations({ cells }: PackedGraph) {
    return cells.i.filter(
      i => !this.occupied[i] && cells.h[i] >= 20 && cells.pop[i] <= 2 && MIGRATING_ANIMALS[cells.biome[i]]
    );
  }

  private addMigration(marker: Marker, cell: number) {
    const animalChoice = ra(MIGRATING_ANIMALS[pack.cells.biome[cell]] ?? ["Birds"]);

    const name = `${animalChoice} migration`;
    const legend = `A huge group of ${animalChoice.toLowerCase()} are migrating, whether part of their annual routine, or something more extraordinary.`;
    marker.name = name;
    marker.note = legend;
  }

  private listDances({ cells, burgs }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.burg[i] && burgs[cells.burg[i]].population! > 15);
  }

  private addDances(marker: Marker, cell: number) {
    const { cells, burgs } = pack;
    const burgName = burgs[cells.burg[cell]].name;
    const socialType = ra(DANCE_TYPES);

    const name = `${burgName} ${socialType}`;
    const legend = `A ${socialType} has been organised at ${burgName} as a chance to gather the ${ra(
      DANCE_GUESTS
    )} of the area together to be merry, make alliances and scheme around the crisis.`;
    marker.name = name;
    marker.note = legend;
  }

  private listMirage({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.biome[i] === 1);
  }

  private addMirage(marker: Marker, _cell: number) {
    const mirageAdjective = ra(MIRAGE_ADJECTIVES);
    const name = `${mirageAdjective} mirage`;
    const legend = `This ${mirageAdjective.toLowerCase()} mirage has been luring travellers out of their way for eons.`;
    marker.name = name;
    marker.note = legend;
  }

  private listCaves({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] >= 50 && cells.pop[i]);
  }

  private addCave(marker: Marker, cell: number) {
    const { cells } = pack;

    let formation = rw(CAVE_FORMATIONS);
    const toponym = Names.getCulture(cells.culture[cell]);
    if (cells.biome[cell] === 11) {
      formation = `Glacial ${formation}`;
    }
    const name = `${toponym} ${formation}`;
    const legend = `The ${name}. Locals claim that it is ${rw(CAVE_STATUSES)}.`;
    marker.name = name;
    marker.note = legend;
  }

  private listPortals({ burgs }: PackedGraph) {
    return burgs
      .slice(1, Math.ceil(burgs.length / 10) + 1)
      .filter(({ cell }) => !this.occupied[cell])
      .map(burg => burg.cell);
  }

  private addPortal(marker: Marker, cell: number) {
    const { cells, burgs } = pack;

    if (!cells.burg[cell]) return;
    const burgName = burgs[cells.burg[cell]].name;

    const name = `${burgName} Portal`;
    const legend = `An element of the magic portal system connecting major cities. The portals were installed centuries ago, but still work fine.`;
    marker.name = name;
    marker.note = legend;
  }

  private listRifts({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.pop[i] <= 3 && pack.biomes[cells.biome[i]].habitability);
  }

  private addRift(marker: Marker, _cell: number) {
    const riftType = ra(RIFT_TYPES);
    const name = `${riftType} Rift`;
    const legend = `A rumoured ${riftType.toLowerCase()} rift in this area is causing ${ra(RIFT_EFFECTS)}.`;
    marker.name = name;
    marker.note = legend;
  }

  private listDisturbedBurial({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] >= 20 && cells.pop[i] > 2);
  }

  private addDisturbedBurial(marker: Marker, _cell: number) {
    const name = "Disturbed Burial";
    const legend = "A burial site has been disturbed in this area, causing the dead to rise and attack the living.";
    marker.name = name;
    marker.note = legend;
  }

  private listNecropolis({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] >= 20 && cells.pop[i] < 2);
  }

  private addNecropolis(marker: Marker, cell: number) {
    const { cells } = pack;

    const toponym = Names.getCulture(cells.culture[cell]);
    const type = rw(NECROPOLIS_TYPES);

    const name = `${toponym} ${type}`;
    const legend = ra(NECROPOLIS_LEGENDS);

    marker.name = name;
    marker.note = legend;
  }

  private listEncounters({ cells }: PackedGraph) {
    return cells.i.filter(i => !this.occupied[i] && cells.h[i] >= 20 && cells.pop[i] > 1);
  }

  private addEncounter(marker: Marker, cell: number) {
    if (typeof navigator === "undefined" || navigator.onLine !== false) {
      const name = "Random encounter";
      const encounterSeed = cell;
      const legend = `<div>You have encountered a character.</div><iframe src="https://deorum.vercel.app/encounter/${encounterSeed}" width="375" height="600" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>`;
      marker.name = name;
      marker.note = legend;
      return;
    }

    const { cells } = pack;
    const cultureName = Names.getCulture(cells.culture[cell]);
    const biomeName = (pack.biomes[cells.biome[cell]]?.name || "wilderness").toLowerCase();

    const { subject, verb } = ra(ENCOUNTER_KINDS);

    const name = `${subject} of ${cultureName}`;
    const legend = `${subject} ${verb} in the ${biomeName} of ${cultureName} lands.`;

    marker.name = name;
    marker.note = legend;
  }
}

export const Markers = new MarkersModule();
