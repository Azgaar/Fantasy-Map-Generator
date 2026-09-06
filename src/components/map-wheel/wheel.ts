// The spin-out renderer. Rendering is a pure fold: walk `path` from the root node list, emit one
// ring per level, carrying the parent's mid-angle forward as the next ring's centre.
//
// Structural changes (`mode`, `path`) redraw in full: at most ~50 sectors are on screen, so diffing
// would buy nothing and costs the clarity of "the DOM is a function of the state". Hover is the one
// exception - it mutates the two elements involved and nothing else. A rebuild would delete the very
// node under the pointer; the mouseleave/mouseenter that follows rebuilds again, and the loop that
// makes both restarts the entry animation and swallows every mouse press.
import { Layers } from "@/components/layers";
import { DRAWER_ID } from "./drawer";
import {
  arcPath,
  bands,
  boxRadius,
  HOVER_GROW,
  labelPoint,
  MAX_DEPTH,
  type Sector,
  sectors,
  spineLine
} from "./geometry";
import { applyPalette, type Palette, readPalette } from "./palette";
import { childrenOf, type DrawerSpec, nodeKind, type WheelNode } from "./types";

const SVG = "http://www.w3.org/2000/svg";

export interface HotRef {
  level: number;
  index: number;
}

export interface WheelState {
  mode: "here" | "menu";
  path: number[];
  /** kept in the state so the keyboard knows where the cursor is; changing it never redraws */
  hot: HotRef | null;
}

export interface WheelRoots {
  menu: () => WheelNode[];
  here: () => WheelNode[];
}

export interface WheelCallbacks {
  /** structural change: mode or path. The caller redraws. */
  onState: (next: WheelState) => void;
  /** hover change only. The caller records it and calls the handle's applyHot - it must not redraw. */
  onHot: (hot: HotRef | null) => void;
  onPanel: (spec: DrawerSpec, sectorMid: number) => void;
  onLeaf: (node: WheelNode) => void;
  onPick: (index: number) => void;
  onToggle: (node: WheelNode) => void;
}

/** What renderWheel hands back so hover can be applied without touching the structure */
export interface WheelHandle {
  applyHot: (hot: HotRef | null) => void;
}

/** The two skins of one sector, computed once at build time so hovering is an attribute write */
interface Painted {
  sector: SVGPathElement;
  label: HTMLElement;
  /** [normal, hovered] */
  d: [string, string];
  fill: [string, string];
  ink: [string, string];
}

interface Level {
  items: WheelNode[];
  ring: Sector[];
  chosen: number | null;
  parentMid: number;
}

/** The fold: root list plus `path` in, one level per open ring out */
export function resolveLevels(roots: WheelRoots, state: WheelState, scale = 1): Level[] {
  const levels: Level[] = [];
  let items = roots[state.mode]();
  let parentMid = 0;

  for (let level = 0; level < MAX_DEPTH && items.length; level++) {
    const chosen = level < state.path.length ? state.path[level] : null;
    const ring = sectors(level, items.length, parentMid, scale);
    levels.push({ items, ring, chosen, parentMid });

    if (chosen === null || !items[chosen]) break;
    const next = childrenOf(items[chosen]);
    if (!next.length) break;
    parentMid = ring[chosen].mid;
    items = next;
  }

  return levels;
}

function fillFor(pal: Palette, node: WheelNode, isChosen: boolean, isHot: boolean, isDim: boolean): string {
  if (isChosen) return pal.fills.chosen;
  if (isHot) return node.danger ? pal.fills.hotDanger : pal.fills.hot;
  if (node.toggle && Layers.isOn(node.toggle)) return pal.fills.layerOn;
  if (isDim) return pal.fills.dim;
  return pal.fills.base;
}

// the light ink is resolved per background, so it has to be picked by the same test that picked the
// fill: a value legible on the chosen fill is not necessarily legible on the danger red
function inkFor(pal: Palette, node: WheelNode, isChosen: boolean, isHot: boolean, isDim: boolean): string {
  if (isChosen) return pal.inks.onChosen;
  if (isHot) return node.danger ? pal.inks.onDanger : pal.inks.onHot;
  if (node.toggle && Layers.isOn(node.toggle)) return pal.inks.layerOn;
  if (isDim) return pal.inks.dim;
  if (node.danger) return pal.inks.danger;
  return pal.inks.base;
}

