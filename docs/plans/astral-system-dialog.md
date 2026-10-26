# Plan — The System Dialog

Updated: 2026-10-25. Inputs: [docs/astral/README.md](../astral/README.md),
[astral-ui-overhaul.md](astral-ui-overhaul.md) (this plan supersedes its Phase 4 click seam),
[data-model.md](../architecture/data-model.md).

## Goal

Clicking a star system must stop opening the **Burg Editor**. Astral gets its own dialog — the
**System Editor** — a full editor that speaks the astral vocabulary: the burg is a star system, its
features are installations, its province is a sector, its state is an empire.

The Burg Editor stays exactly as it is for Standard view. In Astral the System Editor is the only
dialog for a system: there is no escape-hatch button back to the Burg Editor.

## Non-negotiables

- **No new state.** A system is a burg. Every edit writes through the existing `Burgs` model API
  (`rename`, `setPopulation`, `setCulture`, `setGroup`, `setBuilding`, `setPort`, `setCapital`,
  `move`, `setTreasury`, `setLocked`, `remove`), so `.map` saving, the economy and the overviews
  see the same world.
- **No class field.** The spectral class is derived from population (`starClass`); it is a readout,
  not an editable value. An override would need new state.
- **No generator changes, no new dependencies, no new `.map` records.**
  _Update 2026-10-26: the generated star and planet readout extends this dialog —
  [astral-system-details.md](astral-system-details.md) supersedes the "no generator changes" note.
  Its "no new state" rule still holds: the readout is a lazy calculation, never stored._
- **Standard view untouched.** `#burgIcons` clicks and burg label clicks outside Astral still open
  the Burg Editor; the existing burg specs must pass unchanged.

## Routing

`src/components/viewbox-events.ts` owns all three seams:

| Click | Today | After |
|---|---|---|
| `#systems` marker (any view) | `BurgEditor.open` | `AstralSystemEditor.open(id)` |
| burg label, Astral view | `BurgEditor.open` | `AstralSystemEditor.open(id)` |
| burg label, Standard view | `BurgEditor.open` | unchanged |
| `#burgIcons` icon, Astral view | `BurgEditor.open` | `AstralSystemEditor.open(id)` |
| `#burgIcons` icon, Standard view | `BurgEditor.open` | unchanged |

- The marker seam (`GREAT_EDITORS.systems`) routes unconditionally: the systems layer is astral by
  nature, whatever view it is drawn in.
- The label and `#burgIcons` seams route through `isAstralView()` — one branch each, no new
  helpers.
- The label-click re-open trick moves with it: in Astral, clicking the label of the system whose
  editor is already open opens the `LabelsEditor` for it (today the same check reads
  `#burgEditor dataset.burgId`); the check covers both dialog ids.
- Read-only entry points that open the Burg Editor today — the Burgs overview pencil, the legends
  browser — keep doing so; they are standard tools and their rows are burg rows.
- The tooltip (`systemTip`) already says "Click to edit"; no change.

## The dialog

New controller `src/controllers/astral-system-editor.ts`, dialog id `astralSystemEditor`, title
"Edit System", registered as `Controllers.AstralSystemEditor`. It follows the Burg Editor
conventions: `closeDialogs(".stable")` on open, `Layers.show("systems", "labels")` so the clicked
system is visible, jQuery UI `.dialog()` with `destroyDialog`/`close` teardown, `customization`
guard.

### Layout

A single-column form (no emblem column — the star preview takes that place):

- **Star preview** — the system drawn as the chart draws it: class fill from
  `styles.systems.groups[class]`, radius from `starRadiusEm(population)`, capital ring, port tick,
  halo when glow is on. It re-renders live as population and traits change, so the dialog always
  shows the marker the map will draw.
- **Sector, Empire** — `province.fullName, state.fullName`, the astral reading of the Burg Editor's
  province/state line.
- **Name** — input plus speak, random-name and culture-name buttons, identical behaviour to the Burg
  Editor (`Burgs.rename`, then `Layers.draw("labels")`).
- **People** — the culture select with the culture-name button (`Burgs.setCulture`). "Culture" is
  the stock word; "People" is what the astral docs already call it.
- **Population** — number input in people (`peopleOf` / `Burgs.setPopulation`), with the class
  readout next to it: "G-class yellow dwarf" from `starClass(peopleOf(burg))`, updated on change
  along with the star preview.
- **Installations** — the six toggles with astral names and tooltips, all through
  `Burgs.setBuilding` (and the port/capital specials):
  - Shipyard (port, `Burgs.setPort`), Bastion (citadel), Civic core (plaza), Drift (shanty),
    Shrine (temple), Shielding (walls).
  - The plaza-off confirm for a market center carries over unchanged.
  - **Capital** — same guarded toggle as the Burg Editor: only assignable by making this system the
    capital of its empire, never removable directly.
- **Economy** — Wealth readout and Treasury input; same sources and writes as the Burg Editor
  (`Burgs.setTreasury`). The goods economy is view-agnostic and stays editable elsewhere.
  The goods **Production** readout (the icons and their counts) was removed on 2026-10-26: the
  industry of a medieval burg has no place on a system's card.

### Bottom toolbar

