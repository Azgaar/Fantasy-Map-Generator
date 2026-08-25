import markup from "./about-panel.html?raw";

/** Mounts the informational workspace panel outside the root application shell. */
export function mountAboutPanel(): HTMLElement {
  const existing = document.getElementById("aboutContent");
  if (existing) return existing;

  const template = document.createElement("template");
  template.innerHTML = markup;
  const panel = template.content.firstElementChild;
  if (!(panel instanceof HTMLElement)) throw new Error("About panel markup must have an HTMLElement root");

  const customizationPanel = document.getElementById("customizationMenu");
  if (!customizationPanel?.parentElement)
    throw new Error("Cannot mount About panel without the persistent workspace host");
  customizationPanel.after(panel);
  return panel;
}
