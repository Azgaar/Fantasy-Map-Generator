// Enter and leave the Astral view: swap the layer profile and, when available, the chart style
import { Layers, type LayersState } from "@/components/layers";
import { is3dView, isAstralView, setAstralView } from "@/components/options/view-mode";
import { Options } from "@/components/options-model";
import { applyPerformanceSettings, setHaloOwnedByBorders } from "@/components/performance";
import { tip } from "@/components/tooltips";
import { invokeActiveZooming } from "@/components/zoom";
import { Controllers } from "@/controllers";
import { ASTRAL_DEFAULT_PRESET, ASTRAL_PRESETS } from "@/data/astral-layers";
import { groupsOf } from "@/generators/astral-naming";
import { StylePresetsService } from "@/services/style-presets";
import type { StylesData } from "@/types/styles";
import { findEl } from "@/utils";

const PROFILE_KEY = "fmg-astral-previous-profile";
const POLITICAL_LAYERS = [
  "borders",
  "burgIcons",
  "ice",
  "labels",
  "lakes",
  "rivers",
  "routes",
  "scaleBar",
  "states",
  "vignette"
];

interface StoredProfile {
  stylePreset: string;
  styled: boolean;
  layers: LayersState;
}

interface Profile extends StoredProfile {
  styles: StylesData;
}

let profile: Profile | null = null;
let transition = 0;
let hintedNaming = false;

/** One hint per session: the mode is a view, and the naming action that completes it stays in Tools */
function hintNaming(): void {
  if (hintedNaming) return;
  const hasAstralPeoples = pack.states?.some(state => state.i && !state.removed && groupsOf(state.culture ?? 0));
  if (!hasAstralPeoples) return;
  hintedNaming = true;
  tip(
    "For a full star chart apply Astral naming under Tools: polities take their words, provinces become sectors",
    false,
    "info",
    8000
  );
}

function saveProfile(value: StoredProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(value));
  } catch {
    // a full storage only costs the cross-reload fallback
  }
}

function readProfile(): StoredProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredProfile>;
    if (typeof value.stylePreset !== "string" || typeof value.styled !== "boolean") return null;
    const layers = value.layers;
    if (!layers || !Array.isArray(layers.order) || !Array.isArray(layers.active)) return null;
    return { stylePreset: value.stylePreset, styled: value.styled, layers };
  } catch {
    return null;
  }
}

function clearProfile(): void {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    // nothing to clear
  }
}

function applyLayers(active: readonly string[], order?: string[]): void {
  Layers.restore({ order: order ?? Layers.state.order, active: [...active] });
  Layers.drawAll();
}

function applyButtonState(astral: boolean): void {
  const viewMode = findEl("viewMode");
  if (!viewMode) return;
  for (const button of viewMode.querySelectorAll("button")) button.classList.remove("pressed");
  findEl(astral ? "viewAstral" : "viewStandard")?.classList.add("pressed");
}

async function applyStyle(styles: unknown, current: number): Promise<void> {
  if (current !== transition) return;
  await Controllers.StylePresetsEditor.applyPreset(styles);
  if (current !== transition) return;
  Layers.drawAll();
  invokeActiveZooming();
  void Controllers.StyleEditor.refresh(true);
}

async function enter(): Promise<void> {
  if (isAstralView()) return;
  if (customization) return void tip("Finish editing before entering Astral view", false, "error");
  if (is3dView()) await Controllers.View3d.enterStandard();

  const styled = StylePresetsService.isSystem("astral");
  const next: Profile = {
    stylePreset: options.map.style.preset,
    styled,
    layers: Layers.state,
    styles: structuredClone(styles)
  };
  profile = next;
  saveProfile({ stylePreset: next.stylePreset, styled: next.styled, layers: next.layers });
  const current = ++transition;

  setAstralView(true);
  setHaloOwnedByBorders(true); // the Borders button owns the halo while the mode is on
  options.map.astral = true;
  if (styled) options.map.style.preset = "astral";
  Options.persist();
  applyButtonState(true);
  applyLayers(ASTRAL_PRESETS[ASTRAL_DEFAULT_PRESET].layers);
  hintNaming();

  if (!styled) return;
  const loaded = await StylePresetsService.load("astral");
  if (current !== transition || !isAstralView()) return;
  if (loaded.error) tip(`${loaded.error}. Keeping the current style`, false, "error", 8000);
  else await applyStyle(loaded.styles, current);
}

async function exit(): Promise<void> {
  if (!isAstralView()) return;
  const current = ++transition;
  const previous = profile ?? readProfile();
  const restoreStyle = previous?.styled ?? StylePresetsService.isSystem("astral");

  setAstralView(false);
  setHaloOwnedByBorders(false);
  options.map.astral = false;
  options.map.style.preset = previous?.stylePreset ?? "default";
  Options.persist();
  applyButtonState(false);
  applyLayers(previous?.layers.active ?? POLITICAL_LAYERS, previous?.layers.order);

  if (restoreStyle) {
    if (profile) await applyStyle(profile.styles, current);
    else {
      const loaded = await StylePresetsService.load(options.map.style.preset);
      if (current !== transition || isAstralView()) return;
      if (loaded.error) tip(`${loaded.error}. Applying the default style`, false, "error", 8000);
      await applyStyle(loaded.styles, current);
    }
  }

  profile = null;
  clearProfile();
}

const toggle = async (): Promise<void> => (isAstralView() ? exit() : enter());

/** Adopt the persisted mode without re-applying anything: the loaded map already carries its state */
function hydrate(): void {
  const astral = options.map.astral === true;
  setAstralView(astral);
  setHaloOwnedByBorders(astral);
  applyButtonState(astral);
}

// the halo lives on the states layer but is switched by the Borders one, so re-check it on every change
Layers.subscribe(() => applyPerformanceSettings());

window.addEventListener("map:generated", hydrate);

export const AstralMode = { enter, exit, toggle, hydrate };
