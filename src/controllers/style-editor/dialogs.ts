// Every dialog the Style tab opens
import { interpolateRgb, interpolateRgbBasis, scaleSequential } from "d3";
import { destroyDialog } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import { drawHeights } from "@/renderers/draw-heightmap";
import { HeightmapColorSchemes } from "@/renderers/heightmap-color-schemes";
import { addGoogleFont, addLocalFont, addWebFont } from "@/services/fonts";
import { StylePresetsService, SYSTEM_PRESETS } from "@/services/style-presets";
import { VERSION } from "@/services/versioning";
import type { StyleElement, StyleSelection } from "@/types/styles";
import { ensureEl, escapeHtml, findEl, htmlEl, toHEX } from "@/utils";
import { sentences, t } from "@/utils/i18n";
import { groupEntriesFor, hasGroups, listElements } from "./elements";

const controlDialogs = new Set<string>(); // opened by a form control: they go with the form

/** Remember a dialog a control opened, so the form's teardown closes it */
export function trackControlDialog(id: string): void {
  controlDialogs.add(id);
}

/** Dialogs a control may have left open; the editor calls it on close */
export function destroyControlDialogs(): void {
  for (const id of controlDialogs) destroyDialog(id);
  controlDialogs.clear();
}

const ELEMENTS_ID = "styleElements";
const ELEMENTS_STYLE = /* css */ `
  #${ELEMENTS_ID} { padding: .4em .5em; }
  #${ELEMENTS_ID} > .tree { width: auto; overflow: auto; }
  #${ELEMENTS_ID} input.filter { width: 100%; box-sizing: border-box; margin-bottom: .4em; }
  #${ELEMENTS_ID} .li { display: grid; grid-template-columns: 1em 1em 1fr auto; align-items: center; gap: .4em; height: 1.9em; padding: 0 .4em; border-radius: 3px; white-space: nowrap; cursor: pointer; }
  #${ELEMENTS_ID} .li:hover { background: rgba(255, 255, 255, .25); }
  #${ELEMENTS_ID} .li.on { background: rgba(255, 255, 255, .45); font-weight: 700; }
  #${ELEMENTS_ID} .li .cnt { opacity: .6; font-size: .9em; font-weight: 400; }
  #${ELEMENTS_ID} .li .caret { opacity: .6; text-align: center; }
  #${ELEMENTS_ID} .dot { width: .7em; height: .7em; border-radius: 50%; border: 1px solid #333; justify-self: center; box-sizing: border-box; }
  #${ELEMENTS_ID} .dot.vis { background: #2f9e44; }
  #${ELEMENTS_ID} .dot.perm { background: #999; border-color: #999; cursor: default; }
  #${ELEMENTS_ID} .sub { margin-left: .9em; padding-left: 1.6em; border-left: 1px solid rgba(0, 0, 0, .15); }
  #${ELEMENTS_ID} .sub .li { grid-template-columns: 1fr auto; }
`;

/** Every style element with its visibility, its groups and their counts; a click selects in the editor */
export class ElementsDialog {
  private readonly expanded = new Set<string>(); // grouped elements the user unfolded, kept between opens
  private filter = "";
  private unsubscribe?: () => void;

  constructor(
    private readonly current: () => StyleSelection,
    private readonly onPick: (element: StyleElement, group?: string) => void
  ) {}

  open(): void {
    if (findEl(ELEMENTS_ID)) return void this.render();

    const dialog = document.createElement("div");
    dialog.id = ELEMENTS_ID;
    dialog.className = "dialog";
    dialog.style.display = "none";
    dialog.innerHTML = /* html */ `
      <style>${ELEMENTS_STYLE}</style>
      <input class="filter" type="text" placeholder="${t("Filter")}…" data-tip="${t("Filter elements and groups by name")}" />
      <div class="tree"></div>`;
    ensureEl("dialogs").append(dialog);

    const input = dialog.querySelector<HTMLInputElement>("input.filter")!;
    input.value = this.filter;
    input.addEventListener("input", () => {
      this.filter = input.value.trim().toLowerCase();
      this.render();
    });
    dialog.querySelector(".tree")!.addEventListener("click", event => this.onClick(event));
    this.unsubscribe = Layers.subscribe(() => this.render());

    $(dialog).dialog({
      title: t("Style elements"),
      width: "20em",
      height: "auto",
      maxHeight: Math.round(window.innerHeight * 0.7),
      position: { my: "left top", at: "right+10 top", of: "#options" },
      close: () => this.close()
    });
    this.render();
  }

