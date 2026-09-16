// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HeraldicEmblem } from "@/types/emblems";

import { EmblemRenderer } from "./renderer";

beforeEach(() => {
  document.body.innerHTML = /* html */ `<svg><g id="coas"></g></svg>`;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EmblemRenderer", () => {
  it("keeps only the latest definition when renders for one id overlap", async () => {
    const first: HeraldicEmblem = { t1: "gules", shield: "heater" };
    const latest: HeraldicEmblem = { t1: "azure", shield: "heater" };

    await Promise.all([EmblemRenderer.trigger("stateCOA1", first), EmblemRenderer.trigger("stateCOA1", latest)]);

    const definitions = document.querySelectorAll("#stateCOA1");
    expect(definitions).toHaveLength(1);
    expect((definitions[0] as SVGElement).dataset.coa).toBe(JSON.stringify(latest));
  });

  it("does not append a definition after it is removed while rendering", async () => {
    const pending = EmblemRenderer.trigger("stateCOA1", { t1: "gules", shield: "heater" });

    EmblemRenderer.remove("stateCOA1");
    await pending;

    expect(document.getElementById("stateCOA1")).toBeNull();
  });

  it("does not overwrite a custom definition inserted after a pending render is removed", async () => {
    const pending = EmblemRenderer.trigger("stateCOA1", { t1: "gules", shield: "heater" });
    EmblemRenderer.remove("stateCOA1");
    document.getElementById("coas")!.insertAdjacentHTML("beforeend", '<svg id="stateCOA1" data-custom="true" />');

    await pending;

    expect(document.getElementById("stateCOA1")?.dataset.custom).toBe("true");
  });

  it("ignores a removed render that settles after the id is recreated", async () => {
    let releaseCharge!: () => void;
    const charge = new Promise<void>(resolve => {
      releaseCharge = resolve;
    });
    const response = { ok: true, text: () => charge.then(() => "<svg><g><path/></g></svg>") };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const old: HeraldicEmblem = { t1: "gules", shield: "heater", charges: [{ charge: "lion", t: "or", p: "e" }] };
    const replacement: HeraldicEmblem = { t1: "azure", shield: "heater" };
    const stale = EmblemRenderer.trigger("stateCOA1", old);
    EmblemRenderer.remove("stateCOA1");
    await EmblemRenderer.trigger("stateCOA1", replacement);

    releaseCharge();
    await stale;

    expect(document.querySelector<SVGElement>("#stateCOA1")!.dataset.coa).toBe(JSON.stringify(replacement));
  });

  it("cancels a pending change when the latest request restores the rendered definition", async () => {
    const original: HeraldicEmblem = { t1: "gules", shield: "heater" };
    const changed: HeraldicEmblem = { t1: "azure", shield: "heater" };
    await EmblemRenderer.trigger("stateCOA1", original);

    const pendingChange = EmblemRenderer.trigger("stateCOA1", changed);
    const restore = EmblemRenderer.trigger("stateCOA1", original);
    await Promise.all([pendingChange, restore]);

    const rendered = document.querySelector<SVGElement>("#stateCOA1")!;
    expect(rendered.dataset.coa).toBe(JSON.stringify(original));
  });
});
