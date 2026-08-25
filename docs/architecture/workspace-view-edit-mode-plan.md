# Workspace View and Edit Mode Implementation Plan

## Status

Implemented. The workspace now defaults to Edit mode and stores the current View/Edit choice only for the browser
session. View mode exposes the 2D map, layer exploration, Cell Info, and Charts while all authoring, styling,
generation, and mixed editor panels remain capability-gated in Edit mode until they have a dedicated read-only
presentation. The implementation includes pure style serialization, session-scoped layer overrides, semantic dirty
events, transition cleanup, and View-mode diagnostics. The release checklist below remains as the design/audit record.

This document defines how Fantasy Map Generator should introduce two workspace access modes:

- **View mode** for exploring a map without changing the serialized map document.
- **Edit mode** for creating, editing, styling, and regenerating map content.

The work is intentionally incremental. It must preserve existing `.map` compatibility and coexist with legacy
globals and controllers while the FMG 2.0 migration continues.

## Related documents

- [`CONTEXT.md`](../../CONTEXT.md)
- [`architecture.md`](architecture.md)
- [`data_model.md`](data_model.md)
- [`legacy-code.md`](legacy-code.md)
- [`ui_migration_plan.md`](ui_migration_plan.md)
- [`pixi-renderer-migration.md`](pixi-renderer-migration.md)
- [`pixi-viewer-spike.md`](pixi-viewer-spike.md)
- [`grand-strategy-game.md`](../prd/grand-strategy-game.md)

## Purpose

View mode should make the full workspace useful for presenting and inspecting a generated world without exposing
map-authoring actions. It is not enough to hide the Edit menu: all user-facing mutation entry points must follow one
mode policy, and exploration actions must not accidentally mutate or dirty the serialized map document.

The distinction also creates a useful boundary for a possible future game mode. A game may inspect the map and mutate
simulation state without receiving permission to rewrite terrain, countries, styles, or generation settings.

## Terminology

The project already uses a concept that must not be overloaded:

- `customization` identifies a **temporary editor workflow** such as territory painting or heightmap editing.

The new concept is **workspace mode**:

```ts
export type WorkspaceMode = "view" | "edit";
```

Map presentation remains fixed to the 2D renderer, so workspace mode is the only view/edit mode concept exposed by the
application.

## Core contract

> View mode may change transient exploration state, but it must not change anything serialized into the `.map`
> document.

This distinction is required because exploring a map necessarily changes application state. Panning, zooming,
selecting an entity, opening a panel, filtering a table, and temporarily toggling a layer are allowed changes, but
they are not map-document mutations.

### State ownership

| State | Examples | Owner | Serialized | View mode may change it |
| --- | --- | --- | --- | --- |
| World | `grid`, `pack.cells`, states, burgs, rivers, routes | world model | yes | no |
| Map configuration | map name, units, generation options, notes | document/config state | yes | no |
| Semantic style | colors, widths, symbols, persisted layer defaults | style state | yes | no |
| View session | camera, selection, temporary visibility, panel filters | application/viewer | no | yes |
| Runtime resources | Pixi containers, textures, buffers, DOM nodes | renderer/UI | no | yes |

The mode itself is application state. It must not be stored in `.map` files. The initial release should default to Edit
mode for backwards compatibility and keep mode selection only for the current browser session.

## Product behavior

| Action | View | Edit | Notes |
| --- | ---: | ---: | --- |
| Pan, zoom, fit | yes | yes | Transient view state |
| Hover, select, inspect, open read-only panels | yes | yes | Must not write derived data into `pack` |
| Sort, filter, search, paginate, copy | yes | yes | UI-local state |
| Temporarily toggle layers or apply a display preset | yes | yes | Session-only in View; persisted in Edit |
| Load another map | yes | yes | Loaded workspace remains in the current mode |
| Save or export | yes | yes | Serialization and export must be read-only |
| Change names, notes, units, options, or styles | no | yes | Serialized document state |
| Add, delete, drag, paint, assign, or reorder map entities | no | yes | World mutation |
| Generate, regenerate, transform, or create a submap | no | yes | Destructive document operation |
| Create a new map | no | yes | New authoring workflow |
| Add a persisted measurer | no | yes | `pack.measurers` is document state |

Loading is allowed because it replaces the active document rather than editing the loaded file. New Map remains an
Edit-mode action because it opens an authoring workflow and generates new document state.

## Goals

