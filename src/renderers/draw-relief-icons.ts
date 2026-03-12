import { RELIEF_ATLASES } from "../config/relief-config";
import type { ReliefIcon } from "../modules/relief-generator";
import { generateRelief } from "../modules/relief-generator";
import { TextureAtlasLayer } from "../modules/texture-atlas-layer";
import { byId } from "../utils";

const layer = new TextureAtlasLayer("terrain", RELIEF_ATLASES);

function drawSvg(icons: ReliefIcon[], parentEl: HTMLElement): void {
  parentEl.innerHTML = icons
    .map(
      (r) =>
        `<use href="#${r.icon}" data-id="${r.i}" x="${r.x}" y="${r.y}" width="${r.s}" height="${r.s}"/>`,
    )
    .join("");
}

window.drawRelief = (
  type: "svg" | "webGL" = "webGL",
  parentEl: HTMLElement | undefined = byId("terrain"),
) => {
  if (!parentEl) throw new Error("Relief: parent element not found");
  parentEl.innerHTML = "";
  parentEl.dataset.mode = type;

  const icons = pack.relief?.length ? pack.relief : generateRelief();
  if (!icons.length) return;

  if (type === "svg") {
    drawSvg(icons, parentEl);
  } else {
    layer.draw(icons);
  }
};

window.undrawRelief = () => {
  layer.clear();
  const terrainEl = byId("terrain");
  if (terrainEl) terrainEl.innerHTML = "";
};

declare global {
  var drawRelief: (type?: "svg" | "webGL", parentEl?: HTMLElement) => void;
  var undrawRelief: () => void;
}
