/**
 * bundled.ts — the shipped ruleset, imported into the page.
 *
 * The files under `docs/` are the source of truth for the whole project: the dev
 * server validates them from disk, and this module embeds them in the mod so a
 * campaign can run with no server at all (Phase D / D6, D8). One ruleset, two
 * consumers — they cannot drift, because they are the same bytes.
 *
 * The imports are explicit and the arrays are hand-ordered on purpose. A
 * directory listing cannot be embedded (this module must run in a browser, with
 * no filesystem), so "which docs are shipped" is a line of code you can read and
 * review — and a new file under `docs/` that nobody adds here fails loudly in the
 * gate rather than silently joining the shipped ruleset.
 *
 * `docs/game.json` is the exception: it is not a content doc but the game config
 * (`resolveConfig`) — it is imported here only for the two content-meta names it
 * carries; `store.ts` reads the rest of it.
 */
import { type ContentPack, type RawContentDocs, validateAndResolve } from "../engine/common/content";
import eventSample from "./docs/events/sample.json" with { type: "json" };
import gameDoc from "./docs/game.json" with { type: "json" };
import rosterChaos from "./docs/rosters/chaos.json" with { type: "json" };
import rosterChivalric from "./docs/rosters/chivalric.json" with { type: "json" };
import rosterDarkElf from "./docs/rosters/dark_elf.json" with { type: "json" };
import rosterdefault from "./docs/rosters/default.json" with { type: "json" };
import rosterdwarf from "./docs/rosters/dwarf.json" with { type: "json" };
import rosterEastAsia from "./docs/rosters/east_asia.json" with { type: "json" };
import rosterelf from "./docs/rosters/elf.json" with { type: "json" };
import rosterEmpire from "./docs/rosters/empire.json" with { type: "json" };
import rosterInfernalDwarf from "./docs/rosters/infernal_dwarf.json" with { type: "json" };
import rosterLizardmen from "./docs/rosters/lizardmen.json" with { type: "json" };
import rosterMughal from "./docs/rosters/mughal.json" with { type: "json" };
import rosterorc from "./docs/rosters/orc.json" with { type: "json" };
import rosterOttoman from "./docs/rosters/ottoman.json" with { type: "json" };
import rosterRenaissance from "./docs/rosters/renaissance.json" with { type: "json" };
import rosterSkaven from "./docs/rosters/skaven.json" with { type: "json" };
import rostersteppe from "./docs/rosters/steppe.json" with { type: "json" };
import rosterTombKings from "./docs/rosters/tomb_kings.json" with { type: "json" };
import rosterVampire from "./docs/rosters/vampire.json" with { type: "json" };
import rosterWoodElf from "./docs/rosters/wood_elf.json" with { type: "json" };
import victoryStandard from "./docs/victory/standard.json" with { type: "json" };

/** The shipped ruleset, as raw docs — the input to `validateAndResolve`. */
export const BUNDLED_DOCS: RawContentDocs = {
  rosterDocs: [
    { file: "rosters/default.json", doc: rosterdefault },
    { file: "rosters/dwarf.json", doc: rosterdwarf },
    { file: "rosters/elf.json", doc: rosterelf },
    { file: "rosters/orc.json", doc: rosterorc },
    { file: "rosters/east_asia.json", doc: rosterEastAsia },
    { file: "rosters/mughal.json", doc: rosterMughal },
    { file: "rosters/ottoman.json", doc: rosterOttoman },
    { file: "rosters/renaissance.json", doc: rosterRenaissance },
    { file: "rosters/steppe.json", doc: rostersteppe },
    { file: "rosters/empire.json", doc: rosterEmpire },
    { file: "rosters/chivalric.json", doc: rosterChivalric },
    { file: "rosters/wood_elf.json", doc: rosterWoodElf },
    { file: "rosters/tomb_kings.json", doc: rosterTombKings },
    { file: "rosters/vampire.json", doc: rosterVampire },
    { file: "rosters/chaos.json", doc: rosterChaos },
    { file: "rosters/dark_elf.json", doc: rosterDarkElf },
    { file: "rosters/skaven.json", doc: rosterSkaven },
    { file: "rosters/lizardmen.json", doc: rosterLizardmen },
    { file: "rosters/infernal_dwarf.json", doc: rosterInfernalDwarf }
  ],
  culturesDocs: [],
  factionDocs: [],
  buildingsDocs: [],
  techDocs: [],
  victoryDocs: [{ file: "victory/standard.json", doc: victoryStandard }],
  eventsDocs: [{ file: "events/sample.json", doc: eventSample }],
  // The meta names come from `docs/game.json`, never from a literal here. Phase B
  // shipped a hand-mirrored roster and the mirror drifted; a second hand-written
  // copy of the same two strings would drift the same way, silently, showing up
  // only as the page and the server disagreeing about the default victory set.
  meta: gameDoc.content ?? {}
};

/**
 * Validate the shipped ruleset. Throws with every error: a broken baseline must
 * fail loudly at boot, in the page, not quietly at the first battle.
 */
export function bundledContent(): ContentPack {
  const { content, errors } = validateAndResolve(BUNDLED_DOCS);
  if (!content) throw new Error(`the shipped ruleset is invalid:\n  ${errors.join("\n  ")}`);
  return content;
}
