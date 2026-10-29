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
 * Changes that may be interesting for end users go to docs/wiki/Changelog.md: the update window lists them from there.
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

function announceVersion(): void {
  if (parseMapVersion(VERSION) !== VERSION) log.error("versioning: Invalid format or parsing function");

  document.title += ` v${VERSION}`;
  const loadingScreenVersion = findEl("versionText");
  if (loadingScreenVersion) loadingScreenVersion.textContent = `v${VERSION}`;

  const storedVersion = localStorage.getItem("version");
  if (!storedVersion || compareVersions(storedVersion, VERSION, { major: true, minor: true, patch: false }).isOlder) {
    setTimeout(() => {
      localStorage.setItem("version", VERSION); // stored once shown, so the window opens once
      Services.ReleaseNotes.open({ afterUpdate: true });
    }, 6000);
  } else if (compareVersions(storedVersion, VERSION).isOlder) {
    localStorage.setItem("version", VERSION);
    tip(t("Updated to v{{version}}. Reload the page if you get errors", { version: VERSION }), true, "success", 6000);
  }
}

announceVersion();