- Provide a prominent and understandable View/Edit switch in the workspace toolbar.
- Keep inspection, presentation, layer exploration, charts, and read-only panels useful in View mode.
- Enforce the mode at execution boundaries, not only through hidden buttons.
- Make save/export operations pure with respect to the live application state.
- Keep View-mode exploration from setting the dirty flag or triggering autosave.
- Preserve `.map` format compatibility and the current default editing workflow.
- Establish a small capability model that can later distinguish map editing from game simulation.
- Migrate incrementally without a large rewrite of `src/index.html` or every controller at once.

## Non-goals

- Building a game loop, game UI, AI, simulation clock, or game save format.
- Converting the main workspace into the standalone Pixi viewer.
- Treating View mode as a security boundary against browser console code or extensions.
- Replacing `pack`, `grid`, or typed arrays with immutable data structures.
- Adding undo/redo or transactional editing as part of mode switching.
- Redesigning all overview panels at once.
- Changing the `.map` schema solely to store the workspace mode.
- Introducing a new production dependency.

## Capability policy

Use a small capability layer instead of scattering `mode === "edit"` checks throughout the codebase.

Initial capabilities:

```ts
export type WorkspaceCapability = "map:inspect" | "map:edit" | "map:generate";
```

| Mode | `map:inspect` | `map:edit` | `map:generate` |
| --- | ---: | ---: | ---: |
| View | yes | no | no |
| Edit | yes | yes | yes |

The API should be minimal:

```ts
getWorkspaceMode(): WorkspaceMode;
setWorkspaceMode(mode: WorkspaceMode): Promise<boolean>;
hasWorkspaceCapability(capability: WorkspaceCapability): boolean;
requireWorkspaceCapability(capability: WorkspaceCapability): boolean;
subscribeToWorkspaceMode(listener: (mode: WorkspaceMode) => void): () => void;
```

`requireWorkspaceCapability` should show a concise explanation when a user tries to invoke a blocked action. It should
return `false` rather than throwing for ordinary UI commands.

This is an application policy, not authorization. A future game mode can add a separate `simulation:command`
capability without inheriting `map:edit`.

## Proposed architecture

```text
workspace mode
      |
      v
capability policy -----------------------------+
      |                                        |
      v                                        v
toolbar / hotkeys / map input            dialogs and panels
      |                                        |
      +-- map:inspect ------------------------> read-only presentation
      |
      +-- map:edit / map:generate
                  |
                  v
          controller mutation
                  |
                  +--> renderer invalidation
                  |
                  +--> map:mutated --> dirty tracking / autosave

view-session changes --> renderer invalidation only
```

### Workspace mode owner

Add `src/application/workspace-mode.ts`. The module owns the current mode and mode-change lifecycle, but it must not
read or write `pack`, `grid`, or `style` directly.

The application shell initializes it before the toolbar and input handlers subscribe. Expose a temporary `window`
bridge only if unmigrated code requires one, and record it in `legacy-code.md`.

### View session owner

Add a small application/viewer state module only when the first transient override is implemented. It should contain
the current selection and View-mode layer-visibility overrides. Do not copy or snapshot the whole world.

The renderer consumes effective values:

```text
effective layer visibility = view-session override ?? document visibility
```

Entering View mode starts with the document's visibility. View-mode changes write overrides. Returning to Edit mode
clears the overrides and redraws from the persisted document visibility.

### Command metadata

Extend `ToolCommand` with an explicit capability:

```ts
requiredCapability: WorkspaceCapability;
```

Group names are not sufficient because some overview controllers both inspect and edit. Capability metadata must be
explicit and checked by `tool-command-executor.ts` before invoking a controller.

Editing hotkeys should dispatch registered commands instead of opening controllers directly. Any temporary direct
entry point must call the same capability guard.

### Dialog classification

Extend managed-dialog registration with an access classification:

```ts
type DialogAccess = "inspect" | "edit";
```

This allows the Edit-to-View transition to close edit-only dialogs while keeping read-only inspectors and charts
open. Mixed controllers should register as `inspect` when rendered read-only and `edit` otherwise.

### Mutation and dirty events

Introduce a semantic `map:mutated` event emitted after a committed document mutation. It replaces generic DOM input
and renderer redraw signals as the primary dirty/autosave trigger.

Do not make renderers responsible for deciding whether a document changed:

- renderer invalidation means pixels may need to change;
- `map:mutated` means serializable data changed;
- session/view invalidation must never imply a document mutation.

Existing `editor-mutations.ts` is a useful convergence point, but it does not yet cover all direct controller writes.
The mode feature should first guard all UI entry points, then incrementally route committed edits through a shared
mutation notification helper.

## Mode transitions

### Edit to View

1. Request the mode change through `setWorkspaceMode("view")`.
2. If `customization` is active, do not change modes automatically. Ask the user to apply, cancel, or finalize the
   active workflow first.
