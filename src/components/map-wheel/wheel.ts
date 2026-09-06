// The spin-out renderer. Rendering is a pure fold: walk `path` from the root node list, emit one
// ring per level, carrying the parent's mid-angle forward as the next ring's centre.
//
// Redraws in full on every state change. At most ~50 sectors are on screen, so diffing would buy
// nothing and cost the clarity of "the DOM is a function of the state".
import { Layers } from "@/components/layers";
import { arcPath, BANDS, HOVER_GROW, labelPoint, MAX_DEPTH, type Sector, sectors, spineLine } from "./geometry";
import { childrenOf, type DrawerSpec, nodeKind, type WheelNode } from "./types";

const SVG = "http://www.w3.org/2000/svg";

export const FILLS = {
  chosen: "#4a3a22",
  hot: "#6b5535",
  hotDanger: "#a33a2e",
  layerOn: "#8a9c6c",
  dim: "rgba(251,247,236,.82)",
  base: "rgba(251,247,236,.97)"
} as const;

export const INKS = {
  light: "#fffdf7",
  layerOn: "#20261a",
  danger: "#8d2f24",
  dim: "rgba(59,50,38,.82)",
  base: "#3b3226"
} as const;

const EDGE = "rgba(90,74,48,.32)";
const EDGE_DIM = "rgba(90,74,48,.16)";

export interface WheelState {
  mode: "here" | "menu";
  path: number[];
  hot: { level: number; index: number } | null;
}

export interface WheelRoots {
  menu: () => WheelNode[];
  here: () => WheelNode[];
}

export interface WheelCallbacks {
  onState: (next: WheelState) => void;
  onPanel: (spec: DrawerSpec, sectorMid: number) => void;
  onLeaf: (node: WheelNode) => void;
  onPick: (index: number) => void;
  onToggle: (node: WheelNode) => void;
}

interface Level {
  items: WheelNode[];
  ring: Sector[];
  chosen: number | null;
  parentMid: number;
}

/** The fold: root list plus `path` in, one level per open ring out */
export function resolveLevels(roots: WheelRoots, state: WheelState): Level[] {
  const levels: Level[] = [];
  let items = roots[state.mode]();
  let parentMid = 0;

  for (let level = 0; level < MAX_DEPTH && items.length; level++) {
    const chosen = level < state.path.length ? state.path[level] : null;
    const ring = sectors(level, items.length, parentMid);
    levels.push({ items, ring, chosen, parentMid });

    if (chosen === null || !items[chosen]) break;
    const next = childrenOf(items[chosen]);
    if (!next.length) break;
    parentMid = ring[chosen].mid;
    items = next;
  }

  return levels;
}

function fillFor(node: WheelNode, isChosen: boolean, isHot: boolean, isDim: boolean): string {
  if (isChosen) return FILLS.chosen;
  if (isHot) return node.danger ? FILLS.hotDanger : FILLS.hot;
  if (node.toggle && Layers.isOn(node.toggle)) return FILLS.layerOn;
  if (isDim) return FILLS.dim;
  return FILLS.base;
}

function inkFor(node: WheelNode, isChosen: boolean, isHot: boolean, isDim: boolean): string {
  if (isChosen || isHot) return INKS.light;
  if (node.toggle && Layers.isOn(node.toggle)) return INKS.layerOn;
  if (isDim) return INKS.dim;
  if (node.danger) return INKS.danger;
  return INKS.base;
}

function noteFor(node: WheelNode): string | null {
  if (node.toggle) return Layers.isOn(node.toggle) ? "on" : "off";
  if (node.note) return node.note;
  return node.children ? "▸" : null;
}

export function renderWheel(container: HTMLElement, roots: WheelRoots, state: WheelState, cb: WheelCallbacks): void {
  container.textContent = "";
  const levels = resolveLevels(roots, state);

  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "-258 -258 516 516");
  svg.setAttribute("width", "516");
  svg.setAttribute("height", "516");
  svg.setAttribute("class", "mw-svg");
  container.append(svg);

  const labelLayer = document.createElement("div");
  labelLayer.className = "mw-labels";
  container.append(labelLayer);

  levels.forEach((level, L) => {
    if (L > 0) {
      const { x1, y1, x2, y2 } = spineLine(L, level.parentMid);
      const spine = document.createElementNS(SVG, "line");
      spine.setAttribute("class", "mw-spine");
      for (const [k, v] of Object.entries({ x1, y1, x2, y2 })) spine.setAttribute(k, v.toFixed(2));
      svg.append(spine);
    }

    const [inner, outer] = BANDS[L];
    const deeper = level.chosen !== null;

    level.items.forEach((node, i) => {
      const isChosen = level.chosen === i;
      const isHot = state.hot?.level === L && state.hot.index === i;
      const isDim = deeper && !isChosen;
      const { from, to, mid } = level.ring[i];
      const rOuter = isHot ? outer + HOVER_GROW : outer;

      const sector = document.createElementNS(SVG, "path");
      sector.setAttribute("class", "mw-sector");
      sector.setAttribute("d", arcPath(inner, rOuter, from, to));
      sector.setAttribute("fill", fillFor(node, isChosen, isHot, isDim));
      sector.setAttribute("stroke", isDim ? EDGE_DIM : EDGE);
      sector.addEventListener("mouseenter", () => cb.onState({ ...state, hot: { level: L, index: i } }));
      sector.addEventListener("mouseleave", () => cb.onState({ ...state, hot: null }));
      sector.addEventListener("click", () => pick(L, i, node, mid));
      svg.append(sector);

      const [x, y] = labelPoint(mid, inner, rOuter);
      const label = document.createElement("div");
      label.className = `mw-label ${L === 0 ? "mw-label--root" : ""}`;
      label.style.left = `calc(50% + ${x.toFixed(2)}px)`;
      label.style.top = `calc(50% + ${y.toFixed(2)}px)`;
      label.style.color = inkFor(node, isChosen, isHot, isDim);

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

  // The spec's click order. A layer toggle wins over everything else so the ring doubles as the
  // layer panel's status display: it flips in place and the ring neither changes nor closes.
  function pick(level: number, index: number, node: WheelNode, mid: number): void {
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
}

/** Arrow keys walk the rings; the wheel is a set of nested lists. Returns true if the key was ours. */
export function handleKey(event: KeyboardEvent, roots: WheelRoots, state: WheelState, cb: WheelCallbacks): boolean {
  const levels = resolveLevels(roots, state);
  const level = state.hot?.level ?? 0;
  const ring = levels[level];
  if (!ring) return false;

  const move = (index: number) => cb.onState({ ...state, hot: { level, index } });
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
      cb.onState({ ...state, hot: { level: level + 1, index: 0 } });
      return true;
    }
    case "ArrowUp": {
      if (level === 0) return false;
      cb.onState({ ...state, hot: { level: level - 1, index: state.path[level - 1] ?? 0 } });
      return true;
    }
    case "Enter": {
      if (current < 0) return false;
      const node = ring.items[current];
      if (nodeKind(node) === "run") cb.onLeaf(node);
      else if (nodeKind(node) === "toggle") cb.onToggle(node);
      else cb.onState({ ...state, path: [...state.path.slice(0, level), current], hot: null });
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
