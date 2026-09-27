// The icon picker: one dialog for every icon slot, the Icon Library's sources in a side list
import { confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { type IconSetId, IconSets } from "@/components/icon-sets";
import { CustomIcons, type IconPicture, Icons, type IconUseKind } from "@/components/icons";
import { tip } from "@/components/tooltips";
import { ICON_GROUPS } from "@/data/icons-list";
import { capitalize, createFileInput, ensureEl, escapeHtml } from "@/utils";
import { IconPictures } from "./pictures";
import { openPositioner } from "./positioner";

const ICON_PICKER = "iconPicker";

/** one list entry: an emoji theme, a set or one subdirectory of a set */
interface Entry {
  key: string;
  label: string;
  icons: string[];
  set?: IconSetId;
}

/** a heading of the side list, showing all its entries at once */
interface Section {
  key: string;
  label: string;
  entries: Entry[];
}

/** the section of each set family, in list order */
const SECTIONS: Record<string, string> = {
  burgs: "Settlements",
  ports: "Settlements",
  goods: "Goods",
  relief: "Relief"
};

export interface IconPickerOptions {
  current: string;
  onPick: (id: string) => void;
}

const STYLE = /* css */ `
  #${ICON_PICKER} { padding: .4em .6em; }
  #${ICON_PICKER} > div { width: auto; }
  #${ICON_PICKER} .head { display: flex; align-items: center; gap: .6em; padding-bottom: .5em; border-bottom: 1px solid #0000001a; }
  #${ICON_PICKER} .current { display: flex; align-items: center; gap: .5em; flex: 1; min-width: 0; }
  #${ICON_PICKER} .current .preview { flex: none; display: grid; place-items: center; width: 2.2em; height: 2.2em; border-radius: 4px; background: #0000000d; }
  #${ICON_PICKER} .current .preview svg { width: 1.7em; height: 1.7em; overflow: visible; }
  #${ICON_PICKER} .current .about { display: flex; align-items: baseline; gap: .5em; min-width: 0; white-space: nowrap; }
  #${ICON_PICKER} .current .name { font-weight: bold; overflow: hidden; text-overflow: ellipsis; }
  #${ICON_PICKER} .current .from { font-size: .85em; opacity: .65; overflow: hidden; text-overflow: ellipsis; }
  #${ICON_PICKER} .currentActions { display: flex; gap: .2em; margin-left: auto; }
  #${ICON_PICKER} .currentActions button { margin: 0; padding: .2em .4em; white-space: nowrap; }
  #${ICON_PICKER} .search { width: 11em; }
  #${ICON_PICKER} .body { display: grid; grid-template-columns: 11.5em 1fr; height: min(32em, 64vh); }
  #${ICON_PICKER} nav { overflow-y: auto; padding: .4em .4em .4em 0; border-right: 1px solid #0000001a; }
  #${ICON_PICKER} nav button { display: flex; justify-content: space-between; width: 100%; margin: 0; padding: .25em .4em; border: 0; border-radius: 4px; background: none; box-shadow: none; text-align: left; white-space: nowrap; }
  #${ICON_PICKER} nav button:hover { background: #0000000d; }
  #${ICON_PICKER} nav button.active { background: #0000001a; color: inherit; font-weight: bold; }
  #${ICON_PICKER} nav button small { margin-left: .4em; opacity: .6; font-weight: normal; }
  #${ICON_PICKER} nav .section { margin-top: .5em; font-weight: bold; }
  #${ICON_PICKER} nav .entry { padding-left: 1.2em; }
  #${ICON_PICKER} .panel { position: relative; overflow-y: auto; padding: .4em 0 .4em .6em; }
  #${ICON_PICKER} .panel h4 { margin: .6em 0 .3em; font-size: .85em; opacity: .7; }
  #${ICON_PICKER} .panel h4:first-child { margin-top: 0; }
  #${ICON_PICKER} .choices { display: grid; grid-template-columns: repeat(auto-fill, minmax(5.4em, 1fr)); gap: .4em; }
  #${ICON_PICKER} .choices button { display: grid; place-items: center; aspect-ratio: 1; margin: 0; padding: 0; border: 1px solid transparent; border-radius: 4px; background: #0000000a; box-shadow: none; font-size: 2.6em; }
  #${ICON_PICKER} .choices button:hover { background: #00000017; }
  #${ICON_PICKER} .choices button.pressed { border-color: var(--dark-solid); background: #0000001f; }
  #${ICON_PICKER} .choices button svg { width: 80%; height: 80%; overflow: visible; pointer-events: none; }
  #${ICON_PICKER} .glyphText { display: flex; align-items: center; gap: .4em; margin-bottom: .5em; }
  #${ICON_PICKER} .glyphText input { width: 6em; }
  #${ICON_PICKER} .customAdd { display: flex; gap: .3em; margin-bottom: .5em; }
  #${ICON_PICKER} .customAdd input { flex: 1; min-width: 0; }
  #${ICON_PICKER} .customAdd button { margin: 0; white-space: nowrap; }
  #${ICON_PICKER} .replacing { margin: -.2em 0 .5em; padding: .3em .5em; border-radius: 4px; background: #ffd70033; }
  #${ICON_PICKER} .replacing a { cursor: pointer; text-decoration: underline; }
  #${ICON_PICKER} .note { margin: .6em 0 0; font-size: .85em; opacity: .7; }
  #${ICON_PICKER} .empty { margin: 1em 0; font-style: italic; opacity: .7; }
  #${ICON_PICKER}.busy { cursor: progress; }
  #${ICON_PICKER}.busy .customAdd { pointer-events: none; opacity: .5; }
  @media (max-width: 600px) {
    #${ICON_PICKER} .head { flex-wrap: wrap; }
    #${ICON_PICKER} .search { width: 100%; }
    #${ICON_PICKER} .body { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
    #${ICON_PICKER} nav { display: flex; gap: .2em; overflow-x: auto; padding: .4em 0; border: 0; border-bottom: 1px solid #0000001a; }
    #${ICON_PICKER} nav button { width: auto; white-space: nowrap; }
    #${ICON_PICKER} nav .section, #${ICON_PICKER} nav .entry { margin: 0; padding-left: .4em; }
    #${ICON_PICKER} .choices { grid-template-columns: repeat(auto-fill, minmax(4.4em, 1fr)); }
    #${ICON_PICKER} .panel { padding-left: 0; }
  }
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
  const sections = catalog();
  let view = viewOf(current, sections);
  let query = "";
  let replacing: string | null = null; // the custom icon a new link or upload replaces

  destroyDialog(ICON_PICKER);
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${ICON_PICKER}" class="dialog">
      <style>${STYLE}</style>
      <div class="head">
        <div class="current"></div>
        <input type="search" class="search" placeholder="Search built-in icons" data-tip="Find a built-in icon by name" />
      </div>
      <div class="body">
        <nav></nav>
        <div class="panel"></div>
      </div>
    </div>`
  );
  const dialog = ensureEl(ICON_PICKER);
  const nav = dialog.querySelector<HTMLElement>("nav")!;
  const panel = dialog.querySelector<HTMLElement>(".panel")!;
  const search = dialog.querySelector<HTMLInputElement>(".search")!;
  const map = options.map;
  const isOpen = () => dialog.isConnected && options.map === map;

  const renderHead = () => {
    dialog.querySelector(".current")!.innerHTML = renderCurrent(current, replacing, sections);
  };
  const renderNav = () => {
    nav.innerHTML = renderSources(sections, query ? null : view);
  };
  const renderPanel = () => {
    if (query) panel.innerHTML = renderResults(sections, query, current);
    else if (view === "custom") panel.innerHTML = renderCustom(current, replacing);
    else {
      const entries = entriesOf(sections, view);
      panel.innerHTML = (view.startsWith("glyph") ? renderGlyphText(current) : "") + renderEntries(entries, current);
      load(entries);
    }
    reveal();
  };
  const reveal = () => {
    const pressed = panel.querySelector<HTMLElement>(".pressed"); // the current icon in view
    panel.scrollTop = pressed ? pressed.offsetTop - panel.clientHeight / 2 : 0;
  };
  const show = (next: string) => {
    view = next;
    query = "";
    search.value = "";
    renderNav();
    renderPanel();
  };

  const pick = (id: string) => {
    current = id;
    for (const button of panel.querySelectorAll<HTMLElement>(".choices [data-icon]")) {
      button.classList.toggle("pressed", button.dataset.icon === id);
    }
    renderHead();
    onPick(id);
  };

  const setReplacing = (id: string | null) => {
    replacing = id;
    renderHead();
    if (id) show("custom");
    else if (view === "custom" && !query) renderPanel();
  };
  const refreshCustom = () => {
    Icons.syncCustom();
    renderNav();
    renderHead();
    if (view === "custom" && !query) renderPanel();
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
        replacing = null;
        refreshCustom();
      } else {
        CustomIcons.add({ id, ...picture });
        refreshCustom();
        pick(id);
      }
    } catch (error) {
      if (isOpen()) tip((error as Error).message, false, "error", 6000);
    } finally {
      dialog.classList.remove("busy");
    }
  };

  const linkValue = () => panel.querySelector<HTMLInputElement>(".customAdd input")?.value ?? "";
  const upload = () => {
    fileInput ??= createFileInput("image/*,.svg");
    fileInput.onchange = () => {
      const file = fileInput!.files?.[0];
      fileInput!.value = "";
      if (file) void addPicture(id => IconPictures.fromFile(file, id));
    };
    fileInput.click();
  };

  const remove = () => {
    const id = current;
    const uses = Icons.uses(id);
    const count = Object.values(uses).reduce((total, used) => total + used, 0);
    confirmationDialog({
      title: "Remove custom icon",
      message: count
        ? `The icon is used by ${describeUses(uses)}. ${count === 1 ? "It" : "They"} will show no icon.<br>Remove it anyway?`
        : "The icon is not used on the map. Remove it?",
      confirm: "Remove",
      onConfirm: () => {
        if (replacing === id) replacing = null;
        CustomIcons.remove(id);
        refreshCustom();
      }
    });
  };

  const actions: Record<string, () => void> = {
    link: () => void addPicture(() => IconPictures.fromLink(linkValue())),
    upload,
    stopReplacing: () => setReplacing(null),
    position: () => openPositioner(current),
    replace: () => setReplacing(replacing === current ? null : current),
    remove
  };

  dialog.addEventListener("click", event => {
    const target = event.target as HTMLElement;
    const next = target.closest<HTMLElement>("nav [data-source]")?.dataset.source;
    if (next) return show(next);
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (action) return actions[action]?.();
    const icon = target.closest<HTMLElement>(".choices [data-icon]")?.dataset.icon;
    if (icon === undefined) return;
    const text = panel.querySelector<HTMLInputElement>(".glyphText input");
    if (text) text.value = Icons.glyphText(icon) ?? "";
    pick(icon);
  });
  // a double click picks and applies
  panel.addEventListener("dblclick", event => {
    if ((event.target as HTMLElement).closest(".choices [data-icon]")) $(dialog).dialog("close");
  });
  panel.addEventListener("input", event => {
    const input = event.target as HTMLInputElement;
    if (input.closest(".glyphText")) pick(Icons.glyph(input.value));
  });
  panel.addEventListener("keydown", event => {
    if (event.key === "Enter" && (event.target as HTMLElement).closest(".customAdd")) actions.link();
  });
  search.addEventListener("input", () => {
    query = search.value.trim().toLowerCase();
    renderNav();
    renderPanel();
  });

  renderHead();
  renderNav();
  renderPanel();

  $(dialog).dialog({
    title: "Select icon",
    width: dialogWidth(),
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
  reveal(); // the panel has its height only once the dialog is laid out
}

/** 52em, narrowed to the visible screen on a phone */
function dialogWidth(): number {
  const em = Number.parseFloat(getComputedStyle(document.body).fontSize) || 10;
  return Math.min(52 * em, (window.visualViewport?.width ?? window.innerWidth) - 16);
}

/** the side list: the emoji by theme, then the built-in sets by section, a set split by subdirectory */
function catalog(): Section[] {
  const emoji = Object.entries(ICON_GROUPS).map(([label, glyphs]) => ({
    key: `glyph/${label}`,
    label,
    icons: glyphs.map(glyph => Icons.glyph(glyph))
  }));
  const builtIn = new Map<string, Entry[]>();
  for (const { id } of IconSets.sets()) {
    const family = id.split("-")[0];
    const label = SECTIONS[family] ?? capitalize(family);
    builtIn.set(label, [...(builtIn.get(label) ?? []), ...setEntries(id as IconSetId)]);
  }
  const order = [...new Set(Object.values(SECTIONS))];
  const rank = (label: string) => order.indexOf(label) + 1 || order.length + 1;
  const sets = [...builtIn]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([label, entries]) => ({ key: label, label, entries }));
  return [{ key: "glyph", label: "Emoji", entries: emoji }, ...sets];
}

