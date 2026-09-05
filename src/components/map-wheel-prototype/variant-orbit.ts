// PROTOTYPE — Variant B: two tiers, both visible at once.
// The bet: the hard part is that a burg, a province, a state, a market and a cell all sit
// under one click. So the inner ring picks *which entity*; the outer band shows its actions.
import type { WheelContext, WheelTarget } from "./context";
import type { Variant } from "./overlay";

const R_TARGET = 84; // orbit of the entity discs
const R_ACTION_IN = 122;
const R_ACTION_OUT = 188;
const R_ACTION_LABEL = 156;

function render(ctx: WheelContext, host: HTMLElement, close: () => void): void {
  const wheel = document.createElement("div");
  wheel.className = "mw-orbit mw-pop";
  host.append(wheel);

  const cx = Math.min(Math.max(ctx.screen[0], R_ACTION_OUT + 8), innerWidth - R_ACTION_OUT - 8);
  const cy = Math.min(Math.max(ctx.screen[1], R_ACTION_OUT + 8), innerHeight - R_ACTION_OUT - 8);
  wheel.style.left = `${cx}px`;
  wheel.style.top = `${cy}px`;

  const size = R_ACTION_OUT * 2;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `${-R_ACTION_OUT} ${-R_ACTION_OUT} ${size} ${size}`);
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.classList.add("mw-orbit-svg");
  wheel.append(svg);

  const actionLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svg.append(actionLayer);

  const actionLabels = document.createElement("div");
  actionLabels.className = "mw-orbit-actions";
  wheel.append(actionLabels);

  const core = document.createElement("div");
  core.className = "mw-orbit-core";
  wheel.append(core);

  const targets = ctx.targets;
  const discs: HTMLButtonElement[] = [];

  const selectTarget = (target: WheelTarget, index: number): void => {
    discs.forEach((disc, i) => {
      disc.classList.toggle("is-active", i === index);
    });
    core.innerHTML = `<b>${target.name}</b><span>${target.kind}</span><em>${target.subtitle}</em>`;
    paintActions(target);
  };

  const paintActions = (target: WheelTarget): void => {
    actionLayer.replaceChildren();
    actionLabels.replaceChildren();

    const step = (Math.PI * 2) / target.actions.length;
    const gap = 0.02;

    target.actions.forEach((action, i) => {
      const from = i * step - Math.PI / 2 + gap;
      const to = from + step - gap * 2;

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", arc(from, to, R_ACTION_IN, R_ACTION_OUT));
      path.setAttribute("class", `mw-orbit-sector${action.danger ? " is-danger" : ""}`);
      actionLayer.append(path);

      const mid = (from + to) / 2;
      const label = document.createElement("div");
      label.className = `mw-orbit-label${action.danger ? " is-danger" : ""}`;
      label.style.setProperty("--x", `${Math.cos(mid) * R_ACTION_LABEL}px`);
      label.style.setProperty("--y", `${Math.sin(mid) * R_ACTION_LABEL}px`);
      label.innerHTML = `<i class="${action.icon}"></i><span>${action.label}</span>`;
      actionLabels.append(label);

      path.addEventListener("mouseenter", () => {
        path.classList.add("is-hot");
        label.classList.add("is-hot");
      });
      path.addEventListener("mouseleave", () => {
        path.classList.remove("is-hot");
        label.classList.remove("is-hot");
      });
      path.addEventListener("click", () => {
        close();
        action.run();
      });
    });
  };

  // inner tier: one disc per entity found under the cursor
  const targetStep = (Math.PI * 2) / targets.length;
  targets.forEach((target, i) => {
    const angle = i * targetStep - Math.PI / 2;
    const disc = document.createElement("button");
    disc.type = "button";
    disc.className = "mw-orbit-target";
    disc.style.setProperty("--x", `${Math.cos(angle) * R_TARGET}px`);
    disc.style.setProperty("--y", `${Math.sin(angle) * R_TARGET}px`);
    disc.innerHTML = `<i class="${target.icon}"></i><small>${target.kind}</small>`;
    disc.addEventListener("mouseenter", () => selectTarget(target, i));
    disc.addEventListener("click", () => selectTarget(target, i));
    wheel.append(disc);
    discs.push(disc);
  });

  selectTarget(targets[0], 0);
}

function arc(from: number, to: number, rIn: number, rOut: number): string {
  const large = to - from > Math.PI ? 1 : 0;
  const p = (r: number, a: number) => `${Math.cos(a) * r} ${Math.sin(a) * r}`;
  return `M ${p(rIn, from)} L ${p(rOut, from)} A ${rOut} ${rOut} 0 ${large} 1 ${p(rOut, to)} L ${p(rIn, to)} A ${rIn} ${rIn} 0 ${large} 0 ${p(rIn, from)} Z`;
}

const css = /* css */ `
.mw-orbit { position: absolute; translate: -50% -50%; }
.mw-orbit-svg { display: block; overflow: visible; filter: drop-shadow(0 8px 22px rgba(0,0,0,0.32)); }
.mw-orbit-sector {
  fill: rgba(247, 244, 236, 0.96);
  stroke: rgba(80, 66, 44, 0.28);
  stroke-width: 1;
  cursor: pointer;
  transition: fill 90ms;
}
.mw-orbit-sector.is-hot { fill: #3f6b58; }
.mw-orbit-sector.is-danger.is-hot { fill: #a33a2e; }
.mw-orbit-actions { position: absolute; inset: 0; pointer-events: none; }
.mw-orbit-label {
  position: absolute;
  left: calc(50% + var(--x));
  top: calc(50% + var(--y));
  transform: translate(-50%, -50%);
  width: 78px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  line-height: 1.15;
  text-align: center;
  color: #342f26;
}
.mw-orbit-label i { font-size: 15px; }
.mw-orbit-label.is-danger { color: #8d2f24; }
.mw-orbit-label.is-hot, .mw-orbit-label.is-hot.is-danger { color: #fffdf7; }
.mw-orbit-target {
  position: absolute;
  left: calc(50% + var(--x));
  top: calc(50% + var(--y));
  transform: translate(-50%, -50%);
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 1.5px solid rgba(63, 107, 88, 0.45);
  background: #fffdf7;
  color: #3f6b58;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(0,0,0,0.22);
  transition: transform 110ms, background 110ms;
}
.mw-orbit-target i { font-size: 15px; }
.mw-orbit-target small { font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.03em; opacity: 0.75; }
.mw-orbit-target.is-active {
  background: #3f6b58;
  color: #fffdf7;
  transform: translate(-50%, -50%) scale(1.14);
}
.mw-orbit-core {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 104px;
  text-align: center;
  pointer-events: none;
  color: #2c2822;
  text-shadow: 0 1px 0 rgba(255,255,255,0.9), 0 0 6px rgba(255,255,255,0.9);
}
.mw-orbit-core b { display: block; font-size: 12px; line-height: 1.2; }
.mw-orbit-core span { display: block; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.6; }
.mw-orbit-core em { display: block; font-size: 9px; font-style: normal; opacity: 0.65; margin-top: 3px; }
`;

export const variantOrbit: Variant = { key: "B", name: "Orbit (target-first)", css, render };