  close(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    destroyDialog(ELEMENTS_ID);
  }

  /** Re-render when the selection or a group list changed elsewhere; a no-op while closed */
  refresh(): void {
    if (findEl(ELEMENTS_ID)) this.render();
  }

  private onClick(event: Event): void {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>(".li");
    if (!row) return;
    const element = row.dataset.element as StyleElement;

    if (target.classList.contains("dot")) {
      if (Layers.has(element) && !Layers.get(element).params.permanent) Layers.toggle(element);
      return;
    }
    if (target.classList.contains("caret")) {
      if (this.expanded.has(element)) this.expanded.delete(element);
      else this.expanded.add(element);
      this.render();
      return;
    }
    if (row.dataset.group !== undefined) {
      this.onPick(element, row.dataset.group);
      return;
    }

    // a grouped element opens on its first group and unfolds
    const first = groupEntriesFor(element)[0]?.id;
    if (first !== undefined) this.expanded.add(element);
    this.onPick(element, first);
  }

  private render(): void {
    const tree = findEl(ELEMENTS_ID)?.querySelector(".tree");
    if (!tree) return;
    const current = this.current();
    const rows: HTMLElement[] = [];

    for (const { id, label } of listElements()) {
      const entries = groupEntriesFor(id);
      const grouped = hasGroups(id);
      const elementMatches = !this.filter || label.toLowerCase().includes(this.filter);
      const matching = this.filter ? entries.filter(entry => entry.label.toLowerCase().includes(this.filter)) : entries;
      if (!elementMatches && !matching.length) continue;
      const isOpen = grouped && (this.filter ? true : this.expanded.has(id));

      const row = document.createElement("div");
      row.className = "li";
      row.dataset.element = id;
      if (current.element === id && !grouped) row.classList.add("on");
      row.append(
        this.span("caret", grouped ? (isOpen ? "▾" : "▸") : ""),
        this.dot(id),
        this.span("name", label),
        this.span("cnt", grouped ? String(entries.length) : "")
      );
      rows.push(row);
      if (!isOpen) continue;

      const sub = document.createElement("div");
      sub.className = "sub";
      for (const entry of elementMatches ? entries : matching) {
        const item = document.createElement("div");
        item.className = "li";
        item.dataset.element = id;
        item.dataset.group = entry.id;
        if (current.element === id && current.group === entry.id) item.classList.add("on");
        item.append(this.span("name", entry.label), this.span("cnt", entry.count ?? ""));
        sub.append(item);
      }
      rows.push(sub);
    }
    tree.replaceChildren(...rows);
  }

  private span(className: string, text = ""): HTMLElement {
    const el = document.createElement("span");
    el.className = className;
    el.textContent = text;
    return el;
  }

  // green when the layer is on, hollow when off, grey when it cannot be toggled or is not a layer
  private dot(id: StyleElement): HTMLElement {
    const dot = document.createElement("span");
    dot.className = "dot";
    if (!Layers.has(id)) {
      dot.classList.add("perm");
      dot.dataset.tip = t("Not a layer");
      return dot;
    }
    if (Layers.get(id).params.permanent) {
      dot.classList.add("perm");
      dot.dataset.tip = t("Always shown");
      return dot;
    }
    const on = Layers.isOn(id);
    if (on) dot.classList.add("vis");
    dot.dataset.tip = on
      ? sentences(t("Layer is on"), t("Click to toggle"))
      : sentences(t("Layer is off"), t("Click to toggle"));
    return dot;
  }
}

// --- the preset gallery ----------------------------------------------------------------------------

