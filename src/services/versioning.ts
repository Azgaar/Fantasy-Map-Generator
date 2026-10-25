import { log } from "@/utils/logger";
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

import { Options } from "@/model/options/options-model";
import { Pins } from "@/model/options/pins";
import { Services } from "@/services";
import { Dialog } from "@/ui/dialog/dialog";
import { dialogState } from "@/ui/dialog/state";
import { tip } from "@/ui/tooltips";
import { isElectron } from "@/utils/environment";
import { sentences, t } from "@/utils/i18n";
import { findEl } from "@/utils/node-utils";

export const VERSION = "1.157.0";

// new changes on top, never translated
const latestPublicChanges = (): string[] => [
  "Heightmap contours: elevation labels",
  "Interface translated into 29 languages",
  "Map context menu",
  "Advanced Options: configurable map lattice",
  "Trade tariffs and embargoes",
  "View-only mode for saved maps",
  "Free-text tags for states and other entities (hidden by default)",
  "CSV upload for most entities",
  "Color picker rework",
  "Regenerate provinces for selected states",
  "Heightmap Risk mode: map restoration algorithm rework",
  "Submap and Transform fixes",
  "Rivers: lock a river to keep it through regeneration",
  "Paint editor: lock elements from being painted over",
  "Military forces: hide/show individual regiments",
  "Shift + Click to bypass confirmation",
  "Population layer: colored cells style",
  "Altitude legend: heightmap colors"
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

/** cleanupData once the user agrees: it wipes every option and reloads the page */
export function confirmCleanupData(): void {
  Dialog.confirm({
    title: t("Reset Options"),
    message: sentences(
      t("All options return to their defaults and the page reloads"),
      t("If you have unsaved changes, save the map first")
    ),
    confirm: t("Reset"),
    onConfirm: () => cleanupData()
  });
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

  Dialog.message({
    message: /* html */ `${t(
      "The Fantasy Map Generator is updated up to version {{version}}. This version is compatible with {{- previous}}, loaded save files will be auto-updated.",
      {
        version: VERSION,
        previous: `<a href="${changelog}" target="_blank" style="white-space: nowrap">${t("previous versions")}</a>`
      }
    )}
    ${storedVersion ? `<span>${t("In case of errors reload the page to update the code.")}</span>` : ""}

    <ul>
      <strong>${t("Latest changes")}:</strong>
      ${latestPublicChanges()
        .map(change => `<li>${change}</li>`)
        .join("")}
    </ul>

    ${isElectron() ? "" : `<p>${t("The Generator is also available as a {{- app}} that works offline.", { app: `<a id="updateAppOffer" href="#">${t("desktop app")}</a>` })}</p>`}

    <p>${t(
      "Join our {{- discord}} and {{- reddit}} to ask questions, share maps, discuss the Generator and Worldbuilding, report bugs and propose new features.",
      {
        discord: `<a href="${discord}" target="_blank">${t("Discord server")}</a>`,
        reddit: `<a href="${reddit}" target="_blank">${t("Reddit community")}</a>`
      }
    )}</p>
    <span><i>${t("Thanks for all supporters on {{- patreon}}!", { patreon: `<a href="${patreon}" target="_blank">Patreon</a>` })}</i></span>`,
    title: t("Fantasy Map Generator update"),
    width: "28em",
    position: { my: "center center-4em", at: "center", of: "svg" },
    buttons: [
      {
        label: t("Clear cache"),
        onClick: () => {
          clearCache();
          return false;
        }
      },
      { label: t("Don't show again") }
    ]
  });
  findEl("updateAppOffer")?.addEventListener("click", event => {
    event.preventDefault();
    Services.AppOffer.open();
  });
}

function announceVersion(): void {
  if (parseMapVersion(VERSION) !== VERSION) log.error("versioning: Invalid format or parsing function");

  document.title += ` v${VERSION}`;
  const loadingScreenVersion = findEl("versionText");
  if (loadingScreenVersion) loadingScreenVersion.textContent = `v${VERSION}`;

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

// temp legacy compatibility
