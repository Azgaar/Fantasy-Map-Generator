import type { CultureType } from "@/data/culture-types";

export interface Era {
  level: number; // the level it begins at
  name: string;
}

/** The eras, 1–100; 0 is no development, where nobody lives */
export const DEFAULT_ERAS: readonly Era[] = [
  { level: 1, name: "Paleolithic" },
  { level: 3, name: "Mesolithic" },
  { level: 6, name: "Neolithic" },
  { level: 9, name: "Copper Age" },
  { level: 12, name: "Bronze Age" },
  { level: 15, name: "Late Bronze Age" },
  { level: 18, name: "Iron Age" },
  { level: 21, name: "Classical Age" },
  { level: 24, name: "Late Antiquity" },
  { level: 27, name: "Early Middle Ages" },
  { level: 30, name: "High Middle Ages" },
  { level: 33, name: "Commercial Revolution" },
  { level: 36, name: "Late Middle Ages" },
  { level: 40, name: "Renaissance" },
  { level: 45, name: "Age of Discovery" },
  { level: 50, name: "Scientific Revolution" },
  { level: 60, name: "Enlightenment" },
  { level: 70, name: "Industrial Revolution" },
  { level: 80, name: "Machine Age" },
  { level: 90, name: "Space Age" },
  { level: 100, name: "Post-human" }
];

export const DEFAULT_DEVELOPMENT = 33; // a culture's level when none is set: Commercial Revolution
export const WILDLANDS_DEVELOPMENT = 3; // foragers

/** How a way of life adds to its culture's development */
export const CULTURE_TYPE_DEVELOPMENT: Record<CultureType, number> = {
  Generic: 0,
  River: 2,
  Naval: 3,
  Lake: 1,
  Highland: -2,
  Nomadic: -3,
  Hunting: -4
};
