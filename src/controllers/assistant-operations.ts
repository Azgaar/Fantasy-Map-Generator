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
  "States.rename": { run: (id, name) => States.rename(id, name), touches: ["state"], redraw: ["labels"] },
  "Provinces.rename": {
    run: (id, name) => Provinces.rename(id, name),
    touches: ["province"],
    redraw: ["provinces", "labels"]
  },
  "Cultures.rename": { run: (id, name) => Cultures.rename(id, name), touches: ["culture"], redraw: [] },
  "Religions.rename": { run: (id, name) => Religions.rename(id, name), touches: ["religion"], redraw: [] },
  "Rivers.rename": { run: (id, name) => Rivers.rename(id, name), touches: ["river"], redraw: ["labels"] },
  "Markers.rename": { run: (id, name) => Markers.rename(id, name), touches: ["marker"], redraw: [] },
  "Notes.write": { run: (key, html) => Notes.write(key, html), touches: ["entity"], redraw: [] }
};
