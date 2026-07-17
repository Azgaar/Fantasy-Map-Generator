/**
 * Version Control Guidelines
 * --------------------------
 * We use Semantic Versioning: major.minor.patch. Refer to https://semver.org
 * Our .map file format is considered the public API.
 *
 * Update the version on each merge to master:
 * 1. MAJOR version: Incompatible changes that break existing maps
 * 2. MINOR version: Additions or changes that are backward-compatible but may require old .map files to be updated
 * 3. PATCH version: Backward-compatible bug fixes and small features that don't affect the .map file format
 *
 * Example: 1.102.2 -> Major version 1, Minor version 102, Patch version 2
 * Version bumping is automated via GitHub Actions on PR merge.
 *
 * For the changes that may be interesting to end users, update the `latestPublicChanges` array below (new changes on top).
 */

export const VERSION = "1.137.6";

const latestPublicChanges = [
  "Economic simulation",
  "Trade animation",
  "Navigable rivers",
  "3D view: eroded terrain",
  "3D view: satellite texture",
  "Jagged coastlines",
  "Heightmap Editor: Fill brush",
  "Editors: undo button",
  "Minimap",
  "Search input in Overview dialogs",
  "Custom burg grouping and icon selection",
  "Ability to set custom image as Marker or Regiment icon",
  "Submap and Transform tools rework",
  "Azgaar Bot to answer questions and provide help"
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

export async function cleanupData(): Promise<void> {
  await clearCache();
  localStorage.clear();
  localStorage.setItem("version", VERSION);
  localStorage.setItem("disable_click_arrow_tooltip", "true");
  location.reload();
}

async function clearCache(): Promise<unknown> {
  const cacheNames = await caches.keys();
  return Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
}

function showUpdateWindow(storedVersion: string | null): void {
  const changelog = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog";
  const reddit = "https://www.reddit.com/r/FantasyMapGenerator";
  const discord = "https://discordapp.com/invite/X7E84HU";
  const patreon = "https://www.patreon.com/azgaar";

  alertMessage.innerHTML = /* html */ `The Fantasy Map Generator is updated up to version <strong>${VERSION}</strong>. This version is compatible with <a href="${changelog}" target="_blank">previous versions</a>, loaded save files will be auto-updated.
    ${storedVersion ? "<span>In case of errors reload the page to update the code.</span>" : ""}

    <ul>
      <strong>Latest changes:</strong>
      ${latestPublicChanges.map(change => `<li>${change}</li>`).join("")}
    </ul>

    <p>Join our <a href="${discord}" target="_blank">Discord server</a> and <a href="${reddit}" target="_blank">Reddit community</a> to ask questions, share maps, discuss the Generator and Worldbuilding, report bugs and propose new features.</p>
    <span><i>Thanks for all supporters on <a href="${patreon}" target="_blank">Patreon</a>!</i></span>`;

  $("#alert").dialog({
    resizable: false,
    title: "Fantasy Map Generator update",
    width: "28em",
    position: { my: "center center-4em", at: "center", of: "svg" },
    buttons: {
      "Clear cache": () => cleanupData(),
      "Don't show again": function (this: HTMLElement) {
        $(this).dialog("close");
        localStorage.setItem("version", VERSION);
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
  if (compareVersions(storedVersion, VERSION, { major: true, minor: true, patch: false }).isOlder) {
    setTimeout(() => showUpdateWindow(storedVersion), 6000);
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
