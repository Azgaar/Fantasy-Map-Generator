# Kantzen UI Migration Plan

## Purpose

This document breaks the user interface migration into small, independently shippable milestones. The target is a
consistent Kantzen UI workspace without coupling React components to map generation, world state, or SVG rendering.

Shared visual, accessibility, and interaction rules are documented in `docs/architecture/ui_conventions.md`.

The migration is intentionally incremental. Existing controllers and renderers remain authoritative until their
responsibilities are migrated separately under the FMG 2.0 architecture.

## Current State

The first stage is implemented on `feat/new-ui`:

- A persistent Kantzen workspace sidebar replaces the legacy arrow menu.
- Layers, Style, Options, Tools, and About have stable navigation entries.
- Tools are searchable and grouped, while existing controller IDs and shortcuts are preserved.
- The workspace is responsive and lazy-loaded as a React island.
- Legacy panels and jQuery UI dialogs still provide most of the content behind the new shell.

## Goals

- Give all primary workflows a consistent, readable UI.
- Organize actions around map-making domains instead of legacy implementation details.
- Keep the map canvas visible and usable while editing.
- Preserve existing `.map` serialization and generated world data.
- Keep React and Kantzen UI at the application boundary; controllers own user-driven mutations and renderers own SVG.
- Load editor UI on demand and release editor-specific resources when it closes.
- Remove legacy UI code only after its replacement is verified.

## Non-goals

- Rewriting map generation, world state, or SVG rendering as part of a visual migration.
- Replacing the entire `src/index.html` structure in one change.
- Changing `.map` file contents or compatibility.
- Converting every controller to React before improving the main workflows.
- Recreating Kantzen components with project-specific copies when a suitable component already exists.

## Migration Rules

1. One milestone should be reviewable and releasable independently.
2. New files must be TypeScript. UI files that contain JSX use `.tsx`.
3. React components call typed controller or command adapters; they do not mutate `pack`, `grid`, or SVG directly.
4. Existing controller behavior may be wrapped before it is refactored. UI and domain refactoring should not be mixed
   unless the boundary cannot otherwise be made safe.
5. New panels and dialogs should be lazy-loaded where practical.
6. Legacy markup, selectors, and event bridges remain until no supported workflow depends on them.
7. Every milestone must work with mouse, keyboard, narrow screens, and the existing map canvas.
8. User-facing copy should use domain terms from `docs/domain/glossary.md`.

## Definition of Done

Every milestone must meet these checks before it is marked complete:

- [ ] The migrated workflow no longer requires its legacy UI to be visible.
- [ ] Controller and renderer boundaries remain intact.
- [ ] Keyboard focus, labels, tooltips, disabled states, and Escape behavior are verified.
- [ ] The UI works at desktop and mobile viewport widths without horizontal overflow.
- [ ] Opening, closing, and repeating the workflow does not duplicate handlers or retain editor state accidentally.
- [ ] Existing keyboard shortcuts continue to work or are deliberately replaced and documented.
- [ ] Relevant unit tests are added or updated.
- [ ] `npm run lint`, `npm run build`, and `npm run test -- --run` pass.
- [ ] Targeted Playwright coverage is updated, but the full E2E suite is only run when explicitly requested.
- [ ] Legacy code made unreachable by the milestone is removed in the same change or recorded for Milestone 10.

## Milestones

### 0. Workspace Shell — Complete

The shell establishes navigation, responsive layout, tool search, grouped actions, and compatibility with existing
controllers.

Follow-up work should avoid growing `workspace-sidebar.tsx` into a second monolith. Extract shared primitives and
panel modules before adding more substantial behavior.

### 1. Shared UI Foundation

Create the common components and adapters required by later milestones.

Scope:

- Establish `src/components/ui/` for project-level compositions of Kantzen primitives.
- Add a standard panel header, section, empty state, loading state, and inline error presentation.
- Add shared field compositions for text, number, select, slider, toggle, color, and action rows.
- Add dialog, confirmation dialog, toast, tabs, tooltip, searchable list, and data-table compositions.
- Define a typed command adapter for invoking existing controllers without relying on hidden button clicks.
- Define consistent responsive behavior for workspace panels and modal dialogs.
- Document spacing, typography, icon, focus, and destructive-action conventions.

Exit criteria:

- At least one small existing workflow uses each critical composition.
- Components have no dependency on `pack`, `grid`, or specific SVG elements.
- The workspace shell consumes the extracted panel primitives.

Suggested branch: `feat/ui-foundation`

### 2. Tool Information Architecture

Replace the transitional verb-only grouping with a stable, domain-oriented command registry.

Target groups:

- World: Heightmap, Biomes, Temperature, Population, and Units.
- Politics: States, Provinces, Diplomacy, Cultures, and Religions.
- Settlements: Burgs, Buildings, Markets, Economy, and Production.
- Geography: Rivers, Routes, Zones, Markers, Labels, and Relief.
- Analysis: Cell details, charts, elevation profile, and comparisons.
- Create and Regenerate: destructive or generative commands kept visually distinct from editors.

