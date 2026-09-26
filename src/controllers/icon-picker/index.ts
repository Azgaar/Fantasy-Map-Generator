// The icon picker: one dialog for every icon slot, a tab per source of the Icon Library
import { confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { type IconSetId, IconSets } from "@/components/icon-sets";
import { CustomIcons, type IconPicture, Icons, type IconUseKind } from "@/components/icons";
import { tip } from "@/components/tooltips";
import { ICONS } from "@/data/icons-list";
import { capitalize, createFileInput, ensureEl, escapeHtml } from "@/utils";
import { IconPictures } from "./pictures";
import { openPositioner } from "./positioner";

const ICON_PICKER = "iconPicker";

type Tab = "builtin" | "emoji" | "custom";

export interface IconPickerOptions {
  current: string;
  onPick: (id: string) => void;
}

const STYLE = /* css */ `
  #${ICON_PICKER} { overflow: auto; }
  #${ICON_PICKER} > div { width: auto; }
  #${ICON_PICKER} .tabs { display: flex; gap: .2em; margin-bottom: .4em; }
  #${ICON_PICKER} .tabs button { flex: 1; margin: 0; }
  #${ICON_PICKER} .tabs button.pressed { font-weight: bold; }
  #${ICON_PICKER} [data-panel] { display: none; }
  #${ICON_PICKER} [data-panel].active { display: block; }
  #${ICON_PICKER} details { margin-bottom: .3em; }
  #${ICON_PICKER} summary { cursor: pointer; font-weight: bold; }
  #${ICON_PICKER} h4 { margin: .4em 0 .2em; font-size: .9em; }
  #${ICON_PICKER} .choices { display: grid; grid-template-columns: repeat(auto-fill, 4.2em); gap: .2em; }
  #${ICON_PICKER} .choices button { margin: 0; padding: .2em; border: 1px solid transparent; border-radius: 0; background: none; box-shadow: none; }
  #${ICON_PICKER} .choices button:hover { border-color: var(--dark-solid); }
  #${ICON_PICKER} .choices button.pressed { border-color: var(--dark-solid); background: #0000000d; }
  #${ICON_PICKER} .choices button svg { display: block; width: 100%; height: 2.6em; overflow: visible; pointer-events: none; }
  #${ICON_PICKER} .choices button span { display: block; font-size: .75em; line-height: 1em; opacity: .7; overflow-wrap: anywhere; pointer-events: none; }
  #${ICON_PICKER} .glyphs { grid-template-columns: repeat(auto-fill, 2.2em); }
  #${ICON_PICKER} .glyphs button { font-size: 1.5em; line-height: 1.2em; }
  #${ICON_PICKER} .glyphText { display: flex; gap: .4em; align-items: center; margin-bottom: .4em; font-style: italic; }
  #${ICON_PICKER} .glyphText input { width: 4em; }
  #${ICON_PICKER} .customAdd { display: flex; gap: .3em; align-items: center; }
  #${ICON_PICKER} .customAdd input { flex: 1; min-width: 0; }
  #${ICON_PICKER} .customAdd button { margin: 0; white-space: nowrap; }
  #${ICON_PICKER} .replacing { margin-top: .3em; font-style: italic; }
  #${ICON_PICKER} .replacing a { cursor: pointer; text-decoration: underline; }
  #${ICON_PICKER} .sources { margin: .4em 0; font-size: .85em; opacity: .8; }
  #${ICON_PICKER} .customTile { display: flex; flex-direction: column; align-items: stretch; }
  #${ICON_PICKER} .customTile .actions { display: flex; justify-content: space-around; font-size: .85em; }
  #${ICON_PICKER} .customTile .actions span { cursor: pointer; opacity: .6; }
  #${ICON_PICKER} .customTile .actions span:hover { opacity: 1; }
  #${ICON_PICKER} .customTile.pressed { outline: 1px dashed var(--dark-solid); }
  #${ICON_PICKER}.busy { cursor: progress; }
  #${ICON_PICKER}.busy .customAdd { pointer-events: none; opacity: .5; }
`;

const SLOT_NAMES: Record<IconUseKind, [string, string]> = {
  good: ["good", "goods"],
  marker: ["marker", "markers"],
  regiment: ["regiment", "regiments"],
  unit: ["unit type", "unit types"],
  burgGroup: ["burg group style", "burg group styles"],
  market: ["market marker style", "market marker styles"]
};

let fileInput: HTMLInputElement | null = null; // one per page, so reopening never binds a second listener

function open({ current, onPick }: IconPickerOptions): void {
  const initial = current;
  destroyDialog(ICON_PICKER);
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${ICON_PICKER}" class="dialog">
      <style>${STYLE}</style>
      <div class="tabs">
        <button type="button" data-tab="builtin" data-tip="Icons that come with the app">Built-in</button>
        <button type="button" data-tab="emoji" data-tip="Emoji and other short text">Emoji</button>
        <button type="button" data-tab="custom" data-tip="Pictures this map carries">Custom</button>
      </div>
      <div data-panel="builtin">${renderSets(current)}</div>
      <div data-panel="emoji">${renderGlyphs(current)}</div>
      <div data-panel="custom">${renderCustom(current)}</div>
    </div>`
  );
  const dialog = ensureEl(ICON_PICKER);
  const map = options.map;
  const isOpen = () => dialog.isConnected && options.map === map;

  const pick = (id: string) => {
    current = id;
    for (const button of dialog.querySelectorAll<HTMLElement>(".choices [data-icon]")) {
      button.classList.toggle("pressed", button.dataset.icon === id);
    }
    onPick(id);
  };

  // --- the Custom tab: add by link or upload, or give an icon a new picture while one is being replaced
  let replacing: string | null = null;
  const customIcons = dialog.querySelector<HTMLElement>(".customIcons")!;
  const linkInput = dialog.querySelector<HTMLInputElement>(".customAdd input")!;
  const setReplacing = (id: string | null) => {
    replacing = id;
    dialog.querySelector<HTMLElement>(".replacing")!.hidden = !id;
    for (const tile of dialog.querySelectorAll<HTMLElement>(".customTile"))
      tile.classList.toggle("pressed", tile.dataset.id === id);
  };
  const refreshCustom = () => {
    Icons.syncCustom();
    customIcons.innerHTML = renderCustomIcons(current);
  };

  const addPicture = async (make: (id: string) => Promise<IconPicture>) => {
    if (!isOpen() || dialog.classList.contains("busy")) return;
    const replacement = replacing;
    const id = replacement ?? CustomIcons.newId();
    dialog.classList.add("busy");
    try {
      const picture = await make(id);
      if (!isOpen() || replacing !== replacement) return;
      if (replacement) {
        CustomIcons.replace(id, picture);
        setReplacing(null);
        refreshCustom();
      } else {
        CustomIcons.add({ id, ...picture });
        refreshCustom();
        pick(id);
      }
      linkInput.value = "";
    } catch (error) {
      if (isOpen()) tip((error as Error).message, false, "error", 6000);
    } finally {
      dialog.classList.remove("busy");
    }
  };

  const upload = () => {
    fileInput ??= createFileInput("image/*,.svg");
    fileInput.onchange = () => {
      const file = fileInput!.files?.[0];
      fileInput!.value = "";
      if (file) void addPicture(id => IconPictures.fromFile(file, id));
    };
    fileInput.click();
  };

  const remove = (id: string) => {
    const uses = Icons.uses(id);
    const count = Object.values(uses).reduce((total, used) => total + used, 0);
    confirmationDialog({
      title: "Remove custom icon",
      message: count
        ? `The icon is used by ${describeUses(uses)}. ${count === 1 ? "It" : "They"} will show no icon.<br>Remove it anyway?`
        : "The icon is not used on the map. Remove it?",
      confirm: "Remove",
      onConfirm: () => {
        if (replacing === id) setReplacing(null);
        CustomIcons.remove(id);
        refreshCustom();
      }
    });
  };

  const actions: Record<string, (id: string) => void> = {
    link: () => void addPicture(() => IconPictures.fromLink(linkInput.value)),
    upload,
    stopReplacing: () => setReplacing(null),
    position: openPositioner,
    replace: id => setReplacing(replacing === id ? null : id),
    remove
  };

  const showTab = (tab: Tab) => {
    for (const button of dialog.querySelectorAll<HTMLElement>("[data-tab]"))
      button.classList.toggle("pressed", button.dataset.tab === tab);
    for (const panel of dialog.querySelectorAll<HTMLElement>("[data-panel]"))
      panel.classList.toggle("active", panel.dataset.panel === tab);
  };
  showTab(openingTab(current));

  // a set's tiles are drawn when its section opens: its chunk loads only then
  const fill = (section: HTMLDetailsElement) => {
    const set = section.dataset.set as IconSetId;
    section.dataset.filled = "true";
    const choices = section.querySelector<HTMLElement>(".choices-of-set")!;
    choices.innerHTML = renderSet(set, current);
    void Icons.retry(set); // the previews draw once the symbols land
  };
  for (const section of dialog.querySelectorAll<HTMLDetailsElement>("details[data-set]")) {
    if (section.open) fill(section);
    section.addEventListener("toggle", () => section.open && !section.dataset.filled && fill(section));
  }

  dialog.addEventListener("click", event => {
    const target = event.target as HTMLElement;
    const tab = target.closest<HTMLElement>("[data-tab]")?.dataset.tab as Tab | undefined;
    if (tab) return showTab(tab);
    const action = target.closest<HTMLElement>("[data-action]");
    if (action) return actions[action.dataset.action!]?.(action.closest<HTMLElement>(".customTile")?.dataset.id ?? "");
    const icon = target.closest<HTMLElement>(".choices [data-icon]")?.dataset.icon;
    if (icon !== undefined) {
      const input = dialog.querySelector<HTMLInputElement>(".glyphText input")!;
      input.value = Icons.glyphText(icon) ?? "";
      pick(icon);
    }
  });
  dialog.querySelector<HTMLInputElement>(".glyphText input")!.addEventListener("input", event => {
    pick(Icons.glyph((event.target as HTMLInputElement).value));
  });
  linkInput.addEventListener("keydown", event => {
    if (event.key === "Enter") void addPicture(() => IconPictures.fromLink(linkInput.value));
  });

  $(dialog).dialog({
    title: "Select icon",
    width: "32em",
    maxHeight: Math.round(window.innerHeight * 0.8),
    position: { my: "center", at: "center", of: "svg" },
    close: () => destroyDialog(ICON_PICKER),
    buttons: {
      Apply: function (this: HTMLElement) {
        $(this).dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        if (current !== initial) onPick(initial);
        $(this).dialog("close");
      }
    }
  });
}

/** the tab holding the current icon; Built-in when there is none */
function openingTab(current: string): Tab {
  const kind = Icons.kind(current);
  return kind === "custom" ? "custom" : kind === "glyph" ? "emoji" : "builtin";
}

/** every set as a section; the current icon's set is open */
function renderSets(current: string): string {
  const expanded = IconSets.setForId(current);
  return IconSets.sets()
    .map(
      ({ id }) => /* html */ `<details data-set="${id}" ${id === expanded ? "open" : ""}>
        <summary>${setName(id)}</summary>
        <div class="choices-of-set"></div>
      </details>`
    )
    .join("");
}

/** a set's icons grouped by subdirectory */
function renderSet(set: IconSetId, current: string): string {
  const groups = new Map<string, string[]>();
  for (const file of IconSets.choices(set)) {
    const group = file.slice(0, Math.max(0, file.lastIndexOf("/")));
    groups.set(group, [...(groups.get(group) ?? []), file]);
  }
  return [...groups]
    .map(([group, names]) => {
      const tiles = names.map(file => {
        const id = IconSets.symbolId(set, file);
        const name = Icons.name(id);
        return tile(id, current, `${Icons.html(id)}<span>${escapeHtml(name)}</span>`, name);
      });
      return `${group ? `<h4>${capitalize(group)}</h4>` : ""}<div class="choices">${tiles.join("")}</div>`;
    })
    .join("");
}

function renderGlyphs(current: string): string {
  const tiles = ICONS.map(glyph => tile(Icons.glyph(glyph), current, escapeHtml(glyph), glyph));
  return /* html */ `<div class="glyphText">
      <span>Select an emoji or type any short text:</span>
      <input value="${escapeHtml(Icons.glyphText(current) ?? "")}" />
    </div>
    <div class="choices glyphs">${tiles.join("")}</div>`;
}

function renderCustom(current: string): string {
  return /* html */ `<div class="customAdd">
      <input type="url" placeholder="Paste a link to an image" data-tip="A linked image keeps the map small; it shows while its site serves it" />
      <button type="button" data-action="link">Add link</button>
      <button type="button" data-action="upload" data-tip="Upload an SVG file (up to 200 kB) or a PNG, JPEG or WebP image (up to 2 MB, shrunk to 256 px)">Upload</button>
    </div>
    <div class="replacing" hidden>Link or upload the new picture of the selected icon. <a data-action="stopReplacing">Cancel</a></div>
    <p class="sources">Free icons: <a href="https://game-icons.net" target="_blank" rel="noopener">game-icons.net</a>,
      <a href="https://openmoji.org" target="_blank" rel="noopener">OpenMoji</a>,
      <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a>. Check each icon's license.</p>
    <div class="customIcons">${renderCustomIcons(current)}</div>`;
}

function renderCustomIcons(current: string): string {
  if (!CustomIcons.all.length) return `<p><i>This map carries no custom icons yet.</i></p>`;
  const tiles = CustomIcons.all.map(
    ({ id }) => /* html */ `<div class="customTile" data-id="${escapeHtml(id)}">
      ${tile(id, current, Icons.html(id), "Custom icon")}
      <div class="actions">
        <span class="icon-resize-full" data-action="position" data-tip="Zoom and pan the picture in its frame"></span>
        <span class="icon-upload" data-action="replace" data-tip="Replace the picture: every use follows"></span>
        <span class="icon-trash-empty" data-action="remove" data-tip="Remove the icon"></span>
      </div>
    </div>`
  );
  return `<div class="choices">${tiles.join("")}</div>`;
}

/** "1 good, 12 markers" */
function describeUses(uses: Partial<Record<IconUseKind, number>>): string {
  return Object.entries(uses)
    .map(([kind, count]) => `${count} ${SLOT_NAMES[kind as IconUseKind][count === 1 ? 0 : 1]}`)
    .join(", ");
}

function tile(id: string, current: string, content: string, name: string): string {
  const pressed = id === current ? "pressed" : "";
  return `<button type="button" class="${pressed}" data-icon="${escapeHtml(id)}" title="${escapeHtml(name)}">${content}</button>`;
}

function setName(id: string): string {
  return capitalize(id).replace("-", ": "); // relief-simple → Relief: simple
}

export const IconPicker = { open };
