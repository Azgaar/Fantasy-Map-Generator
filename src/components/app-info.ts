// The "About" dialog: what the generator is, where to get help and how to support it.
// A component, not a controller — it is opened over the map but knows nothing about it

import { ensureEl, link } from "@/utils";
import { t } from "@/utils/i18n";

const COMMUNITY = {
  discord: link("https://discordapp.com/invite/X7E84HU", "Discord"),
  reddit: link("https://www.reddit.com/r/FantasyMapGenerator", "Reddit"),
  patreon: link("https://www.patreon.com/azgaar", "Patreon")
};

const PROJECTS = {
  armoria: link("https://azgaar.github.io/Armoria", "Armoria"),
  deorum: link("https://deorum.vercel.app", "Deorum")
};

const WIKI = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki";
const GUIDES = {
  quickStart: link(`${WIKI}/Quick-Start-Tutorial`, t("Quick start tutorial")),
  qaa: link(`${WIKI}/Q&A`, t("Q&A page")),
  video: link("https://youtube.com/playlist?list=PLtgiuDC8iVR2gIG8zMTRn7T_L0arl9h1C", t("Video tutorial"))
};

const LINKS = [
  link("https://github.com/Azgaar/Fantasy-Map-Generator", "GitHub repository"),
  link("https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/LICENSE", "License"),
  link(`${WIKI}/Changelog`, "Changelog"),
  link(`${WIKI}/Hotkeys`, "Hotkeys"),
  link("https://trello.com/b/7x832DG4/fantasy-map-generator", "Devboard"),
  `<a href="mailto:azgaar.fmg@yandex.by" target="_blank">${t("Contact Azgaar")}</a>`
];

function render(): string {
  return /* html */ `${t("<b>Fantasy Map Generator</b> (FMG) is a free open-source application. It means that you own all created maps and can use them as you wish.")}

    <p>
      ${t("The development is community-backed, you can donate on {{- patreon}}. You can also help creating overviews, tutorials and spreding the word about the Generator.", { patreon: COMMUNITY.patreon })}
    </p>

    <p>
      ${t("The best way to get help is to contact the community on {{- discord}} and {{- reddit}}. Before asking questions, please check out the {{- quickStart}}, the {{- qaa}}, and {{- video}}.", { ...COMMUNITY, ...GUIDES })}
    </p>

    <ul style="columns:2">${LINKS.map(item => `<li>${item}</li>`).join("")}</ul>

    <p>${t("Check out our other projects")}:
      <ul>
        <li>${t("{{- armoria}}: a tool for creating heraldic coats of arms", { armoria: PROJECTS.armoria })}</li>
        <li>${t("{{- deorum}}: a vast gallery of customizable fantasy characters", { deorum: PROJECTS.deorum })}</li>
      </ul>
    </p>

    <p>${t("Chinese localization")}: <a href="https://www.8desk.top" target="_blank">8desk.top</a></p>`;
}

/** Show info about the generator in a popup */
export function showInfo(): void {
  ensureEl("alertMessage").innerHTML = render();

  $("#alert").dialog({
    resizable: false,
    title: document.title,
    width: "28em",
    buttons: {
      [t("OK")]: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    },
    position: { my: "center", at: "center", of: "svg" }
  });
}

export const AppInfo = { open: showInfo };
