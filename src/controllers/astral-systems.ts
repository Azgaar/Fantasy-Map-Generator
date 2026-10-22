// The Star Systems overview: every burg on the map read as a star system — its class, its
// people, the installations that make it what it is. Read-only, and the place the Astral
// mapping is meant to grow into a visual reskin. See docs/astral/README.md
import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { dialogState } from "@/components/dialog/state";
import { type StarSystem, starClass, systemsOf } from "@/generators/astral-naming";
import { getCellPoint } from "@/generators/journeys/journey-places";
import { ensureEl, escapeHtml } from "@/utils";

const dialogId = "astralSystems" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };

let filterState: { search: string };

const TEMPLATE = /* html */ `
  <style>
    #${dialogId} { width: 36em; }
    #${dialogId} #astralBody { height: 24em; overflow-y: auto; padding: .3em .5em; }
    #${dialogId} .astralSystem { display: flex; gap: .6em; align-items: baseline; padding: .15em 0; }
    #${dialogId} .astralSystem:hover { background: rgba(0, 0, 0, 0.05); }
    #${dialogId} .astralName { flex: 1; font-weight: bold; }
    #${dialogId} .astralClass { flex: 0 0 11em; }
    #${dialogId} .astralPop { flex: 0 0 7em; text-align: right; }
    #${dialogId} .astralTraits { flex: 0 0 14em; opacity: .8; }
    #${dialogId} .astralEmpty { padding: 1em; font-style: italic; opacity: .7; }
  </style>
`;

function open(): void {
  if (customization) return;
  filterState = dialogState.get(dialogId, "filters", () => ({ search: "" }));
  closeDialogs(`#${dialogId}, .stable`);

  renderDialog();
  renderBody();

  $(`#${dialogId}`).dialog({ title: "Star Systems", resizable: false, position, close: () => destroyDialog(dialogId) });
}

function renderDialog(): void {
  destroyDialog(dialogId);

  const html = /* html */ `<div id="${dialogId}" class="dialog stable">${TEMPLATE}
    <div id="astralFilters" class="editorFilters">
      <label for="astralSearch" data-tip="Filter by system name, class or trait" style="grid-template-columns: 4em 14em">Search:
        <input id="astralSearch" type="search" />
      </label>
    </div>

    <div id="astralBody"></div>

    <div id="astralFooter" class="totalLine">
      <div data-tip="Systems shown" style="margin-left: 4px">Systems:&nbsp;<span id="astralCount">0</span></div>
    </div>

    <div id="astralBottom" class="editorToolbar">
      <button id="astralRefresh" data-tip="Refresh the overview" class="icon-cw"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  ensureEl<HTMLInputElement>("astralSearch").value = filterState.search;
  ensureEl("astralRefresh").addEventListener("click", renderBody);
  ensureEl("astralSearch").addEventListener("input", event => {
    filterState.search = (event.target as HTMLInputElement).value;
    dialogState.set(dialogId, "filters", filterState);
    renderBody();
  });
}

function renderBody(): void {
  const body = ensureEl("astralBody");
  const search = filterState.search.toLowerCase().trim();
  const systems = systemsOf().filter(system => matches(system, search));

  if (!systems.length) {
    body.innerHTML = `<div class="astralEmpty">No systems to show.</div>`;
    ensureEl("astralCount").textContent = "0";
    return;
  }

  let lines = "";
  for (const system of systems) {
    const { class: letter, name: className } = starClass(system.population);
    lines += /* html */ `<div class="astralSystem" data-cell="${system.id}">
      <span class="astralName">${escapeHtml(system.name)}</span>
      <span class="astralClass">${letter}-class ${escapeHtml(className)}</span>
      <span class="astralPop">${system.population.toLocaleString("en-US")}</span>
      <span class="astralTraits">${escapeHtml(system.traits.join(", "))}</span>
    </div>`;
  }
  body.innerHTML = lines;
  ensureEl("astralCount").textContent = String(systems.length);

  body.querySelectorAll<HTMLElement>(".astralSystem").forEach(el => {
    el.addEventListener("click", () => zoomToSystem(el));
  });
}

function matches(system: StarSystem, search: string): boolean {
  if (!search) return true;
  const haystack = [system.name, system.class, system.className, ...system.traits].join(" ").toLowerCase();
  return haystack.includes(search);
}

function zoomToSystem(el: HTMLElement): void {
  const burgId = Number(el.dataset.cell);
  const burg = pack.burgs[burgId];
  if (!burg) return;
  const point = getCellPoint(burg.cell);
  if (point) zoomTo(point[0], point[1], 8, 2000);
}

export const AstralSystems = { open };
