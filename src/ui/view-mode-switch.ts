// The 2d / 3d / globe buttons under the options panel, and the Astral and Living World modes
import { Controllers } from "@/controllers";
import { isConquestEnabled } from "@/controllers/conquest-mode";
import { is3dView, isAstralView, isLivingWorldEnabled, setLivingWorld } from "@/renderers/view-mode";
import { findEl } from "@/utils/node-utils";

export async function changeViewMode(event: Event): Promise<void> {
  const button = event.target as HTMLElement;
  if (button.tagName !== "BUTTON") return;

  if (button.id === "viewLivingWorld") {
    await toggleLivingWorld();
    return;
  }

  if (isLivingWorldEnabled()) await exitLivingWorld();

  if (button.id === "viewAstral") {
    await Controllers.AstralMode.toggle();
    return;
  }

  if (isAstralView()) await Controllers.AstralMode.exit();

  if (isConquestEnabled()) await Controllers.ConquestMode.exit();

  const isPressed = button.classList.contains("pressed");
  if (!isPressed && button.id !== "viewStandard") await Controllers.View3d.open(button.id);
  else void Controllers.View3d.enterStandard();
}

async function enterLivingWorld(): Promise<void> {
  if (isLivingWorldEnabled()) return;
  if (isAstralView()) await Controllers.AstralMode.exit();
  if (is3dView()) await Controllers.View3d.enterStandard();
  if (isConquestEnabled()) await Controllers.ConquestMode.exit();

  setLivingWorld(true);
  applyLivingWorldButtonState(true);
  await Controllers.LivingHud.open();
}

async function exitLivingWorld(): Promise<void> {
  if (!isLivingWorldEnabled()) return;
  setLivingWorld(false);
  applyLivingWorldButtonState(false);
  Controllers.LivingHud.close();
}

async function toggleLivingWorld(): Promise<void> {
  if (isLivingWorldEnabled()) await exitLivingWorld();
  else await enterLivingWorld();
}

function applyLivingWorldButtonState(enabled: boolean): void {
  const viewModeEl = findEl("viewMode");
  if (!viewModeEl) return;
  for (const btn of viewModeEl.querySelectorAll("button")) btn.classList.remove("pressed");
  findEl(enabled ? "viewLivingWorld" : "viewStandard")?.classList.add("pressed");
}