import { destroyDialog } from "@/components/dialog/dialog-helpers";
import { showDomDialog } from "@/components/ui/dom-dialog";
import type { Burg } from "@/generators/burgs-generator";
import { convertTemperature, ensureEl, getHeight, rn, si } from "@/utils";

const dialogId = "burgInfo";

function open(id: number): void {
  const burg = pack.burgs[id];
  if (!burg?.i || burg.removed) return;

  destroyDialog(dialogId);
  const content = renderBurgInfo(burg);
  ensureEl("dialogs").appendChild(content);

  showDomDialog({
    access: "inspect",
    content,
    placement: "top-right",
    placementTarget: document.getElementById("map"),
    presentation: "panel",
    resizable: false,
    title: burg.name || `Burg ${burg.i}`
  });
}

function renderBurgInfo(burg: Burg): HTMLElement {
  const province = pack.cells.province[burg.cell] ? pack.provinces[pack.cells.province[burg.cell]] : undefined;
  const state = burg.state ? pack.states[burg.state] : undefined;
  const culture = burg.culture ? pack.cultures[burg.culture] : undefined;
  const temperature = grid.cells.temp[pack.cells.g[burg.cell]];
  const population = (burg.population || 0) * populationRate * urbanization;
  const wealth = burg.population ? (burg.product || 0) / burg.population : 0;
  const rows: readonly [string, string][] = [
    ["Cell", String(burg.cell)],
    ["Province", province?.fullName || province?.name || "None"],
    ["State", state?.fullName || state?.name || "Neutral lands"],
    ["Culture", culture?.name || "None"],
    ["Group", burg.group || "Default"],
    ["Type", burg.type || "Generic"],
    ["Population", si(population)],
    ["Product", `🟡 ${rn(burg.product || 0, 2)}`],
    ["Wealth", `🟡 ${rn(wealth, 2)}`],
    ["Treasury", `🟡 ${rn(burg.treasury || 0, 2)}`],
    ["Temperature", convertTemperature(temperature)],
    ["Elevation", getHeight(pack.cells.h[burg.cell])],
    ["Coordinates", `${rn(burg.x)}, ${rn(burg.y)}`],
    ["Features", getBurgFeatures(burg).join(", ") || "None"]
  ];

  const content = document.createElement("div");
  content.className = "dialog stable";
  content.id = dialogId;
  content.style.maxWidth = "min(62vw, 42em)";
  const body = document.createElement("div");
  body.style.cssText = "display:flex;align-items:flex-start;gap:1em";
  body.append(renderBurgEmblem(burg));
  const details = document.createElement("dl");
  details.style.cssText = "display:grid;grid-template-columns:auto 1fr;gap:.35em .8em;margin:0";

  for (const [label, value] of rows) {
    const term = document.createElement("dt");
    term.style.fontWeight = "bold";
    term.textContent = `${label}:`;
    const description = document.createElement("dd");
    description.style.margin = "0";
    description.textContent = value;
    details.append(term, description);
  }

  body.append(details);
  content.append(body);
  const preview = renderBurgPreview(burg);
  if (preview) content.append(preview);
  return content;
}

function renderBurgEmblem(burg: Burg): SVGSVGElement {
  const emblemId = `burgCOA${burg.i}`;
  COArenderer.trigger(emblemId, burg.coa);
  const emblem = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  emblem.setAttribute("aria-label", `${burg.name || "Burg"} emblem`);
  emblem.setAttribute("role", "img");
  emblem.setAttribute("viewBox", "0 0 200 200");
  emblem.setAttribute("width", "9em");
  emblem.setAttribute("height", "9em");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${emblemId}`);
  emblem.append(use);
  return emblem;
}

function renderBurgPreview(burg: Burg): HTMLIFrameElement | null {
  const preview = Burgs.getPreview(burg).preview;
  if (!preview) return null;

  const previewFrame = document.createElement("iframe");
  previewFrame.setAttribute("aria-label", `${burg.name || "Burg"} map preview`);
  previewFrame.setAttribute("sandbox", "allow-scripts allow-same-origin");
  previewFrame.src = preview;
  previewFrame.style.cssText = "border:0;display:block;height:18em;margin-top:1em;pointer-events:none;width:100%";
  return previewFrame;
}

export function getBurgFeatures(
  burg: Pick<Burg, "capital" | "citadel" | "plaza" | "port" | "shanty" | "temple" | "walls">
): string[] {
  return [
    burg.capital ? "Capital" : "",
    burg.port ? "Port" : "",
    burg.citadel ? "Citadel" : "",
    burg.walls ? "Walls" : "",
    burg.plaza ? "Market center" : "",
    burg.temple ? "Temple" : "",
    burg.shanty ? "Shanty town" : ""
  ].filter(Boolean);
}

export const BurgInfo = { open };
