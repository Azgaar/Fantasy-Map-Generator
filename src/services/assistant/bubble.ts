// The Assistant call button. The dialog behind it lives in controllers/assistant

import { findEl } from "@/utils/nodeUtils";

/** Show or hide the assistant bubble. The caller says which: this owns the button, not the preference */
export function toggleAssistant(shouldShow = options.app.ui.assistant === "show"): void {
  const bubble = findEl("assistantBubble");
  if (bubble) bubble.style.display = shouldShow ? "flex" : "none";
}
