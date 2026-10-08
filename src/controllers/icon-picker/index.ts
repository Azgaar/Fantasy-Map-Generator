// The icon picker: one dialog for every icon slot, the Icon Library's sources in a side list
import { confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { type IconSetId, IconSets } from "@/components/icon-sets";
import { type CustomIcon, CustomIcons, type IconPicture, Icons } from "@/components/icons";
import { tip } from "@/components/tooltips";
import { ICON_GROUPS } from "@/data/icons-list";
import { ICON_GROUP_LABELS } from "@/data/id-labels";
import { IconsArchive } from "@/services/io/icons-archive";
import type { IconSet } from "@/types/icons";
import { capitalize, createFileInput, downloadFile, ensureEl, escapeHtml, getFileName } from "@/utils";
import { sentences, t } from "@/utils/i18n";
import { IconPictures, type PictureProfile } from "./pictures";
import { closePositioner, openPositioner } from "./positioner";

const ICON_PICKER = "iconPicker";

/** one list entry: an emoji theme, a set or one subdirectory of a set, listed under its group */
interface Entry {
  key: string;
  group: string;
  label: string;
  icons: string[];
  set?: IconSetId;
}

export interface IconPickerOptions {
  current: string;
  onPick: (id: string) => void; // on Apply; `live` also calls it on every selection and with `current` on cancel
  live?: boolean;
  preferCustom?: boolean; // open on the Custom tab when no icon is set
  profile?: PictureProfile;
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
  #${ICON_PICKER} nav div.section { padding: .25em .4em; white-space: nowrap; }
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
  #${ICON_PICKER} .customArchive { display: flex; gap: .3em; margin-top: .5em; }
  #${ICON_PICKER} .customArchive button { margin: 0; }
  #${ICON_PICKER} .replacing { margin: -.2em 0 .5em; padding: .3em .5em; border-radius: 4px; background: #ffd70033; }
  #${ICON_PICKER} .replacing a { cursor: pointer; text-decoration: underline; }
  #${ICON_PICKER} .note { margin: .6em 0 0; font-size: .85em; opacity: .7; }
  #${ICON_PICKER} .empty { margin: 1em 0; font-style: italic; opacity: .7; }
  #${ICON_PICKER}.busy { cursor: progress; }
  #${ICON_PICKER}.busy :is(.customAdd, .customArchive) { pointer-events: none; opacity: .5; }
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

let fileInput: HTMLInputElement | null = null; // one per page, so reopening never binds a second listener

function open({ current, onPick, live = false, preferCustom, profile = "icon" }: IconPickerOptions): void {
  const initial = current;
  let applied = false;
  const entries = catalog();
  let view = viewOf(current, entries, preferCustom);
  let query = "";
  let replacing: string | null = null; // the custom icon a new link or upload replaces

  destroyDialog(ICON_PICKER);
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${ICON_PICKER}" class="dialog">
      <style>${STYLE}</style>
      <div class="head">
        <div class="current"></div>
        <input type="search" class="search" placeholder="${t("Search built-in icons")}" data-tip="${t("Find a built-in icon or emoji by name")}" />
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
    dialog.querySelector(".current")!.innerHTML = renderCurrent(current, replacing, entries);
  };
  const renderNav = () => {
    nav.innerHTML = renderSources(entries, query ? null : view);
  };
  const renderPanel = () => {
    if (query) panel.innerHTML = renderResults(entries, query, current);
    else if (view === "custom") panel.innerHTML = renderCustom(current, replacing, profile);
    else {
      const shown = entries.filter(({ key }) => key === view);
      panel.innerHTML = (view.startsWith("glyph") ? renderGlyphText(current) : "") + renderEntries(shown, current);
      load(shown);
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
    if (live) onPick(id);
  };
  const apply = () => {
    applied = true;
    if (!live) onPick(current);
    $(dialog).dialog("close");
  };

  const setReplacing = (id: string | null) => {
    replacing = id;
    renderHead();
    if (id) show("custom");
    else if (view === "custom" && !query) renderPanel();
  };
  const refreshCustom = () => {
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
        closePositioner(id);
        CustomIcons.update(id, picture);
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
  const pickFile = (accept: string, onFile: (file: File) => void) => {
    fileInput ??= createFileInput(accept);
    fileInput.accept = accept;
    fileInput.onchange = () => {
      const file = fileInput!.files?.[0];
      fileInput!.value = "";
      if (file) onFile(file);
    };
    fileInput.click();
  };
  const upload = () =>
    pickFile("image/*,.svg", file => void addPicture(id => IconPictures.fromFile(file, id, profile)));

  const exportAll = async () => {
    const blob = await IconsArchive.pack();
    downloadFile(blob, `${getFileName("Custom icons")}.zip`, "application/zip");
  };
  const importArchive = (file: File) => {
    if (!isOpen() || dialog.classList.contains("busy")) return;
    dialog.classList.add("busy");
    closePositioner(current);
    IconsArchive.unpack(file)
      .then(({ added, unchanged, conflicts, invalid }) => {
        if (!isOpen()) return;
        refreshCustom();
        const counts = [
          t("Added: {{added}}", { added }),
          unchanged && t("Already here: {{unchanged}}", { unchanged }),
          invalid && t("Invalid, skipped: {{invalid}}", { invalid })
        ];
        tip(sentences(t("Custom icons imported"), counts.filter(Boolean).join(", ")), false, "success", 5000);
        if (conflicts.length) askToReplace(conflicts);
      })
      .catch(error => isOpen() && tip((error as Error).message, false, "error", 6000))
      .finally(() => dialog.classList.remove("busy"));
  };
  const askToReplace = (conflicts: CustomIcon[]) => {
    confirmationDialog({
      title: t("Import custom icons"),
      message: sentences(
        t("Archived icons with the id of a different icon on this map: {{icons}}", { icons: conflicts.length }),
        t("Replace the map's pictures with the archived ones?"),
        t("Everything using them will change")
      ),
      confirm: t("Replace"),
      cancel: t("Keep the map's"),
      onConfirm: () => {
        for (const { id } of conflicts) closePositioner(id);
        IconsArchive.replace(conflicts);
        if (isOpen()) refreshCustom();
        tip(t("Custom icons replaced: {{icons}}", { icons: conflicts.length }), false, "success", 4000);
      }
    });
  };

  const remove = () => {
    const id = current;
    const uses = Icons.uses(id);
    const count = Object.values(uses).reduce((total, used) => total + used, 0);
    confirmationDialog({
      title: t("Remove custom icon"),
      message: count
        ? `${t("The icon is used by {{uses}}. They will show no icon.", {
            uses: Icons.describeUses(uses)
          })}<br>${t("Remove it anyway?")}`
        : t("The icon is not used on the map. Remove it?"),
      confirm: t("Remove"),
      onConfirm: () => {
        if (replacing === id) replacing = null;
        closePositioner(id);
        CustomIcons.remove(id);
        refreshCustom();
      }
    });
  };

  const actions: Record<string, () => void> = {
    link: () => void addPicture(() => IconPictures.fromLink(linkValue())),
    upload,
    exportAll: () => void exportAll().catch(error => tip((error as Error).message, false, "error", 6000)),
    importArchive: () => pickFile(".zip,application/zip", importArchive),
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
    if ((event.target as HTMLElement).closest(".choices [data-icon]")) apply();
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
    title: t("Select icon"),
    width: dialogWidth(),
    position: { my: "center", at: "center", of: "svg" },
    close: () => {
      if (live && !applied && current !== initial) onPick(initial);
      destroyDialog(ICON_PICKER);
    },
    buttons: {
      [t("Apply")]: apply,
      [t("Cancel")]: () => $(dialog).dialog("close")
    }
  });
  reveal(); // the panel has its height only once the dialog is laid out
}

/** 52em, narrowed to the visible screen on a phone */
function dialogWidth(): number {
  const em = Number.parseFloat(getComputedStyle(document.body).fontSize) || 10;
  return Math.min(52 * em, (window.visualViewport?.width ?? window.innerWidth) - 16);
}

/** the side list: the emoji by theme, then the built-in sets by group, a set split by subdirectory */
function catalog(): Entry[] {
  const emoji = Object.entries(ICON_GROUPS).map(([label, glyphs]) => ({
    key: `glyph/${label}`,
    group: t("Emoji"),
    label: ICON_GROUP_LABELS[label] ?? label,
    icons: Object.keys(glyphs).map(glyph => Icons.glyph(glyph))
  }));
  return [...emoji, ...IconSets.sets().flatMap(setEntries)];
}

/** a set's entries: one per subdirectory, else the set itself, named after its folder */
function setEntries({ id, group }: IconSet): Entry[] {
  const set = id as IconSetId;
  const subdirectories = new Map<string, string[]>();
  for (const file of IconSets.files(set)) {
    const subdirectory = file.slice(0, Math.max(0, file.lastIndexOf("/")));
    subdirectories.set(subdirectory, [...(subdirectories.get(subdirectory) ?? []), IconSets.symbolId(set, file)]);
  }
  const name = id.slice(id.indexOf("-") + 1); // relief-simple → simple, goods → goods
  return [...subdirectories].map(([subdirectory, icons]) => ({
    key: subdirectory ? `${set}/${subdirectory}` : set,
    group,
    label: capitalize((subdirectory || name).replaceAll(/[-/]/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2")),
    icons,
    set
  }));
}

/** the entry an icon is listed in, else the first entry of its set */
function locate(entries: Entry[], id: string): Entry | undefined {
  const set = IconSets.setForId(id);
  return entries.find(entry => entry.icons.includes(id)) ?? (set && entries.find(entry => entry.set === set));
}

/** where the picker opens: the current icon's entry, else the first emoji or built-in entry */
function viewOf(current: string, entries: Entry[], preferCustom?: boolean): string {
  const kind = Icons.kind(current);
  if (kind === "custom") return "custom";
  if (!current && preferCustom) return "custom";
  const entry = locate(entries, current) ?? entries.find(({ set }) => (kind === "glyph" ? !set : set));
  return entry?.key ?? "custom";
}

/** Relief · Simple, or Goods for a set that is its own group */
function entryLabel(entry: Entry): string {
  return entry.label === entry.group ? groupName(entry.group) : `${groupName(entry.group)} · ${entry.label}`;
}

/** a set group's name in the interface; the group stays English in the data */
const groupName = (group: string): string => ICON_GROUP_LABELS[group] ?? group;

/** the selected icon, with its custom icon actions */
function renderCurrent(current: string, replacing: string | null, entries: Entry[]): string {
  const kind = Icons.kind(current);
  const located = kind === "set" ? locate(entries, current) : undefined;
  const from = !current
    ? t("No icon selected")
    : kind === "glyph"
      ? t("Emoji")
      : kind === "custom"
        ? t("Carried by this map")
        : located
          ? entryLabel(located)
          : t("Built-in");
  const actions =
    kind === "custom" && CustomIcons.get(current)
      ? /* html */ `<div class="currentActions">
          <button type="button" data-action="position" data-tip="${t("Zoom and pan the picture in its frame")}"><span class="icon-resize-full"></span> ${t("Position")}</button>
          <button type="button" data-action="replace" class="${replacing === current ? "pressed" : ""}" data-tip="${t("Give the icon a new picture: every use follows")}"><span class="icon-upload"></span> ${t("Replace")}</button>
          <button type="button" data-action="remove" data-tip="${t("Remove the icon from the map")}"><span class="icon-trash-empty"></span></button>
        </div>`
      : "";
  return /* html */ `<span class="preview">${Icons.html(current)}</span>
    <div class="about"><span class="name">${escapeHtml(current ? capitalize(Icons.name(current)) : t("None"))}</span><span class="from">${from}</span></div>
    ${actions}`;
}

/** the map's icons, then each entry under its group's heading; a set that is its own group stands alone */
function renderSources(entries: Entry[], active: string | null): string {
  const item = (key: string, label: string, count: number, type = "") =>
    `<button type="button" data-source="${escapeHtml(key)}" class="${type} ${key === active ? "active" : ""}">${label}${count ? ` <small>${count}</small>` : ""}</button>`;
  let group = "";
  const list = entries.map(entry => {
    if (entry.label === entry.group) return item(entry.key, groupName(entry.group), entry.icons.length, "section");
    const heading = entry.group === group ? "" : `<div class="section">${groupName(entry.group)}</div>`;
    group = entry.group;
    return heading + item(entry.key, entry.label, entry.icons.length, "entry");
  });
  return item("custom", t("Custom"), CustomIcons.all.length) + list.join("");
}

/** the entries' tiles, each under its label when asked */
function renderEntries(entries: Entry[], current: string, headings = false): string {
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

/** the built-in icons and emoji whose name holds the query, entry by entry */
function renderResults(entries: Entry[], query: string, current: string): string {
  const found = entries
    .map(entry => ({
      ...entry,
      label: entryLabel(entry),
      icons: entry.icons.filter(id => Icons.name(id).toLowerCase().includes(query))
    }))
    .filter(entry => entry.icons.length);
  load(found);
  return found.length
    ? renderEntries(found, current, true)
    : `<p class="empty">${t("No built-in icon is called “{{query}}”.", { query })}</p>`;
}

function renderGlyphText(current: string): string {
  return /* html */ `<label class="glyphText">${t("Type any short text")}
      <input value="${escapeHtml(Icons.glyphText(current) ?? "")}" placeholder="XIV" />
    </label>`;
}

function renderCustom(current: string, replacing: string | null, profile: PictureProfile): string {
  const icons = CustomIcons.all.map(({ id }) => tile(id, current));
  return /* html */ `<div class="customAdd">
      <input type="url" placeholder="${t("Paste a link to an image")}" data-tip="${t("A linked image keeps the map small; it shows while its site serves it")}" />
      <button type="button" data-action="link">${t("Add link")}</button>
      <button type="button" data-action="upload" data-tip="${profile === "emblem" ? t("Upload an SVG file (up to 1 MB) or a PNG, JPEG or WebP image (up to 10 MB, shrunk to 1024 px)") : t("Upload an SVG file (up to 200 kB) or a PNG, JPEG or WebP image (up to 2 MB, shrunk to 256 px)")}">${t("Upload")}</button>
    </div>
    <div class="replacing" ${replacing ? "" : "hidden"}>${t("Link or upload the new picture of the selected icon.")} <a data-action="stopReplacing">${t("Cancel")}</a></div>
    ${icons.length ? `<div class="choices">${icons.join("")}</div>` : t('<p class="empty">This map carries no custom icons yet.</p>')}
    <div class="customArchive">
      ${icons.length ? `<button type="button" data-action="exportAll" data-tip="${t("Download all custom icons as a zip archive, to import them into another map")}">${t("Download all")}</button>` : ""}
      <button type="button" data-action="importArchive" data-tip="${t("Import custom icons from a downloaded zip archive. An icon whose id the map uses for another picture is replaced only on confirmation")}">${t("Import zip")}</button>
    </div>
    <p class="note">${t("Free icons")}: <a href="https://game-icons.net" target="_blank" rel="noopener">game-icons.net</a>, <a href="https://thenounproject.com" target="_blank" rel="noopener">The Noun Project</a>, <a href="https://openmoji.org" target="_blank" rel="noopener">OpenMoji</a>, <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a>.</p>`;
}

/** a glyph tile draws its text, sparing a symbol per glyph */
function tile(id: string, current: string): string {
  const pressed = id === current ? "pressed" : "";
  const text = Icons.glyphText(id);
  const content = text === null ? Icons.html(id) : escapeHtml(text);
  return `<button type="button" class="${pressed}" data-icon="${escapeHtml(id)}" data-tip="${escapeHtml(capitalize(Icons.name(id)))}">${content}</button>`;
}

export const IconPicker = { open };
