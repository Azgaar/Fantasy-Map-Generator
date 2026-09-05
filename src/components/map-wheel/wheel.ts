// The wheel itself: one ring of sectors around the click, and a hub that names the subject.
//
// The ring shows exactly one subject's actions. Everything else the click could have been about
// lives one hop away behind the hub, so the ring never stacks and never grows a submenu. Swapping
// between the two is a zoom: out to the list of subjects, back in to the one you picked.
import type { WheelContext } from "./context";

const R_INNER = 60;
const R_OUTER = 150;
const R_LABEL = (R_INNER + R_OUTER) / 2;
const R_BOX = R_OUTER + 9; // half the wheel's square box; leaves room for the verb ticks
const GAP = 0.042; // radians trimmed from each end of a sector
const LIFT = 4; // px a hovered sector moves outward
const MARGIN = 10;
const SWAP_MS = 180; // must match the ring swap animations in styles.ts

/** Which way the ring is being swapped: out to the subject list, or back in to one subject */
type Motion = "none" | "out" | "in";

interface Slice {
  label: string;
  icon: string;
  detail: string;
  run: () => void;
  /** sectors are ruled off where the verb changes, so groups read as arcs */
  breakBefore: boolean;
}

export function drawWheel(host: HTMLElement, ctx: WheelContext, close: () => void): void {
  const origin = document.createElement("div");
  origin.className = "mw-origin";
  origin.style.left = `${ctx.screen[0]}px`;
  origin.style.top = `${ctx.screen[1]}px`;
  host.append(origin);

  const wheel = document.createElement("div");
  wheel.className = "mw-wheel";
  wheel.style.setProperty("--mw-size", `${R_BOX * 2}px`);
  wheel.style.left = `${clamp(ctx.screen[0], innerWidth)}px`;
  wheel.style.top = `${clamp(ctx.screen[1], innerHeight)}px`;
  host.append(wheel);

  let subject = ctx.subjects[0];

  const showActions = (motion: Motion): void => {
    const slices = subject.actions.map((action, i) => ({
      label: action.label,
      icon: action.icon,
      breakBefore: i > 0 && action.verb !== subject.actions[i - 1].verb,
      detail: subject.name,
      run: () => {
        close();
        action.run();
      }
    }));

    paint(wheel, slices, motion, {
      kind: subject.kind,
      name: subject.name,
      detail: subject.detail,
      pips: ctx.subjects.length > 1 ? { total: ctx.subjects.length, active: ctx.subjects.indexOf(subject) } : null,
      onHub: ctx.subjects.length > 1 ? showSubjects : null
    });
  };

  const showSubjects = (): void => {
    const slices = ctx.subjects.map(candidate => ({
      label: candidate.name,
      icon: candidate.icon,
      detail: candidate.kind,
      breakBefore: false,
      run: () => {
        subject = candidate;
        showActions("in");
      }
    }));

    paint(wheel, slices, "out", {
      kind: `${ctx.subjects.length} here`,
      name: "What is this?",
      detail: "pick a subject",
      pips: null,
      onHub: () => showActions("in")
    });
  };

  showActions("none");
}

interface Hub {
  kind: string;
  name: string;
  detail: string;
  pips: { total: number; active: number } | null;
  onHub: (() => void) | null;
}

/**
 * Build a ring and cross-fade it over whatever ring is already there. Each ring owns its own
 * listeners and focus, so the outgoing one stops responding the moment it leaves.
 */
