import { Controllers } from "@/controllers";
import { selectionsAt, setSelection } from "@/services/agent/map-tools";
import { getPointer } from "@/utils";

let dismiss: (() => void) | undefined;
export function openHere(event: MouseEvent): void {
  const viewbox = document.getElementById("viewbox");
  const element = event.target instanceof Element ? event.target : null;
  if (!viewbox || !element || !viewbox.contains(element) || element.closest("input,textarea,[contenteditable]")) return;
  const [x, y] = getPointer(event, viewbox);
  const choices = selectionsAt(x, y, element);
  if (!choices.length) return;
  event.preventDefault();
  event.stopPropagation();
  dismiss?.();
  const previous = document.activeElement;
  const menu = document.createElement("div");
  menu.id = "assistantHere";
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-label", "Here: assistant actions");
  Object.assign(menu.style, {
    position: "fixed",
    zIndex: "10000",
    padding: "8px",
    background: "var(--light-solid, white)",
    color: "var(--text-color, black)",
    boxShadow: "0 2px 10px #0006",
    borderRadius: "5px",
    maxWidth: "280px",
    display: "grid",
    gap: "5px"
  });
  const title = document.createElement("strong");
  title.textContent = "Here";
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Subject at this location");
  choices.forEach((c, i) => {
    select.add(new Option(c.label, String(i)));
  });
  menu.append(title, select);
  const close = () => {
    menu.remove();
    document.removeEventListener("pointerdown", outside, true);
    document.removeEventListener("keydown", keys, true);
    if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    dismiss = undefined;
  };
  const outside = (e: Event) => {
    if (!menu.contains(e.target as Node)) close();
  };
  const keys = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
    if (e.key === "Tab") {
      const controls = [select, ...menu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      const index = controls.indexOf(document.activeElement as HTMLSelectElement);
      e.preventDefault();
      controls[(index + (e.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
    }
  };
  for (const [label, prompt] of [
    ["Ask about here…", ""],
    ["Describe this place", "Describe this place using its map context."],
    ["Draft a note…", "Draft a note for this place."],
    ["Use as assistant context", ""]
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.onclick = () => {
      const choice = choices[Number(select.value)];
      close();
      setSelection(choice);
      void Controllers.HelpAssistant.open().then(() => {
        const input = document.getElementById("helpMapInput") as HTMLTextAreaElement | null;
        if (input) {
          input.value = prompt;
          input.dispatchEvent(new Event("input"));
          input.focus();
        }
      });
    };
    if (label === "Draft a note…") {
      const update = () => {
        button.disabled = choices[Number(select.value)].target.startsWith("cell:");
      };
      select.addEventListener("change", update);
      update();
    }
    menu.append(button);
  }
  document.body.append(menu);
  menu.style.left = `${Math.max(0, Math.min(event.clientX, innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${Math.max(0, Math.min(event.clientY, innerHeight - menu.offsetHeight - 8))}px`;
  dismiss = close;
  document.addEventListener("pointerdown", outside, true);
  document.addEventListener("keydown", keys, true);
  select.focus();
}
document.addEventListener("contextmenu", openHere);