3. Ask managed edit dialogs to close through their existing `requestClose` behavior.
4. Clear editing overlays, handles, pressed tools, and editing cursors.
5. Verify that no customization workflow remains active.
6. Set the mode, start the view session, update the workspace UI, and announce the change to assistive technology.

Already committed edits are preserved. The transition does not attempt to undo them.

### View to Edit

1. Clear temporary visibility and selection overrides.
2. Restore the persisted document presentation.
3. Set Edit mode and update the workspace UI.
4. Do not automatically open an editor.

### Load while in View

Loading closes document-specific dialogs and view-session state as it does today. After the new document finishes
loading, create a fresh view session and remain in View mode.

## Read-only panels

Classify each controller before exposing it in View mode:

| Classification | Behavior in View |
| --- | --- |
| Inspect-only | Open normally |
| Edit-only | Hide/disable entry point and guard invocation |
| Mixed | Open in read-only presentation |

For a mixed panel, View mode should:

- render values as text or read-only fields;
- omit add, delete, regenerate, apply, assign, drag, lock, and destructive controls;
- avoid binding mutation listeners;
- retain search, sort, pagination, location, charts, copy, and export;
- compute display statistics without caching them back into `pack`;
- register the resulting dialog as `inspect`.

Initial audit targets include Burgs, Markets, Military, Markers, Rivers, Routes, Labels, and Notes. Cell Info and
Charts are good candidates for the first View-mode panels, but they still require a mutation audit before being
declared safe.

## Map interaction behavior

### Primary click

- Edit mode keeps the current click-to-edit dispatch.
- View mode selects the picked domain entity and opens its read-only inspector or overview.
- If no inspector exists yet, keep the selection and tooltip rather than opening an editor.

### Context menu

View mode may show:

- inspect entity;
- inspect area or cell;
- center here;
- copy map coordinates;
- copy cell or entity ID.

Edit mode additionally shows the existing edit, add, and persisted measure actions.

### Keyboard

- Camera, projection, inspection, layer, copy, save, load, and export shortcuts remain active.
- Editor, create, regenerate, Delete, and persistent measurer shortcuts require Edit mode.
- Blocked shortcuts should not open lazy controller chunks.

## Serialization and layer changes

`Save.prepareMapData` currently captures live layer visibility and order by mutating `style`. Refactor this before View
mode is enabled:

1. Persist layer visibility/order at the moment an Edit-mode layer command commits.
2. Keep View-mode visibility in a session override.
3. Make the serializer construct a detached serialized style value without modifying the live `style` object.
4. Ensure save and export do not alter the dirty flag.
5. Remove renderer-side writes such as style updates performed only because a layer was drawn.

Built-in display presets may be applied temporarily in View mode. Creating, renaming, or removing stored custom
presets is a preference mutation and should initially remain Edit-only.

## Autosave and dirty tracking

Replace the current broad dirty signals with semantic document mutations:

- stop treating every captured DOM `input` or `change` event as a map edit;
- stop treating every Pixi content invalidation as a map edit;
- mark dirty after generator/editor commits and persisted style/config changes;
- clear dirty on successful load and save as today;
- do not autosave because a user explored the map in View mode.

Until all legacy writes publish `map:mutated`, keep a documented compatibility bridge for known legacy controls. The
bridge must check that the changed control owns serialized document data and that the workspace is in Edit mode.

## Implementation milestones

Each milestone should be independently reviewable and keep the default Edit workflow working.

### 0. Mutation inventory and policy tests

Scope:

- Inventory all toolbar, tool registry, hotkey, map click, context menu, inline HTML, and dialog mutation entry points.
- Classify controllers as inspect-only, edit-only, or mixed.
- Record which layer, style, option, and overview interactions write serialized data.
- Add the expected capability matrix as unit-test fixtures before wiring UI behavior.

Exit criteria:

- Every current public mutation entry point has an owner and required capability.
- Mixed panels have a documented read-only conversion decision.
- Hidden mutations discovered during panel opening or rendering are tracked as implementation tasks.

Suggested branch: `feat/workspace-mode-audit`

### 1. Workspace mode and capability foundation

Scope:

- Add the workspace mode module, types, subscription, and capability checks.
- Default to Edit mode and keep the value outside `.map` serialization.
- Keep map presentation fixed to the 2D renderer.
- Add mode attributes to the application root for UI styling and diagnostics.
- Unit-test mode transitions, capability checks, and subscriptions.

Exit criteria:

- Mode can change programmatically without changing document state.
- Existing 2D map behavior is unchanged.
- A future capability can be added without changing every caller to a new mode comparison.

