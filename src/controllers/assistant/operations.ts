import { AddedLabels } from "@/model/annotations/added-labels";
import { Labels } from "@/model/annotations/labels-generator";
import { Goods } from "@/model/economy/goods-generator";
import { Markets } from "@/model/economy/markets-generator";
import { Routes } from "@/model/economy/routes-generator";
import { Biomes } from "@/model/physical/biomes-generator";
import { Features } from "@/model/physical/features-generator";
import { Rivers } from "@/model/physical/river-generator";
import { Burgs } from "@/model/political/burgs-generator";
import { Emblems } from "@/model/political/emblems-generator";
import { Military } from "@/model/political/military-generator";
import { Provinces } from "@/model/political/provinces-generator";
import { States } from "@/model/political/states-generator";
import { Zones } from "@/model/political/zones-generator";
import { Cultures } from "@/model/society/cultures-generator";
import { Religions } from "@/model/society/religions-generator";
import { Journeys } from "@/model/story/journeys/journeys-generator";
import { Lore } from "@/model/story/lore";
import { Markers } from "@/model/story/markers-generator";
import { Notes } from "@/model/story/notes";
import { Styles } from "@/model/styles/styles";
import { StylePresets } from "./style-presets";

const MODELS = {
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
  Styles,
  StylePresets,
  Zones
};

type Models = typeof MODELS;

// Model methods the Assistant may propose
export const METHODS = {
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
  Rivers: ["rename", "setType", "add", "remove", "setParent", "setWidth", "setLocked", "create"],
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
  Notes: ["write"],
  Styles: ["setValue"],
  StylePresets: ["apply"]
} satisfies { [K in keyof Models]?: (keyof Models[K])[] };

export const OPERATIONS = new Set(
  Object.entries(METHODS).flatMap(([model, methods]) => methods.map(method => `${model}.${method}`))
);

export function runOperation(op: string, args: unknown[]): unknown {
  const [name, method] = op.split(".");
  const model = MODELS[name as keyof Models] as unknown as Record<string, (...args: unknown[]) => unknown>;
  return model[method](...args);
}
