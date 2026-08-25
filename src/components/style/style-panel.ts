import markup from "./style-panel.html?raw";

/**
 * Mounts the style editor's persistent control surface before legacy style
 * bindings initialize. The first extraction is structural: IDs stay stable
 * while the panel leaves the root document shell.
 */
export function mountStylePanel(): HTMLElement {
  const existing = document.getElementById("styleContent");
  if (existing) return existing;

  const template = document.createElement("template");
  template.innerHTML = markup;
  const panel = template.content.firstElementChild;
  if (!(panel instanceof HTMLElement)) throw new Error("Style panel markup must have an HTMLElement root");

  const toolsPanel = document.getElementById("toolsContent");
  if (!toolsPanel?.parentElement) throw new Error("Cannot mount style panel without the persistent workspace host");
  toolsPanel.before(panel);
  return panel;
}
