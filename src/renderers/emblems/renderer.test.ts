// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HeraldicEmblem } from "@/types/emblems";
import "@/generators/relief-generator"; // the icon set catalog lists every family
import "@/generators/burgs-generator";
import "@/generators/goods-generator";

import { EmblemRenderer } from "./renderer";

beforeEach(() => {
  document.body.innerHTML = /* html */ `<svg><g id="coas"></g></svg>`;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EmblemRenderer", () => {
  it("draws picture emblems with and without a shield", async () => {
    await EmblemRenderer.trigger("stateCOA1", { icon: "glyph-58" });
    let emblem = document.getElementById("stateCOA1")!;
    expect(emblem.querySelector('use[href="#glyph-58"]')).not.toBeNull();
    expect(emblem.querySelector("clipPath")).toBeNull();

    await EmblemRenderer.trigger("stateCOA1", { icon: "glyph-58", shield: "heater" });
    emblem = document.getElementById("stateCOA1")!;
    expect(emblem.querySelector("clipPath path")).not.toBeNull();
    expect(emblem.querySelector('[clip-path="url(#shield_stateCOA1)"] use')).not.toBeNull();
  });

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

describe("EmblemRenderer Armoria features", () => {
  const render = async (coa: HeraldicEmblem) => {
    const charge = { ok: true, text: () => Promise.resolve('<svg><g><path class="background"/><path/></g></svg>') };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(charge));
    await EmblemRenderer.trigger("stateCOA1", coa);
    return document.getElementById("stateCOA1")!;
  };
  const clipped = (svg: HTMLElement) => svg.querySelector('[clip-path="url(#shield_stateCOA1)"]')!;

  it("paints exact hex colours, inside patterns too, with pattern ids a url() can link", async () => {
    const svg = await render({
      t1: "vair-#228833-or",
      shield: "heater",
      charges: [{ charge: "lionRampant", t: "#aa0000", p: "e" }]
    });
    expect(clipped(svg).querySelector("rect")!.getAttribute("fill")).toBe("url(#vair-228833-or_stateCOA1)");
    expect(svg.querySelector("#vair-228833-or_stateCOA1 rect")!.getAttribute("fill")).toBe("#228833");
    expect(clipped(svg).querySelector('g[fill="#aa0000"] use')).not.toBeNull();
  });

  it("paints the newer tinctures", async () => {
    const svg = await render({ t1: "carnation", shield: "heater" });
    expect(clipped(svg).querySelector("rect")!.getAttribute("fill")).toBe("#eabfa2");
  });

  it("scopes patterns to the emblem and strews semy charges from its own definitions", async () => {
    const svg = await render({ t1: "semy_of_mullet-or-azure-small", shield: "heater" });
    const pattern = svg.querySelector("pattern")!;
    expect(pattern.id).toBe("semy_of_mullet-or-azure-small_stateCOA1");
    expect(pattern.querySelector("use")!.getAttribute("href")).toBe("#mullet_stateCOA1");
    expect(svg.querySelector("#mullet_stateCOA1")).not.toBeNull();
  });

  it("draws a library icon as a charge in the charge box, tinted by the charge", async () => {
    const coa: HeraldicEmblem = {
      t1: "argent",
      charges: [
        { charge: "custom-1a2b3c4d", t: "azure", p: "e", size: 1.5 },
        { charge: "goods-wood", t: "or", p: "a" }
      ]
    };
    const svg = await render(coa);
    const custom = svg.querySelector("#custom-1a2b3c4d_stateCOA1 use")!;
    expect(custom.getAttribute("href")).toBe("#custom-1a2b3c4d");
    const box = ["x", "y", "width", "height"].map(name => custom.getAttribute(name));
    expect(box).toEqual(["60", "60", "80", "80"]);
    expect(custom.getAttribute("stroke")).toBe("none"); // custom art gets no forced outline
    expect(svg.querySelector("#goods-wood_stateCOA1 use")!.getAttribute("style")).toBe("stroke: var(--tincture)"); // line art
    expect(clipped(svg).querySelector('g[fill="#377cd7"] use')!.getAttribute("href")).toBe(
      "#custom-1a2b3c4d_stateCOA1"
    );
  });

  it("stretches and rotates placed charges", async () => {
    const coa: HeraldicEmblem = {
      t1: "gules",
      charges: [{ charge: "lionRampant", t: "or", p: "e", stretch: 0.5, angle: 30, x: 10 }]
    };
    const group = clipped(await render(coa)).querySelector("g")!;
    expect(group.getAttribute("transform")).toBe("translate(10 0) rotate(30 100 100)");
    expect(group.querySelector("use")!.getAttribute("transform")).toBe("translate(0 -50) scale(1 1.5)");
  });

  it("redraws the foreground of layered charges and draws outside ones beyond the shield clip", async () => {
    const coa: HeraldicEmblem = {
      t1: "gules",
      charges: [
        { charge: "lionRampant", t: "or", p: "e", layered: 1 },
        { charge: "crown", t: "or", p: "e", outside: "above" }
      ]
    };
    const svg = await render(coa);
    const onField = [...clipped(svg).querySelectorAll(":scope > g")];
    expect(onField.map(g => g.getAttribute("style")?.includes("--background: none"))).toEqual([false, true]);
    const outside = svg.querySelector(':scope > g:not([clip-path]) use[href="#crown_stateCOA1"]');
    expect(outside).not.toBeNull();
  });

  it("draws gyronny bordures through a mask of the shield outline", async () => {
    const coa: HeraldicEmblem = {
      t1: "gules",
      ordinaries: [{ ordinary: "bordure", t: "or", t2: "azure", gyronny: 8 }]
    };
    const svg = await render(coa);
    expect(svg.querySelector("mask")!.id).toBe("mask0_stateCOA1");
    expect(svg.querySelectorAll('g[mask="url(#mask0_stateCOA1)"] polygon')).toHaveLength(4);
  });

  it("applies the diaper over a plain field and writes inscriptions along their path", async () => {
    const coa: HeraldicEmblem = {
      t1: "gules",
      diaper: "nourse",
      inscriptions: [{ text: "Fortis & <Fidelis>", font: "Cinzel", size: 20, color: "#fff", path: "M-50 0 L50 0" }]
    };
    const svg = await render(coa);
    expect(svg.querySelector("#diaper_stateCOA1")).not.toBeNull();
    expect(clipped(svg).querySelector('rect.diaper[fill="url(#diaper_stateCOA1)"]')).not.toBeNull();
    const textPath = svg.querySelector("textPath")!;
    expect(textPath.getAttribute("href")).toBe("#inscription0_stateCOA1");
    expect(textPath.textContent).toBe("Fortis & <Fidelis>");
  });

  it("zooms the view around the shield center", async () => {
    const svg = await render({ t1: "gules", shield: "round", zoom: 2 });
    expect(svg.getAttribute("viewBox")).toBe("50 50 100 100");
  });

  it("falls back to straight templates and skips unknown ordinaries", async () => {
    const coa: HeraldicEmblem = {
      t1: "gules",
      ordinaries: [
        { ordinary: "fess", t: "or", line: "unknownLine" },
        { ordinary: "unknownOrdinary", t: "or" }
      ]
    };
    const groups = clipped(await render(coa)).querySelectorAll(":scope > g");
    expect(groups).toHaveLength(1);
    expect(groups[0].innerHTML).toBe('<rect x="0" y="75" width="200" height="50"></rect>');
  });
});