const PRESETS_ID = "presetSelector";
const PRESETS_STYLE = /* css */ `
  #${PRESETS_ID} { padding: .4em .5em; }
  #${PRESETS_ID} > .grid { width: auto; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .4em; }
  #${PRESETS_ID} .pc { min-width: 0; border: 2px solid transparent; border-radius: 4px; padding: 2px; text-align: center; font-size: .9em; cursor: pointer; overflow: hidden; }
  #${PRESETS_ID} .pc:hover { background: rgba(255, 255, 255, .15); }
  #${PRESETS_ID} .pc.on { border-color: var(--dark-solid); background: rgba(255, 255, 255, .25); }
  #${PRESETS_ID} .pc .img { position: relative; aspect-ratio: 16 / 10; border-radius: 2px; background: #888; display: flex; align-items: center; justify-content: center; color: #eee; font-style: italic; overflow: hidden; }
  #${PRESETS_ID} .pc .img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  #${PRESETS_ID} .pc .remove { position: absolute; top: 2px; right: 2px; margin: 0; padding: .1em .2em; font-size: .9em; opacity: 0; }
  #${PRESETS_ID} .pc:hover .remove { opacity: 1; }
  #${PRESETS_ID} .pc .name { display: block; text-transform: capitalize; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

/** One screenshot per preset, the current one outlined; a click applies through the confirmed path. Custom presets can be removed */
export class PresetSelector {
  open(): void {
    if (findEl(PRESETS_ID)) return void this.render();

    const dialog = document.createElement("div");
    dialog.id = PRESETS_ID;
    dialog.className = "dialog";
    dialog.style.display = "none";
    dialog.innerHTML = /* html */ `<style>${PRESETS_STYLE}</style><div class="grid"></div>`;
    ensureEl("dialogs").append(dialog);
    dialog.querySelector(".grid")!.addEventListener("click", event => {
      const target = event.target as HTMLElement;
      const name = target.closest<HTMLElement>(".pc")?.dataset.name;
      if (!name) return;
      if (target.closest(".remove")) void Controllers.StylePresetsEditor.remove(name);
      // the raw preset: one this browser lacks shows as default, yet picking default must still apply it
      else if (name !== (options.map.style.preset || "default"))
        void Controllers.StylePresetsEditor.requestChange(name);
    });

    $(dialog).dialog({
      title: t("Style Presets"),
      width: 480,
      maxHeight: Math.round(window.innerHeight * 0.75),
      position: { my: "left top", at: "right+10 top", of: "#options" },
      close: () => destroyDialog(PRESETS_ID)
    });
    this.render();
  }

  /** Re-render after the preset changed or a custom one was saved or removed; a no-op while closed */
  refresh(): void {
    if (findEl(PRESETS_ID)) this.render();
  }

  close(): void {
    destroyDialog(PRESETS_ID);
  }

  private render(): void {
    const grid = findEl(PRESETS_ID)?.querySelector(".grid");
    if (!grid) return;
    const cards = [...SYSTEM_PRESETS, ...StylePresetsService.listCustom()].map(name => this.card(name));
    grid.replaceChildren(...cards);
  }

  private card(name: string): HTMLElement {
    const card = document.createElement("div");
    card.className = "pc";
    card.dataset.name = name;
    card.dataset.tip = t("Apply the {{preset}} preset", { preset: StylePresetsService.displayName(name) });
    card.classList.toggle("on", name === StylePresetsService.current());

    const image = document.createElement("div");
    image.className = "img";
    // a custom preset, or a screenshot that fails to load, shows the neutral tile
    if (StylePresetsService.isSystem(name)) {
      const screenshot = document.createElement("img");
      screenshot.alt = "";
      screenshot.addEventListener("error", () => screenshot.replaceWith("custom"));
      screenshot.src = `./images/style-presets/${name}.avif?v=${VERSION}`;
      image.append(screenshot);
    } else {
      image.textContent = "custom";
      const remove = document.createElement("button");
      remove.className = "remove icon-trash-empty";
      remove.dataset.tip = t("Remove this custom preset");
      image.append(remove);
    }

    const label = document.createElement("span");
    label.className = "name";
    label.textContent = StylePresetsService.displayName(name);
    card.append(image, label);
    return card;
  }
}

// --- the controls' dialogs --------------------------------------------------------------------------

const FONT_DIALOG = "fontDialog";

const FONT_STYLE = /* css */ `
  #${FONT_DIALOG} { display: flex; flex-direction: column; gap: .4em; }
  #${FONT_DIALOG} input { width: 100%; box-sizing: border-box; }
  #${FONT_DIALOG} .choices { display: flex; flex-direction: column; gap: 0.3em; width: auto; overflow-y: auto; }
  #${FONT_DIALOG} button { flex: none; padding: .3em .5em; border: 1px solid transparent; border-radius: 0; text-align: left; white-space: nowrap; overflow: hidden; }
  #${FONT_DIALOG} button:hover { border-color: var(--dark-solid); }
  #${FONT_DIALOG} button.pressed { border: 1px solid var(--dark-solid); }
  #${FONT_DIALOG} button .sample { display: block; font-size: 1.5em; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; }
  #${FONT_DIALOG} button .family { display: block; font-size: 0.9em; line-height: 1em; opacity: .7; }
