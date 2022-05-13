"use strict";
// version and caching control

const version = "1.811"; // generator version, update each time

{
  document.title += " v" + version;
  const loadingScreenVersion = document.getElementById("version");
  if (loadingScreenVersion) loadingScreenVersion.innerHTML = version;

  const majorVersion = Math.round(version * 10) / 10;
  const storedVersion = +localStorage.getItem("version") || 0;

  const showUpdate = storedVersion < majorVersion;
  if (showUpdate) setTimeout(showUpdateWindow, 5000);

  function showUpdateWindow() {
    const changelog = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog";
    const reddit = "https://www.reddit.com/r/FantasyMapGenerator";
    const discord = "https://discordapp.com/invite/X7E84HU";
    const patreon = "https://www.patreon.com/azgaar";

    alertMessage.innerHTML = /* html */ `The Fantasy Map Generator is updated up to version <strong>${version}</strong>. This version is compatible with <a href="${changelog}" target="_blank">previous versions</a>, loaded <i>.map</i> files will be auto-updated.
      ${storedVersion ? "<span>Reload the page to fetch fresh code.</span>" : ""}

      <ul>
        <strong>Latest changes:</strong>
        <li>Ability to install the App</li>
        <li>14 new default fonts</li>
        <li>Caching for faster startup</li>
        <li>Submap tool by Goteguru</li>
        <li>Resample tool by Goteguru</li>
        <li>Pre-defined heightmaps</li>
        <li>Advanced notes editor</li>
        <li>Zones editor: filter by type</li>
        <li>Color picker: new hatchings</li>
      </ul>

      <p>Join our <a href="${discord}" target="_blank">Discord server</a> and <a href="${reddit}" target="_blank">Reddit community</a> to ask questions, share maps, discuss the Generator and Worlbuilding, report bugs and propose new features.</p>
      <span><i>Thanks for all supporters on <a href="${patreon}" target="_blank">Patreon</a>!</i></span>`;

    const buttons = {
      Ok: function () {
        $(this).dialog("close");
        if (storedVersion) clearStoredData();
        localStorage.setItem("version", version);
      }
    };

    if (storedVersion) {
      buttons.Reload = () => {
        clearStoredData();
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

  async function clearStoredData() {
    localStorage.clear();
    const cacheNames = await caches.keys();
    Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
  }
}