| Button | Behaviour | Source |
|---|---|---|
| Edit class style | `StyleEditor.open("systems", class)` — the astral replacement for the burg group style buttons | new |
| Edit label style | `StyleEditor.open("labels", burg.label?.group || burg.group)` | carried |
| Edit label | `LabelsEditor.open("burg", id)` after closing this dialog | carried |
| Edit emblem | `EmblemsEditor.open("burg", "burgCOA{id}", burg)` — the sigil of the system's institutions; click-to-edit on the preview keeps the Burg Editor's affordance but there is no emblem column, so the toolbar button is the entry | carried |
| Locate | `zoomTo(x, y, 8, 2000)` | carried |
| Production overview | `ProductionOverview.open(id)` | carried |
| Relocate | the crosshair mode with the cells layer forced on, `Burgs.move`; redraws `systems` and `labels` | carried |
| Notes | `noteButton` → `NotesEditor.open({ type: "burg", id })` | carried |
| Lock | `Burgs.setLocked` + icon swap | carried |
| Remove | capital and market-center guards, confirm, `Burgs.remove`, redraw, close | carried |

### Dropped from the Burg Editor, on purpose

| Field | Why dropped |
|---|---|
| Type (Generic/River/Naval…) | fantasy vocabulary; only slightly steers emblem generation |
| Temperature, Elevation | planetary readings with no astral meaning on a star chart |
| Preview iframe, custom preview link | a medieval city generator has nothing to show for a star |
| Group select + configure | the systems layer ignores burg groups; label grouping is reached through "Edit label style" |

## Writes and redraws

Every edit writes through the model, then redraws the layers that show it:

- name, relocate → `Layers.draw("systems", "labels")`
- population, traits, capital, port → `Layers.draw("systems")` (class, radius and accents come from
  these) plus `burgIcons` when the standard icons layer is on
- culture → production changes; update the dialog values in place rather than redrawing everything

The controller keeps no burg copy — it re-reads `pack.burgs[id]` on every update, like the Burg
Editor does.

## Marker markup sharing

The star preview must not fork the marker geometry. `draw-systems.ts` already keeps its pure
geometry in `src/renderers/astral/system-markers.ts`; the per-system shape emission
(`halo`, `capitalRing`, `portTick` around `starRadiusEm`) moves from the DOM writer into that pure
module as one function, and both the layer and the dialog call it. Same function, same star.

## Files

### New

```
src/controllers/astral-system-editor.ts
```

### Modified

```
src/components/viewbox-events.ts    three seams route to AstralSystemEditor (mode-aware)
src/renderers/astral/system-markers.ts  gains the per-system marker emission (pure)
src/renderers/astral/draw-systems.ts    imports it from system-markers
src/controllers/index.ts            AstralSystemEditor registry entry
tests/e2e/astral-systems.spec.ts    click test expects the System Editor; new editing tests
docs/astral/README.md               the view section names the System Editor; roadmap entry
MERGING.md                          viewbox-events seam update under the Astral section
```

## Phases

### Phase 1 — The dialog and the routing ✅

- the controller, dialog markup and open/close lifecycle;
- all writes wired through the `Burgs` model with layer redraws;
- the three routing seams in `viewbox-events.ts`;
- the marker emission extracted into `system-markers.ts` and reused for the star preview.

Shipped: `AstralSystemEditor` (`src/controllers/astral-system-editor.ts`), the marker click, label
and `#burgIcons` routing, `starShape`/`writeAttrs` in `system-markers.ts` shared with the layer,
and the e2e click expectation moved to `#astralSystemEditor`.

**Acceptance:** clicking a system marker, a system label or (in Astral) a burg icon opens the
System Editor in astral vocabulary; the same clicks in Standard still open the Burg Editor; every
field edit changes the map; close/teardown leaves no listeners behind.

### Phase 2 — Coverage and docs ✅

- e2e: the click test swaps its expectation to `#astralSystemEditor`; new tests — rename updates
  the label, a population change crosses a class threshold (readout, preview and marker colour all
  move), a trait toggle appears on the chart, remove closes the dialog;
- README, MERGING.md.

Shipped: the label-routing, rename, class-threshold, capital-toggle and removal e2e tests; the
README "System Editor" section and roadmap entry; the MERGING.md touch-point section.

**Acceptance:** lint, unit tests, build and the astral e2e specs pass; the standard burg specs pass
unchanged.

## Testing

- **E2E:** extend `astral-systems.spec.ts` (the hit-testing parity guard) — it is the only spec
  that asserts the click seam, so it both proves the new dialog and guards the parity.
- **Unit:** none new — the controller is DOM + model calls; the marker emission stays covered by
  the layer's existing draws, and the class ladder is already tested in `astral-names.test.ts`.
- **Standard guard:** `burgs.spec.ts` and the other Burg Editor specs must pass without edits;
  they exercise `Controllers.BurgEditor.open` directly in Standard view.

## Risks and open questions

- **Duplication with the Burg Editor.** Treasury formatting, lock, relocate and the notes button
  repeat burg-editor code. The codebase prefers readable per-dialog controllers over shared
  abstractions; duplicate the small parts, extract only if a third consumer appears.
- **Label-click branch complexity.** The re-open check must cover both dialogs without becoming a
  mode puzzle: keep it to "which dialog is open for this id" and route the open by `isAstralView()`.
- **Port toggle redraw.** `setPort` can fail validation (a port needs water in Standard); in Astral
  every cell is "land", so the toggle should succeed — keep the `tryEdit` error tip anyway.
- **Marker click while `customization` is active** must no-op with the standard guard, not open a
  dialog mid-edit.

## Out of scope

- A class override or any per-system astral attributes (new state).
- Creating systems (the Burg Creator stays the tool, in either view).
- An astral reskin of the Burgs overview, the legends browser or the notes editor.
- The Burg Editor preview iframe for systems.
