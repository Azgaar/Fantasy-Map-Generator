// The collapsible panel on the right and the sticked menu below it
import { showExportPane, showLoadPane, showSavePane } from "@/components/options/io-panes";
import { changeViewMode } from "@/components/options/view-mode";
import { clearMainTip } from "@/components/tooltips";
import { resetZoom } from "@/components/zoom";
import { ensureEl, findEl } from "@/utils/nodeUtils";

const TAB_CONTENT: Record<string, string> = {
  layersTab: "layersContent",
  styleTab: "styleContent",
  optionsTab: "optionsContent",
  toolsTab: "toolsContent",
  aboutTab: "aboutContent"
};

export function showOptions(event?: Event): void {
  if (options.view.ui.clickArrowTip) {
    clearMainTip();
    Options.set(o => (o.view.ui.clickArrowTip = false));
    ensureEl("optionsTrigger").classList.remove("glow");
  }

  ensureEl("regenerate").style.display = "none";
  ensureEl("options").style.display = "block";
  ensureEl("optionsTrigger").style.display = "none";
  event?.stopPropagation();
}

export function hideOptions(event?: Event): void {
  ensureEl("options").style.display = "none";
  ensureEl("optionsTrigger").style.display = "block";
  event?.stopPropagation();
}

export function toggleOptions(event?: Event): void {
  if (ensureEl("options").style.display === "none") showOptions(event);
  else hideOptions(event);
}

/** Show the clicked tab, hiding whichever was open. Tools swaps in the customization menu instead */
function selectTab(id: string): void {
  const active = ensureEl("options").querySelector(".tab > button.active");
  if (active?.id === id) return;

  active?.classList.remove("active");
  ensureEl(id).classList.add("active");
  for (const content of ensureEl("options").querySelectorAll<HTMLElement>(".tabcontent")) {
    content.style.display = "none";
  }

  const shown = id === "toolsTab" && customization === 1 ? "customizationMenu" : TAB_CONTENT[id];
  if (shown) ensureEl(shown).style.display = "block";
  if (id === "styleTab") window.selectStyleElement?.();
}

/** Any control marked `data-stored` pins its value, and any `<x>Input` mirrors its `<x>Output` */
function onPanelInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  const { id, value } = target;

  if (id === "manorsInput") {
    ensureEl<HTMLOutputElement>("manorsOutput").value = value === "1000" ? "auto" : value;
    return;
  }

  if (id.endsWith("Input")) {
    const output = findEl<HTMLOutputElement>(`${id.slice(0, -5)}Output`);
    if (output) output.value = value;
  } else if (id.endsWith("Output")) {
    const input = findEl<HTMLInputElement>(`${id.slice(0, -6)}Input`);
    if (input) input.value = value;
  }
}

function initialize(): void {
  $("#optionsContainer").draggable({ handle: ".drag-trigger", snap: "svg", snapMode: "both" });
  $("#exitCustomization").draggable({ handle: "div" });
  $("#mapLayers").disableSelection();

  // the trigger glows until the user has found it once
  if (!options.view.ui.clickArrowTip) {
    clearMainTip();
    ensureEl("optionsTrigger").classList.remove("glow");
  }

  const trigger = ensureEl("optionsTrigger");
  trigger.addEventListener("mouseenter", () => {
    if (trigger.classList.contains("glow")) return;
    if (ensureEl("options").style.display === "none") ensureEl("regenerate").style.display = "block";
  });
  ensureEl("collapsible").addEventListener("mouseleave", () => {
    ensureEl("regenerate").style.display = "none";
  });

  ensureEl("options")
    .querySelector("div.tab")
    ?.addEventListener("click", event => {
      const target = event.target as HTMLElement;
      if (target.tagName === "BUTTON") selectTab(target.id);
    });

  for (const id of ["options", "dialogs"]) {
    ensureEl(id).addEventListener("input", onPanelInput);
  }

  ensureEl("sticked").addEventListener("click", event => {
    const id = (event.target as HTMLElement).id;
    if (id === "newMapButton") regeneratePrompt();
    else if (id === "saveButton") showSavePane();
    else if (id === "exportButton") showExportPane();
    else if (id === "loadButton") void showLoadPane();
    else if (id === "zoomReset") resetZoom(1000);
  });

  ensureEl("viewMode").addEventListener("click", changeViewMode);
}

initialize();

// Legacy seam: the hotkeys and the About tab reach these by name from inline markup
declare global {
  // biome-ignore lint/suspicious/noRedeclare: legacy seam
  var toggleOptions: (event?: Event) => void;
  interface Window {
    showOptions: typeof showOptions;
    hideOptions: typeof hideOptions;
    selectStyleElement?: () => void;
  }
}
window.toggleOptions = toggleOptions;
window.showOptions = showOptions;
window.hideOptions = hideOptions;
