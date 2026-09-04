// Map mode shared by the states and provinces editors: click the annexing entity, then the ones it absorbs
import { select } from "d3";
import { ensureEl, getPointer } from "@/utils";
import { clearMainTip, tip } from "./tooltips";
import { applyDefaultViewboxEvents } from "./viewbox-events";

interface AnnexModeOptions {
  buttonId: string;
  bodySectionId: string;
  mode: number;
  noun: string;
  ownerOf: (cellId: number) => number;
  colorOf: (id: number) => string;
  nameOf: (id: number) => string;
  rejectReason?: (parentId: number, id: number) => string | undefined;
  commit: (parentId: number, annexed: number[]) => void;
}

export function createAnnexMode(options: AnnexModeOptions) {
  const { buttonId, bodySectionId, mode, noun, ownerOf, colorOf, nameOf, rejectReason, commit } = options;
  let parent = 0;
  const staged = new Set<number>();

  const isActive = () => customization === mode;
  const preview = () => select("#debug").select("g.annex-preview");

  function toggle(): void {
    if (isActive()) finish();
    else enter();
  }

  function enter(): void {
    customization = mode;
    ensureEl(buttonId).classList.add("pressed");
    select("#debug").append("g").attr("class", "annex-preview");
    tip(`Click the ${noun} that annexes, then the ${noun}s it absorbs. Hold Shift to keep annexing`, true);
    select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", onClick);
    setRowsInert(true);
  }

  function onClick(this: SVGElement, event: MouseEvent): void {
    const [x, y] = getPointer(event, this);
    const cell = Pack.findCell(x, y);
    if (cell === undefined || pack.cells.h[cell] < 20) {
      tip(`Click on a land cell to pick a ${noun}`, false, "error");
      return;
    }

    const id = ownerOf(cell);
    if (!id) {
      tip(`There is no ${noun} here`, false, "error");
      return;
    }

    if (!parent) {
      parent = id;
      drawEntity(id, "annex-parent", 0.3);
      tip(`Annexing into ${nameOf(id)}. Click the ${noun}s to annex. Hold Shift to keep annexing`, true);
      return;
    }

    if (id === parent) {
      tip(`${nameOf(id)} is the annexing ${noun}`, false, "error");
      return;
    }

    const reason = rejectReason?.(parent, id);
    if (reason) {
      tip(reason, false, "error");
      return;
    }

    if (staged.has(id)) {
      staged.delete(id);
      preview().select(`g[data-id='${id}']`).remove();
    } else {
      staged.add(id);
      drawEntity(id, "annex-child", 0.7);
    }

    if (!event.shiftKey) finish();
  }

  function drawEntity(id: number, className: string, opacity: number): void {
    const color = colorOf(parent);
    const group = preview().append("g").attr("data-id", id).attr("class", className).attr("opacity", opacity);
    const { h } = pack.cells;
    for (let i = 0; i < h.length; i++) {
      if (h[i] < 20 || ownerOf(i) !== id) continue;
      group
        .append("polygon")
        .attr("points", String(Pack.getPolygon(i)))
        .attr("fill", color)
        .attr("stroke", color);
    }
  }

  function setRowsInert(inert: boolean): void {
    ensureEl(bodySectionId)
      .querySelectorAll<HTMLElement>("div > input, select, span, svg")
      .forEach(e => {
        if (inert) e.style.pointerEvents = "none";
        else e.style.removeProperty("pointer-events");
      });
  }

  function finish(): void {
    const parentId = parent;
    const annexed = [...staged];
    exit();
    if (parentId && annexed.length) commit(parentId, annexed);
  }

  function exit(): void {
    if (!isActive()) return;
    customization = 0;
    parent = 0;
    staged.clear();
    preview().remove();
    applyDefaultViewboxEvents();
    clearMainTip();
    setRowsInert(false);
    ensureEl(buttonId).classList.remove("pressed");
  }

  return { toggle, exit };
}
