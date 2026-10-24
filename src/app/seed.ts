// The map seed: where it comes from, and the UI to revisit or share it

import Alea from "alea";
import { mapHistory } from "@/model/map-history";
import { Options } from "@/model/options/options-model";
import { Pins } from "@/model/options/pins";
import { Dialog } from "@/ui/dialog/dialog";
import { tip } from "@/ui/tooltips";
import { t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";
import { generateSeed } from "@/utils/probability-utils";
import { regeneratePrompt } from "./lifecycle";

export function setSeed(precreatedSeed?: string): void {
  if (precreatedSeed) options.map.seed = precreatedSeed;
  else {
    const isFirstMap = !mapHistory.length;
    const urlSeed = new URL(window.location.href).searchParams.get("seed");

    if (isFirstMap && urlSeed) {
      const isMfcgSeed = new URL(window.location.href).searchParams.get("from") === "MFCG" && urlSeed.length === 13;
      options.map.seed = isMfcgSeed ? urlSeed.slice(0, -4) : urlSeed;
    } else options.map.seed = generateSeed();
  }

  Math.random = Alea(options.map.seed);
}

/** Regenerate with the seed the user typed into the options panel */
export function generateMapWithSeed(): void {
  const requested = ensureEl<HTMLInputElement>("seedInput").value;
  if (requested === options.map.seed) {
    tip(t("The current map already has this seed"), false, "error");
    return;
  }
  regeneratePrompt({ seed: requested });
}

export function showSeedHistoryDialog(): void {
  const lines = mapHistory.map((entry, index) => {
    const created = new Date(entry.created).toLocaleTimeString();
    const button = /* html */ `<i data-tip="${t("Click to generate a map with this seed")}" data-index="${index}" class="icon-history optionsSeedRestore"></i>`;
    return /* html */ `<li>${t(
      "Seed: {{seed}} {{- restore}}. Size: {{width}}x{{height}}. Template: {{template}}. Created: {{created}}",
      {
        seed: entry.seed,
        restore: button,
        width: entry.width,
        height: entry.height,
        template: entry.template,
        created
      }
    )}</li>`;
  });

  const text = Dialog.message({
    title: t("Seed history"),
    message: /* html */ `<ol style="margin: 0; padding-left: 1.5em">${lines.join("")}</ol>`
  });
  for (const button of text.querySelectorAll<HTMLElement>(".optionsSeedRestore")) {
    button.addEventListener("click", () => restoreSeed(Number(button.dataset.index)));
  }
}

/** Generate a map with a seed from this session's history, restoring the size and template it used */
export function restoreSeed(index: number): void {
  const { seed, width, height, template } = mapHistory[index];
  Options.set(o => (o.generation.template = template));

  if (Pins.has("template")) Pins.clear("template");
  regeneratePrompt({ seed, width, height });
}
