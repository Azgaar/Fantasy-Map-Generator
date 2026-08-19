import { renderCOA } from "armoria";
import { select } from "d3";
import { Layers } from "@/components/layers";

declare global {
  var COArenderer: EmblemRenderModule;
}
interface Division {
  division: string;
  line?: string;
  t: string;
}

interface Ordinary {
  ordinary: string;
  line?: string;
  t: string;
  divided?: "field" | "division" | "counter";
  above?: boolean;
}

interface Charge {
  stroke: string;
  charge: string;
  t: string;
  size?: number;
  sinister?: boolean;
  reversed?: boolean;
  line?: string;
  divided?: "field" | "division" | "counter";
  p: number[]; // position on shield from 1 to 9
}

interface Emblem {
  shield: string;
  t1: string;
  division?: Division;
  ordinaries?: Ordinary[];
  charges?: Charge[];
  custom?: boolean; // if true, coa will not be rendered
}

class EmblemRenderModule {
  private async draw(id: string, coa: Emblem) {
    // insert coa svg to defs
    const svg = await renderCOA({ ...coa, seed: id }, 200);
    const coas = document.getElementById("coas")!;
    coas.insertAdjacentHTML("beforeend", svg);
    // the cache key travels with the rendered shield, so clearing #coas clears the cache with it
    (coas.lastElementChild as SVGElement).dataset.coa = JSON.stringify(coa);
    return true;
  }

  /** render the coa unless the rendered one is already up to date: a reassigned coa replaces its shield */
  async trigger(id: string, coa: Emblem) {
    if (!coa) return console.warn(`Emblem ${id} is undefined`);
    if (coa.custom) return console.warn("Cannot render custom emblem", coa);

    const rendered = document.getElementById(id);
    if (rendered?.dataset.coa === JSON.stringify(coa)) return;

    rendered?.remove(); // the entity kept its id but got new arms, e.g. on a states regeneration
    return this.draw(id, coa);
  }

  async add(type: string, i: number, coa: Emblem, x: number, y: number) {
    const id = `${type}COA${i}`;
    const g: HTMLElement = document.getElementById(`${type}Emblems`) as HTMLElement;

    if (select("#emblems").selectAll("use").size()) {
      const size = parseFloat(g.getAttribute("font-size") || "50");
      const use = `<use data-i="${i}" x="${x - size / 2}" y="${y - size / 2}" width="1em" height="1em" href="#${id}"/>`;
      g.insertAdjacentHTML("beforeend", use);
    }
    if (Layers.isOn("emblems")) this.trigger(id, coa);
  }
}
window.COArenderer = new EmblemRenderModule();
