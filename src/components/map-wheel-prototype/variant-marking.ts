// PROTOTYPE — Variant C: a marking menu. Nothing is drawn on press. Flick in a direction
// and release and the action fires immediately; hold still for 260ms and the compass fades in.
// The bet: a menu used hundreds of times a session should reward muscle memory over browsing.
import type { WheelAction, WheelContext, WheelTarget } from "./context";
import type { Variant } from "./overlay";

const REVEAL_DELAY = 260;
const DEAD_ZONE = 26;
const R_SLOT = 108;
const SLOTS = 8;

interface Slot {
  label: string;
  kind: string;
  icon: string;
  danger?: boolean;
  run: () => void;
}

function render(ctx: WheelContext, host: HTMLElement, close: () => void): void {
  const slots = pickSlots(ctx);
  const [ox, oy] = ctx.screen;

  const layer = document.createElement("div");
  layer.className = "mw-mark";
  layer.style.left = `${ox}px`;
  layer.style.top = `${oy}px`;
  host.append(layer);

  const trail = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  trail.setAttribute("class", "mw-mark-trail");
  trail.setAttribute("viewBox", "-400 -400 800 800");
  trail.setAttribute("width", "800");
  trail.setAttribute("height", "800");
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", "0");
  line.setAttribute("y1", "0");
  trail.append(line);
  layer.append(trail);

  const nub = document.createElement("div");
  nub.className = "mw-mark-nub";
  layer.append(nub);

  const readout = document.createElement("div");
  readout.className = "mw-mark-readout";
  readout.textContent = "flick a direction";
  layer.append(readout);

  const petals = slots.map((slot, i) => {
    const angle = (i / SLOTS) * Math.PI * 2 - Math.PI / 2;
    const petal = document.createElement("div");
    petal.className = `mw-mark-petal${slot.danger ? " is-danger" : ""}`;
    petal.style.setProperty("--x", `${Math.cos(angle) * R_SLOT}px`);
    petal.style.setProperty("--y", `${Math.sin(angle) * R_SLOT}px`);
    petal.innerHTML = `<i class="${slot.icon}"></i><b>${slot.label}</b><small>${slot.kind}</small>`;
    layer.append(petal);
    return petal;
  });

  let revealed = false;
  const revealTimer = window.setTimeout(() => {
    revealed = true;
    layer.classList.add("is-revealed");
    readout.textContent = "pick a direction";
  }, REVEAL_DELAY);

  let active = -1;

  const setActive = (index: number): void => {
    if (index === active) return;
    active = index;
    petals.forEach((petal, i) => {
      petal.classList.toggle("is-active", i === index);
    });
    readout.textContent = index < 0 ? (revealed ? "pick a direction" : "flick a direction") : slots[index].label;
    readout.classList.toggle("is-armed", index >= 0);
  };

  const onMove = (event: PointerEvent): void => {
    const dx = event.clientX - ox;
    const dy = event.clientY - oy;
    const dist = Math.hypot(dx, dy);

    line.setAttribute("x2", String(dx));
    line.setAttribute("y2", String(dy));
    line.classList.toggle("is-armed", dist >= DEAD_ZONE);

    if (dist < DEAD_ZONE) {
      setActive(-1);
      return;
    }
    const angle = Math.atan2(dy, dx) + Math.PI / 2;
    setActive(Math.round((angle / (Math.PI * 2)) * SLOTS + SLOTS) % SLOTS);
  };

  const commit = (): void => {
    const chosen = active >= 0 ? slots[active] : null;
    window.clearTimeout(revealTimer);
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerup", onUp, true);
    close();
    chosen?.run();
  };

  // release outside the dead zone = the flick. Release inside it just leaves the compass up.
  const onUp = (event: PointerEvent): void => {
    if (Math.hypot(event.clientX - ox, event.clientY - oy) < DEAD_ZONE) {
      revealed = true;
      layer.classList.add("is-revealed");
      window.clearTimeout(revealTimer);
      // switch to click-to-pick once the flick has been abandoned
      window.removeEventListener("pointerup", onUp, true);
      petals.forEach((petal, i) => {
        petal.addEventListener("click", () => {
          setActive(i);
          commit();
        });
      });
      return;
    }
    commit();
  };

  window.addEventListener("pointermove", onMove, true);
  window.addEventListener("pointerup", onUp, true);
}

/** Flatten the context into at most 8 compass slots, best-first, one per direction */
function pickSlots(ctx: WheelContext): Slot[] {
  const toSlot = (target: WheelTarget, action: WheelAction): Slot => ({
    label: action.label,
    kind: target.kind,
    icon: action.icon,
    danger: action.danger,
    run: action.run
  });

  const slots: Slot[] = [];
  // round-robin across targets so the compass never spends all 8 slots on one entity
  for (let rank = 0; slots.length < SLOTS; rank++) {
    const before = slots.length;
    for (const target of ctx.targets) {
      const action = target.actions[rank];
      if (action && slots.length < SLOTS) slots.push(toSlot(target, action));
    }
    if (slots.length === before) break;
  }
  return slots;
}

const css = /* css */ `
.mw-mark { position: absolute; translate: -50% -50%; pointer-events: none; }
.mw-mark-trail { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); overflow: visible; pointer-events: none; }
.mw-mark-trail line { stroke: rgba(40, 40, 40, 0.35); stroke-width: 2; stroke-linecap: round; stroke-dasharray: 4 4; }
.mw-mark-trail line.is-armed { stroke: #b8552f; stroke-width: 3; stroke-dasharray: none; }
.mw-mark-nub {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: 12px; height: 12px; border-radius: 50%;
  background: #b8552f; box-shadow: 0 0 0 3px rgba(255,255,255,0.85);
  pointer-events: none;
}
.mw-mark-readout {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, calc(-50% + 26px));
  padding: 3px 9px; border-radius: 11px; white-space: nowrap;
  background: rgba(28, 26, 22, 0.82); color: #fdf8ee;
  font-size: 10.5px; letter-spacing: 0.02em; pointer-events: none;
}
.mw-mark-readout.is-armed { background: #b8552f; font-weight: bold; }
.mw-mark-petal {
  position: absolute;
  left: calc(50% + var(--x));
  top: calc(50% + var(--y));
  transform: translate(-50%, -50%) scale(0.8);
  width: 92px; padding: 6px 4px; box-sizing: border-box;
  display: flex; flex-direction: column; align-items: center; gap: 1px;
  border-radius: 8px; background: rgba(253, 250, 243, 0.97);
  border: 1px solid rgba(90, 74, 48, 0.28);
  box-shadow: 0 4px 12px rgba(0,0,0,0.22);
  color: #332e26; font-size: 10px; line-height: 1.15; text-align: center;
  opacity: 0; pointer-events: none;
  transition: opacity 120ms, transform 120ms, background 90ms;
}
.mw-mark.is-revealed .mw-mark-petal { opacity: 1; transform: translate(-50%, -50%) scale(1); pointer-events: auto; cursor: pointer; }
.mw-mark-petal i { font-size: 15px; }
.mw-mark-petal b { font-weight: 600; }
.mw-mark-petal small { font-size: 8px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.55; }
.mw-mark-petal.is-danger { color: #8d2f24; }
.mw-mark-petal.is-active {
  background: #b8552f; color: #fffdf7; border-color: #8f3f21;
  opacity: 1; transform: translate(-50%, -50%) scale(1.08);
}
.mw-mark-petal.is-active small { opacity: 0.8; }
`;

export const variantMarking: Variant = { key: "C", name: "Marking menu", css, render };
