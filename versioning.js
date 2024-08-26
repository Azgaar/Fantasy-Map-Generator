"use strict";
/**
 * Version Control Guidelines
 * --------------------------
 * We use Semantic Versioning: major.minor.patch. Refer to https://semver.org
 * Our .map file format is considered the public API.
 *
 * Update the version MANUALLY on each merge to main:
 * 1. MAJOR version: Incompatible changes that break existing maps
 * 2. MINOR version: Backwards-compatible changes requiring old .map files to be updated
 * 3. PATCH version: Backwards-compatible bug fixes not affecting .map file format
 *
 * Example: 1.102.0 -> Major version 1, Minor version 102, Patch version 0
 */
const VERSION = "1.100.00";

{
  document.title += " v" + VERSION;
  const loadingScreenVersion = document.getElementById("versionText");
  if (loadingScreenVersion) loadingScreenVersion.innerText = `v${VERSION}`;

  const storedVersion = localStorage.getItem("version");
  if (compareVersions(storedVersion, VERSION).isOlder) setTimeout(showUpdateWindow, 6000);

  function showUpdateWindow() {
    const changelog = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog";
    const reddit = "https://www.reddit.com/r/FantasyMapGenerator";
    const discord = "https://discordapp.com/invite/X7E84HU";
    const patreon = "https://www.patreon.com/azgaar";

    alertMessage.innerHTML = /* html */ `The Fantasy Map Generator is updated up to version <strong>${VERSION}</strong>. This version is compatible with <a href="${changelog}" target="_blank">previous versions</a>, loaded save files will be auto-updated.
      ${storedVersion ? "<span>Click on OK and then reload the page to fetch fresh code.</span>" : ""}

      <ul>
        <strong>Latest changes:</strong>
        <li>Notes Editor: on-demand AI text generation</li>
        <li>New style preset: Dark Seas</li>
        <li>New routes generation algorithm</li>
        <li>Routes overview tool</li>
        <li>Configurable longitude</li>
        <li>Preview villages map</li>
        <li>Ability to render ocean heightmap</li>
        <li>Scale bar styling features</li>
        <li>Vignette visual layer and vignette styling options</li>
        <li>Ability to define custom heightmap color scheme</li>
        <li>New style preset Night and new heightmap color schemes</li>
        <li>Random encounter markers (integration with <a href="https://deorum.vercel.app/" target="_blank">Deorum</a>)</li>
        <li>Auto-load of the last saved map is now optional (see <i>Onload behavior</i> in Options)</li>
        <li>New label placement algorithm for states</li>
        <li>North and South Poles temperature can be set independently</li>
      </ul>

      <p>Join our <a href="${discord}" target="_blank">Discord server</a> and <a href="${reddit}" target="_blank">Reddit community</a> to ask questions, share maps, discuss the Generator and Worlbuilding, report bugs and propose new features.</p>
      <span><i>Thanks for all supporters on <a href="${patreon}" target="_blank">Patreon</a>!</i></span>`;

    const buttons = {
      Ok: function () {
        $(this).dialog("close");
        if (storedVersion) {
          clearCache();
          localStorage.clear();
        }
        localStorage.setItem("version", VERSION);
      }
    };

    if (storedVersion) {
      buttons.Reload = () => {
        clearCache();
        localStorage.clear();
        localStorage.setItem("version", VERSION);
        location.reload();
      };
    }

    $("#alert").dialog({
      resizable: false,
      title: "Fantasy Map Generator update",
      width: "28em",
      position: {my: "center center-4em", at: "center", of: "svg"},
      buttons
    });
  }

  async function clearCache() {
    const cacheNames = await caches.keys();
    return Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
  }
}

function isValidVersion(versionString) {
  if (!versionString) return false;
  const [major, minor, patch] = versionString.split(".");
  return !isNaN(major) && !isNaN(minor) && !isNaN(patch);
}

function compareVersions(version1, version2) {
  if (!isValidVersion(version1) || !isValidVersion(version2)) return {isEqual: false, isNewer: false, isOlder: false};

  const [major1, minor1, patch1] = version1.split(".").map(Number);
  const [major2, minor2, patch2] = version2.split(".").map(Number);

  const isEqual = major1 === major2 && minor1 === minor2 && patch1 === patch2;
  const isNewer = major1 > major2 || (major1 === major2 && (minor1 > minor2 || (minor1 === minor2 && patch1 > patch2)));
  const isOlder = major1 < major2 || (major1 === major2 && (minor1 < minor2 || (minor1 === minor2 && patch1 < patch2)));

  return {isEqual, isNewer, isOlder};
}
