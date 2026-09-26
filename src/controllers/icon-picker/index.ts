// The icon picker: one dialog for every icon slot, the Icon Library's sources in a side list
import { confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { type IconSetId, IconSets } from "@/components/icon-sets";
import { CustomIcons, type IconPicture, Icons, type IconUseKind } from "@/components/icons";
import { tip } from "@/components/tooltips";
import { ICONS } from "@/data/icons-list";
import { capitalize, createFileInput, ensureEl, escapeHtml } from "@/utils";
import { IconPictures } from "./pictures";
import { openPositioner } from "./positioner";

const ICON_PICKER = "iconPicker";

/** a built-in set, the glyphs or the map's custom icons */
type Source = IconSetId | "glyph" | "custom";

export interface IconPickerOptions {
  current: string;
  onPick: (id: string) => void;
}

const STYLE = /* css */ `
  #${ICON_PICKER} { padding: .4em .6em; }
  #${ICON_PICKER} > div { width: auto; }
  #${ICON_PICKER} .head { display: flex; align-items: center; gap: .6em; padding-bottom: .5em; border-bottom: 1px solid #0000001a; }
  #${ICON_PICKER} .current { display: flex; align-items: center; gap: .5em; flex: 1; min-width: 0; }
  #${ICON_PICKER} .current .preview { flex: none; display: grid; place-items: center; width: 2.6em; height: 2.6em; font-size: 1.1em; border-radius: 4px; background: #0000000d; }
  #${ICON_PICKER} .current .preview svg { width: 2em; height: 2em; overflow: visible; }
  #${ICON_PICKER} .current .about { display: flex; flex-direction: column; min-width: 0; }
  #${ICON_PICKER} .current .name { font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #${ICON_PICKER} .current .from { font-size: .85em; opacity: .65; }
  #${ICON_PICKER} .currentActions { display: flex; gap: .2em; margin-left: auto; }
  #${ICON_PICKER} .currentActions button { margin: 0; padding: .2em .4em; white-space: nowrap; }
  #${ICON_PICKER} .search { width: 11em; }
  #${ICON_PICKER} .body { display: grid; grid-template-columns: 8.5em 1fr; height: min(24em, 58vh); }
  #${ICON_PICKER} nav { overflow-y: auto; padding: .4em .4em .4em 0; border-right: 1px solid #0000001a; }
  #${ICON_PICKER} nav h5 { margin: .7em 0 .2em .4em; font-size: .75em; text-transform: uppercase; letter-spacing: .05em; opacity: .55; }
  #${ICON_PICKER} nav button { display: flex; justify-content: space-between; width: 100%; margin: 0; padding: .25em .4em; border: 0; border-radius: 4px; background: none; box-shadow: none; text-align: left; }
  #${ICON_PICKER} nav button:hover { background: #0000000d; }
  #${ICON_PICKER} nav button.active { background: #0000001a; font-weight: bold; }
  #${ICON_PICKER} nav button small { margin-left: .4em; opacity: .6; font-weight: normal; }
  #${ICON_PICKER} .panel { position: relative; overflow-y: auto; padding: .4em 0 .4em .6em; }
  #${ICON_PICKER} .panel h4 { margin: .6em 0 .3em; font-size: .85em; opacity: .7; }
  #${ICON_PICKER} .panel h4:first-child { margin-top: 0; }
  #${ICON_PICKER} .choices { display: grid; grid-template-columns: repeat(auto-fill, minmax(3.2em, 1fr)); gap: .3em; }
  #${ICON_PICKER} .choices button { display: grid; place-items: center; aspect-ratio: 1; margin: 0; padding: 0; border: 1px solid transparent; border-radius: 4px; background: #0000000a; box-shadow: none; font-size: 1.5em; }
  #${ICON_PICKER} .choices button:hover { background: #00000017; }
  #${ICON_PICKER} .choices button.pressed { border-color: var(--dark-solid); background: #0000001f; }
  #${ICON_PICKER} .choices button svg { width: 70%; height: 70%; overflow: visible; pointer-events: none; }
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
    #${ICON_PICKER} nav h5 { display: none; }
    #${ICON_PICKER} nav button { width: auto; white-space: nowrap; }
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
  let source = sourceOf(current);
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
    dialog.querySelector(".current")!.innerHTML = renderCurrent(current, replacing);
  };
  const renderNav = () => {
    nav.innerHTML = renderSources(query ? null : source);
  };
  const renderPanel = () => {
    if (query) panel.innerHTML = renderResults(query, current);
    else if (source === "glyph") panel.innerHTML = renderGlyphs(current);
    else if (source === "custom") panel.innerHTML = renderCustom(current, replacing);
    else {
      panel.innerHTML = renderSet(source, current);
      void Icons.retry(source); // an explicit demand: the previews draw once the symbols land
    }
    reveal();
  };
  const reveal = () => {
    const pressed = panel.querySelector<HTMLElement>(".pressed"); // the current icon in view
    panel.scrollTop = pressed ? pressed.offsetTop - panel.clientHeight / 2 : 0;
  };
  const show = (next: Source) => {
    source = next;
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
    else if (source === "custom" && !query) renderPanel();
  };
  const refreshCustom = () => {
    Icons.syncCustom();
    renderNav();
    renderHead();
    if (source === "custom" && !query) renderPanel();
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
    const next = target.closest<HTMLElement>("nav [data-source]")?.dataset.source as Source | undefined;
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

/** 42em, narrowed to the visible screen on a phone */
function dialogWidth(): number {
  const em = Number.parseFloat(getComputedStyle(document.body).fontSize) || 10;
  return Math.min(42 * em, (window.visualViewport?.width ?? window.innerWidth) - 16);
}

/** where the current icon comes from; the first built-in set when there is none */
function sourceOf(current: string): Source {
  const kind = Icons.kind(current);
  if (kind === "custom" || kind === "glyph") return kind;
  const firstSet = IconSets.sets().find(set => !set.id.includes("-"))?.id as IconSetId | undefined;
  return IconSets.setForId(current) ?? firstSet ?? "glyph";
}

/** the selected icon, with its custom icon actions */
function renderCurrent(current: string, replacing: string | null): string {
  const kind = Icons.kind(current);
  const from = !current
    ? "No icon selected"
    : kind === "set"
      ? setLabel(IconSets.setForId(current)!, true)
      : kind === "glyph"
        ? "Emoji & text"
        : "Carried by this map";
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

/** the sources: the map's icons and glyphs, then the built-in sets, a family's sets under its heading */
function renderSources(active: Source | null): string {
  const item = (source: Source, label: string, extra = "") =>
    `<button type="button" data-source="${source}" class="${source === active ? "active" : ""}">${label}${extra}</button>`;
  const families = new Map<string, string[]>();
  for (const { id } of IconSets.sets()) {
    const family = id.includes("-") ? id.slice(0, id.indexOf("-")) : "";
    families.set(family, [...(families.get(family) ?? []), id]);
  }
  const count = CustomIcons.all.length;
  const builtIn = [...families]
    .sort(([a], [b]) => (a ? 1 : 0) - (b ? 1 : 0))
    .map(
      ([family, sets]) =>
        `<h5>${family ? capitalize(family) : "Built-in"}</h5>${sets.map(set => item(set as IconSetId, setLabel(set))).join("")}`
    )
    .join("");
  return `${item("custom", "Custom", count ? ` <small>${count}</small>` : "")}${item("glyph", "Emoji & text")}${builtIn}`;
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
        return tile(id, current, Icons.html(id), Icons.name(id));
      });
      return `${group ? `<h4>${capitalize(group)}</h4>` : ""}<div class="choices">${tiles.join("")}</div>`;
    })
    .join("");
}

/** the built-in icons whose name holds the query, set by set */
function renderResults(query: string, current: string): string {
  const sections = IconSets.sets().flatMap(({ id }) => {
    const set = id as IconSetId;
    const files = IconSets.choices(set).filter(file => Icons.name(IconSets.symbolId(set, file)).includes(query));
    if (!files.length) return [];
    void Icons.retry(set);
    const tiles = files.map(file => {
      const icon = IconSets.symbolId(set, file);
      return tile(icon, current, Icons.html(icon), Icons.name(icon));
    });
    return [`<h4>${setLabel(set, true)}</h4><div class="choices">${tiles.join("")}</div>`];
  });
  return sections.join("") || `<p class="empty">No built-in icon is called “${escapeHtml(query)}”.</p>`;
}

function renderGlyphs(current: string): string {
  const tiles = ICONS.map(glyph => tile(Icons.glyph(glyph), current, escapeHtml(glyph), glyph));
  return /* html */ `<label class="glyphText">Type any short text
      <input value="${escapeHtml(Icons.glyphText(current) ?? "")}" placeholder="XIV" />
    </label>
    <div class="choices">${tiles.join("")}</div>`;
}

function renderCustom(current: string, replacing: string | null): string {
  const icons = CustomIcons.all.map(({ id }) => tile(id, current, Icons.html(id), "Custom icon"));
  return /* html */ `<div class="customAdd">
      <input type="url" placeholder="Paste a link to an image" data-tip="A linked image keeps the map small; it shows while its site serves it" />
      <button type="button" data-action="link">Add link</button>
      <button type="button" data-action="upload" data-tip="Upload an SVG file (up to 200 kB) or a PNG, JPEG or WebP image (up to 2 MB, shrunk to 256 px)">Upload</button>
    </div>
    <div class="replacing" ${replacing ? "" : "hidden"}>Link or upload the new picture of the selected icon. <a data-action="stopReplacing">Cancel</a></div>
    ${icons.length ? `<div class="choices">${icons.join("")}</div>` : `<p class="empty">This map carries no custom icons yet.</p>`}
    <p class="note">Free icons: <a href="https://game-icons.net" target="_blank" rel="noopener">game-icons.net</a>,
      <a href="https://openmoji.org" target="_blank" rel="noopener">OpenMoji</a>,
      <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a>. Check each icon's license.</p>`;
}

/** "1 good, 12 markers" */
function describeUses(uses: Partial<Record<IconUseKind, number>>): string {
  return Object.entries(uses)
    .map(([kind, count]) => `${count} ${SLOT_NAMES[kind as IconUseKind][count === 1 ? 0 : 1]}`)
    .join(", ");
}

function tile(id: string, current: string, content: string, name: string): string {
  const pressed = id === current ? "pressed" : "";
  return `<button type="button" class="${pressed}" data-icon="${escapeHtml(id)}" data-tip="${escapeHtml(capitalize(name))}">${content}</button>`;
}

/** relief-simple → Simple, or Relief · Simple with its family */
function setLabel(id: string, withFamily = false): string {
  const [family, ...rest] = id.split("-");
  if (!rest.length) return capitalize(family);
  const name = capitalize(rest.join(" "));
  return withFamily ? `${capitalize(family)} · ${name}` : name;
}

export const IconPicker = { open };
