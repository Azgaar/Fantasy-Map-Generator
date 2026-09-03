// The map seed: where it comes from, and the UI to revisit or share it
import { alertDialog } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import { ensureEl } from "@/utils/nodeUtils";
import { isLocked, unlock } from "@/utils/preferences";
import { generateSeed } from "@/utils/probabilityUtils";

/**
 * Resolve the seed for the map about to be generated and reseed the PRNG. The first map of a session
 * honours a `seed` search param (MFCG appends a 4-digit burg id to its 13-char seeds); later ones don't
 */
export function setSeed(precreatedSeed?: string): void {
  if (precreatedSeed) facts.seed = precreatedSeed;
  else {
    const isFirstMap = !mapHistory.length;
    const urlSeed = new URL(window.location.href).searchParams.get("seed");

    if (isFirstMap && urlSeed) {
      const isMfcgSeed = new URL(window.location.href).searchParams.get("from") === "MFCG" && urlSeed.length === 13;
      facts.seed = isMfcgSeed ? urlSeed.slice(0, -4) : urlSeed;
    } else facts.seed = generateSeed();
  }

  Math.random = aleaPRNG(facts.seed);
}

/** Regenerate with the seed the user typed into the options panel */
export function generateMapWithSeed(): void {
  const requested = ensureEl<HTMLInputElement>("seedInput").value;
  if (requested === facts.seed) {
    tip("The current map already has this seed", false, "error");
    return;
  }
  regeneratePrompt({ seed: requested });
}

export function showSeedHistoryDialog(): void {
  const lines = mapHistory.map((entry, index) => {
    const created = new Date(entry.created).toLocaleTimeString();
    const button = /* html */ `<i data-tip="Click to generate a map with this seed" onclick="restoreSeed(${index})" class="icon-history optionsSeedRestore"></i>`;
    return /* html */ `<li>Seed: ${entry.seed} ${button}. Size: ${entry.width}x${entry.height}. Template: ${entry.template}. Created: ${created}</li>`;
  });

  alertDialog({
    title: "Seed history",
    message: /* html */ `<ol style="margin: 0; padding-left: 1.5em">${lines.join("")}</ol>`
  });
}

/** Generate a map with a seed from this session's history, restoring the size and template it used */
export function restoreSeed(index: number): void {
  const { seed, width, height, template } = mapHistory[index];
  facts.heightmap.template = template;

  if (isLocked("template")) unlock("template");
  regeneratePrompt({ seed, width, height });
}

// Legacy seam: the seed history list wires its buttons with an inline onclick
declare global {
  interface Window {
    restoreSeed: typeof restoreSeed;
    generateMapWithSeed: typeof generateMapWithSeed;
    showSeedHistoryDialog: typeof showSeedHistoryDialog;
  }
}
window.restoreSeed = restoreSeed;
window.generateMapWithSeed = generateMapWithSeed;
window.showSeedHistoryDialog = showSeedHistoryDialog;
