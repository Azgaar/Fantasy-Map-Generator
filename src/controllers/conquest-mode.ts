import { Layers, type LayersState } from "@/renderers/layers";
import { is3dView, isAstralView } from "@/renderers/view-mode";
import { setFallbackVisible } from "@/conquest/ui/button";
import { twLayerIds } from "@/conquest/ui/layers";
import { applyPreset } from "@/conquest/ui/presets";
import { Controllers } from "@/controllers";
import { findEl } from "@/utils";

let conquestEnabled = false;
let previousLayers: LayersState | null = null;
const listeners = new Set<(enabled: boolean) => void>();

export const isConquestEnabled = (): boolean => conquestEnabled;

export function subscribeConquestView(listener: (enabled: boolean) => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

function applyButtonState(enabled: boolean): void {
  const viewMode = findEl("viewMode");
  if (!viewMode) return;
  for (const button of viewMode.querySelectorAll("button")) button.classList.remove("pressed");
  findEl(enabled ? "viewConquest" : "viewStandard")?.classList.add("pressed");
}

function updateUiPanels(enabled: boolean): void {
  const rail = document.getElementById("tw-rail");
  if (rail) {
    rail.style.display = enabled ? "flex" : "none";
    rail.hidden = !enabled;
  }
  setFallbackVisible(enabled);
  if (!enabled) {
    const menu = document.getElementById("tw-menu");
    if (menu) menu.classList.remove("is-open");
  }
}

export async function enter(): Promise<void> {
  if (conquestEnabled) return;
  if (isAstralView()) await Controllers.AstralMode.exit();
  if (is3dView()) await Controllers.View3d.enterStandard();

  previousLayers = {
    active: [...Layers.state.active],
    order: [...Layers.state.order]
  };

  conquestEnabled = true;
  applyButtonState(true);
  updateUiPanels(true);

  applyPreset("campaign");

  for (const listener of listeners) listener(true);
}

export async function exit(): Promise<void> {
  if (!conquestEnabled) return;

  conquestEnabled = false;
  applyButtonState(false);
  updateUiPanels(false);

  if (previousLayers) {
    Layers.restore({
      active: previousLayers.active,
      order: previousLayers.order
    });
    Layers.drawAll();
    previousLayers = null;
  } else {
    for (const id of twLayerIds()) {
      if (Layers.isOn(id)) Layers.hide(id);
    }
    if (!Layers.isOn("states") && !Layers.isOn("provinces")) {
      Layers.show("states");
      Layers.show("borders");
      Layers.show("burgIcons");
    }
  }

  for (const listener of listeners) listener(false);
}

export async function toggle(): Promise<void> {
  if (conquestEnabled) await exit();
  else await enter();
}

export const ConquestMode = {
  isConquestEnabled,
  subscribeConquestView,
  enter,
  exit,
  toggle,
  updateUiPanels
};
