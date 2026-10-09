/**
 * Version Control Guidelines
 * --------------------------
 * We use Semantic Versioning: major.minor.patch. Refer to https://semver.org
 * Our .map file format is considered the public API.
 *
 * Update the version before merging to master:
 * 1. MAJOR version: Incompatible changes that break existing maps
 * 2. MINOR version: Additions or changes that are backward-compatible but may require old .map files to be updated
 * 3. PATCH version: Backward-compatible bug fixes and small features that don't affect the .map file format
 *
 * Example: 1.102.2 -> Major version 1, Minor version 102, Patch version 2
 * VERSION below is the only source of truth. Edit it by hand: the pre-commit hook copies it where needed.
 *
 * For the changes that may be interesting for end users, update the `latestPublicChanges` below.
 */

import { dialogState } from "@/components/dialog/state";
import { Pins } from "@/components/pins";
import { tip } from "@/components/tooltips";
import { t } from "@/utils/i18n";
import { isElectron } from "./platform";

export const VERSION = "1.155.0";

// new changes on top
const latestPublicChanges = [
  "Population layer: colored cells style",
  // old ones
  "Azgaar Assistant can read map data and propose changes when your own AI key is provided",
  "Icons: unified icon picker and uploader for goods, markers, regiments, burgs and emblems",
  "Style: the Style tab is reworked",
  "Atlas preset reworked",
  "Relief: any icon can be a relief icon",
  "Relief: new relief icons pack",
  "Biome editor: editable relief icon pools",
  "Emblems: live updates on edit in Armoria",
  "Saving: choose the map file destination",
  "States Editor: keep merged states as provinces",
  "Diplomacy Overview: set relations on map click"
];

export function parseMapVersion(version: string): string {
  let [major, minor, patch] = version.split(".");

  if (patch === undefined) {
    // e.g. 1.732
    const compactVersion = minor!;
    minor = compactVersion.slice(0, 2);
    patch = compactVersion.slice(2);
  }

  // e.g. 0.7b
  const majorN = parseInt(major!, 10) || 0;
  const minorN = parseInt(minor, 10) || 0;
  const patchN = parseInt(patch, 10) || 0;

  return `${majorN}.${minorN}.${patchN}`;
}

export function isValidVersion(versionString: string | null | undefined): boolean {
  if (!versionString) return false;
  const [major, minor, patch] = versionString.split(".");
  return !Number.isNaN(Number(major)) && !Number.isNaN(Number(minor)) && !Number.isNaN(Number(patch));
}

export type VersionComparison = { isEqual: boolean; isNewer: boolean; isOlder: boolean };

export function compareVersions(
  version1: string | null | undefined,
  version2: string | null | undefined,
  options: { major?: boolean; minor?: boolean; patch?: boolean } = { major: true, minor: true, patch: true }
): VersionComparison {
  if (!isValidVersion(version1) || !isValidVersion(version2)) return { isEqual: false, isNewer: false, isOlder: false };

  let [major1, minor1, patch1] = version1!.split(".").map(Number) as [number, number, number];
  let [major2, minor2, patch2] = version2!.split(".").map(Number) as [number, number, number];

  if (!options.major) major1 = major2 = 0;
  if (!options.minor) minor1 = minor2 = 0;
  if (!options.patch) patch1 = patch2 = 0;

  const isEqual = major1 === major2 && minor1 === minor2 && patch1 === patch2;
  const isNewer = major1 > major2 || (major1 === major2 && (minor1 > minor2 || (minor1 === minor2 && patch1 > patch2)));
  const isOlder = major1 < major2 || (major1 === major2 && (minor1 < minor2 || (minor1 === minor2 && patch1 < patch2)));

  return { isEqual, isNewer, isOlder };
}

export async function clearCache(): Promise<void> {
  if (!isElectron()) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));

    const registrations = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(registrations.map(registration => registration.unregister()));
  }

  location.reload();
}

export const ARROW_TIP_KEY = "fmg-disable-click-arrow-tooltip";

export async function cleanupData(): Promise<void> {
  localStorage.clear();
  dialogState.clear();
  localStorage.setItem("version", VERSION);

  Options.reset();
  Pins.clearAll();
  localStorage.setItem(ARROW_TIP_KEY, "true");
  await clearCache();
}

function showUpdateWindow(storedVersion: string | null): void {
  localStorage.setItem("version", VERSION);

  const changelog = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog";
  const reddit = "https://www.reddit.com/r/FantasyMapGenerator";
  const discord = "https://discordapp.com/invite/X7E84HU";
  const patreon = "https://www.patreon.com/azgaar";

  alertMessage.innerHTML = /* html */ `${t(
    "The Fantasy Map Generator is updated up to version {{version}}. This version is compatible with {{- previous}}, loaded save files will be auto-updated.",
    {
      version: VERSION,
      previous: `<a href="${changelog}" target="_blank" style="white-space: nowrap">${t("previous versions")}</a>`
    }
  )}
    ${storedVersion ? `<span>${t("In case of errors reload the page to update the code.")}</span>` : ""}

    <ul>
      <strong>${t("Latest changes")}:</strong>
      ${latestPublicChanges.map(change => `<li>${change}</li>`).join("")}
    </ul>

    ${isElectron() ? "" : `<p>${t("The Generator is also available as a {{- app}} that works offline.", { app: `<a href="#" onclick="window.Services.AppOffer.open(); return false">${t("desktop app")}</a>` })}</p>`}

    <p>${t(
      "Join our {{- discord}} and {{- reddit}} to ask questions, share maps, discuss the Generator and Worldbuilding, report bugs and propose new features.",
      {
        discord: `<a href="${discord}" target="_blank">${t("Discord server")}</a>`,
        reddit: `<a href="${reddit}" target="_blank">${t("Reddit community")}</a>`
      }
    )}</p>
    <span><i>${t("Thanks for all supporters on {{- patreon}}!", { patreon: `<a href="${patreon}" target="_blank">Patreon</a>` })}</i></span>`;

  $("#alert").dialog({
    resizable: false,
    title: t("Fantasy Map Generator update"),
    width: "28em",
    position: { my: "center center-4em", at: "center", of: "svg" },
    buttons: {
      [t("Clear cache")]: () => clearCache(),
      [t("Don't show again")]: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function announceVersion(): void {
  if (parseMapVersion(VERSION) !== VERSION) alert("versioning: Invalid format or parsing function");

  document.title += ` v${VERSION}`;
  const loadingScreenVersion = document.getElementById("versionText");
  if (loadingScreenVersion) loadingScreenVersion.innerText = `v${VERSION}`;

  const storedVersion = localStorage.getItem("version");
  if (!storedVersion) {
    setTimeout(() => showUpdateWindow(null), 6000);
    return;
  }

  if (compareVersions(storedVersion, VERSION, { major: true, minor: true, patch: false }).isOlder) {
    setTimeout(() => showUpdateWindow(storedVersion), 6000);
  } else if (compareVersions(storedVersion, VERSION).isOlder) {
    localStorage.setItem("version", VERSION);
    tip(t("Updated to v{{version}}. Reload the page if you get errors", { version: VERSION }), true, "success", 6000);
  }
}

announceVersion();

declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var VERSION: string;
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var cleanupData: () => Promise<void>;
}

// temp legacy compatibility
window.VERSION = VERSION;
window.cleanupData = cleanupData;
