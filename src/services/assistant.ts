// The third-party support chat widget, loaded on demand and only on the web
import { showDataTip } from "@/components/tooltips";
import { findEl } from "@/utils/nodeUtils";
import { isElectron } from "./platform";

let isLoaded = false;

const container = () => findEl("chat-widget-container");

/** Show or hide the assistant. The caller says which: this owns the widget, not the preference */
export function toggleAssistant(shouldShow = options.view.ui.assistant === "show"): void {
  if (isElectron()) return;

  if (!shouldShow) {
    if (isLoaded && container()) container()!.style.display = "none";
    return;
  }

  if (isLoaded) {
    if (container()) container()!.style.display = "block";
    return;
  }

  isLoaded = true;

  // a vendored classic script, not an ES module: load it with a tag so the bundler leaves it alone
  const script = document.createElement("script");
  script.src = `${import.meta.env.BASE_URL}libs/openwidget.min.js`;
  script.async = true;
  script.onload = () => {
    // the widget builds its bubble asynchronously, well after the script itself resolves
    setTimeout(() => {
      const bubble = findEl("chat-widget-minimized");
      if (!bubble) return;
      bubble.dataset.tip = "Click to open the Assistant";
      bubble.addEventListener("mouseover", showDataTip);
    }, 5000);
  };
  document.head.append(script);
}

// Legacy seam: the options panel toggles it on change
declare global {
  interface Window {
    toggleAssistant: typeof toggleAssistant;
  }
}
window.toggleAssistant = toggleAssistant;
