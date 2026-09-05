// PROTOTYPE — Variant A: one ring of action sectors around the cursor.
// The bet: context is *one* thing. Show the primary target's actions flat, and let
// "More…" swap the ring in place for the other entities under the cursor.
import type { WheelAction, WheelContext, WheelTarget } from "./context";
import type { Variant } from "./overlay";

const R_INNER = 52;
const R_OUTER = 132;
const R_ICON = (R_INNER + R_OUTER) / 2;

interface Sector {
  label: string;
  sublabel: string;
  icon: string;
  danger?: boolean;
  run: () => void;
}

function render(ctx: WheelContext, host: HTMLElement, close: () => void): void {
  const wheel = document.createElement("div");
  wheel.className = "mw-radial mw-pop";
  host.append(wheel);

  // keep the whole ring on screen
  const cx = Math.min(Math.max(ctx.screen[0], R_OUTER + 8), innerWidth - R_OUTER - 8);
  const cy = Math.min(Math.max(ctx.screen[1], R_OUTER + 8), innerHeight - R_OUTER - 8);
  wheel.style.left = `${cx}px`;
  wheel.style.top = `${cy}px`;

  const drawTarget = (target: WheelTarget, isDrilled: boolean): void => {
    const sectors: Sector[] = target.actions.map((action: WheelAction) => ({
      label: action.label,
      sublabel: action.hint || target.kind,
      icon: action.icon,
      danger: action.danger,
      run: () => {
        close();
        action.run();
      }
    }));

    const others = ctx.targets.filter(other => other !== target);
    if (isDrilled) {
      sectors.push({
        label: "Back",
        sublabel: "to primary",
        icon: "icon-left-open",
        run: () => drawTarget(ctx.targets[0], false)
      });
    } else if (others.length) {
      sectors.push({
        label: "More…",
        sublabel: `${others.length} more here`,
        icon: "icon-dot-3",
        run: () => drawOthers(others)
      });
    }

    paint(wheel, sectors, target.name, target.kind);
  };

  const drawOthers = (others: WheelTarget[]): void => {
    const sectors: Sector[] = others.map(target => ({
      label: target.name,
      sublabel: target.kind,
      icon: target.icon,
      run: () => drawTarget(target, true)
    }));
    sectors.push({
      label: "Back",
      sublabel: "to actions",
      icon: "icon-left-open",
      run: () => drawTarget(ctx.targets[0], false)
    });
    paint(wheel, sectors, "What here?", `${others.length} entities`);
  };

  drawTarget(ctx.targets[0], false);
}

/** Redraw the ring in place — the whole point of this variant is that it never stacks */
function paint(wheel: HTMLElement, sectors: Sector[], hubTitle: string, hubSub: string): void {
  wheel.replaceChildren();

  const size = R_OUTER * 2;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `${-R_OUTER} ${-R_OUTER} ${size} ${size}`);
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.classList.add("mw-radial-svg");
  wheel.append(svg);

  const step = (Math.PI * 2) / sectors.length;
  const gap = 0.018;

  const hub = document.createElement("div");
  hub.className = "mw-radial-hub";
  hub.innerHTML = `<b>${hubTitle}</b><span>${hubSub}</span>`;
  wheel.append(hub);

  sectors.forEach((sector, i) => {
    const from = i * step - Math.PI / 2 + gap;
    const to = from + step - gap * 2;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", arc(from, to));
    path.setAttribute("class", `mw-radial-sector${sector.danger ? " is-danger" : ""}`);
    svg.append(path);

    const mid = (from + to) / 2;
    const label = document.createElement("button");
    label.type = "button";
    label.className = `mw-radial-item${sector.danger ? " is-danger" : ""}`;
    label.style.setProperty("--x", `${Math.cos(mid) * R_ICON}px`);
    label.style.setProperty("--y", `${Math.sin(mid) * R_ICON}px`);
    label.innerHTML = `<i class="${sector.icon}"></i><span>${sector.label}</span>`;
    wheel.append(label);

    const enter = (): void => {
      path.classList.add("is-hot");
      label.classList.add("is-hot");
      hub.innerHTML = `<b>${sector.label}</b><span>${sector.sublabel}</span>`;
    };
    const leave = (): void => {
      path.classList.remove("is-hot");
      label.classList.remove("is-hot");
      hub.innerHTML = `<b>${hubTitle}</b><span>${hubSub}</span>`;
    };

    for (const node of [path, label]) {
      node.addEventListener("mouseenter", enter);
      node.addEventListener("mouseleave", leave);
      node.addEventListener("click", sector.run);
    }
  });
}

function arc(from: number, to: number): string {
  const large = to - from > Math.PI ? 1 : 0;
  const p = (r: number, a: number) => `${Math.cos(a) * r} ${Math.sin(a) * r}`;
  return `M ${p(R_INNER, from)} L ${p(R_OUTER, from)} A ${R_OUTER} ${R_OUTER} 0 ${large} 1 ${p(R_OUTER, to)} L ${p(R_INNER, to)} A ${R_INNER} ${R_INNER} 0 ${large} 0 ${p(R_INNER, from)} Z`;
}

const css = /* css */ `
.mw-radial { position: absolute; translate: -50% -50%; }
.mw-radial-svg { display: block; overflow: visible; filter: drop-shadow(0 6px 18px rgba(0,0,0,0.35)); }
.mw-radial-sector {
  fill: rgba(252, 250, 244, 0.97);
  stroke: rgba(90, 74, 48, 0.35);
  stroke-width: 1;
  cursor: pointer;
  transition: fill 90ms;
}
.mw-radial-sector.is-hot { fill: #6b5535; }
.mw-radial-sector.is-danger.is-hot { fill: #a33a2e; }
.mw-radial-item {
  position: absolute;
  left: calc(50% + var(--x));
  top: calc(50% + var(--y));
  transform: translate(-50%, -50%);
  width: 74px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  border: 0;
  background: none;
  color: #3b3226;
  font-size: 10.5px;
  line-height: 1.15;
  text-align: center;
  cursor: pointer;
  pointer-events: none;
}
.mw-radial-item i { font-size: 17px; }
.mw-radial-item.is-danger { color: #8d2f24; }
.mw-radial-item.is-hot, .mw-radial-item.is-hot.is-danger { color: #fffdf7; }
.mw-radial-hub {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: ${R_INNER * 2 - 6}px;
  height: ${R_INNER * 2 - 6}px;
  border-radius: 50%;
  background: #6b5535;
  color: #fdfbf6;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px;
  box-sizing: border-box;
  text-align: center;
  pointer-events: none;
  box-shadow: 0 4px 14px rgba(0,0,0,0.3);
}
.mw-radial-hub b { font-size: 11px; line-height: 1.2; }
.mw-radial-hub span { font-size: 9px; opacity: 0.75; }
`;

export const variantRadial: Variant = { key: "A", name: "Radial ring", css, render };
