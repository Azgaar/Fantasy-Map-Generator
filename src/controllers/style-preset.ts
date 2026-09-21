// Style presets: the preset row on the Style tab, applying a preset to the map, the Style Saver dialog
import { confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import { invokeActiveZooming } from "@/components/zoom";
import { Controllers } from "@/controllers";
import { Styles } from "@/generators/styles";
import { isLegacyPreset, isStoreStyles, normalizeStyles, presetFromLegacy } from "@/generators/styles-legacy";
import { applyVignetteOptions } from "@/renderers/draw-vignette";
import { HeightmapColorSchemes } from "@/renderers/heightmap-color-schemes";
import { CUSTOM_PREFIX, StylePresetsService, SYSTEM_PRESETS } from "@/services/style-presets";
import type { StylesData } from "@/types/styles";
import { applyOption, downloadFile, ensureEl, isValidJSON, openURL, uploadFile } from "@/utils";

const id = "stylePreset" as const;
let wired = false;

/** Fill the preset select from the system list and localStorage, and make it follow the map's preset */
function init(): void {
  const el = ensureEl<HTMLSelectElement>(id);
  el.replaceChildren(
    ...SYSTEM_PRESETS.map(name => new Option(name, name)),
    ...StylePresetsService.listCustom().map(name => new Option(StylePresetsService.displayName(name), name))
  );
  if (!wired) {
    wired = true;
    el.addEventListener("change", () => requestChange(el.value));
    ensureEl("addStyleButton").addEventListener("click", openSaver);
    ensureEl("removeStyleButton").addEventListener("click", remove);
  }
  syncSelect();
}

// the select follows options.map.style.preset: a preset this browser doesn't have falls back to default
function syncSelect(): void {
  const el = ensureEl<HTMLSelectElement>(id);
  const preset = options.map.style.preset || "default";
  const isKnown = Array.from(el.options).some(option => option.value === preset);
  el.value = el.dataset.old = isKnown ? preset : "default";
  ensureEl("removeStyleButton").style.display = StylePresetsService.isSystem(el.value) ? "none" : "inline-block";
}

const isKnownStyleFormat = (json: unknown): boolean =>
  typeof json === "object" && json !== null && (isLegacyPreset(json) || isStoreStyles(json));

/** A preset record in store shape, whichever format it was saved in; undefined for what is not a preset */
export function parsePreset(presetJson: unknown): StylesData | undefined {
  if (!isKnownStyleFormat(presetJson)) return undefined;
  if (isLegacyPreset(presetJson as object))
    return presetFromLegacy(presetJson as Record<string, Record<string, unknown>>, { onUnknown: "skip" });
  // a preset file saved before v1.154.0 is store-shaped but in an older layout; normalize a copy, the
  // default preset is the shared record
  return Styles.parse(normalizeStyles(structuredClone(presetJson)));
}

/** Put a preset record into the store and onto the map. Used by load and by every UI path */
function applyPreset(presetJson: unknown): void {
  const parsed = parsePreset(presetJson);
  if (!parsed) {
    tip("The file is not a style preset - the current style is kept", false, "error", 5000);
    return;
  }

  Styles.set(parsed);
  ensureGroupStyles();

  Styles.writeAll();
  // the defs resources are renderer-owned; their appliers shape them from the store
  applyVignetteOptions();

  for (const { options } of [styles.heightmap.groups.landHeights, styles.heightmap.groups.oceanHeights]) {
    HeightmapColorSchemes.ensure(options.scheme);
  }
}

// a group the preset doesn't cover takes the style of the default group of its type. It's left without a
// style if there is none: getGroupStyle falls back to the built-in style, an empty one would win over it
function fillMissingLabelGroups(): void {
  for (const group of options.map.labels.groups) {
    if (styles.labels.groups[group.name]) continue;
    const defaultGroupStyle = styles.labels.groups[Labels.getFallbackGroup(group.type).name];
    if (defaultGroupStyle) styles.labels.groups[group.name] = structuredClone(defaultGroupStyle);
  }
}

/** Give every group the map knows a store entry: a preset and an opened map both go through here */
export function ensureGroupStyles(): void {
  fillMissingLabelGroups();
  Burgs.ensureBurgGroupStyles();
  Routes.ensureRouteGroupStyles();
  Lakes.ensureLakeGroupStyles();
}

// the preset by name; when it is gone or broken, the default with a tip saying so
async function loadPreset(name: string): Promise<{ name: string; styles: unknown }> {
  const loaded = await StylePresetsService.load(name);
  if (loaded.error) tip(`${loaded.error}. Applying default style`, false, "error", 8000);
  return loaded;
}

/** The start-up path: the previously selected default or custom style */
async function applyOnLoad(): Promise<void> {
  const desired = options.map.style.preset || "default";
  const { name, styles: preset } = await loadPreset(desired);
  applyPreset(preset);
  if (name !== desired) {
    options.map.style.preset = name; // the fallback preset, if the stored one is gone
    Options.save();
  }
  init();
}

const CONFIRMED_KEY = "fmg-style-change-confirmed"; // session-scoped: ask once per session

/** Apply a preset the way the select does: once per session the user confirms losing unsaved changes */
function requestChange(name: string): void {
  if (sessionStorage.getItem(CONFIRMED_KEY)) return void change(name);

  confirmationDialog({
    title: "Change style preset",
    message: "Are you sure you want to change the style preset? All unsaved style changes will be lost",
    confirm: "Change",
    onConfirm: () => {
      sessionStorage.setItem(CONFIRMED_KEY, "true");
      void change(name);
    },
    onCancel: () => {
      ensureEl<HTMLSelectElement>(id).value = ensureEl<HTMLSelectElement>(id).dataset.old ?? "default";
    }
  });
}

async function change(desired: string): Promise<void> {
  const { name, styles: preset } = await loadPreset(desired);
  options.map.style.preset = name;
  Options.save();
  applyWithUiRefresh(preset);
}

function applyWithUiRefresh(preset: unknown): void {
  applyPreset(preset);
  syncSelect();
  Layers.drawAll(); // a style change can affect any layer, so redraw the active ones
  invokeActiveZooming();
  void Controllers.StyleEditor.refresh(true);
}

function openSaver(): void {
  destroyDialog("styleSaver");
  const dialog = document.createElement("div");
  dialog.id = "styleSaver";
  dialog.className = "dialog stable textual";
  dialog.style.display = "none";
  dialog.innerHTML = /* html */ `
    <div style="padding: 2px 0">
      <span>Preset name:</span>
      <input id="styleSaverName" data-tip="Enter style preset name" placeholder="Preset name" style="width: 12em" required />
      <span id="styleSaverTip" data-tip="Shows whether there is already a preset with this name" class="italic"></span>
    </div>
    <div style="padding: 2px 0; width: 100%">
      <span>Style JSON:</span>
      <textarea id="styleSaverJSON" rows="18" data-tip="Style JSON is getting formed based the current settings, but can be entered manually" placeholder="Paste any valid style data in JSON format" autocorrect="off" spellcheck="false"></textarea>
    </div>
    <div>
      <button id="styleSaverSave" data-tip="Save current JSON as a new style preset" class="icon-check"></button>
      <button id="styleSaverDownload" data-tip="Download the style as a .json file (can be opened in any text editor)" class="icon-download"></button>
      <button id="styleSaverLoad" data-tip="Open previously downloaded style file" class="icon-upload"></button>
      <button id="styleSaverCA" data-tip="Find or share custom style preset on Cartography Assets portal" class="icon-drafting-compass"></button>
    </div>`;
  ensureEl("dialogs").append(dialog);

  const nameInput = ensureEl<HTMLInputElement>("styleSaverName");
  const jsonInput = ensureEl<HTMLTextAreaElement>("styleSaverJSON");
  const nameTip = ensureEl("styleSaverTip");
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json";
  fileInput.style.display = "none";
  dialog.append(fileInput);

  nameInput.value = ensureEl<HTMLSelectElement>(id).value.replace(CUSTOM_PREFIX, "");
  jsonInput.value = JSON.stringify(styles, null, 2);

  const checkName = () => {
    const name = CUSTOM_PREFIX + nameInput.value;
    if (StylePresetsService.isSystem(name) || StylePresetsService.isSystem(nameInput.value))
      nameTip.textContent = "default";
    else if (Array.from(ensureEl<HTMLSelectElement>(id).options).some(option => option.value === name))
      nameTip.textContent = "existing";
    else nameTip.textContent = "new";
  };
  checkName();

  const save = () => {
    const json = jsonInput.value;
    const desiredName = nameInput.value;
    if (!json) return tip("Please provide a style JSON", false, "error");
    if (!isValidJSON(json)) return tip("JSON string is not valid, please check the format", false, "error");
    if (!isKnownStyleFormat(JSON.parse(json)))
      return tip("The JSON is not a style preset - nothing was saved", false, "error", 5000);
    if (!desiredName) return tip("Please provide a preset name", false, "error");
    if (nameTip.textContent === "default")
      return tip("You cannot overwrite default preset, please change the name", false, "error");

    const name = CUSTOM_PREFIX + desiredName;
    applyOption(ensureEl<HTMLSelectElement>(id), name, `${desiredName} [custom]`);
    options.map.style.preset = name;
    Options.save();
    StylePresetsService.saveCustom(name, json);
    applyWithUiRefresh(JSON.parse(json));
    tip("Style preset is saved and applied", false, "success", 4000);
    $(dialog).dialog("close");
  };

  const download = () => {
    const json = jsonInput.value;
    const name = nameInput.value;
    if (!json) return tip("Please provide a style JSON", false, "error");
    if (!isValidJSON(json)) return tip("JSON string is not valid, please check the format", false, "error");
    if (!name) return tip("Please provide a preset name", false, "error");
    downloadFile(json, `${name}.json`, "application/json");
  };

  const upload = () => {
    const fileName = fileInput.files?.[0]?.name.replace(/\.[^.]*$/, "") ?? "";
    uploadFile(fileInput, data => {
      if (!data) return tip("Cannot load the file. Please check the data format", false, "error");
      if (!isValidJSON(data)) return tip("Loaded data is not a valid JSON, please check the format", false, "error");
      jsonInput.value = JSON.stringify(JSON.parse(data), null, 2);
      nameInput.value = fileName;
      checkName();
      tip("Style preset is uploaded", false, "success", 4000);
    });
  };

  nameInput.addEventListener("input", checkName);
  ensureEl("styleSaverSave").addEventListener("click", save);
  ensureEl("styleSaverDownload").addEventListener("click", download);
  ensureEl("styleSaverLoad").addEventListener("click", () => fileInput.click());
  ensureEl("styleSaverCA").addEventListener("click", () =>
    openURL("https://cartographyassets.com/asset-category/specific-assets/azgaars-generator/styles/")
  );
  fileInput.addEventListener("change", upload);

  $(dialog).dialog({
    title: "Style Saver",
    width: "26em",
    position: { my: "center", at: "center", of: "svg" },
    close: () => destroyDialog("styleSaver")
  });
}

function remove(): void {
  const name = ensureEl<HTMLSelectElement>(id).value;
  if (StylePresetsService.isSystem(name)) return void tip("Cannot remove system preset", false, "error");

  confirmationDialog({
    title: "Remove style preset",
    message: "Are you sure you want to remove the style preset? This action cannot be undone.",
    confirm: "Remove",
    onConfirm: () => {
      StylePresetsService.removeCustom(name);
      ensureEl<HTMLSelectElement>(id).selectedOptions[0]?.remove();
      void change("default");
    }
  });
}

export const StylePreset = {
  init,
  applyOnLoad,
  applyPreset,
  ensureGroupStyles,
  requestChange,
  change,
  openSaver,
  remove
};