Scope:

- Give each command a stable ID, label, icon, group, shortcut, search terms, and invocation function.
- Remove duplicate command definitions from the sidebar component.
- Make destructive commands explicit and confirm them where needed.
- Preserve direct links from the guided tour and keyboard shortcuts.

Exit criteria:

- Tools can be searched by both action and domain vocabulary.
- Command invocation no longer depends on clicking hidden legacy controls.
- Each existing tool remains reachable.

Suggested branch: `feat/ui-tool-registry`

### 3. Layers Panel

Make Layers the first fully migrated workspace panel because it exercises toggles, presets, sorting, and map feedback.

Scope:

- Render layer rows, visibility state, drag handles, search, and presets with React and Kantzen UI.
- Create a typed layer view model around the existing layer registry.
- Preserve layer ordering and current SVG renderer behavior.
- Add clear selected, disabled, hidden, and locked states.
- Keep layer-specific settings discoverable without opening unrelated dialogs.

Exit criteria:

- Legacy layer markup is no longer required.
- Toggling, reordering, searching, and applying presets behave identically after save and reload.
- Layer changes do not cause unnecessary full React or SVG rerenders.

Suggested branch: `feat/ui-layers`

### 4. Style Panel

Migrate visual styling controls without treating rendered SVG attributes as React state.

Scope:

- Split Style into clear sections such as Canvas, Terrain, Borders, Labels, Symbols, and Effects.
- Migrate style presets, save preset, font selection, colors, opacity, width, and visibility controls.
- Introduce adapters that read and apply the current style representation through existing style functions.
- Keep the future serializable style model described in `architecture.md` as the destination.
- Avoid combining the UI migration with a full style-state rewrite.

Exit criteria:

- Common style changes have immediate map feedback and deterministic reset behavior.
- Preset loading and saving remain compatible.
- The Style panel does not read arbitrary SVG attributes directly from React components.

Suggested branch: `feat/ui-style`

### 5. Options and About Panels

Migrate application settings and informational content after the form foundation is stable.

Scope:

- Organize Options into Generation, Display, Interaction, Units, and Application sections.
- Migrate seed, map size, density, zoom, units, and other application controls.
- Move dangerous reset actions into a clearly separated section with confirmation.
- Replace About content with an accessible Kantzen panel while preserving credits and project links.
- Keep settings persistence behavior unchanged.

Exit criteria:

- All Options controls use shared field compositions.
- Reloaded settings match the values shown in the UI.
- Reset actions communicate their scope before execution.

Suggested branch: `feat/ui-options`

### 6. New Map, Save, Load, and Export

Replace the most visible file and generation dialogs with coherent workflows.

Implement as separate changes in this order:

1. New Map and regeneration confirmation.
2. Save Map and save metadata.
3. Load Map, validation errors, and incompatible-file guidance.
4. Export image, data, tiles, and related format options.

Scope:

- Use shared dialogs, fields, progress states, and notifications.
- Keep file parsing, serialization, and export logic outside React components.
- Show actionable validation errors instead of generic alerts.
- Prevent double submission and make long-running work visible.

Exit criteria:

- `.map` round trips are unchanged.
- Canceling any workflow has no side effects.
- File and export errors are recoverable without reloading the app.

Suggested branches: `feat/ui-new-map`, `feat/ui-save-load`, and `feat/ui-export`

### 7. Overview Tables

Migrate dense read/edit surfaces onto the shared data-table and inspector patterns. Keep each group as a separate PR.

Order:

1. Burgs, States, and Provinces.
2. Cultures and Religions.
3. Routes, Rivers, Zones, and Markers.
4. Military, Markets, Prices, Production, and Trade.

Scope for each overview:

- Search, sort, filter, select, and bulk actions.
- Explicit empty and filtered-empty states.
- Keyboard navigation and stable focus after edits.
- A consistent path from a row to its map location and detailed editor.
- Virtualization or pagination only when measurements show it is necessary.

Exit criteria:

- The overview remains responsive on large maps.
- Table actions go through controllers rather than mutating world state in cell renderers.
- Exported data matches the legacy overview output where applicable.

Suggested branches: `feat/ui-overview-<domain>`

### 8. Contextual Editors

Move object editing into the workspace panel where it benefits map interaction, while retaining modal dialogs for
tasks that genuinely need focused or multi-step space.

Order:

1. Cell, label, marker, and burg inspectors.
2. Route, river, coastline, and zone editors.
3. State, province, culture, and religion editors.
4. Heightmap and other specialized full-workspace tools.

Scope:

- Define typed selection and editor-session boundaries.
- Preserve the map selection highlight while the panel is open.
- Support Apply/Cancel where edits cannot safely be immediate.
- Warn before discarding dirty edits.
- Release temporary handlers and selections when an editor closes.

Exit criteria:

