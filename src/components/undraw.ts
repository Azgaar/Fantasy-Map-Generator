// Clearing the map: everything drawn for the previous world has to go before the next one is drawn.
// A leaf on purpose - the editors that erase a map must not have to pull in the whole app lifecycle
import { Layers } from "@/components/layers";
import { unfog } from "@/renderers/overlays/fogging";
import { ensureEl } from "@/utils/nodeUtils";

/** Clear the map: every layer, the transient defs and the notes that described what was there */
export function undraw(): void {
  Layers.eraseAll();
  for (const el of ensureEl("deftemp").querySelectorAll("path, clipPath, svg")) el.remove();
  ensureEl("coas").innerHTML = ""; // auto-generated emblems are re-created on demand
  notes = [];
  unfog();
}
