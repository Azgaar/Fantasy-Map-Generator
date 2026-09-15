import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import { RELIEF_ICONS, RELIEF_SETS } from "@/data/relief-icons";
import type { ReliefSet } from "@/types/relief";
import { getReliefIconId } from "./relief-generator";

afterEach(() => vi.unstubAllGlobals());

test("every relief type can switch into and out of the illustrated set without missing artwork", () => {
  const html = readFileSync("src/index.html", "utf8");
  const icons = RELIEF_ICONS.flatMap(({ set, type, variants }) =>
    variants.map(variant => ({ icon: getReliefIconId(type, variant, set), x: 10, y: 20, s: 12 }))
  );

  for (const set of Object.keys(RELIEF_SETS) as ReliefSet[]) {
    const relief = structuredClone(icons);
    vi.stubGlobal("pack", { relief });
    Relief.changeSet("illustrated");
    expect(relief.every(({ icon }) => icon.endsWith("-illustrated"))).toBe(true);
    Relief.changeSet(set);
    for (const entry of relief) {
      expect(html.includes(`<symbol id="${entry.icon}"`), entry.icon).toBe(true);
      expect({ x: entry.x, y: entry.y, s: entry.s }).toEqual({ x: 10, y: 20, s: 12 });
    }
  }
});
