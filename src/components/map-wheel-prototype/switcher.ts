// PROTOTYPE — the floating variant switcher. Deliberately ugly so it never reads as part of
// the design being evaluated.
import type { Variant } from "./overlay";

const PARAM = "variant";

export function readVariant(variants: Variant[]): Variant {
  const key = new URLSearchParams(location.search).get(PARAM)?.toUpperCase();
  return variants.find(variant => variant.key === key) || variants[0];
}

export function mountSwitcher(variants: Variant[], onChange: (variant: Variant) => void): void {
  const bar = document.createElement("div");
  bar.id = "mapWheelPrototypeSwitcher";
  bar.innerHTML = /* html */ `
    <button type="button" data-step="-1" title="Previous variant (←)">◀</button>
    <span class="mw-sw-label"></span>
    <button type="button" data-step="1" title="Next variant (→)">▶</button>
    <span class="mw-sw-tag">PROTOTYPE · right-click the map</span>`;
  document.body.append(bar);

  const label = bar.querySelector<HTMLSpanElement>(".mw-sw-label")!;

  const apply = (variant: Variant): void => {
    label.textContent = `${variant.key} — ${variant.name}`;
    const url = new URL(location.href);
    url.searchParams.set(PARAM, variant.key);
    history.replaceState(null, "", url);
    onChange(variant);
  };

  const step = (delta: number): void => {
    const index = variants.indexOf(readVariant(variants));
    apply(variants[(index + delta + variants.length) % variants.length]);
  };

  bar.addEventListener("click", event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-step]");
    if (button) step(Number(button.dataset.step));
  });

  window.addEventListener("keydown", event => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
    if (active instanceof HTMLElement && active.isContentEditable) return;
    step(event.key === "ArrowRight" ? 1 : -1);
  });

  apply(readVariant(variants));
}

export const SWITCHER_CSS = /* css */ `
#mapWheelPrototypeSwitcher {
  position: fixed;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  z-index: 3100;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px 5px 6px;
  border-radius: 999px;
  background: #17161a;
  color: #fff;
  border: 2px solid #ff3d7f;
  box-shadow: 0 6px 22px rgba(0,0,0,0.45);
  font: 12px/1 var(--monospace);
}
#mapWheelPrototypeSwitcher button {
  width: 22px; height: 22px; padding: 0;
  border: 0; border-radius: 50%; cursor: pointer;
  background: #2c2a33; color: #fff; font-size: 10px;
}
#mapWheelPrototypeSwitcher button:hover { background: #ff3d7f; }
#mapWheelPrototypeSwitcher .mw-sw-label { min-width: 168px; text-align: center; font-weight: bold; }
#mapWheelPrototypeSwitcher .mw-sw-tag {
  margin-left: 4px; padding-left: 8px;
  border-left: 1px solid #3a3742;
  font-size: 9.5px; letter-spacing: 0.04em; color: #ff8fb6;
}
`;
