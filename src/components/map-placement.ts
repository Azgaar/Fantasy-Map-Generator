import { select } from "d3";
import { ensureEl } from "@/utils";
import { clearMainTip, tip } from "./tooltips";
import { applyDefaultViewboxEvents } from "./viewbox-events";

let cleanupActivePlacement: (() => void) | undefined;

/** Toggle a map-placement tool, replacing any other active placement tool. */
export function toggleMapPlacement(
  buttonId: string,
  onClick: (event: MouseEvent) => void,
  message: string,
  type?: "warn",
  onStop?: () => void
): boolean {
  const button = ensureEl(buttonId);
  if (button.classList.contains("pressed")) {
    stopMapPlacement();
    return false;
  }

  stopMapPlacement();
  button.classList.add("pressed");
  cleanupActivePlacement = onStop;
  select<SVGGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", onClick);
  tip(message, true, type);
  return true;
}

/** Exit the active map-placement tool and restore default map interaction. */
export function stopMapPlacement(): void {
  cleanupActivePlacement?.();
  cleanupActivePlacement = undefined;
  ensureEl("addFeature")
    .querySelectorAll("button.pressed")
    .forEach(button => {
      button.classList.remove("pressed");
    });
  applyDefaultViewboxEvents();
  clearMainTip();
}
