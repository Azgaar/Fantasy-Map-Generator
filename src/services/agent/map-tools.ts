import { type NoteRef, Notes } from "@/generators/notes";
import type { PackedGraph } from "@/types/PackedGraph";
import { MAX_RESULT, type ToolCall, validateCall } from "./contract";

export interface Selection {
  target: string;
  label: string;
  mapId: string;
  cell: number;
  x: number;
  y: number;
}
export interface NoteProposal {
  id: string;
  target: string;
  label: string;
  mapId: string;
  before: string;
  html: string;
  selection?: { index: number; length: number; html: string };
  status: "proposed" | "applied" | "discarded" | "undone";
}
let knownMap: PackedGraph | undefined;
let knownCells: PackedGraph["cells"] | undefined;
let epoch = "";
let selection: Selection | undefined;
export function mapId(): string {
  if (typeof pack === "undefined") return "no-map";
  if (pack !== knownMap || pack.cells !== knownCells) {
    knownMap = pack;
    knownCells = pack.cells;
    epoch = crypto.randomUUID();
  }
  return epoch;
}
export function getSelection(): Selection | undefined {
  return selection?.mapId === mapId() ? selection : undefined;
}
export function setSelection(value?: Selection): void {
  selection = value;
  window.dispatchEvent(new Event("assistant-context"));
}
export function noteRef(target: string): NoteRef {
  if (!/^[A-Za-z]+:\d+(?:-\d+)?$/.test(target)) throw new Error("Invalid note target");
  const ref = Notes.parseKey(target);
  if (!ref || !Notes.exists(ref)) throw new Error("This entity no longer exists");
  return ref;
}
export function selectionsAt(x: number, y: number, element?: Element | null): Selection[] {
  if (typeof pack === "undefined" || !pack.cells?.p?.length) return [];
  const cell = Pack.findCell(x, y);
  if (cell === undefined) return [];
  const targets: string[] = [];
  const direct = element?.closest("#burgIcons use[data-id], #markers > svg");
  if (direct) {
    if (direct.matches("#burgIcons use[data-id]")) targets.push(`burg:${direct.getAttribute("data-id")}`);
    else {
      const match = direct.id.match(/^marker(\d+)$/);
      if (match) targets.push(`marker:${match[1]}`);
    }
  }
  const { cells } = pack;
  for (const kind of ["burg", "province", "state", "culture", "religion"] as const) {
    const id = cells[kind][cell];
    if (id) targets.push(`${kind}:${id}`);
  }
  targets.push(`cell:${cell}`);
  return [...new Set(targets)].flatMap(target => {
    try {
      const label = target.startsWith("cell:")
        ? `Location ${Math.round(x)}, ${Math.round(y)}`
        : Notes.getEntityName(noteRef(target));
      return [{ target, label: label || target, mapId: mapId(), cell, x, y }];
    } catch {
      return [];
    }
  });
}
const clip = (value: unknown, n = 120) => String(value ?? "").slice(0, n);
export function bounded(value: unknown): string {
  const text = JSON.stringify(value);
  if (new TextEncoder().encode(text).length > MAX_RESULT)
    throw new Error("Result exceeds the context budget. Narrow the query.");
  return text;
}
function position(target: string): { cell: number; x: number; y: number } {
  if (target.startsWith("cell:")) {
    const cell = Number(target.slice(5));
    const point = pack.cells.p[cell];
    if (!Number.isInteger(cell) || !point) throw new Error("Unknown cell");
    return { cell, x: point[0], y: point[1] };
  }
  const point = Notes.getPosition(noteRef(target));
  if (!point) throw new Error("This entity has no location");
  const cell = Pack.findCell(point[0], point[1]);
  if (cell === undefined) throw new Error("Location outside map");
  return { cell, x: point[0], y: point[1] };
}
function collection(kind: string) {
  switch (kind) {
    case "burg":
      return pack.burgs;
    case "marker":
      return pack.markers;
    case "state":
      return pack.states;
    case "province":
      return pack.provinces;
    case "religion":
      return pack.religions;
    case "culture":
      return pack.cultures;
    default:
      throw new Error("Unsupported entity type");
  }
}
export function searchMap(input: Record<string, unknown>): unknown {
  const kind = String(input.kind);
  const q = String(input.query ?? "").toLowerCase();
  const limit = Number(input.limit ?? 5);
  const candidates: { target: string; name: string; population?: number; port?: boolean; state?: string }[] = [];
  let matches = 0;
  const portStates = new Set(pack.burgs.filter(b => b?.i && !b.removed && b.port).map(b => b.state));
  for (const entity of collection(kind)) {
    if (!entity || (!entity.i && kind !== "marker") || ("removed" in entity && entity.removed)) continue;
    if (input.state !== undefined && (!("state" in entity) || entity.state !== input.state)) continue;
    if (input.port !== undefined) {
      const hasPort = kind === "state" ? portStates.has(entity.i) : "port" in entity && Boolean(entity.port);
      if (hasPort !== input.port) continue;
    }
    if (kind === "state" && input.withoutPorts === true && portStates.has(entity.i)) continue;
    if (!String(entity.name).toLowerCase().includes(q)) continue;
    matches++;
    const item = {
      target: `${kind}:${entity.i}`,
      name: clip(entity.name),
      ...(kind === "state" ? { hasPorts: portStates.has(entity.i) } : {}),
      ...("population" in entity
        ? {
            population: Math.round(
              (entity.population ?? 0) *
                options.map.units.population.scale *
                options.map.units.population.urbanization.rate
            )
          }
        : {}),
      ...("port" in entity ? { port: Boolean(entity.port), state: clip(pack.states[entity.state ?? 0]?.name) } : {})
    };
    candidates.push(item);
    candidates.sort((a, b) =>
      input.sort === "population" ? (b.population ?? 0) - (a.population ?? 0) : a.name.localeCompare(b.name)
    );
    if (candidates.length > limit) candidates.pop();
  }
  return {
    results: candidates,
    matches,
    limited: matches > limit,
    coverage: "All active entities were checked locally. Results are capped; repeat queries return the same records."
  };
}
export async function placeContext(target: string, signal?: AbortSignal): Promise<unknown> {
  const epoch = mapId();
  const { cell, x, y } = position(target);
  const { cells } = pack;
  const relation = (kind: "state" | "province" | "culture" | "religion") => {
    const id = cells[kind][cell];
    const item = collection(kind).find(e => e?.i === id);
    return id && item ? { target: `${kind}:${id}`, name: clip(item.name) } : null;
  };
  const nearest = { river: { cell: -1, distance: Infinity }, coast: { cell: -1, distance: Infinity } };
  // One cancellable local scan; only two reduced records leave the browser.
  for (let n = 0; n < cells.i.length; n++) {
    const i = cells.i[n];
    const p = cells.p[i];
    if (!p) continue;
    const d = Math.hypot(p[0] - x, p[1] - y);
    if (cells.r[i] && d < nearest.river.distance) nearest.river = { cell: i, distance: d };
    if (
      cells.h[i] >= 20 &&
      cells.c[i]?.some(c => cells.h[c] < 20 && pack.features[cells.f[c]]?.type === "ocean") &&
      d < nearest.coast.distance
    )
      nearest.coast = { cell: i, distance: d };
    if (n > 0 && n % 20000 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
      signal?.throwIfAborted();
      if (mapId() !== epoch) throw new Error("Map changed");
    }
  }
  const describe = (found: { cell: number; distance: number }, river: boolean) =>
    found.cell < 0
      ? { status: "not_found" }
      : {
          distance: Math.round(found.distance * options.map.units.distance.scale * 10) / 10,
          unit: options.map.units.distance.unit,
          method: river ? "nearest river cell" : "nearest ocean-adjacent land cell",
          approximate: true,
          bearingDegrees: Math.round(
            ((Math.atan2(cells.p[found.cell][0] - x, y - cells.p[found.cell][1]) * 180) / Math.PI + 360) % 360
          ),
          ...(river ? { name: clip(pack.rivers.find(r => r.i === cells.r[found.cell])?.name) } : {})
        };
  const markers: { target: string; name: string; type: string; distance: number }[] = [];
  for (const marker of pack.markers ?? []) {
    if (marker.hidden) continue;
    const distance = Math.hypot(marker.x - x, marker.y - y) * options.map.units.distance.scale;
    markers.push({
      target: `marker:${marker.i}`,
      name: clip(marker.name),
      type: clip(marker.type, 50),
      distance: Math.round(distance * 10) / 10
    });
    markers.sort((a, b) => a.distance - b.distance);
    if (markers.length > 3) markers.pop();
  }
  return {
    target,
    mapId: epoch,
    location: { cell, x: Math.round(x), y: Math.round(y) },
    name: target.startsWith("cell:") ? target : clip(Notes.getEntityName(noteRef(target))),
    province: relation("province"),
    state: relation("state"),
    culture: relation("culture"),
    religion: { assignedAtLocation: relation("religion"), basis: "cell assignment, not individual beliefs" },
    biome: clip(pack.biomes[cells.biome[cell]]?.name),
    nearestRiver: describe(nearest.river, true),
    nearestCoast: describe(nearest.coast, false),
    nearbyMarkers: markers,
    coverage: { markerLimit: 3, ranking: "nearest visible markers", notesIncluded: false }
  };
}
export async function revision(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${mapId()}\n${text}`));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
export function safeNoteHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (doc.querySelector("script,style,iframe,object,embed")) throw new Error("Unsupported note content");
  const tags = new Set(
    "P DIV BR SPAN STRONG B EM I U S OL UL LI BLOCKQUOTE H1 H2 H3 H4 H5 H6 SUB SUP TABLE TBODY TR TD A".split(" ")
  );
  for (const el of doc.body.querySelectorAll("*")) {
    if (!tags.has(el.tagName))
      throw new Error("Unsupported note formatting. Use paragraphs, lists, links and text formatting.");
    for (const attr of [...el.attributes]) {
      if (attr.name === "href" && el.tagName === "A" && /^https?:\/\//i.test(attr.value)) continue;
      if (attr.name === "style") {
        const style = (el as HTMLElement).style;
        for (const prop of [...style])
          if (
            ![
              "text-align",
              "color",
              "background-color",
              "font-size",
              "font-family",
              "font-weight",
              "font-style",
              "text-decoration"
            ].includes(prop) ||
            /url\s*\(|expression|[<>]/i.test(style.getPropertyValue(prop))
          )
            style.removeProperty(prop);
        continue;
      }
      el.removeAttribute(attr.name);
    }
  }
  return doc.body.innerHTML;
}
// Remove serialization quotes around generated HTML, keeping quotations inside the note intact.
export function proposedNoteHtml(html: string): string {
  const trimmed = html.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    let inner = trimmed.slice(1, -1);
    try {
      const decoded: unknown = JSON.parse(trimmed);
      if (typeof decoded === "string") inner = decoded;
    } catch {
      /* Raw HTML may contain unescaped attribute quotes. */
    }
    if (/<[a-z][a-z0-9]*\b[^>]*>/i.test(inner)) html = inner.trim();
  }
  return safeNoteHtml(html);
}
export async function executeMapTool(
  call: ToolCall,
  onProposal: (p: NoteProposal) => void,
  signal?: AbortSignal
): Promise<string> {
  validateCall(call);
  signal?.throwIfAborted();
  if (typeof pack === "undefined" || !pack.cells?.p) throw new Error("No map loaded");
  const target = String(call.input.target ?? "");
  if (call.name === "search_map") return bounded(searchMap(call.input));
  if (call.name === "place_context") return bounded(await placeContext(target, signal));
  if (call.name === "read_note" || call.name === "propose_note") {
    const epoch = mapId();
    const ref = noteRef(target);
    const before = Notes.get(ref) ?? "";
    const selection =
      call.input.scope === "selection"
        ? (await import("@/controllers/notes-editor")).NotesEditor.assistantSelection()
        : null;
    if (call.input.scope === "selection" && (!selection || selection.target !== target))
      throw new Error("Select a passage in the target note first");
    const readHtml = selection?.html ?? before;
    if (before.length > 200000) throw new Error("This note is too large for an assistant preview");
    if (new TextEncoder().encode(readHtml).length > 8000)
      throw new Error("This note is too long to replace safely. Select a shorter passage in the editor.");
    const version = await revision(before + (selection ? `\nselection:${selection.index}:${selection.length}` : ""));
    if (epoch !== mapId()) throw new Error("Map changed");
    if (call.name === "read_note")
      return bounded({
        target,
        revision: version,
        scope: selection ? "selection" : "note",
        html: readHtml,
        name: clip(Notes.getEntityName(ref))
      });
    if (version !== call.input.revision) throw new Error("Read the current note before proposing changes");
    const fragment = proposedNoteHtml(String(call.input.html));
    const html = selection
      ? (await import("@/controllers/notes-editor")).NotesEditor.previewSelection(
          target,
          selection.index,
          selection.length,
          before,
          fragment
        )
      : fragment;
    if (mapId() !== epoch || (Notes.get(ref) ?? "") !== before) throw new Error("The note changed");
    onProposal({
      id: crypto.randomUUID(),
      target,
      label: clip(Notes.getEntityName(ref)),
      mapId: epoch,
      before,
      html,
      ...(selection ? { selection: { index: selection.index, length: selection.length, html: fragment } } : {}),
      status: "proposed"
    });
    return "Note proposal ready for the user to Apply. No edit has been made.";
  }
  throw new Error("Unsupported map tool");
}
export async function applyProposal(proposal: NoteProposal, undo = false): Promise<void> {
  if (mapId() !== proposal.mapId) throw new Error("This proposal belongs to another map");
  if (proposal.status !== (undo ? "applied" : "proposed")) throw new Error("This operation has already been handled");
  if (!undo && !proposal.selection) proposal.html = proposedNoteHtml(proposal.html);
  const ref = noteRef(proposal.target);
  const expected = undo ? proposal.html : proposal.before;
  if ((Notes.get(ref) ?? "") !== expected) throw new Error("The note changed. Prepare a fresh proposal.");
  // Loading the controller can yield; check again before its synchronous write.
  const { NotesEditor } = await import("@/controllers/notes-editor");
  if (!undo && proposal.selection) {
    const { index, length, html } = proposal.selection;
    const prepared = NotesEditor.previewSelection(proposal.target, index, length, proposal.before, safeNoteHtml(html));
    if (prepared !== proposal.html) throw new Error("The note preview changed. Prepare a fresh proposal.");
  }
  if (
    mapId() !== proposal.mapId ||
    (Notes.get(ref) ?? "") !== expected ||
    proposal.status !== (undo ? "applied" : "proposed")
  )
    throw new Error("The note changed");
  const result = NotesEditor.write(proposal.target, undo ? proposal.before : proposal.html);
  if (!result) throw new Error("The note target no longer exists");
  proposal.status = undo ? "undone" : "applied";
}
