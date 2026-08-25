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

export const VERSION = "1.143.3";

const latestPublicChanges = [
  "Relief icons: improved performance",
  "Configurable table columns",
  "Labels: improved performance",
  "Labels Overview",
  "Route and river labels",
  "Economic simulation",
  "Trade animation",
  "Navigable rivers",
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

export { compareVersions, isValidVersion, parseMapVersion, type VersionComparison } from "./version-utils";

import { compareVersions, parseMapVersion } from "./version-utils";

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

  const messageHtml = /* html */ `The Fantasy Map Generator is updated up to version <strong>${VERSION}</strong>. This version is compatible with <a href="${changelog}" target="_blank">previous versions</a>, loaded save files will be auto-updated.
    ${storedVersion ? "<span>In case of errors reload the page to update the code.</span>" : ""}

    <ul>
      <strong>Latest changes:</strong>
      ${latestPublicChanges.map(change => `<li>${change}</li>`).join("")}
    </ul>

    <p>Join our <a href="${discord}" target="_blank">Discord server</a> and <a href="${reddit}" target="_blank">Reddit community</a> to ask questions, share maps, discuss the Generator and Worldbuilding, report bugs and propose new features.</p>
    <span><i>Thanks for all supporters on <a href="${patreon}" target="_blank">Patreon</a>!</i></span>`;

  void import("@/components/ui/message-dialog").then(({ showMessageDialog }) => {
    showMessageDialog({
      actions: [
        { close: false, label: "Clear cache", onClick: () => void cleanupData() },
        {
          intent: "primary",
          label: "Don't show again",
          onClick: () => localStorage.setItem("version", VERSION)
        }
      ],
      id: "versionDialog",
      messageHtml,
      title: "Fantasy Map Generator update",
      width: "28em"
    });
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
