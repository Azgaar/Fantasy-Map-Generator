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
  CRUMB_CLEAR,
  HOVER_GROW,
  labelPoint,
  MAX_DEPTH,
  markPath,
  openOuterRadius,
  type Sector,
  sectors,
  spineLine,
  VIEWPORT_MARGIN
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

/** What renderWheel hands back so hover and theme changes can be applied without touching the structure */
export interface WheelHandle {
  applyHot: (hot: HotRef | null) => void;
  /**
   * Re-sample the app's theme and recolour what is already on screen. Structure is untouched: the
   * user can sit in Options → Interface INSIDE the drawer moving the hue and transparency sliders,
   * and rebuilding the ring on every one of those mutations would resurrect the hover-redraw loop.
   */
  repaint: () => void;
  /** The outermost ring actually open. The drawer and the breadcrumb hang off this ring's edge. */
  openLevel: number;
}

/** The two skins of one sector, computed once at build time so hovering is an attribute write */
interface Painted {
  sector: SVGPathElement;
  label: HTMLElement;
  /** the parent tick, on sectors that open a child ring */
  mark: SVGPathElement | null;
  /** [normal, hovered] */
  d: [string, string];
  fill: [string, string];
  ink: [string, string];
  /** what the two skins above were computed from, so a theme change can recompute them in place */
  node: WheelNode;
  isChosen: boolean;
  isDim: boolean;
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

// Only a note that says something gets a line: a layer's on/off, a subject's kind, the subject
// count. "This has children" is drawn as a tick on the sector's outer edge instead, because a line
// of text costs the band's depth and every parent sector used to spend one on a "▸".
function noteFor(node: WheelNode): string | null {
  if (node.toggle) return Layers.isOn(node.toggle) ? "on" : "off";
  return node.note ?? null;
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

      // The tick and the note are independent: the tick says "this opens a child ring", the note
      // says what the sector is. A node with both (the HERE channel's "What's here") gets both.
      let mark: SVGPathElement | null = null;
      if (nodeKind(node) === "children") {
        mark = document.createElementNS(SVG, "path");
        mark.setAttribute("class", "mw-mark");
        mark.setAttribute("d", markPath(mid, outer, scale));
        mark.setAttribute("fill", inkFor(pal, node, isChosen, false, isDim));
        svg.append(mark);
      }

      painted.set(`${L}:${i}`, {
        sector,
        label,
        mark,
        d: skin,
        fill: [fillFor(pal, node, isChosen, false, isDim), fillFor(pal, node, isChosen, true, isDim)],
        ink: [inkFor(pal, node, isChosen, false, isDim), inkFor(pal, node, isChosen, true, isDim)],
        node,
        isChosen,
        isDim
      });
    });
  });

  const openLevel = levels.length - 1;
  renderHub(container, state, cb);
  renderCrumbs(container, roots, state, cb, openLevel, scale);

  let hot: HotRef | null = null;
  const wear = (item: Painted, on: boolean): void => {
    const skin = on ? 1 : 0;
    item.sector.setAttribute("d", item.d[skin]);
    item.sector.setAttribute("fill", item.fill[skin]);
    item.label.style.color = item.ink[skin];
    item.mark?.setAttribute("fill", item.ink[skin]);
  };

  const paint = (ref: HotRef | null, on: boolean): void => {
    const item = ref && painted.get(`${ref.level}:${ref.index}`);
    if (item) wear(item, on);
  };

  const applyHot = (next: HotRef | null): void => {
    paint(hot, false);
    hot = next;
    paint(hot, true);
  };

  // A theme change recomputes the two precomputed skins of every sector and re-wears the one each
  // sector is currently in. No node is removed, so the element under the pointer stays the element
  // the next mousedown lands on.
  const repaint = (): void => {
    const next = readPalette();
    applyPalette(container, next);
    const hotKey = hot && `${hot.level}:${hot.index}`;
    for (const [key, item] of painted) {
      const { node, isChosen, isDim } = item;
      item.fill = [fillFor(next, node, isChosen, false, isDim), fillFor(next, node, isChosen, true, isDim)];
      item.ink = [inkFor(next, node, isChosen, false, isDim), inkFor(next, node, isChosen, true, isDim)];
      item.sector.setAttribute("stroke", isDim ? next.edgeDim : next.edge);
      wear(item, key === hotKey);
    }
  };

  applyHot(state.hot);
  return { applyHot, repaint, openLevel };
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

/**
 * Nudge the breadcrumb back inside the viewport. The bar is anchored to the ring, and the ring is
 * anchored to the click point, so a deep drill on a short window can put the crumb off the top of
 * the screen - where it is neither readable nor clickable, and clicking crumb N is the only way
 * back to depth N.
 */
function clampToViewport(bar: HTMLElement): void {
  const rect = bar.getBoundingClientRect();
  if (!rect.width || !rect.height) return; // detached, or jsdom, which lays nothing out
  const dx = Math.max(0, VIEWPORT_MARGIN - rect.left) - Math.max(0, rect.right - (window.innerWidth - VIEWPORT_MARGIN));
  const dy =
    Math.max(0, VIEWPORT_MARGIN - rect.top) - Math.max(0, rect.bottom - (window.innerHeight - VIEWPORT_MARGIN));
  if (dx || dy) bar.style.transform = `translate(-50%, -100%) translate(${dx}px, ${dy}px)`;
}

function renderCrumbs(
  container: HTMLElement,
  roots: WheelRoots,
  state: WheelState,
  cb: WheelCallbacks,
  openLevel: number,
  scale: number
): void {
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

  // Above the ring that is actually drawn and centred on the wheel's centre, not in the corner of
  // the box: the box is sized for a drill to level 3, so a two-ring wheel pinned to its corner puts
  // the crumb hundreds of px from the ring - in a large window, in the corner of the screen.
  bar.style.left = "50%";
  bar.style.top = `calc(50% - ${(openOuterRadius(openLevel, scale) + CRUMB_CLEAR * scale).toFixed(2)}px)`;
  container.append(bar);
  clampToViewport(bar);
}
