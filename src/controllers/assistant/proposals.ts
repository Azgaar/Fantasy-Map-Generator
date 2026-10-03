import { refreshEditors } from "@/components/dialog/dialog-helpers";
import { type LayerId, Layers } from "@/components/layers";
import { MapEntities } from "@/components/map-entities";
import { Options } from "@/components/options-model";
import { invokeActiveZooming } from "@/components/zoom";
import { Controllers } from "@/controllers";
import { effectAt } from "@/controllers/style-editor/effects";
import { Styles } from "@/generators/styles";
import type { ChangeRow, Proposal } from "@/services/assistant/chats";
import { errorText } from "@/utils/stringUtils";
import { Change, type Side } from "./change";
import { OPERATIONS, runOperation } from "./operations";
import { World } from "./world";

type Batch = Proposal["operations"];
export type Action = "apply" | "undo" | "redo";

/** What each action needs and does: a proposal in state `from`, on a map that still shows the `expects` side of the
 * change, gets the `writes` side written and moves to state `to` */
const ACTIONS: Record<Action, { from: Proposal["state"]; expects: Side; writes: Side; to: Proposal["state"] }> = {
  apply: { from: "proposed", expects: "before", writes: "after", to: "applied" },
  undo: { from: "applied", expects: "after", writes: "before", to: "undone" },
  redo: { from: "undone", expects: "before", writes: "after", to: "applied" }
};

/** A proposal is a batch of operations the Assistant wants to run, shown to the user as a card before anything
 * changes: Preview → Apply → Undo → Redo, or Discard. See docs/prd/assistant.md */
class ProposalLifecycle {
  /** Try the operations on a draft of the map and record what they change. The live map is never touched, and one
   * failing operation fails the whole batch. Returns the proposal, or the reason there is none */
  propose(summary: string, operations: unknown, number: number, mapId: number): Proposal | string {
    const batch = this.parse(operations);
    if (typeof batch === "string") return batch;
    const live = World.live();
    const draft = live.draft();
    let rows: Omit<ChangeRow, "entity">[];
    let draftNames: Map<string, string>; // an added entity has its name only in the draft, a removed one only live
    try {
      [rows, draftNames] = draft.asLive(() => {
        const results: unknown[] = [];
        for (const { op, args } of batch) results.push(runOperation(op, this.resolve(args, results) as unknown[]));
        const rows = Change.record(live, draft);
        return [rows, new Map(rows.map(({ key }) => [key, this.name(key)]))] as const;
      });
    } catch (error) {
      return errorText(error);
    }
    if (!rows.length) return "These operations change nothing";
    const regenerating = rows.find(
      row => row.key === Change.STYLE && effectAt(row.field.split(".")) === "regenerateRelief"
    );
    if (regenerating)
      return `${regenerating.field} regenerates every relief icon, which Undo cannot restore: the user changes it in the Style tab`;
    const change = rows.map(row => ({ ...row, entity: this.label(row.key, draftNames.get(row.key)!) }));
    return { number, mapId, summary, operations: batch, change, state: "proposed" };
  }

  /** The quick check behind the card's button: the right state, the right map, and nobody changed the same values */
  ready(action: Action, proposal: Proposal, mapId: number): boolean {
    const { from, expects } = ACTIONS[action];
    if (proposal.state !== from || proposal.mapId !== mapId) return false;
    return new Change(proposal.change).matches(World.live(), expects);
  }

  /** The full check before running: ready, and the result breaks no reference between entities */
  can(action: Action, proposal: Proposal, mapId: number): boolean {
    if (!this.ready(action, proposal, mapId)) return false;
    return new Change(proposal.change).keepsReferencesIntact(World.live(), ACTIONS[action].writes);
  }

  /** Apply, undo or redo the proposal on the live map and redraw what it touched; false when it cannot */
  run(action: Action, proposal: Proposal, mapId: number): boolean {
    if (!this.can(action, proposal, mapId)) return false;
    const change = new Change(proposal.change);
    change.writeTo(World.live(), ACTIONS[action].writes);
    proposal.state = ACTIONS[action].to;
    this.refresh(change);
    return true;
  }

  discard(proposal: Proposal): void {
    if (proposal.state === "proposed") proposal.state = "discarded";
  }

