// The 2d / 3d / globe switch under the options panel, and the Astral 2d view
import { Controllers } from "@/controllers";
import { isConquestEnabled, subscribeConquestView } from "@/controllers/conquest-mode";
import { notifyAstralView } from "./astral-view";

export { subscribeAstralView } from "./astral-view";
export { isConquestEnabled, subscribeConquestView };

type ViewMode = "standard" | "mesh" | "globe";
type Cartography = "standard" | "astral";
let viewMode: ViewMode = "standard";
let cartography: Cartography = "standard";

export const getViewMode = (): ViewMode => viewMode;
export function setViewMode(mode: ViewMode): void {
  viewMode = mode;
}

export const is3dView = (): boolean => viewMode !== "standard";
export const isGlobeView = (): boolean => viewMode === "globe";
export const isAstralView = (): boolean => cartography === "astral";

export function setAstralView(on: boolean): void {
  const next: Cartography = on ? "astral" : "standard";
  if (cartography === next) return;

  cartography = next;
  notifyAstralView();
}

export async function changeViewMode(event: Event): Promise<void> {
  const button = event.target as HTMLElement;
  if (button.tagName !== "BUTTON") return;

  if (button.id === "viewConquest") {
    await Controllers.ConquestMode.toggle();
    return;
  }

  if (isConquestEnabled()) await Controllers.ConquestMode.exit();

  if (button.id === "viewAstral") {
    await Controllers.AstralMode.toggle();
    return;
  }

  if (isAstralView()) await Controllers.AstralMode.exit();

  const isPressed = button.classList.contains("pressed");
  if (!isPressed && button.id !== "viewStandard") await Controllers.View3d.open(button.id);
  else Controllers.View3d.enterStandard();
}
