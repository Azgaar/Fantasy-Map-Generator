import markup from "./options-panel.html?raw";

/**
 * Mounts the persistent generation and preference controls before their legacy
 * event bindings run. Keeping this structural first move preserves every
 * control ID while moving the panel out of the root document shell.
 */
export function mountOptionsPanel(): HTMLElement {
  const existing = document.getElementById("optionsContent");
  if (existing) return existing;

  const template = document.createElement("template");
  template.innerHTML = markup;
  const panel = template.content.firstElementChild;
  if (!(panel instanceof HTMLElement)) throw new Error("Options panel markup must have an HTMLElement root");

  const toolsPanel = document.getElementById("toolsContent");
  if (!toolsPanel?.parentElement) throw new Error("Cannot mount options panel without the persistent workspace host");
  toolsPanel.before(panel);
  return panel;
}