function noteFor(node: WheelNode): string | null {
  if (node.toggle) return Layers.isOn(node.toggle) ? "on" : "off";
  if (node.note) return node.note;
  return node.children ? "▸" : null;
}

export function renderWheel(
  container: HTMLElement,
  roots: WheelRoots,
  state: WheelState,
  cb: WheelCallbacks,
  scale = 1
): WheelHandle {
  // Everything the ring owns goes, but not the drawer: it is a sibling here and holds live app DOM
  // borrowed out of #options, which a redraw must never carry off.
  for (const child of [...container.children]) if (child.id !== DRAWER_ID) child.remove();
  const levels = resolveLevels(roots, state, scale);
  const pal = readPalette();
  applyPalette(container, pal);

  const radius = boxRadius(scale);
  const box = radius * 2;
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", `${-radius} ${-radius} ${box} ${box}`);
  svg.setAttribute("width", String(box));
  svg.setAttribute("height", String(box));
  svg.setAttribute("class", "mw-svg");
  container.append(svg);

  const labelLayer = document.createElement("div");
  labelLayer.className = "mw-labels";
  container.append(labelLayer);

  const painted = new Map<string, Painted>();
  const table = bands(scale);
  const grow = HOVER_GROW * scale;

  levels.forEach((level, L) => {
    if (L > 0) {
      const { x1, y1, x2, y2 } = spineLine(L, level.parentMid, scale);
      const spine = document.createElementNS(SVG, "line");
      spine.setAttribute("class", "mw-spine");
      for (const [k, v] of Object.entries({ x1, y1, x2, y2 })) spine.setAttribute(k, v.toFixed(2));
      svg.append(spine);
    }

    const [inner, outer] = table[L];
    const deeper = level.chosen !== null;

    level.items.forEach((node, i) => {
      const isChosen = level.chosen === i;
      const isDim = deeper && !isChosen;
      const { from, to, mid } = level.ring[i];
      // the hovered skin, per the spec: the outer radius grows, the inner radius never moves
      const skin: Painted["d"] = [arcPath(inner, outer, from, to), arcPath(inner, outer + grow, from, to)];

      const sector = document.createElementNS(SVG, "path");
      sector.setAttribute("class", "mw-sector");
      sector.setAttribute("d", skin[0]);
      sector.setAttribute("fill", fillFor(pal, node, isChosen, false, isDim));
      sector.setAttribute("stroke", isDim ? pal.edgeDim : pal.edge);
      sector.addEventListener("mouseenter", () => cb.onHot({ level: L, index: i }));
      sector.addEventListener("mouseleave", () => cb.onHot(null));
      sector.addEventListener("click", () => dispatch(levels, state, cb, L, i));
      svg.append(sector);

      // the label sits at the band's mid-radius and stays put under the pointer; only its ink moves
      const [x, y] = labelPoint(mid, inner, outer);
      const label = document.createElement("div");
      label.className = `mw-label ${L === 0 ? "mw-label--root" : ""}`;
      label.style.left = `calc(50% + ${x.toFixed(2)}px)`;
      label.style.top = `calc(50% + ${y.toFixed(2)}px)`;
      label.style.color = inkFor(pal, node, isChosen, false, isDim);

      painted.set(`${L}:${i}`, {
        sector,
        label,
        d: skin,
        fill: [fillFor(pal, node, isChosen, false, isDim), fillFor(pal, node, isChosen, true, isDim)],
        ink: [inkFor(pal, node, isChosen, false, isDim), inkFor(pal, node, isChosen, true, isDim)]
      });

      const icon = document.createElement("i");
      icon.className = node.toggle && !Layers.isOn(node.toggle) ? "icon-eye-off" : node.icon;
      const text = document.createElement("span");
      text.textContent = node.label;
      label.append(icon, text);

      const note = noteFor(node);
      if (note) {
        const noteEl = document.createElement("span");
        noteEl.className = "mw-note";
        noteEl.textContent = note;
        label.append(noteEl);
      }
      labelLayer.append(label);
    });
  });

  renderHub(container, state, cb);
  renderCrumbs(container, roots, state, cb);

  let hot: HotRef | null = null;
  const paint = (ref: HotRef | null, on: boolean): void => {
    const item = ref && painted.get(`${ref.level}:${ref.index}`);
    if (!item) return;
    const skin = on ? 1 : 0;
    item.sector.setAttribute("d", item.d[skin]);
    item.sector.setAttribute("fill", item.fill[skin]);
    item.label.style.color = item.ink[skin];
  };

  const applyHot = (next: HotRef | null): void => {
    paint(hot, false);
    hot = next;
    paint(hot, true);
  };

  applyHot(state.hot);
  return { applyHot };
}

