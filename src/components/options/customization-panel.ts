import markup from "./customization-panel.html?raw";

/** Mounts the heightmap editor's persistent customization surface. */
export function mountCustomizationPanel(): HTMLElement {
  const existing = document.getElementById("customizationMenu");
  if (existing) return existing;

  const template = document.createElement("template");
  template.innerHTML = markup;
  const panel = template.content.firstElementChild;
  if (!(panel instanceof HTMLElement)) throw new Error("Customization panel markup must have an HTMLElement root");

  const toolsPanel = document.getElementById("toolsContent");
  if (!toolsPanel?.parentElement)
    throw new Error("Cannot mount customization panel without the persistent workspace host");
  toolsPanel.after(panel);
  return panel;
}
