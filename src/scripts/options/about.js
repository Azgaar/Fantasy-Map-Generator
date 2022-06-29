// show info about the generator in a popup
export function showAboutDialog() {
  const Discord = link("https://discordapp.com/invite/X7E84HU", "Discord");
  const Reddit = link("https://www.reddit.com/r/FantasyMapGenerator", "Reddit");
  const Patreon = link("https://www.patreon.com/azgaar", "Patreon");
  const Armoria = link("https://azgaar.github.io/Armoria", "Armoria");
  const QuickStart = link(
    "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Quick-Start-Tutorial",
    "Quick start tutorial"
  );
  const QAA = link("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Q&A", "Q&A page");
  const VideoTutorial = link("https://youtube.com/playlist?list=PLtgiuDC8iVR2gIG8zMTRn7T_L0arl9h1C", "Video tutorial");

  alertMessage.innerHTML = /* html */ `<b>Fantasy Map Generator</b> (FMG) is a free open-source application. It means that you own all created maps and can use them as
    you wish.

    <p>
      The development is community-backed, you can donate on ${Patreon}. You can also help creating overviews, tutorials and spreding the word about the
      Generator.
    </p>

    <p>
      The best way to get help is to contact the community on ${Discord} and ${Reddit}. Before asking questions, please check out the ${QuickStart}, the ${QAA},
      and ${VideoTutorial}.
    </p>

    <p>Check out our another project: ${Armoria} — heraldry generator and editor.</p>

    <ul style="columns:2">
      <li>${link("https://github.com/Azgaar/Fantasy-Map-Generator", "GitHub repository")}</li>
      <li>${link("https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/LICENSE", "License")}</li>
      <li>${link("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog", "Changelog")}</li>
      <li>${link("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Hotkeys", "Hotkeys")}</li>
      <li>${link("https://trello.com/b/7x832DG4/fantasy-map-generator", "Devboard")}</li>
      <li><a href="mailto:azgaar.fmg@yandex.by" target="_blank">Contact Azgaar</a></li>
    </ul>`;

  $("#alert").dialog({
    resizable: false,
    title: document.title,
    width: "28em",
    buttons: {
      OK: function () {
        $(this).dialog("close");
      }
    },
    position: {my: "center", at: "center", of: "svg"}
  });
}
