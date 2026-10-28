// The 2d / 3d / globe switch under the options panel, and the Astral 2d view
import { Controllers } from "@/controllers";
import { isConquestEnabled, subscribeConquestView } from "@/controllers/conquest-mode";
import { findEl } from "@/utils";
import { notifyAstralView } from "./astral-view";

export { subscribeAstralView } from "./astral-view";
export { isConquestEnabled, subscribeConquestView };

type ViewMode = "standard" | "mesh" | "globe";
type Cartography = "standard" | "astral";
let viewMode: ViewMode = "standard";
let cartography: Cartography = "standard";
let livingWorldEnabled = false;

export const getViewMode = (): ViewMode => viewMode;
export function setViewMode(mode: ViewMode): void {
  viewMode = mode;
}

export const is3dView = (): boolean => viewMode !== "standard";
export const isGlobeView = (): boolean => viewMode === "globe";
export const isAstralView = (): boolean => cartography === "astral";
export const isLivingWorldEnabled = (): boolean => livingWorldEnabled;

export function setAstralView(on: boolean): void {
  const next: Cartography = on ? "astral" : "standard";
  if (cartography === next) return;

  cartography = next;
  notifyAstralView();
}

export async function changeViewMode(event: Event): Promise<void> {
  const button = event.target as HTMLElement;
  if (button.tagName !== "BUTTON") return;

  if (button.id === "viewLivingWorld") {
    await toggleLivingWorld();
    return;
  }

  if (livingWorldEnabled) await exitLivingWorld();

  if (button.id === "viewAstral") {
    await Controllers.AstralMode.toggle();
    return;
  }

  if (isAstralView()) await Controllers.AstralMode.exit();

  if (isConquestEnabled()) await Controllers.ConquestMode.exit();

  const isPressed = button.classList.contains("pressed");
  if (!isPressed && button.id !== "viewStandard") await Controllers.View3d.open(button.id);
  else Controllers.View3d.enterStandard();
}

async function enterLivingWorld(): Promise<void> {
  if (livingWorldEnabled) return;
  if (isAstralView()) await Controllers.AstralMode.exit();
  if (is3dView()) await Controllers.View3d.enterStandard();
  if (isConquestEnabled()) await Controllers.ConquestMode.exit();

  livingWorldEnabled = true;
  applyLivingWorldButtonState(true);
  await Controllers.LivingHud.open();
}

async function exitLivingWorld(): Promise<void> {
  if (!livingWorldEnabled) return;
  livingWorldEnabled = false;
  applyLivingWorldButtonState(false);
  Controllers.LivingHud.close();
}

async function toggleLivingWorld(): Promise<void> {
  if (livingWorldEnabled) await exitLivingWorld();
  else await enterLivingWorld();
}

function applyLivingWorldButtonState(enabled: boolean): void {
  const viewModeEl = findEl("viewMode");
  if (!viewModeEl) return;
  for (const btn of viewModeEl.querySelectorAll("button")) btn.classList.remove("pressed");
  findEl(enabled ? "viewLivingWorld" : "viewStandard")?.classList.add("pressed");
}
