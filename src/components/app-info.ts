// The "About" dialog: what the generator is, where to get help and how to support it.
// A component, not a controller — it is opened over the map but knows nothing about it

import { link } from "@/utils";

const PROJECT_URL = "https://github.com/patkepa/fantasia";
const UPSTREAM_URL = "https://github.com/Azgaar/Fantasy-Map-Generator";
const WIKI = `${UPSTREAM_URL}/wiki`;
const GUIDES = {
  quickStart: link(`${WIKI}/Quick-Start-Tutorial`, "Quick start tutorial"),
  qaa: link(`${WIKI}/Q&A`, "Q&A page"),
  video: link("https://youtube.com/playlist?list=PLtgiuDC8iVR2gIG8zMTRn7T_L0arl9h1C", "Video tutorial")
};

const LINKS = [
  link(PROJECT_URL, "Fantasia repository"),
  link(`${PROJECT_URL}/blob/main/LICENSE`, "License"),
  link(`${PROJECT_URL}/issues`, "Report an issue"),
  link(UPSTREAM_URL, "Upstream FMG repository")
];

function render(): string {
  return /* html */ `<b>Fantasia</b> is a free, open-source application for creating fantasy maps. You own the maps you create and may use them as you wish.

    <p>
      Fantasia is a fork of <a href="${UPSTREAM_URL}" target="_blank">Azgaar's Fantasy Map Generator (FMG)</a>. Its upstream project remains credited for the original work.
    </p>

    <p>
      Before asking questions, consult the upstream ${GUIDES.quickStart}, ${GUIDES.qaa}, and ${GUIDES.video}.
    </p>

    <ul style="columns:2">${LINKS.map(item => `<li>${item}</li>`).join("")}</ul>
`;
}

/** Show info about the generator in a popup */
export function showInfo(): void {
  void import("./ui/message-dialog").then(({ showMessageDialog }) => {
    showMessageDialog({
      id: "appInfoDialog",
      messageHtml: render(),
      title: document.title,
      width: "28em"
    });
  });
}

window.showInfo = showInfo;