/** a set's entries: one per subdirectory, else the set itself */
function setEntries(set: IconSetId): Entry[] {
  const groups = new Map<string, string[]>();
  for (const file of IconSets.files(set)) {
    const group = file.slice(0, Math.max(0, file.lastIndexOf("/")));
    groups.set(group, [...(groups.get(group) ?? []), IconSets.symbolId(set, file)]);
  }
  const name = set.slice(set.indexOf("-") + 1); // relief-simple → simple
  return [...groups].map(([group, icons]) => ({
    key: group ? `${set}/${group}` : set,
    label: capitalize((group || name).replaceAll(/[-/]/g, " ")),
    icons,
    set
  }));
}

/** a section's entries, or the one entry keyed so */
function entriesOf(sections: Section[], view: string): Entry[] {
  for (const section of sections) {
    if (section.key === view) return section.entries;
    const entry = section.entries.find(entry => entry.key === view);
    if (entry) return [entry];
  }
  return [];
}

/** the entry an icon is listed in, else the first entry of its set */
function locate(sections: Section[], id: string): { section: Section; entry: Entry } | undefined {
  const set = IconSets.setForId(id);
  const found = (match: (entry: Entry) => boolean) => {
    for (const section of sections) {
      const entry = section.entries.find(match);
      if (entry) return { section, entry };
    }
  };
  return found(entry => entry.icons.includes(id)) ?? (set && found(entry => entry.set === set));
}

