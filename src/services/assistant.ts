// The help assistant's call button. The dialog behind it lives in controllers/help-assistant
import { findEl } from "@/utils/nodeUtils";
import { isElectron } from "./platform";

/** Show or hide the assistant bubble. The caller says which: this owns the button, not the preference */
export function toggleAssistant(shouldShow = options.app.ui.assistant === "show"): void {
  if (isElectron()) return;

  const bubble = findEl("helpAssistantBubble");
  if (bubble) bubble.style.display = shouldShow ? "flex" : "none";
}
