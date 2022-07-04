import {byId} from "utils/shorthands";

console.info("Azgaar's Fantasy Map Generator", `v${APP_VERSION}`);

export function checkForUpdates() {
  const versionNumber = parseFloat(APP_VERSION);
  const storedVersion = parseFloat(localStorage.getItem("version") || "0");

  const isOutdated = storedVersion !== versionNumber;
  if (isOutdated) clearCache();

  const showUpdate = storedVersion < versionNumber;
  if (showUpdate) setTimeout(() => showUpdateWindow(storedVersion), 6000);
}

const LATEST_CHANGES = [
  "Data Charts screen",
  "Сultures and religions can have multiple parents in hierarchy tree",
  "Heightmap selection screen",
  "Dialogs optimization for mobile",
  "New heightmap template: Fractious",
  "Template Editor: mask and invert tools",
  "Ability to install the App",
  "14 new default fonts",
  "Caching for faster startup"
];

function showUpdateWindow(storedVersion: number) {
  const changelog = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog";
  const reddit = "https://www.reddit.com/r/FantasyMapGenerator";
  const discord = "https://discordapp.com/invite/X7E84HU";
  const patreon = "https://www.patreon.com/azgaar";

  byId("alertMessage")!.innerHTML = /* html */ `
    The Fantasy Map Generator is updated up to version <strong>${APP_VERSION}</strong>. This version is compatible with <a href="${changelog}" target="_blank">previous versions</a>, loaded <i>.map</i> files will be auto-updated.
    ${storedVersion ? "<span>Reload the page to fetch fresh code.</span>" : ""}

    <ul>
      <strong>Latest changes:</strong>
      ${LATEST_CHANGES.map(change => `<li>${change}</li>`).join("")}
    </ul>

    <p>Join our <a href="${discord}" target="_blank">Discord server</a> and <a href="${reddit}" target="_blank">Reddit community</a> to ask questions, share maps, discuss the Generator and Worlbuilding, report bugs and propose new features.</p>
    <span><i>Thanks for all supporters on <a href="${patreon}" target="_blank">Patreon</a>!</i></span>
  `;

  const buttons: {Ok: noop; Reload?: noop} = {
    Ok: function () {
      $(this).dialog("close");
      if (storedVersion) localStorage.clear();
      localStorage.setItem("version", APP_VERSION);
    }
  };

  if (storedVersion) {
    buttons.Reload = () => {
      localStorage.clear();
      localStorage.setItem("version", APP_VERSION);
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
  Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
}
