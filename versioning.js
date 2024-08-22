"use strict";

// version and caching control
const version = "1.99.05"; // generator version, update each time

{
  document.title += " v" + version;
  const loadingScreenVersion = document.getElementById("versionText");
  if (loadingScreenVersion) loadingScreenVersion.innerText = `v${version}`;

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

    alertMessage.innerHTML = /* html */ `The Fantasy Map Generator is updated up to version <strong>${version}</strong>. This version is compatible with <a href="${changelog}" target="_blank">previous versions</a>, loaded save files will be auto-updated.
      ${storedVersion ? "<span>Reload the page to fetch fresh code.</span>" : ""}

      <ul>
        <strong>Latest changes:</strong>
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
        <li>More than 70 new heraldic charges</li>
        <li>Multi-color heraldic charges support</li>
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