/** where the picker opens: the current icon's entry, else the first built-in section */
function viewOf(current: string, sections: Section[]): string {
  if (Icons.kind(current) === "custom") return "custom";
  if (Icons.kind(current) === "glyph") return locate(sections, current)?.entry.key ?? "glyph";
  return locate(sections, current)?.entry.key ?? sections.find(({ key }) => key !== "glyph")?.key ?? "glyph";
}

/** Relief · Simple, or Goods for a section of one entry */
function entryLabel(section: Section, entry: Entry): string {
  return section.entries.length > 1 ? `${section.label} · ${entry.label}` : section.label;
}

/** the selected icon, with its custom icon actions */
function renderCurrent(current: string, replacing: string | null, sections: Section[]): string {
  const kind = Icons.kind(current);
  const located = kind === "set" ? locate(sections, current) : undefined;
  const from = !current
    ? "No icon selected"
    : kind === "glyph"
      ? "Emoji"
      : kind === "custom"
        ? "Carried by this map"
        : located
          ? entryLabel(located.section, located.entry)
          : "Built-in";
  const actions =
    kind === "custom" && CustomIcons.get(current)
      ? /* html */ `<div class="currentActions">
          <button type="button" data-action="position" data-tip="Zoom and pan the picture in its frame"><span class="icon-resize-full"></span> Position</button>
          <button type="button" data-action="replace" class="${replacing === current ? "pressed" : ""}" data-tip="Give the icon a new picture: every use follows"><span class="icon-upload"></span> Replace</button>
          <button type="button" data-action="remove" data-tip="Remove the icon from the map"><span class="icon-trash-empty"></span></button>
        </div>`
      : "";
  return /* html */ `<span class="preview">${Icons.html(current)}</span>
    <div class="about"><span class="name">${escapeHtml(current ? capitalize(Icons.name(current)) : "None")}</span><span class="from">${from}</span></div>
    ${actions}`;
}

