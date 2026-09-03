// About tab: credits, links and the supporters list

import { alertDialog } from "@/components/dialog/dialog-helpers";
import { ensureEl } from "@/utils/nodeUtils";

const TEMPLATE = /* html */ `
  <div class="aboutActions">
    <button
      id="startTourButton"
      onclick="window.Services.UiTour.start()"
      data-tip="Take an interactive tour of the map generator"
      style="flex: 1; border: 1px solid var(--header);"
    >
      Interactive Tour
    </button>
    <button
      id="getAppButton"
      onclick="window.Services.AppOffer.open()"
      data-tip="Install the Generator on your computer"
      style="flex: 1; border: 1px solid var(--header);"
    >
      Desktop App
    </button>
  </div>
  <p>
    <a href="https://github.com/Azgaar/Fantasy-Map-Generator" target="_blank">Fantasy Map Generator</a> is an
    <a href="https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/LICENSE" target="_blank"
      >open source</a
    >
    tool by Azgaar and Team. You may use maps as they are, edit them or even create a new map from
    scratch. Check out the
    <a href="https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Quick-Start-Tutorial" target="_blank"
      >Quick start</a
    >, <a href="https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Q&A" target="_blank">Q&A</a>,
    <a href="https://youtube.com/playlist?list=PLtgiuDC8iVR2gIG8zMTRn7T_L0arl9h1C" target="_blank"
      >Video tutorial</a
    >, and
    <a href="https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Hotkeys" target="_blank">hotkeys</a> for
    guidance.
  </p>
  <p>
    Join our <a href="https://discordapp.com/invite/X7E84HU" target="_blank">Discord server</a> and
    <a href="https://www.reddit.com/r/FantasyMapGenerator/" target="_blank">Reddit community</a> to ask
    questions, get help and share maps. The created maps can be used for free, even for commercial purposes.
  </p>
  <p>
    The project is under active development. Creator and main maintainer: Azgaar. To track the development
    progress see the
    <a href="https://trello.com/b/7x832DG4/fantasy-map-generator" target="_blank">devboard</a>. For older
    versions see the
    <a href="https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog" target="_blank">changelog</a>.
    Please report bugs
    <a href="https://github.com/Azgaar/Fantasy-Map-Generator/issues" target="_blank">here</a>. You can also
    contact me directly via <a href="mailto:azgaar.fmg@yandex.by" target="_blank">email</a>.
  </p>
  <div
    style="
      background-color: #e85b46;
      padding: 0.4em;
      width: max-content;
      margin: 0.6em auto 0 auto;
      border: 1px solid #943838;
    "
  >
    <a
      href="https://www.patreon.com/azgaar"
      target="_blank"
      style="color: white; text-decoration: none; font-family: sans-serif"
    >
      <div>
        <div style="width: 0.8em; display: inline-block; padding: 0 0.2em; fill: white">
          <svg viewBox="0 0 569 546">
            <circle cx="362.589996" cy="204.589996" data-fill="1" id="Oval" r="204.589996" />
            <rect data-fill="2" height="545.799988" id="Rectangle" width="100" x="0" y="0" />
          </svg>
        </div>
        SUPPORT ON PATREON
      </div>
    </a>
  </div>
  <p>
    Special thanks to
    <a data-tip="Click to see list of supporters" onclick="showSupporters()">all supporters</a> on Patreon!
  </p>
  <div style="display: flex; justify-content: center; padding: 0.4em; font-family: cursive">
    <a href="https://u24.gov.ua/" style="width: 80%" data-tip="Support Ukraine" target="_blank">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200">
        <rect width="100%" height="100%" fill="#005bbb"></rect>
        <rect y="50%" width="100%" height="50%" fill="#ffd500"></rect>
        <text x="50%" text-anchor="middle" font-size="6em" y="32%" fill="#f5f5f5">Support Ukraine</text>
        <text x="50%" text-anchor="middle" font-size="4em" y="78%" fill="#005bdd">u24.gov.ua</text>
      </svg>
    </a>
  </div>
  <div style="text-align: left">
    <p>Check out our other projects:</p>
    <div>• <a href="https://azgaar.github.io/Armoria" target="_blank">Armoria</a>: a tool for creating coats of arms</div>
    <div>• <a href="https://deorum.vercel.app" target="_blank">Deorum</a>: gallery of fantasy characters</div>
  </div>
  <div style="text-align: left; margin-top: 0.5em">
    Chinese localization: <a href="https://www.8desk.top" target="_blank">8desk.top</a>
  </div>
  <ul class="share-buttons">
    <li>
      <a
        href="https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fazgaar.github.io%2FFantasy-Map-Generator%2F&quote="
        data-tip="Share on Facebook"
        target="_blank"
        ><img alt="Share on Facebook" src="images/Facebook.png" loading="lazy"
      /></a>
    </li>
    <li>
      <a
        href="https://twitter.com/intent/tweet?source=https%3A%2F%2Fazgaar.github.io%2FFantasy-Map-Generator&text=%23FantasyMapGenerator%0A%0Ahttps%3A//azgaar.github.io/Fantasy-Map-Generator"
        target="_blank"
        data-tip="Tweet"
        ><img alt="Tweet" src="images/Twitter.png" loading="lazy"
      /></a>
    </li>
    <li>
      <a
        href="http://pinterest.com/pin/create/button/?url=https%3A%2F%2Fazgaar.github.io%2FFantasy-Map-Generator"
        target="_blank"
        data-tip="Pin it"
        ><img alt="Pin it" src="images/Pinterest.png" loading="lazy"
      /></a>
    </li>
    <li>
      <a
        href="http://www.reddit.com/submit?url=https%3A%2F%2Fazgaar.github.io%2FFantasy-Map-Generator"
        target="_blank"
        data-tip="Submit to Reddit"
        ><img alt="Submit to Reddit" src="images/Reddit.png" loading="lazy"
      /></a>
    </li>
    <li>
      <a href="https://discord.gg/X7E84HU" target="_blank" data-tip="Join Discord server"
        ><img alt="Join Discord server" src="images/Discord.png" loading="lazy"
      /></a>
    </li>
  </ul>
`;

ensureEl("aboutContent").innerHTML = TEMPLATE;

/** The list of Patreon supporters, updated by hand with each release */
function showSupporters(): void {
  const columns = window.innerWidth < 800 ? 2 : 5;
  const names = window.Supporters.split("\n").sort();
  alertDialog({
    title: "Patreon Supporters",
    width: "min-width",
    message: /* html */ `<ul style="column-count: ${columns}; column-gap: 2em">${names
      .map(name => `<li>${name}</li>`)
      .join("")}</ul>`
  });
}

// Legacy seam: the credits block wires the dialog with an inline onclick
declare global {
  interface Window {
    showSupporters: typeof showSupporters;
  }
}
window.showSupporters = showSupporters;
