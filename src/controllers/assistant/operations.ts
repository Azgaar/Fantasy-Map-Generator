import { Burgs } from "@/generators/burgs-generator";
import { Cultures } from "@/generators/cultures-generator";
import { Emblems } from "@/generators/emblems-generator";
import { Labels } from "@/generators/labels-generator";
import { Lore } from "@/generators/lore";
import { Military } from "@/generators/military-generator";
import { Notes } from "@/generators/notes";

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

const IMPORTED: Record<string, unknown> = { Burgs, Cultures, Emblems, Labels, Lore, Military, Notes };

/** Run a registered operation. Models that don't export their singleton yet are reached through their global */
export function runOperation(op: string, args: unknown[]): unknown {
  const [name, method] = op.split(".");
  const model = IMPORTED[name] ?? globalThis[name as keyof typeof globalThis];
  return (model as Model)[method](...args);
}
