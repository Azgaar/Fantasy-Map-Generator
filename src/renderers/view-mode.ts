// The 2d / 3d / globe switch under the options panel
import { Controllers } from "@/controllers";

type ViewMode = "standard" | "mesh" | "globe";
let viewMode: ViewMode = "standard";

export const getViewMode = (): ViewMode => viewMode;
export function setViewMode(mode: ViewMode): void {
  viewMode = mode;
}

export const is3dView = (): boolean => viewMode !== "standard";
export const isGlobeView = (): boolean => viewMode === "globe";

export function changeViewMode(event: Event): void {
  const button = event.target as HTMLElement;
  if (button.tagName !== "BUTTON") return;

  const isPressed = button.classList.contains("pressed");
  if (!isPressed && button.id !== "viewStandard") void Controllers.View3d.open(button.id);
  else void Controllers.View3d.enterStandard();
}
