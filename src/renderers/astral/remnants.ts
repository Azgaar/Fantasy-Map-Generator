// Remnant classification: where matter piled thickest, it collapsed.
// Positions come for free — the relief generator already places the mount family on the highest cells
import type { ReliefIcon } from "@/generators/relief-generator";

export const REMNANT_CLASSES = ["blackHole", "pulsar", "neutron"] as const;
export type RemnantClassId = (typeof REMNANT_CLASSES)[number];

const MOUNT_FAMILY = new Set(["mount", "mountSnow", "vulcan"]);

/** the mount-family icons; hills, dunes, trees and library references never collapse */
export const isMountFamily = (icon: ReliefIcon): boolean => "type" in icon && MOUNT_FAMILY.has(icon.type);

/** the elevation ladder: h ≥ 80 black hole, 70–79 pulsar, anything lower neutron star */
export function remnantClass(height: number): RemnantClassId {
  if (height >= 80) return "blackHole";
  if (height >= 70) return "pulsar";
  return "neutron";
}

export interface Remnant {
  index: number; // the icon's place in pack.relief
  x: number; // the icon box centre — the cell point the icon was anchored on
  y: number;
  cls: RemnantClassId;
}

/** one remnant per mount-family icon, classified by the elevation under its centre */
export function collectRemnants(
  relief: readonly ReliefIcon[],
  cellAt: (x: number, y: number) => number | undefined,
  heights: ArrayLike<number>
): Remnant[] {
  const remnants: Remnant[] = [];
  for (let index = 0; index < relief.length; index++) {
    const icon = relief[index];
    if (!isMountFamily(icon)) continue;
    const cell = cellAt(icon.x + icon.s / 2, icon.y + icon.s / 2);
    if (cell === undefined) continue;
    remnants.push({ index, x: icon.x + icon.s / 2, y: icon.y + icon.s / 2, cls: remnantClass(heights[cell]) });
  }
  return remnants;
}