/** the map's icons, then each section: its heading shows all its entries, a section of one entry is just the entry */
function renderSources(sections: Section[], active: string | null): string {
  const item = (key: string, label: string, count: number, type = "") =>
    `<button type="button" data-source="${escapeHtml(key)}" class="${type} ${key === active ? "active" : ""}">${label}${count ? ` <small>${count}</small>` : ""}</button>`;
  const list = sections.map(section => {
    const [first] = section.entries;
    if (section.entries.length === 1) return item(first.key, section.label, first.icons.length, "section");
    const count = section.entries.reduce((total, entry) => total + entry.icons.length, 0);
    const entries = section.entries.map(entry => item(entry.key, entry.label, entry.icons.length, "entry"));
    return item(section.key, section.label, count, "section") + entries.join("");
  });
  return item("custom", "Custom", CustomIcons.all.length) + list.join("");
}

/** the entries' tiles, each under its label when there are several */
function renderEntries(entries: Entry[], current: string, headings = entries.length > 1): string {
  return entries
    .map(entry => {
      const tiles = entry.icons.map(id => tile(id, current)).join("");
      return `${headings ? `<h4>${entry.label}</h4>` : ""}<div class="choices">${tiles}</div>`;
    })
    .join("");
}

/** an explicit demand: the previews draw once the sets' symbols land */
function load(entries: Entry[]): void {
  for (const set of new Set(entries.map(entry => entry.set))) if (set) void Icons.retry(set);
}

