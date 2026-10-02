import { AddedLabels } from "@/generators/added-labels";
import { Biomes } from "@/generators/biomes-generator";
import { Burgs } from "@/generators/burgs-generator";
import { Cultures } from "@/generators/cultures-generator";
import { Emblems } from "@/generators/emblems-generator";
import { Features } from "@/generators/features-generator";
import { Goods } from "@/generators/goods-generator";
import { Journeys } from "@/generators/journeys/journeys-generator";
import { Labels } from "@/generators/labels-generator";
import { Lore } from "@/generators/lore";
import { Markers } from "@/generators/markers-generator";
import { Markets } from "@/generators/markets-generator";
import { Military } from "@/generators/military-generator";
import { Notes } from "@/generators/notes";
import { Provinces } from "@/generators/provinces-generator";
import { Religions } from "@/generators/religions-generator";
import { Rivers } from "@/generators/river-generator";
import { Routes } from "@/generators/routes-generator";
import { States } from "@/generators/states-generator";
import { Zones } from "@/generators/zones-generator";

// Model methods the Assistant may propose
export const METHODS: Record<string, string[]> = {
  Burgs: [
    "rename",
    "setPopulation",
    "setGroup",
    "setType",
    "setBuilding",
    "setCulture",
    "setPort",
    "setCapital",
    "move",
    "add",
    "remove",
    "setTreasury",
    "setLocked",
    "setLink"
  ],
  States: [
    "rename",
    "recolor",
    "setFullName",
    "setForm",
    "setCulture",
    "setType",
    "setExpansionism",
    "setRelation",
    "recalculate",
    "merge",
    "add",
    "remove",
    "setTaxes",
    "setTreasury",
    "setLocked",
    "setChronicleEntry",
    "setCells",
    "setPopulation"
  ],
  Provinces: [
    "rename",
    "recolor",
    "setFullName",
    "setForm",
    "setCapital",
    "setState",
    "add",
    "declareIndependence",
    "remove",
    "merge",
    "setPopulation",
    "setLocked",
    "setCells"
  ],
  Cultures: [
    "rename",
    "recolor",
    "setType",
    "setBase",
    "setExpansionism",
    "recalculate",
    "add",
    "remove",
    "setEmblemShape",
    "setLocked",
    "setOrigins",
    "setCode",
    "moveCenter",
    "setCells",
    "setPopulation"
  ],
  Religions: [
    "rename",
    "recolor",
    "setDeity",
    "setType",
    "setForm",
    "setExpansion",
    "setExpansionism",
    "recalculate",
    "add",
    "remove",
    "setLocked",
    "setOrigins",
    "setCode",
    "moveCenter",
    "setCells",
    "setPopulation"
  ],
  Biomes: ["rename", "recolor", "setHabitability", "add", "remove", "setCells", "restore"],
  Rivers: ["rename", "setType", "add", "remove", "setParent", "setWidth", "create"],
  Routes: ["rename", "setGroup", "add", "remove", "setLocked", "create", "split", "join"],
  Features: ["rename", "setSubtype", "setGroup", "setCoastline"],
  Zones: ["rename", "recolor", "setType", "setHidden", "setCells", "add", "remove", "setPopulation"],
  Markers: [
    "rename",
    "setIcon",
    "setType",
    "setHidden",
    "place",
    "remove",
    "move",
    "setPinned",
    "setLocked",
    "setAppearance"
  ],
  AddedLabels: ["rename", "place", "remove"],
  Labels: ["setGroup", "setLayout", "reset"],
  Military: [
    "rename",
    "remove",
    "add",
    "setAlert",
    "setUnits",
    "setNaval",
    "setIcon",
    "move",
    "rotate",
    "setBase",
    "split",
    "attach"
  ],
  Emblems: ["set", "regenerateOne", "place"],
  Journeys: [
    "add",
    "remove",
    "rename",
    "setType",
    "recolor",
    "setHidden",
    "setLocked",
    "addSegment",
    "removeSegment",
    "moveSegment",
    "setSegment",
    "resetSegment"
  ],
  Goods: ["rename", "setIcon", "recolor", "setPrice", "setUnit", "setTags", "setProduction"],
  Markets: ["rename", "recolor"],
  Lore: ["rename", "setYear", "setEra", "setDescription"],
  Notes: ["write"]
};

export const OPERATIONS = new Set(
  Object.entries(METHODS).flatMap(([model, methods]) => methods.map(m => `${model}.${m}`))
);

type Model = Record<string, (...args: unknown[]) => unknown>;

const MODELS: Record<string, unknown> = {
  AddedLabels,
  Biomes,
  Burgs,
  Cultures,
  Emblems,
  Features,
  Goods,
  Journeys,
  Labels,
  Lore,
  Markers,
  Markets,
  Military,
  Notes,
  Provinces,
  Religions,
  Rivers,
  Routes,
  States,
  Zones
};

export function runOperation(op: string, args: unknown[]): unknown {
  const [name, method] = op.split(".");
  return (MODELS[name] as Model)[method](...args);
}