`;

type FontDialogOptions = {
  selected: string;
  sample: string; // what the labels say, drawn in each family
  onPick: (family: string) => void;
  onAdd: (refresh: (family: string) => void) => void; // opens the add-font flow; the callback lists the new family
};

function fontChoices(sample: string, selected: string): string {
  const families = [...new Set(fonts.map(({ family }) => family))];
  if (selected && !families.includes(selected)) families.push(selected);
  return families
    .map(
      family => /* html */ `
        <button type="button" data-family="${escapeHtml(family)}" class="${family === selected ? "pressed" : ""}">
          <span class="sample" style="font-family: '${escapeHtml(family)}'">${escapeHtml(sample)}</span>
          <span class="family">${escapeHtml(family)}</span>
        </button>`
    )
    .join("");
}

export function openFontDialog({ selected, sample, onPick, onAdd }: FontDialogOptions): void {
  destroyDialog(FONT_DIALOG);
  trackControlDialog(FONT_DIALOG);
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${FONT_DIALOG}" class="dialog">
      <style>${FONT_STYLE}</style>
      <input type="text" placeholder="${t("Search fonts")}" />
      <div class="choices">${fontChoices(sample, selected)}</div>
    </div>`
  );
  const dialog = ensureEl(FONT_DIALOG);

  const search = dialog.querySelector("input")!;
  const list = dialog.querySelector<HTMLElement>(".choices")!;

  const filter = () => {
    const query = search.value.trim().toLowerCase();
    for (const button of list.querySelectorAll<HTMLElement>("button[data-family]")) {
      button.hidden = !button.dataset.family!.toLowerCase().includes(query);
    }
  };
  search.addEventListener("input", filter);

  const select = (family: string) => {
    for (const pressed of list.querySelectorAll(".pressed")) pressed.classList.remove("pressed");
    list.querySelector(`button[data-family="${CSS.escape(family)}"]`)?.classList.add("pressed");
    onPick(family);
  };
  list.addEventListener("click", event => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-family]");
    if (button) select(button.dataset.family!);
  });

  $(dialog).dialog({
    title: t("Select font"),
    width: "24em",
    position: { my: "center", at: "center", of: "svg" },
    maxHeight: Math.round(window.innerHeight * 0.7),
    close: () => destroyDialog(FONT_DIALOG),
    buttons: {
      [t("Add font")]: () =>
        onAdd(family => {
          list.innerHTML = fontChoices(sample, family);
          filter();
          select(family);
        }),
      [t("Close")]: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
  list.querySelector(".pressed")?.scrollIntoView({ block: "center" });
}

export function openAddFontDialog(onAdded: (family: string) => void): void {
  destroyDialog("addFontDialog");
  trackControlDialog("addFontDialog");
  const dialog = htmlEl("div", { id: "addFontDialog", className: "dialog", style: "display: none" });
  dialog.innerHTML = /* html */ `
    <span>${t("There are 3 ways to add a custom font")}:</span>
    <p>
      <strong>${t("Google font")}</strong>. ${t('Open <a href="https://fonts.google.com/" target="_blank">Google Fonts</a>, find a font you like and enter its name to the field below.')}
    </p>
    <p>
      <strong>${t("Local font")}</strong>. ${t('If you have a font <a href="https://faqs.skillcrush.com/article/275-downloading-installing-a-font-on-your-computer" target="_blank">installed on your computer</a>, just provide the font name. Make sure the browser is reloaded after the installation. The font won\'t work on machines not having it installed. Good source of fonts are <a href="https://fontesk.com" target="_blank">Fontdesk</a> and <a href="https://www.dafont.com" target="_blank">DaFont</a>.')}
    </p>
    <p>
      <strong>${t("Font URL")}</strong>. ${t('Provide font name and link to the font file hosted online. The best free font hostings are <a href="https://fonts.google.com/" target="_blank">Google Fonts</a> and <a target="_blank" href="https://www.cdnfonts.com">CDN Fonts</a>. To get font file open the link to css provided by these services and manually copy the link to <code>woff2</code> of desired variant. To add another variant (e.g. Cyrillic), add the font one more time under the same name, but with another URL')}
    </p>
    <div style="margin-top: 0.3em" data-tip="${t("Select font adding method")}">
      <select id="addFontMethod">
        <option value="googleFont" selected>${t("Google font")}</option>
        <option value="localFont">${t("Local font")}</option>
        <option value="fontURL">${t("Font URL")}</option>
      </select>
      <input id="addFontNameInput" placeholder="${t("Font family")}" style="width: 15em" />
      <div><input id="addFontURLInput" placeholder="${t("font file URL")}" style="width: 22.6em; margin-top: 0.1em; display: none" /></div>
    </div>`;
  ensureEl("dialogs").append(dialog);

  const method = ensureEl<HTMLSelectElement>("addFontMethod");
  const nameInput = ensureEl<HTMLInputElement>("addFontNameInput");
  const urlInput = ensureEl<HTMLInputElement>("addFontURLInput");
  method.addEventListener("change", () => {
    urlInput.style.display = method.value === "fontURL" ? "inline" : "none";
  });

  const add = async () => {
    const family = nameInput.value.trim();
    const src = urlInput.value.trim();
    if (!family) return tip(t("Please provide a font name"), false, "error");
    const exists =
      method.value === "fontURL"
        ? fonts.some(font => font.family === family && font.src === `url('${src}')`)
        : fonts.some(font => font.family === family);
    if (exists) return tip(t("The font is already added"), false, "error");

    const added =
      method.value === "fontURL"
        ? addWebFont(family, src)
        : method.value === "googleFont"
          ? await addGoogleFont(family)
          : addLocalFont(family);
    if (added) onAdded(added);
    $(dialog).dialog("close");
  };

  $(dialog).dialog({
    title: t("Add custom font"),
    width: "26em",
    position: { my: "center", at: "center", of: "svg" },
    close: () => destroyDialog("addFontDialog"),
    buttons: {
      // jQuery 3.1 takes an async function for a props object, so the button handler stays sync
      [t("Add")]: () => void add(),
      [t("Cancel")]: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

export function openSchemeBuilder(current: string, onCreate: (stops: string) => void): void {
  destroyDialog("heightmapSchemeDialog");
  trackControlDialog("heightmapSchemeDialog");
  const dialog = htmlEl("div", { id: "heightmapSchemeDialog", className: "dialog", style: "display: none" });
  dialog.innerHTML = /* html */ `<div>
    <i>${t("Define heightmap gradient colors from high to low altitude")}</i>
    <img id="heightmapSchemePreview" alt="${t("heightmap preview")}" style="margin-top: 0.5em; width: 100%;" />
    <div id="heightmapSchemeStops" style="margin-block: 0.5em; display: flex; flex-wrap: wrap;"></div>
    <div id="heightmapSchemeGradient" style="height: 1.9em; border: 1px solid #767676;"></div>
  </div>`;
  ensureEl("dialogs").append(dialog);

  const stops = current.startsWith("#")
    ? current.split(",")
    : [0, 0.25, 0.5, 0.75, 1].map(HeightmapColorSchemes.get(current)).map(toHEX);

  const renderPreview = () => {
    ensureEl<HTMLImageElement>("heightmapSchemePreview").src = drawHeights({
      heights: grid.cells.h,
      width: grid.cellsX,
      height: grid.cellsY,
      scheme: scaleSequential(interpolateRgbBasis(stops)),
      renderOcean: styles.heightmap.groups.oceanHeights.options.render
    });
  };
  const renderGradient = () => {
    ensureEl("heightmapSchemeGradient").style.background = `linear-gradient(to right, ${stops.join(",")})`;
  };
  const renderStops = () => {
    const container = ensureEl("heightmapSchemeStops");
    container.replaceChildren();
    stops.forEach((stop, index) => {
      if (index) {
        const add = htmlEl("button", {
          className: "add",
          textContent: "+",
          style: "margin-top: 0.3em; height: max-content"
        });
        add.dataset.tip = t("Add color stop in between");
        add.addEventListener("click", () => {
          stops.splice(index, 0, toHEX(interpolateRgb(stops[index - 1], stops[index])(0.5)));
          renderAll();
        });
        container.append(add);
      }
      const input = htmlEl("input", {
        type: "color",
        className: "stop",
        value: stop,
        style: "width: 2.5em; border: none"
      });
      input.dataset.tip = t("Click to set the color");
      input.addEventListener("input", () => {
        stops[index] = input.value;
        renderPreview();
        renderGradient();
      });
      container.append(input);
      if (index && index < stops.length - 1) {
        const remove = htmlEl("button", {
          className: "remove",
          textContent: "x",
          style: "margin-top: 0.3em; height: max-content"
        });
        remove.dataset.tip = t("Remove color stop");
        remove.addEventListener("click", () => {
          stops.splice(index, 1);
          renderAll();
        });
        container.append(remove);
      }
    });
  };
  const renderAll = () => {
    renderPreview();
    renderStops();
    renderGradient();
  };
  renderAll();

  $(dialog).dialog({
    resizable: false,
    title: t("Create heightmap color scheme"),
    position: { my: "center top+150", at: "center top", of: "svg" },
    close: () => destroyDialog("heightmapSchemeDialog"),
    buttons: {
      [t("Create")]: function (this: HTMLElement) {
        const name = stops.join(",");
        if (HeightmapColorSchemes.has(name)) return tip(t("This scheme already exists"), false, "error");
        HeightmapColorSchemes.add(name);
        onCreate(name);
        $(this).dialog("close");
      },
      [t("Cancel")]: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

export function openTextureUrlDialog(onApply: (url: string) => void): void {
  destroyDialog("textureUrlDialog");
  trackControlDialog("textureUrlDialog");
  const dialog = htmlEl("div", { id: "textureUrlDialog", className: "dialog", style: "display: none" });
  dialog.innerHTML = /* html */ `${t("Provide a texture image URL")}:
    <input id="textureURL" type="url" style="width: 100%" placeholder="http://www.example.com/image.jpg" />
    <canvas id="texturePreview" width="256px" height="144px"></canvas>`;
  ensureEl("dialogs").append(dialog);
  const input = ensureEl<HTMLInputElement>("textureURL");
  input.addEventListener("input", () => {
    const image = new Image();
    image.onload = () => {
      const canvas = ensureEl<HTMLCanvasElement>("texturePreview");
      const context = canvas.getContext("2d")!;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = input.value;
  });

  $(dialog).dialog({
    resizable: false,
    title: t("Load custom texture"),
    width: "28em",
    close: () => destroyDialog("textureUrlDialog"),
    buttons: {
      [t("Apply")]: function (this: HTMLElement) {
        if (!input.value) return tip(t("Please provide a valid URL"), false, "error");
        onApply(input.value);
        $(this).dialog("close");
      },
      [t("Cancel")]: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}
