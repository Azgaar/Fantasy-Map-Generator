// The Style presets dialog: one screenshot per preset, the current one outlined. A click applies the preset
// through the same confirmed path as the select; the dialog stays open and follows the change
import { destroyDialog } from "@/components/dialog/dialog-helpers";
import { Controllers } from "@/controllers";
import { StylePresetsService, SYSTEM_PRESETS } from "@/services/style-presets";
import { VERSION } from "@/services/versioning";
import { ensureEl, findEl } from "@/utils";

const ID = "presetSelector" as const;

const STYLE = /* css */ `
  #${ID} { padding: .4em .5em; }
  #${ID} > .grid { width: auto; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .4em; }
  #${ID} .pc { min-width: 0; border: 2px solid transparent; border-radius: 4px; padding: 2px; text-align: center; font-size: .9em; cursor: pointer; overflow: hidden; }
  #${ID} .pc:hover { background: rgba(255, 255, 255, .15); }
  #${ID} .pc.on { border-color: var(--style-pick, #f5c542); background: rgba(255, 255, 255, .25); }
  #${ID} .pc .img { position: relative; aspect-ratio: 16 / 9; border-radius: 2px; background: #888; display: flex; align-items: center; justify-content: center; color: #eee; font-style: italic; overflow: hidden; }
  #${ID} .pc .img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  #${ID} .pc .name { display: block; text-transform: capitalize; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

export class PresetSelector {
  open(): void {
    if (findEl(ID)) return void this.render();

    const dialog = document.createElement("div");
    dialog.id = ID;
    dialog.className = "dialog";
    dialog.style.display = "none";
    dialog.innerHTML = /* html */ `<style>${STYLE}</style><div class="grid"></div>`;
    ensureEl("dialogs").append(dialog);
    dialog.querySelector(".grid")!.addEventListener("click", event => {
      const name = (event.target as HTMLElement).closest<HTMLElement>(".pc")?.dataset.name;
      if (name && name !== this.current()) void Controllers.StylePresetsEditor.requestChange(name);
    });

    $(dialog).dialog({
      title: "Style presets",
      width: "36em",
      position: { my: "left top", at: "right+10 top", of: "#options" },
      close: () => destroyDialog(ID)
    });
    this.render();
  }

  /** Re-render after the preset changed or a custom one was saved or removed; a no-op while closed */
  refresh(): void {
    if (findEl(ID)) this.render();
  }

  close(): void {
    destroyDialog(ID);
  }

  private current(): string {
    return options.map.style.preset || "default";
  }

  private render(): void {
    const grid = findEl(ID)?.querySelector(".grid");
    if (!grid) return;

    const cards = [...SYSTEM_PRESETS, ...StylePresetsService.listCustom()].map(name => {
      const card = document.createElement("div");
      card.className = "pc";
      card.dataset.name = name;
      card.dataset.tip = `Apply the ${StylePresetsService.displayName(name)} preset`;
      card.classList.toggle("on", name === this.current());
      // a custom preset, or a screenshot that fails to load, shows the neutral tile
      const image = StylePresetsService.isSystem(name)
        ? `<img src="./images/style-presets/${name}.png?v=${VERSION}" alt="" onerror="this.replaceWith('custom')" />`
        : "custom";
      card.innerHTML = /* html */ `<div class="img">${image}</div><span class="name">${StylePresetsService.displayName(name)}</span>`;
      return card;
    });
    grid.replaceChildren(...cards);
  }
}
