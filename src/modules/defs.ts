import type { Selection } from "d3";
import { select } from "d3";

const SVG_NS = "http://www.w3.org/2000/svg";

export class RuntimeDefsModule {
  private ensureGroup(id: string): SVGGElement {
    const existing = document.getElementById(id);
    if (existing instanceof SVGGElement) return existing;
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("id", id);
    Scene.getRuntimeDefs().append(g);
    return g;
  }

  private ensureMask(id: string): SVGMaskElement {
    const existing = document.getElementById(id);
    if (existing instanceof SVGMaskElement) return existing;
    const mask = document.createElementNS(SVG_NS, "mask");
    mask.setAttribute("id", id);
    Scene.getRuntimeDefs().append(mask);
    return mask;
  }

  getFeaturePaths(): Selection<SVGGElement, unknown, null, undefined> {
    return select<SVGGElement, unknown>(this.ensureGroup("featurePaths"));
  }

  getLandMask(): Selection<SVGMaskElement, unknown, null, undefined> {
    return select<SVGMaskElement, unknown>(this.ensureMask("land"));
  }

  getWaterMask(): Selection<SVGMaskElement, unknown, null, undefined> {
    return select<SVGMaskElement, unknown>(this.ensureMask("water"));
  }

  getTextPaths(): Selection<SVGGElement, unknown, null, undefined> {
    return select<SVGGElement, unknown>(this.ensureGroup("textPaths"));
  }

  /** Remove migrated stubs from #deftemp in a freshly-loaded map SVG to prevent duplicate IDs. */
  purgeMapDefStubs(): void {
    const deftemp = document.getElementById("deftemp");
    if (!deftemp) return;
    for (const id of ["featurePaths", "textPaths", "land", "water"]) {
      deftemp.querySelector(`#${id}`)?.remove();
    }
  }
}

declare global {
  var RuntimeDefs: RuntimeDefsModule;
}

if (typeof window !== "undefined") {
  window.RuntimeDefs = new RuntimeDefsModule();
}
