import {byId} from "utils/shorthands";
import {updatePresetInput} from "./init";

export function layerIsOn(toggleId: string) {
  const buttonoff = byId(toggleId)?.classList.contains("buttonoff");
  return !buttonoff;
}

export function turnLayerButtonOn(toggleId: string) {
  byId(toggleId)?.classList.remove("buttonoff");
  updatePresetInput();
}

export function turnLayerButtonOff(toggleId: string) {
  byId(toggleId)?.classList.add("buttonoff");
  updatePresetInput();
}