Suggested branch: `feat/workspace-mode-foundation`

### 2. Persistence, view state, and dirty-state purity

Scope:

- Separate persisted layer visibility/order from session overrides.
- Make save serialization pure.
- Introduce `map:mutated` and update dirty/autosave behavior.
- Remove known renderer or panel-opening writes that would make View mode unsafe.
- Add a canonical serializable document snapshot helper for tests.

Exit criteria:

- Saving twice does not mutate live state.
- Camera, selection, layer overrides, and panel controls do not mark the document dirty.
- Edit-mode visibility/order changes still round-trip through `.map` files.
- View-mode visibility changes disappear when the view session ends.

Suggested branch: `feat/workspace-view-state`

### 3. Workspace switch and command gating

Scope:

- Add the View/Edit control to the workspace toolbar.
- Add capability metadata to tool commands and enforce it in the command executor.
- Refactor mutation hotkeys through the command policy.
- Gate New Map, Style, World Setup, Create, Edit, and Regenerate entry points.
- Extend managed dialogs with access classification.
- Implement safe Edit-to-View cleanup and customization blocking.

Exit criteria:

- No toolbar, shortcut, or registered command can open an editing workflow in View mode.
- Blocked commands are also rejected when invoked programmatically through their public UI adapter.
- Switching to View closes editing UI without closing safe inspectors.
- The current Edit workflow remains behaviorally unchanged.

Suggested branch: `feat/workspace-mode-switch`

### 4. Mode-aware map interactions

Scope:

- Add transient domain selection for View mode.
- Route primary clicks to inspectors instead of editors.
- Split the context menu into inspect and edit capabilities.
- Disable Delete, persisted measurement, drag handles, brushes, and create tools in View mode.
- Preserve pan, zoom, picking, hover, tooltip, center, and copy behavior.

Exit criteria:

- Clicking any supported map entity in View mode cannot open an editor.
- Context menus contain no mutation action in View mode.
- Editing overlays cannot survive an Edit-to-View transition.
- Pointer and keyboard exploration continue to work on desktop and mobile.

Suggested branch: `feat/workspace-view-interaction`

### 5. Read-only overview conversion

Convert mixed panels in small, domain-focused changes. Suggested order:

1. Cells, Charts, and common inspector shell.
2. Burgs, Markets, Production, and Trade.
3. States, Provinces, Cultures, Religions, and Military.
4. Rivers, Routes, Markers, Labels, Zones, and Notes.

Scope for each group:

- derive read-only presentation from workspace capability;
- remove mutation controls and listeners in View mode;
- keep inspection, navigation, filtering, copying, charts, and exports;
- add focused unit tests for the read-only rendering and handlers;
- document any editor that remains unavailable until a safe inspector exists.

Exit criteria:

- Every tool exposed in View mode has a tested no-mutation path.
- Opening and closing View-mode panels does not alter the canonical document snapshot.
- Panels are still transient and release their resources on close.

Suggested branches: `feat/workspace-view-inspect-*`

### 6. Hardening and release gate

Scope:

- Audit remaining direct writes to `pack`, `grid`, `style`, `options`, and `notes`.
- Add development diagnostics that report a document change occurring while in View mode.
- Add integration coverage for toolbar, hotkeys, map picking, context menus, dialogs, layers, save, and export.
- Update architecture, UI, hotkey, and legacy bridge documentation.
- Confirm all mode UI works at narrow and desktop widths and with keyboard navigation.

Exit criteria:

- The canonical document snapshot is unchanged after the complete View-mode exploration scenario.
- No View-mode action sets dirty or triggers autosave.
- All mutation entry points are blocked in View and still operate in Edit.
- Save/load round trips and old `.map` migrations remain unchanged.

Suggested branch: `feat/workspace-mode-hardening`

## Expected file areas

This is a guide, not a requirement to change all files in one milestone.

| Area | Expected responsibility |
| --- | --- |
| `src/application/workspace-mode.ts` | Mode store, capabilities, transition lifecycle |
| `src/application/view-session-state.ts` | Transient selection and presentation overrides |
| `src/controllers/view-mode-events.ts` | Rename presentation mode/event without changing behavior |
| `src/components/workspace-toolbar.tsx` | Mode switch and capability-aware menus |
| `src/components/tool-registry.ts` | Required capability metadata |
| `src/components/tool-command-executor.ts` | Central execution guard |
| `src/components/hotkeys.ts` | Route editing shortcuts through guarded commands |
| `src/components/viewbox-events.ts` | Inspect-versus-edit click dispatch |
| `src/components/map-context-menu.tsx` | Capability-aware context actions |
| `src/components/dialog/dialog-helpers.ts` | Dialog access classification and transition cleanup |
| `src/components/layers/` | Persisted visibility versus session overrides |
| `src/services/io/save.ts` | Pure document serialization |
| `src/services/autosave.ts` | Semantic dirty tracking |
| `src/controllers/` | Read-only mixed-panel presentation and guarded mutations |

