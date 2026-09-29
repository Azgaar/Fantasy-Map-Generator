import type { LayerId } from "@/components/layers";
import type { EntityType } from "@/components/map-entities";
import { Notes } from "@/generators/notes";

// Operations the Assistant may propose. Each is a public model-class method; see docs/prd/assistant.md

export interface Operation {
  run: (...args: any[]) => void;
  /** Entity types the operation may change, or "entity" for the one its first argument names */
  touches: (EntityType | "entity")[];
  redraw: LayerId[];
}

export const OPERATIONS: Record<string, Operation> = {
  "Burgs.rename": { run: (id, name) => Burgs.rename(id, name), touches: ["burg"], redraw: ["labels"] },
  "Burgs.setPopulation": { run: (id, people) => Burgs.setPopulation(id, people), touches: ["burg"], redraw: [] },
  "Burgs.setGroup": {
    run: (id, group) => Burgs.setGroup(id, group),
    touches: ["burg"],
    redraw: ["burgIcons", "labels"]
  },
  "Burgs.setType": { run: (id, type) => Burgs.setType(id, type), touches: ["burg"], redraw: [] },
  "Burgs.setBuilding": {
    run: (id, building, present) => Burgs.setBuilding(id, building, present),
    touches: ["burg"],
    redraw: []
  },
  "States.rename": { run: (id, name) => States.rename(id, name), touches: ["state"], redraw: ["labels"] },
  "States.recolor": {
    run: (id, color) => States.recolor(id, color),
    touches: ["state"],
    redraw: ["states", "military"]
  },
  "States.setFullName": {
    run: (id, fullName) => States.setFullName(id, fullName),
    touches: ["state"],
    redraw: ["labels"]
  },
  "Provinces.rename": {
    run: (id, name) => Provinces.rename(id, name),
    touches: ["province"],
    redraw: ["provinces", "labels"]
  },
  "Provinces.recolor": {
    run: (id, color) => Provinces.recolor(id, color),
    touches: ["province"],
    redraw: ["provinces"]
  },
  "Provinces.setFullName": {
    run: (id, fullName) => Provinces.setFullName(id, fullName),
    touches: ["province"],
    redraw: ["labels"]
  },
  "Cultures.rename": { run: (id, name) => Cultures.rename(id, name), touches: ["culture"], redraw: [] },
  "Cultures.recolor": { run: (id, color) => Cultures.recolor(id, color), touches: ["culture"], redraw: ["cultures"] },
  "Cultures.setType": { run: (id, type) => Cultures.setType(id, type), touches: ["culture"], redraw: [] },
  "Religions.rename": { run: (id, name) => Religions.rename(id, name), touches: ["religion"], redraw: [] },
  "Religions.recolor": {
    run: (id, color) => Religions.recolor(id, color),
    touches: ["religion"],
    redraw: ["religions"]
  },
  "Religions.setDeity": { run: (id, deity) => Religions.setDeity(id, deity), touches: ["religion"], redraw: [] },
  "Biomes.rename": { run: (id, name) => Biomes.rename(id, name), touches: ["biome"], redraw: [] },
  "Biomes.recolor": { run: (id, color) => Biomes.recolor(id, color), touches: ["biome"], redraw: ["biomes"] },
  "Biomes.setHabitability": {
    run: (id, percent) => Biomes.setHabitability(id, percent),
    touches: ["biome"],
    redraw: []
  },
  "Rivers.rename": { run: (id, name) => Rivers.rename(id, name), touches: ["river"], redraw: ["labels"] },
  "Routes.rename": { run: (id, name) => Routes.rename(id, name), touches: ["route"], redraw: ["labels"] },
  "Features.rename": { run: (id, name) => Features.rename(id, name), touches: ["feature"], redraw: [] },
  "Zones.rename": { run: (id, name) => Zones.rename(id, name), touches: ["zone"], redraw: ["zones"] },
  "Zones.recolor": { run: (id, color) => Zones.recolor(id, color), touches: ["zone"], redraw: ["zones"] },
  "Zones.setType": { run: (id, type) => Zones.setType(id, type), touches: ["zone"], redraw: ["zones"] },
  "Zones.setHidden": { run: (id, hidden) => Zones.setHidden(id, hidden), touches: ["zone"], redraw: ["zones"] },
  "Markers.rename": { run: (id, name) => Markers.rename(id, name), touches: ["marker"], redraw: [] },
  "Markers.setIcon": { run: (id, icon) => Markers.setIcon(id, icon), touches: ["marker"], redraw: ["markers"] },
  "Markers.setType": { run: (id, type) => Markers.setType(id, type), touches: ["marker"], redraw: ["markers"] },
  "Markers.setHidden": { run: (id, hidden) => Markers.setHidden(id, hidden), touches: ["marker"], redraw: ["markers"] },
  "Notes.write": { run: (key, html) => Notes.write(key, html), touches: ["entity"], redraw: [] }
};