function paint(wheel: HTMLElement, slices: Slice[], motion: Motion, hub: Hub): void {
  const ring = document.createElement("div");
  ring.className = "mw-ring";
  ring.tabIndex = -1;

  const size = R_BOX * 2;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `${-R_BOX} ${-R_BOX} ${size} ${size}`);
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  ring.append(svg);

  const step = (Math.PI * 2) / slices.length;
  const items: HTMLElement[] = [];
  const sectors: SVGPathElement[] = [];
  const lifts: Array<[string, string]> = [];
  let hot = -1;

  // the ring starts half a sector before 12 o'clock, so the first action is centred at the top
  const start = -Math.PI / 2 - step / 2;

  slices.forEach((slice, i) => {
    const from = start + i * step + GAP;
    const to = from + step - GAP * 2;
    const mid = (from + to) / 2;

    const sector = document.createElementNS("http://www.w3.org/2000/svg", "path");
    sector.setAttribute("class", "mw-sector");
    sector.setAttribute("d", arc(from, to));
    svg.append(sector);
    sectors.push(sector);

    // a tick wherever the verb changes: the ring is grouped, not just divided
    if (slice.breakBefore) {
      const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
      const edge = from - GAP;
      tick.setAttribute("class", "mw-verb-tick");
      tick.setAttribute("x1", String(Math.cos(edge) * (R_OUTER + 2)));
      tick.setAttribute("y1", String(Math.sin(edge) * (R_OUTER + 2)));
      tick.setAttribute("x2", String(Math.cos(edge) * R_BOX));
      tick.setAttribute("y2", String(Math.sin(edge) * R_BOX));
      svg.append(tick);
    }

    const item = document.createElement("div");
    item.className = "mw-item";
    item.style.setProperty("--x", `${Math.cos(mid) * R_LABEL}px`);
    item.style.setProperty("--y", `${Math.sin(mid) * R_LABEL}px`);
    item.innerHTML = `<i class="${slice.icon}"></i><span>${escapeHtml(slice.label)}</span>`;
    ring.append(item);
    items.push(item);

    lifts.push([`${(Math.cos(mid) * LIFT).toFixed(2)}px`, `${(Math.sin(mid) * LIFT).toFixed(2)}px`]);
    sector.addEventListener("mouseenter", () => setHot(i));
    sector.addEventListener("mouseleave", () => setHot(-1));
    sector.addEventListener("click", slice.run);
  });

  const hubEl = document.createElement("button");
  hubEl.type = "button";
  hubEl.className = "mw-hub";
  hubEl.style.width = `${R_INNER * 2 - 8}px`;
  hubEl.style.height = `${R_INNER * 2 - 8}px`;
  hubEl.innerHTML =
    `<span class="mw-hub-kind">${escapeHtml(hub.kind)}</span>` +
    `<span class="mw-hub-name">${escapeHtml(hub.name)}</span>` +
    `<span class="mw-hub-detail">${escapeHtml(hub.detail)}</span>` +
    (hub.pips ? pips(hub.pips) : "");
  ring.append(hubEl);

  if (hub.onHub) hubEl.addEventListener("click", hub.onHub);
  else hubEl.disabled = true;

  function setHot(index: number): void {
    if (index === hot) return;
    hot = index;

    sectors.forEach((sector, i) => {
      const on = i === index;
      const [dx, dy] = lifts[i];
      sector.classList.toggle("is-hot", on);
      sector.style.translate = on ? `${dx} ${dy}` : "";
      items[i].classList.toggle("is-hot", on);
      items[i].style.translate = on ? `calc(-50% + ${dx}) calc(-50% + ${dy})` : "";
    });

    const slice = slices[index];
    hubEl.querySelector(".mw-hub-name")!.textContent = slice ? slice.label : hub.name;
    hubEl.querySelector(".mw-hub-detail")!.textContent = slice ? slice.detail : hub.detail;
  }

  // keyboard: the ring is a list, so step around it and commit with Enter
  ring.addEventListener("keydown", event => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") setHot((hot + 1) % slices.length);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") setHot((hot - 1 + slices.length) % slices.length);
    else if (event.key === "Enter" && hot >= 0) slices[hot].run();
    else if (event.key === "Tab" && hub.onHub) hub.onHub();
    else return;
    event.preventDefault();
    event.stopPropagation();
  });

  swap(wheel, ring, motion);
  ring.focus({ preventScroll: true });
}

/** Cross-fade the new ring over the old one, zooming in the direction of travel */
function swap(wheel: HTMLElement, ring: HTMLElement, motion: Motion): void {
  for (const stale of wheel.querySelectorAll(".mw-ring.is-leaving")) stale.remove();

  const previous = wheel.querySelector<HTMLElement>(".mw-ring");
  wheel.append(ring);
  if (!previous || motion === "none") {
    previous?.remove();
    return;
  }

  previous.classList.remove("is-entering-out", "is-entering-in");
  previous.classList.add("is-leaving", `is-leaving-${motion}`);
  ring.classList.add(`is-entering-${motion}`);

  // animationend alone is not enough: it never fires for an animation the browser skipped
  // (a backgrounded tab, reduced motion), which would strand the old ring on top of the new one
  const drop = (): void => previous.remove();
  previous.addEventListener("animationend", drop, { once: true });
  setTimeout(drop, SWAP_MS + 60);
}

const pips = ({ total, active }: { total: number; active: number }): string =>
  `<span class="mw-hub-pips">${Array.from({ length: total }, (_, i) => `<span class="${i === active ? "is-on" : ""}"></span>`).join("")}</span>`;

/** An annulus wedge from `from` to `to` */
function arc(from: number, to: number): string {
  const large = to - from > Math.PI ? 1 : 0;
  const p = (r: number, a: number) => `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
  return (
    `M ${p(R_INNER, from)} L ${p(R_OUTER, from)}` +
    ` A ${R_OUTER} ${R_OUTER} 0 ${large} 1 ${p(R_OUTER, to)}` +
    ` L ${p(R_INNER, to)}` +
    ` A ${R_INNER} ${R_INNER} 0 ${large} 0 ${p(R_INNER, from)} Z`
  );
}

const clamp = (value: number, extent: number): number =>
  Math.min(Math.max(value, R_BOX + MARGIN), Math.max(R_BOX + MARGIN, extent - R_BOX - MARGIN));

function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}
