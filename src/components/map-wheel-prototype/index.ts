// PROTOTYPE — Map Wheel. Four structurally different right-click menus on the real map,
// switchable via `?variant=` and the floating bottom bar. See README.md.
// Mounted from src/components/index.ts behind import.meta.env.DEV — never ships.
import { resolveContext } from "./context";
import { closeOverlay, HOST_CSS, injectCss, isOpen, openOverlay, type Variant } from "./overlay";
import { mountSwitcher, SWITCHER_CSS } from "./switcher";
import { variantMarking } from "./variant-marking";
import { variantOrbit } from "./variant-orbit";
import { variantPanel } from "./variant-panel";
import { variantRadial } from "./variant-radial";

const VARIANTS: Variant[] = [variantRadial, variantOrbit, variantMarking, variantPanel];

let active: Variant = VARIANTS[0];

function onContextMenu(event: MouseEvent): void {
  // stay out of the way of modes that already claim right-click (customization, path drawing)
  if (customization) return;
  if (!(event.target as Element)?.closest("#map")) return;

  event.preventDefault();
  event.stopPropagation();

  const ctx = resolveContext(event);
  if (!ctx) return;
  openOverlay(active, ctx);
}

function mount(): void {
  injectCss("host", HOST_CSS);
  injectCss("switcher", SWITCHER_CSS);
  mountSwitcher(VARIANTS, variant => {
    active = variant;
    closeOverlay();
  });

  document.addEventListener("contextmenu", onContextMenu, true);
  // a left-click on the map while the menu is up should just dismiss it
  document.addEventListener(
    "pointerdown",
    event => {
      if (isOpen() && !(event.target as Element)?.closest("#mapWheelPrototypeHost")) closeOverlay();
    },
    true
  );
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
else mount();
