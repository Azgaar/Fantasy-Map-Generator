import { ensureEl, getIsolines } from "@/utils";
import type { Alliance } from "@/generators/alliances-generator";
import { buildFillPaths } from "./isoline-fills";

type AllianceMapOptions = typeof options.map & { alliances?: Alliance[] };

/** Countries can belong to multiple alliances; the first active alliance supplies the display color. */
export function drawAlliances(): void {
  const alliances = ((options.map as AllianceMapOptions).alliances ?? []).filter(
    alliance => alliance.status === "active"
  );
  const target = ensureEl("alliancesBody");
  if (!alliances.length) {
    target.replaceChildren();
    return;
  }

  const { cells } = pack;
  const allianceByState = new Map<number, number>();
  alliances.forEach((alliance, index) => {
    for (const stateId of alliance.members) if (!allianceByState.has(stateId)) allianceByState.set(stateId, index + 1);
  });
  const isolines = getIsolines(pack, cellId => allianceByState.get(cells.state[cellId]) ?? 0, {
    fill: true,
    waterGap: true
  });
  target.innerHTML = buildFillPaths("alliance", isolines, index => alliances[index - 1]?.color ?? "transparent");
}
