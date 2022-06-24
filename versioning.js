"use strict";

// version and caching control
const version = "1.87.04"; // generator version, update each time

{
  document.title += " v" + version;
  const loadingScreenVersion = document.getElementById("version");
  if (loadingScreenVersion) loadingScreenVersion.innerHTML = version;

  const versionNumber = parseFloat(version);
  const storedVersion = localStorage.getItem("version") ? parseFloat(localStorage.getItem("version")) : 0;

  const isOutdated = storedVersion !== versionNumber;
  if (isOutdated) clearCache();

  const showUpdate = storedVersion < versionNumber;
  if (showUpdate) setTimeout(showUpdateWindow, 6000);

  function showUpdateWindow() {
    const changelog = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog";
    const reddit = "https://www.reddit.com/r/FantasyMapGenerator";
    const discord = "https://discordapp.com/invite/X7E84HU";
    const patreon = "https://www.patreon.com/azgaar";

    alertMessage.innerHTML = /* html */ `The Fantasy Map Generator is updated up to version <strong>${version}</strong>. This version is compatible with <a href="${changelog}" target="_blank">previous versions</a>, loaded <i>.map</i> files will be auto-updated.
      ${storedVersion ? "<span>Reload the page to fetch fresh code.</span>" : ""}

      <ul>
        <strong>Latest changes:</strong>
        <li>Data Charts screen</li>
        <li>Сultures and religions can have multiple parents in hierarchy tree</li>
        <li>Heightmap selection screen</li>
        <li>Dialogs optimization for mobile</li>
        <li>New heightmap template: Fractious</li>
        <li>Template Editor: mask and invert tools</li>
        <li>Ability to install the App</li>
        <li>14 new default fonts</li>
        <li>Caching for faster startup</li>
      </ul>

      <p>Join our <a href="${discord}" target="_blank">Discord server</a> and <a href="${reddit}" target="_blank">Reddit community</a> to ask questions, share maps, discuss the Generator and Worlbuilding, report bugs and propose new features.</p>
      <span><i>Thanks for all supporters on <a href="${patreon}" target="_blank">Patreon</a>!</i></span>`;

    const buttons = {
      Ok: function () {
        $(this).dialog("close");
        if (storedVersion) localStorage.clear();
        localStorage.setItem("version", version);
      }
    };

    if (storedVersion) {
      buttons.Reload = () => {
        localStorage.clear();
        localStorage.setItem("version", version);
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
}