  private parse(operations: unknown): Batch | string {
    if (!Array.isArray(operations) || !operations.length) return "Propose at least one operation";
    const batch: Batch = [];
    for (const item of operations) {
      const { op, args = [] } = (item ?? {}) as { op?: unknown; args?: unknown };
      if (typeof op !== "string" || !OPERATIONS.has(op))
        return `Unknown operation ${JSON.stringify(op)}. Registered operations: ${[...OPERATIONS].join(", ")}`;
      if (!Array.isArray(args)) return `The args of ${op} must be a list, in the order of its parameters`;
      batch.push({ op, args });
    }
    return batch;
  }

  /** `{ result: n }` in args stands for what operation n (0-based) of the same batch returned, such as a new id;
   * `{ result: n, type: "burg" }` stands for its key, such as "burg:12" */
  private resolve(arg: unknown, results: unknown[]): unknown {
    if (Array.isArray(arg)) return arg.map(item => this.resolve(item, results));
    if (typeof arg !== "object" || arg === null || !Number.isInteger((arg as { result?: unknown }).result)) return arg;
    const { result: n, type, ...rest } = arg as { result: number; type?: unknown };
    if (Object.keys(rest).length || (type !== undefined && typeof type !== "string")) return arg;
    if (n < 0 || n >= results.length)
      throw new Error(`{ result: ${n} } must name an earlier operation of the batch, counted from 0`);
    if (results[n] === undefined) throw new Error(`Operation ${n} returns nothing to refer to`);
    return type === undefined ? results[n] : `${type}:${results[n]}`;
  }

  /** An entity's name on the map entered now; cells and lore have none */
  private name(key: string): string {
    const ref = MapEntities.parseKey(key);
    return ref ? MapEntities.getName(ref) : "";
  }

  /** A row's entity as the card names it */
  private label(key: string, fallback: string): string {
    if (key === Change.LORE) return "Map lore";
    if (key === Change.STYLE) return "Style";
    const ref = MapEntities.parseKey(key);
    if (!ref) return "Cells";
    const { kind } = MapEntities.getDisplay(ref);
    const name = this.name(key) || fallback;
    return name ? `${kind}: ${name}` : kind;
  }

  private refresh(change: Change): void {
    Layers.draw(...change.layers);
    this.refreshStyle(change.stylePaths);
    refreshEditors();
    for (const key of change.keys) this.refreshNameInputs(key);
    if (document.getElementById("notesEditor")) void Controllers.NotesEditor.refresh();
    if (change.keys.has(Change.LORE)) {
      Options.save();
      if (document.getElementById("loreEditor")) void Controllers.LoreEditor.refresh();
    }
  }

  /** Run what each changed style value declares (see style-editor/effects), drawing each layer once */
  private refreshStyle(paths: string[][]): void {
    if (!paths.length) return;
    const layers = new Set<LayerId>();
    let zoom = false;
    for (const path of paths) {
      const effect = effectAt(path);
      if (path.includes("attrs")) Styles.writeAttr(path);
      if (effect === "zoom") zoom = true;
      if (effect === "draw" && Layers.has(path[0])) layers.add(path[0]);
    }
    Layers.draw(...layers);
    if (zoom) invokeActiveZooming();
    if (document.getElementById("styleForm")?.childElementCount) void Controllers.StyleEditor.refresh();
  }

  /** Entity editors show the name in an input; update it only when that editor shows this entity */
  private refreshNameInputs(key: string): void {
    const ref = MapEntities.parseKey(key);
    const entity = ref && (MapEntities.get(ref) as { name?: string; fullName?: string } | undefined);
    if (!ref || !entity) return;
    const value = entity.name ?? "";
    if (ref.type === "state" || ref.type === "province") {
      const dialog = document.getElementById(`${ref.type}NameEditor`);
      if (dialog?.dataset[ref.type] !== String(ref.id)) return;
      const short = document.getElementById(`${ref.type}NameEditorShort`) as HTMLInputElement | null;
      const full = document.getElementById(`${ref.type}NameEditorFull`) as HTMLInputElement | null;
      if (short) short.value = value;
      if (full) full.value = entity.fullName ?? value;
    } else {
      const dialog = document.getElementById(`${ref.type}Editor`);
      const input = document.getElementById(`${ref.type}Name`) as HTMLInputElement | null;
      if (dialog?.dataset.entity === key && input) input.value = value;
    }
  }
}

export const Proposals = new ProposalLifecycle();
