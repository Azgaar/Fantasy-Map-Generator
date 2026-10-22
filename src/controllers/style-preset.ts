// Style presets: the preset row on the Style tab, applying a preset to the map, the Style Saver dialog
import { alertDialog, confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { CustomIcons } from "@/components/icons";
import { tip } from "@/components/tooltips";
import { invokeActiveZooming } from "@/components/zoom";
import { Controllers } from "@/controllers";
import { Styles } from "@/generators/styles";
import { applyVignetteOptions } from "@/renderers/draw-vignette";
import { HeightmapColorSchemes } from "@/renderers/heightmap-color-schemes";
import { IconsArchive } from "@/services/io/icons-archive";
import { CUSTOM_PREFIX, LEGACY_PREFIX, StylePresetsService } from "@/services/style-presets";
import { downloadFile, ensureEl, escapeHtml, isValidJSON, openURL, uploadFile } from "@/utils";
import { sentences, t } from "@/utils/i18n";

let wired = false;

/** Make the preset row follow the map's preset */
function init(): void {
  if (!wired) {
    wired = true;
    ensureEl("addStyleButton").addEventListener("click", openSaver);
  }
  syncLabel();
}

function syncLabel(): void {
  const label = document.createElement("span");
  label.textContent = StylePresetsService.displayName(StylePresetsService.current());
  ensureEl("stylePreset").replaceChildren(label);
}

/** Put a preset record into the store and onto the map. Used by load and by every UI path */
function applyPreset(presetJson: unknown): void {
  const parsed = StylePresetsService.parse(presetJson);
  if (!parsed) {
    tip(t("The file is not a style preset - the current style is kept"), false, "error", 5000);
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
  if (loaded.error) tip(sentences(escapeHtml(loaded.error), t("Applying default style")), false, "error", 8000);
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

/** Apply a preset from the UI: once per session the user confirms losing unsaved changes */
function requestChange(name: string): void {
  if (sessionStorage.getItem(CONFIRMED_KEY)) return void change(name);

  confirmationDialog({
    title: t("Change style preset"),
    message: t("Are you sure you want to change the style preset? All unsaved style changes will be lost"),
    confirm: t("Change"),
    onConfirm: () => {
      sessionStorage.setItem(CONFIRMED_KEY, "true");
      void change(name);
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
  syncLabel();
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
      <span>${t("Preset name")}:</span>
      <input id="styleSaverName" data-tip="${t("Preset name")}" placeholder="${t("Preset name")}" style="width: 12em" required />
      <span id="styleSaverTip" data-tip="${t("Shows whether there is already a preset with this name")}" class="italic"></span>
    </div>
    <div style="padding: 2px 0; width: 100%">
      <span>${t("Style JSON")}:</span>
      <textarea id="styleSaverJSON" rows="18" data-tip="${t("Style JSON is getting formed based the current settings, but can be entered manually")}" placeholder="${t("Paste any valid style data in JSON format")}" autocorrect="off" spellcheck="false"></textarea>
    </div>
    <div>
      <button id="styleSaverSave" data-tip="${t("Save current JSON as a new style preset")}" class="icon-check"></button>
      <button id="styleSaverDownload" data-tip="${t("Download the style as a .json file (can be opened in any text editor)")}" class="icon-download"></button>
      <button id="styleSaverLoad" data-tip="${t("Open previously downloaded style file")}" class="icon-upload"></button>
      <button id="styleSaverCA" data-tip="${t("Find or share custom style preset on Cartography Assets portal")}" class="icon-drafting-compass"></button>
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

  nameInput.value = StylePresetsService.current().replace(CUSTOM_PREFIX, "").replace(LEGACY_PREFIX, "");
  jsonInput.value = JSON.stringify(styles, null, 2);

  // whether the name would save over a system preset, an existing custom one, or a new one
  const nameStatus = (): "default" | "existing" | "new" => {
    const name = CUSTOM_PREFIX + nameInput.value;
    if (StylePresetsService.isSystem(name) || StylePresetsService.isSystem(nameInput.value)) return "default";
    const custom = StylePresetsService.listCustom();
    return custom.includes(name) || custom.includes(LEGACY_PREFIX + nameInput.value) ? "existing" : "new";
  };
  const checkName = () => {
    nameTip.textContent = nameStatus();
  };
  checkName();

  const save = () => {
    const json = jsonInput.value;
    const desiredName = nameInput.value;
    if (!json) return tip(t("Please provide a style JSON"), false, "error");
    if (!isValidJSON(json)) return tip(t("JSON string is not valid, please check the format"), false, "error");
    if (!StylePresetsService.isPreset(JSON.parse(json)))
      return tip(t("The JSON is not a style preset - nothing was saved"), false, "error", 5000);
    if (!desiredName) return tip(t("Please provide a preset name"), false, "error");
    if (nameStatus() === "default")
      return tip(t("You cannot overwrite default preset, please change the name"), false, "error");

    const name = CUSTOM_PREFIX + desiredName;
    options.map.style.preset = name;
    Options.save();
    StylePresetsService.saveCustom(name, json);
    StylePresetsService.removeCustom(LEGACY_PREFIX + desiredName); // the saved preset replaces a legacy one
    applyWithUiRefresh(JSON.parse(json));
    tip(t("Style preset is saved and applied"), false, "success", 4000);
    $(dialog).dialog("close");
  };

  const download = () => {
    const json = jsonInput.value;
    const name = nameInput.value;
    if (!json) return tip(t("Please provide a style JSON"), false, "error");
    if (!isValidJSON(json)) return tip(t("JSON string is not valid, please check the format"), false, "error");
    if (!name) return tip(t("Please provide a preset name"), false, "error");
    downloadFile(json, `${name}.json`, "application/json");
    offerCustomIcons(json, name);
  };

  const upload = () => {
    const fileName = fileInput.files?.[0]?.name.replace(/\.[^.]*$/, "") ?? "";
    uploadFile(fileInput, data => {
      if (!data) return tip(sentences(t("Cannot load the file"), t("Please check the data format")), false, "error");
      if (!isValidJSON(data)) return tip(t("Loaded data is not a valid JSON, please check the format"), false, "error");
      jsonInput.value = JSON.stringify(JSON.parse(data), null, 2);
      nameInput.value = fileName;
      checkName();
      tip(t("Style preset is uploaded"), false, "success", 4000);
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
    title: t("Style Saver"),
    width: "26em",
    position: { my: "center", at: "center", of: "svg" },
    close: () => destroyDialog("styleSaver")
  });
}

// a preset keeps only the ids of custom icons; their pictures are the map's, so they travel as a separate zip
function offerCustomIcons(json: string, name: string): void {
  const ids = new Set(Array.from(json.matchAll(/"(custom-[\w-]+)"/g), match => match[1]));
  if (!ids.size) return;
  const icons = CustomIcons.all.filter(icon => ids.has(icon.id));

  const missing = ids.size - icons.length;
  const absent = missing ? `. ${t("Not on this map: {{missing}}", { missing })}` : "";
  const message =
    sentences(
      t("Custom icons used by the style: {{icons}}", { icons: ids.size }),
      t("Custom icons are stored in the map, not in the style, so they must be re-uploaded on the target map")
    ) + absent;
  if (!icons.length) return void alertDialog({ title: t("Custom icons"), message });

  confirmationDialog({
    title: t("Custom icons"),
    message: `${message}<br><br>${t("Download the icons as a zip? Import it on the target map via the icon picker: Custom → Import zip")}`,
    confirm: t("Download icons"),
    cancel: t("Skip"),
    onConfirm: async () => {
      try {
        downloadFile(await IconsArchive.pack(icons), `${name} icons.zip`, "application/zip");
      } catch (error) {
        tip((error as Error).message, false, "error", 6000);
      }
    }
  });
}

/** Remove a custom preset; when it is the current one, the map falls back to default */
function remove(name: string): void {
  if (StylePresetsService.isSystem(name)) return void tip(t("Cannot remove system preset"), false, "error");

  confirmationDialog({
    title: t("Remove"),
    message: t("Are you sure you want to remove the “{{preset}}” preset? This action cannot be undone.", {
      preset: StylePresetsService.displayName(name)
    }),
    confirm: t("Remove"),
    onConfirm: () => {
      StylePresetsService.removeCustom(name);
      if (name === options.map.style.preset) void change("default");
      else void Controllers.StyleEditor.refresh();
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