/** the built-in icons whose name holds the query, entry by entry */
function renderResults(sections: Section[], query: string, current: string): string {
  const found = sections.flatMap(section =>
    section.entries
      .filter(entry => entry.set)
      .map(entry => ({
        ...entry,
        label: entryLabel(section, entry),
        icons: entry.icons.filter(id => Icons.name(id).includes(query))
      }))
      .filter(entry => entry.icons.length)
  );
  load(found);
  return found.length
    ? renderEntries(found, current, true)
    : `<p class="empty">No built-in icon is called “${escapeHtml(query)}”.</p>`;
}

function renderGlyphText(current: string): string {
  return /* html */ `<label class="glyphText">Type any short text
      <input value="${escapeHtml(Icons.glyphText(current) ?? "")}" placeholder="XIV" />
    </label>`;
}

function renderCustom(current: string, replacing: string | null): string {
  const icons = CustomIcons.all.map(({ id }) => tile(id, current));
  return /* html */ `<div class="customAdd">
      <input type="url" placeholder="Paste a link to an image" data-tip="A linked image keeps the map small; it shows while its site serves it" />
      <button type="button" data-action="link">Add link</button>
      <button type="button" data-action="upload" data-tip="Upload an SVG file (up to 200 kB) or a PNG, JPEG or WebP image (up to 2 MB, shrunk to 256 px)">Upload</button>
    </div>
    <div class="replacing" ${replacing ? "" : "hidden"}>Link or upload the new picture of the selected icon. <a data-action="stopReplacing">Cancel</a></div>
    ${icons.length ? `<div class="choices">${icons.join("")}</div>` : `<p class="empty">This map carries no custom icons yet.</p>`}
    <p class="note">Free icons: <a href="https://game-icons.net" target="_blank" rel="noopener">game-icons.net</a>,
      <a href="https://thenounproject.com" target="_blank" rel="noopener">The Noun Project</a>,
      <a href="https://openmoji.org" target="_blank" rel="noopener">OpenMoji</a>,
      <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a>.</p>`;
}

/** "1 good, 12 markers" */
function describeUses(uses: Partial<Record<IconUseKind, number>>): string {
  return Object.entries(uses)
    .map(([kind, count]) => `${count} ${SLOT_NAMES[kind as IconUseKind][count === 1 ? 0 : 1]}`)
    .join(", ");
}

/** a glyph tile draws its text, sparing a symbol per glyph */
function tile(id: string, current: string): string {
  const pressed = id === current ? "pressed" : "";
  const text = Icons.glyphText(id);
  const content = text === null ? Icons.html(id) : escapeHtml(text);
  return `<button type="button" class="${pressed}" data-icon="${escapeHtml(id)}" data-tip="${escapeHtml(capitalize(Icons.name(id)))}">${content}</button>`;
}

export const IconPicker = { open };