// The spec's click order. A layer toggle wins over everything else so the ring doubles as the
// layer panel's status display: it flips in place and the ring neither changes nor closes.
// Shared by mouse clicks and keyboard Enter so the two input paths cannot disagree.
function dispatch(levels: Level[], state: WheelState, cb: WheelCallbacks, level: number, index: number): void {
  const node = levels[level].items[index];
  const mid = levels[level].ring[index].mid;
  const kind = nodeKind(node);

  if (kind === "toggle") {
    cb.onToggle(node);
    return;
  }
  if (kind === "pick") {
    cb.onPick(node.pick!);
    return;
  }

  const isChosen = levels[level].chosen === index;
  const truncated = state.path.slice(0, level);

  if (kind === "panel") {
    if (isChosen) {
      cb.onState({ ...state, path: truncated, hot: null });
      return;
    }
    cb.onState({ ...state, path: [...truncated, index], hot: null });
    cb.onPanel(node.panel!, mid);
    return;
  }

  if (kind === "children") {
    cb.onState({ ...state, path: isChosen ? truncated : [...truncated, index], hot: null });
    return;
  }

  if (kind === "run") cb.onLeaf(node);
}

/** Arrow keys walk the rings; the wheel is a set of nested lists. Returns true if the key was ours. */
export function handleKey(
  event: KeyboardEvent,
  roots: WheelRoots,
  state: WheelState,
  cb: WheelCallbacks,
  scale = 1
): boolean {
  const levels = resolveLevels(roots, state, scale);
  const level = state.hot?.level ?? 0;
  const ring = levels[level];
  if (!ring) return false;

  // hover moves go through onHot, exactly like the mouse: moving the cursor must not rebuild the DOM
  const move = (index: number) => cb.onHot({ level, index });
  const current = state.hot?.index ?? -1;

  switch (event.key) {
    case "ArrowRight": {
      move(current < 0 ? 0 : (current + 1) % ring.items.length);
      return true;
    }
    case "ArrowLeft": {
      move(current < 0 ? 0 : (current - 1 + ring.items.length) % ring.items.length);
      return true;
    }
    case "ArrowDown": {
      const next = levels[level + 1];
      if (!next) return false;
      cb.onHot({ level: level + 1, index: 0 });
      return true;
    }
    case "ArrowUp": {
      if (level === 0) return false;
      cb.onHot({ level: level - 1, index: state.path[level - 1] ?? 0 });
      return true;
    }
    case "Enter": {
      if (current < 0) return false;
      dispatch(levels, state, cb, level, current);
      return true;
    }
    default:
      return false;
  }
}

function renderHub(container: HTMLElement, state: WheelState, cb: WheelCallbacks): void {
  const hub = document.createElement("div");
  hub.className = "mw-hub";

  for (const mode of ["here", "menu"] as const) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `mw-tab ${state.mode === mode ? "is-active" : ""}`;
    tab.textContent = mode;
    tab.addEventListener("click", () => cb.onState({ mode, path: [], hot: null }));
    hub.append(tab);
  }

  container.append(hub);
}

function renderCrumbs(container: HTMLElement, roots: WheelRoots, state: WheelState, cb: WheelCallbacks): void {
  const bar = document.createElement("div");
  bar.className = "mw-crumbs";

  const labels = [state.mode === "menu" ? "Menu" : "Here"];
  let items = roots[state.mode]();
  for (const index of state.path) {
    const node = items[index];
    if (!node) break;
    labels.push(node.label);
    items = childrenOf(node);
  }

  labels.forEach((text, depth) => {
    if (depth > 0) {
      const sep = document.createElement("span");
      sep.className = "mw-crumb-sep";
      sep.textContent = "›";
      bar.append(sep);
    }
    const crumb = document.createElement("span");
    crumb.className = `mw-crumb ${depth === labels.length - 1 ? "is-last" : ""}`;
    crumb.textContent = text;
    crumb.addEventListener("click", () => cb.onState({ ...state, path: state.path.slice(0, depth), hot: null }));
    bar.append(crumb);
  });

  container.append(bar);
}
