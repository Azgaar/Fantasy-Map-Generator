// The 2d / 3d / globe switch under the options panel
import { Controllers } from "@/controllers";

export function changeViewMode(event: Event): void {
  const button = event.target as HTMLElement;
  if (button.tagName !== "BUTTON") return;

  const isPressed = button.classList.contains("pressed");
  if (!isPressed && button.id !== "viewStandard") void Controllers.View3d.open(button.id);
  else void Controllers.View3d.enterStandard();
}