- Editors can be opened repeatedly without accumulating global listeners.
- Selection, mutation, undo expectations, and rendering updates are explicit.
- Floating dialogs are retained only when they are the clearer interaction model.

Suggested branches: `feat/ui-editor-<domain>`

### 9. Map Canvas Chrome

Unify controls that sit directly over the map after the panels and editors are stable.

Scope:

- Zoom controls, scale, map coordinates, tooltips, selection state, and contextual actions.
- Measurement and placement mode indicators.
- Mobile-safe positioning that does not conflict with the workspace panel.
- Consistent icons, labels, shortcuts, and accessible names.

Exit criteria:

- Map controls remain usable at supported zoom and viewport sizes.
- Controls do not intercept map gestures outside their visible bounds.
- Active editing or placement mode is always apparent and can be canceled with Escape.

Suggested branch: `feat/ui-map-controls`

### 10. Legacy UI Removal

Remove compatibility code only after the replacement workflows have shipped and been verified.

Scope:

- Remove hidden menu tabs, hidden action buttons, and obsolete event bridges.
- Remove migrated markup from `src/index.html` in small, reviewable sections.
- Remove unused jQuery UI dialog initialization and CSS.
- Remove obsolete icon and style assets after confirming no remaining consumers.
- Update the guided tour, tests, and documentation to reference only the new UI.
- Measure the final JavaScript and CSS bundle impact.

Exit criteria:

- Searches find no runtime references to removed selectors or dialog IDs.
- Startup, map generation, editing, save/load, and export smoke tests pass.
- Legacy dependencies are removed only when their final consumer is gone.

Suggested branch: `refactor/remove-legacy-ui`

## Progress Tracker

| Milestone | Status | Depends on |
| --- | --- | --- |
| 0. Workspace Shell | Complete | — |
| 1. Shared UI Foundation | In progress | Workspace Shell |
| 2. Tool Information Architecture | In progress | Shared UI Foundation |
| 3. Layers Panel | Planned | Shared UI Foundation |
| 4. Style Panel | Planned | Shared UI Foundation |
| 5. Options and About | Planned | Shared UI Foundation |
| 6. New Map, Save, Load, and Export | Planned | Shared UI Foundation |
| 7. Overview Tables | Planned | Shared UI Foundation, Tool Registry |
| 8. Contextual Editors | Planned | Shared UI Foundation, relevant overviews |
| 9. Map Canvas Chrome | Planned | Contextual Editors |
| 10. Legacy UI Removal | Planned | All replacement milestones |

## Recommended Next Step

Verify the domain-oriented tool registry against the rendered application, then migrate Layers in Milestone 3. The
Layers workflow will exercise shared fields and feedback against real state while preserving the existing SVG renderer.

## Implementation Log

### Milestone 1

Completed:

- [x] Extract shared workspace panel, search, section, action-row, and empty-state compositions.
- [x] Use Kantzen SearchField, Button, Icon, and EmptyState primitives in the extracted components.
- [x] Refactor the Tools panel to consume the shared compositions.
- [x] Add a typed compatibility adapter for commands still owned by legacy controls.
- [x] Add unit coverage for available, disabled, and missing legacy command targets.
- [x] Make the displayed Tools search shortcut functional while the panel is active.
- [x] Extract the visible workspace panel header from legacy markup.
- [x] Add shared toggle-field and confirmation-dialog compositions.
- [x] Replace the Tools regeneration prompt with the Kantzen confirmation dialog.
- [x] Preserve regeneration modifiers and the session-level confirmation preference through a typed command event.
- [x] Add accessible text, number, select, range, and color field compositions.
- [x] Add a general modal-dialog foundation with focus containment and restoration.
- [x] Add semantic inline feedback for info, success, warning, and danger states.
- [x] Document spacing, typography, icon, form, focus, feedback, and destructive-action conventions.
- [x] Add a Kantzen-backed tabs composition with keyboard navigation.
- [x] Add a generic accessible data-table foundation with roving row focus and empty states.

Remaining:

- [ ] Exercise the general dialog and remaining field types in a migrated workflow.
- [ ] Exercise tabs and data tables in the first migrated overview workflow.

### Milestone 2

Completed:

- [x] Move tool definitions out of the workspace sidebar into a typed command registry.
- [x] Give commands stable IDs, compatibility control IDs, icons, descriptions, shortcuts, search terms, and invocation
      functions.
- [x] Organize tools into World, Politics, Settlements, Geography, Analysis, Create, and Regenerate domains.
- [x] Search tool labels, descriptions, domain vocabulary, and synonyms.
- [x] Invoke editor and placement controllers directly instead of clicking hidden legacy controls.
- [x] Keep regeneration behind the typed command event and the Kantzen confirmation dialog.
- [x] Preserve existing DOM IDs used by the guided tour, keyboard shortcuts, and placement state.
- [x] Replace the expandable regeneration menu with a visible, visually distinct command section.

Remaining:

- [ ] Verify command reachability and responsive grouping in a rendered browser session.
