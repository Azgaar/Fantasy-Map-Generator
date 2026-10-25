// The window shown once after an update and on F1: update note, changelog, links

import latestUpdate from "virtual:latest-update";
import { Services } from "@/services";
import { parseChangelog, renderChanges } from "@/services/changelog";
import { compareVersions, VERSION } from "@/services/versioning";
import { Dialog } from "@/ui/dialog/dialog";
import { Catalog, sentences, t } from "@/utils/i18n";
import changelog from "../../docs/wiki/Changelog.md?raw";

const PATREON = "https://www.patreon.com/azgaar";
const WIKI = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki";
const RELEASES_SHOWN = 5;

const STYLE = /* html */ `<style>
  #releaseNotes .dialog-message { max-width: none; } /* the dialog's own width already fits the screen */
  .releaseNotes { --rule: color-mix(in srgb, var(--bg-main) 30%, transparent); display: grid; gap: 1em; padding: .4em 0 .2em; }
  .releaseNotes h3 { margin: 0; font: normal 1.75em/1.1 var(--serif); color: var(--dark-solid); }
  .releaseNotes header p { margin: .35em 0 0; color: #666; }
  .releaseNotes .post { display: block; position: relative; aspect-ratio: 16 / 5.5; background: center / cover no-repeat; color: #fff; text-decoration: none; }
  .releaseNotes .post::before { content: ""; position: absolute; inset: 0; background: linear-gradient(0deg, color-mix(in srgb, var(--dark-solid) 85%, transparent), transparent 65%); }
  .releaseNotes .caption { position: absolute; left: 1em; right: 1em; bottom: .8em; display: grid; gap: .15em; }
  .releaseNotes .caption small { font-size: .9em; opacity: .85; }
  .releaseNotes .caption b { font: normal 1.45em/1.15 var(--serif); }
  .releaseNotes .post:hover b { text-decoration: underline; text-underline-offset: .15em; }
  .releaseNotes .releases { height: 24em; overflow-y: auto; scrollbar-width: thin; padding-right: .5em; display: grid; gap: 1em; align-content: start; }
  .releaseNotes .releases.more { mask-image: linear-gradient(#000 75%, transparent); }
  .releaseNotes .releases h4 { margin: 0 0 .3em; display: flex; justify-content: space-between; align-items: baseline; gap: 1em; font-size: 1em; color: var(--dark-solid); }
  .releaseNotes .releases h4 span { font-weight: normal; color: #888; font-size: .9em; }
  .releaseNotes .releases ul { margin: 0; padding: 0; list-style: none; display: grid; gap: .25em; }
  .releaseNotes .releases li { position: relative; padding-left: 1.1em; line-height: 1.35; }
  .releaseNotes .releases li::before { content: "–"; position: absolute; left: .1em; color: var(--header); }
  .releaseNotes .releases li a, .releaseNotes .releases > a { color: var(--dark-solid); }
  .releaseNotes .releases > a { justify-self: start; }
  .releaseNotesLinks { float: left; display: flex; flex-wrap: wrap; gap: 0 .9em; margin: .95em 0 .4em .6em; }
  .releaseNotesLinks a { color: #666; text-decoration: none; }
  .releaseNotesLinks a:hover { color: var(--dark-solid); text-decoration: underline; text-underline-offset: .2em; }
</style>`;

// the button bar holds the links, left of the buttons
const LINKS = /* html */ `<nav class="releaseNotesLinks">
  <a href="${WIKI}/Quick-Start-Tutorial" target="_blank">${t("Tutorial")}</a>
  <a href="${WIKI}/Hotkeys" target="_blank">${t("Hotkeys")}</a>
  <a href="https://discordapp.com/invite/X7E84HU" target="_blank">Discord</a>
  <a href="https://www.reddit.com/r/FantasyMapGenerator" target="_blank">Reddit</a>
  <a href="https://github.com/Azgaar/Fantasy-Map-Generator" target="_blank">GitHub</a>
  <a href="${PATREON}" target="_blank">Patreon</a>
</nav>`;

/** `afterUpdate` adds the F1 hint: the window opens on its own once, so the user needs to know how to get it back */
function open({ afterUpdate = false } = {}): void {
  const content = document.createElement("div");
  content.className = "releaseNotes";
  content.innerHTML = STYLE + render(afterUpdate);

  Dialog.message({
    id: "releaseNotes",
    title: t("Generator update"),
    message: content,
    width: "min(42em, calc(100vw - 32px))", // a 16px gutter on phones
    footer: LINKS,
    buttons: [{ label: t("Interactive Tour"), onClick: () => void Services.UiTour.start() }, { label: t("Close") }]
  });

  const releases = content.querySelector<HTMLElement>(".releases")!;
  const fade = () =>
    releases.classList.toggle("more", releases.scrollTop + releases.clientHeight < releases.scrollHeight - 2);
  releases.addEventListener("scroll", fade);
  fade();
}

function render(afterUpdate: boolean): string {
  const all = parseChangelog(changelog);
  const releases = all.filter(({ version }) => !compareVersions(version, VERSION).isNewer).slice(0, RELEASES_SHOWN);
  const updateDate = all.find(({ version }) => version === latestUpdate.version)?.date;

  const minor = VERSION.split(".").slice(0, 2).join(".");
  const note = t("Older maps are updated automatically when you load them");

  return /* html */ `
    <header>
      <h3>${t("Azgaar's Fantasy Map Generator")} v${minor}</h3>
      <p>${afterUpdate ? sentences(note, t("Press F1 to open this again")) : note}</p>
    </header>
    <a class="post" href="${PATREON}/posts" target="_blank" style="background-image: url('${latestUpdate.image}')">
      <span class="caption">
        <small>${updateDate ? t("Latest post on Patreon, {{date}}", { date: formatDate(updateDate) }) : t("Latest post on Patreon")}</small>
        <b>${latestUpdate.title}</b>
      </span>
    </a>
    <div class="releases">
      ${releases
        .map(
          ({ version, date, changes }) => /* html */ `<section>
            <h4>v${version}${date ? `<span>${formatDate(date)}</span>` : ""}</h4>
            ${renderChanges(changes)}
          </section>`
        )
        .join("")}
      <a href="${WIKI}/Changelog" target="_blank">${t("Changelog")}</a>
    </div>`;
}

const formatDate = (date: string): string =>
  new Date(date).toLocaleDateString(Catalog.language, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });

export const ReleaseNotes = { open };