Do not place map state or capability logic in renderers. Renderers receive effective state and render it.

## Testing strategy

### Unit tests

- Workspace-mode transitions and subscriptions.
- Capability matrix and blocked-action responses.
- Tool-command metadata completeness.
- Layer document/session visibility resolution.
- Pure serializer behavior.
- Semantic dirty-event behavior.
- Dialog access classification.
- Read-only rendering for each converted mixed panel.

### Integration tests

- Toolbar visibility and disabled states by mode.
- Editing shortcuts do not lazy-load controllers in View mode.
- Map click and context-menu routing by mode.
- Edit-to-View transition with open dialogs and customization workflows.
- Load while remaining in View mode.
- View-mode layer overrides followed by return to Edit.

### Document immutability scenario

1. Load a representative map.
2. Capture a canonical snapshot of all serializable world, configuration, style, and overlay data.
3. Enter View mode.
4. Pan, zoom, change projection, toggle layers, apply a temporary preset, select entities, open and filter panels,
   inspect charts, copy data, save, and export.
5. Capture the canonical document snapshot again.
6. Assert exact equality and assert that dirty remained `false`.
7. Attempt editor, create, regenerate, Delete, drag, and context-menu mutation paths and verify rejection.
8. Enter Edit mode and verify representative mutations still succeed and set dirty.

The snapshot helper should exclude time-dependent save metadata such as the save date. Comparing two raw `.map` files
would otherwise produce false differences.

### Required checks per milestone

- `npm run lint`
- `npm run build`
- `npm run test -- --run`
- Update targeted Playwright coverage, but only run the full E2E suite when explicitly requested.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Hidden direct writes bypass the command registry | Inventory entry points, close edit UI on transition, add snapshot tests and diagnostics |
| Mixed overviews mutate while appearing read-only | Audit open/render handlers; compute pure view models; bind no mutation listeners in View |
| Layer exploration changes saved appearance | Separate session overrides from persisted visibility and make serialization pure |
| Generic DOM events mark View dirty | Use semantic `map:mutated` events |
| `customization` is abandoned halfway through a transition | Block mode change until the workflow applies, cancels, or finalizes |
| Mode checks spread across the codebase | Central capability API and explicit command metadata |
| View mode is mistaken for security enforcement | Document that it is a product policy; future shared authority requires server enforcement |
| Broad refactor destabilizes legacy UI | Ship milestones independently and preserve compatibility bridges until callers migrate |

Deep-freezing or proxying the live world is not recommended. Large typed arrays, legacy globals, and renderer caches
make it expensive and incomplete. Enforcement should happen at user-action boundaries and be verified with canonical
document snapshots.

## Release definition of done

- [ ] View/Edit is visible, keyboard accessible, and understandable without opening another menu.
- [ ] The workspace presents only the 2D map renderer.
- [ ] View mode exposes no create, edit, style, option, or regeneration command.
- [ ] Toolbar, hotkey, click, context-menu, dialog, and legacy entry points enforce the same capability policy.
- [ ] View mode supports useful map and panel inspection.
- [ ] Temporary layer and camera changes are not serialized.
- [ ] Save and export do not mutate the live document.
- [ ] View exploration does not set dirty or trigger autosave.
- [ ] Active customization cannot be stranded by a mode transition.
- [ ] Loading a map preserves the current workspace mode.
- [ ] Canonical before/after document snapshots are identical for the full View-mode scenario.
- [ ] Representative Edit-mode mutations still work and mark the document dirty.
- [ ] Existing `.map` files load and save without format changes.
- [ ] Architecture and legacy bridge documentation is updated.

## Future game compatibility

This plan does not implement gameplay. It only avoids a binary assumption that every state-changing action is a map
edit. If a game mode is added later, keep three boundaries separate:

```text
map definition mutations  -> map:edit
view/session changes      -> map:inspect
simulation commands       -> simulation:command
```

Game state should remain separate from the generated map definition as described in `grand-strategy-game.md`. A game
mode may receive `map:inspect` and `simulation:command` while still being denied `map:edit` and `map:generate`.

The standalone Pixi viewer remains the preferred editor-free embedding boundary. The in-app View mode described here
continues to use the main workspace because users still need its panels, inspection tools, exports, and presentation
controls.
