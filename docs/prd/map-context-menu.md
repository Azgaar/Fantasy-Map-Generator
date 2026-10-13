# PRD — Map Context Menu

## Problem Statement

A spot on the Map usually has several things at once: a Burg inside a Province inside a State, crossed by a River and a Route, under a Marker, an Emblem or a Regiment. Left-click opens the editor of whatever is drawn on top, and nothing else. To reach what lies underneath, the user has to hide Layers, zoom until the shapes separate, or search by name. Things on hidden Layers can't be reached from the map at all.

Right-click on the map opens the browser's own menu, which is useless here. The Journey path editor is the exception: there, right-click undoes or removes path points, and nothing hints at it.

Key-tier users can ask the Assistant about the Map, but have to describe the place in words first, and the Assistant then has to guess which Burg or Province they meant.

## Starting point

What exists on `v1.155.0` and is reused as is:

- **Left-click routing.** The default viewbox events open an editor for the clicked SVG element through three lookup tables (by the id of the element's parent, grandparent or great-grandparent group), plus a branch for Labels. The element itself is the input, so the routing knows nothing about entity refs.
- **`MapEntities`.** One config object (`EntityLookup.types`) describes every entity type: name, kind, icon, zoom scale, Layers, highlight selector, position and geometry. `resolveTarget(element)` turns any map element into an `EntityRef`. Territory types (State, Province, Culture, Religion, Biome) already declare their per-Cell assignment through `cells`.
- **Revealing.** `revealEntity(ref)` turns on the entity's Layers, zooms to it and outlines it. The Omnibar opens an entity with `MapEntities.open(ref)` when its type has an editor hook, and reveals it otherwise.
- **The Omnibar.** One closed controller class with `open()` and `close()`, its own inline styles, capture-phase key handling while open, and closing on outside pointer-down, blur and `map:generated`. It is the pattern for the menu.
- **The Assistant.** Only the Key tier gets the map tools, so only it can read the Map. The dialog exposes `open` and `toggle`. There is no way to send it a question from elsewhere in the app.
- **Journey path editor.** The only right-click handlers on the map: one on the viewbox undoes the last drawn point, one on each control point removes it. Five UI strings mention right-click.

## Solution

Right-click anywhere on the map opens a small **map context menu** at the cursor. It lists **everything at that spot** across all Layers, one row per entity, from the most specific to the broadest:

1. the entity left-click would open, first;
2. everything else drawn under the cursor (`elementsFromPoint`, resolved by `MapEntities.resolveTarget`);
3. what the Cell holds even when it isn't drawn there: its Burg, River, Routes, Markers, Zones, Journeys and Regiments, its resource Good and the Goods its Burg produces, its Feature, and its Market, Province, State, Culture, Religion and Biome.

After the first row, rows are ordered by the entity type's zoom scale (largest first), which already ranks a Burg above a Province above a State. Each row shows the type's icon, the entity's name and its kind.

- **Click** a row to do what the existing code already does for it. The entity's element (the one under the cursor, or its own element when its Layer is on) goes through the left-click routing and opens the same editor left-click would. Otherwise it works like an Omnibar result: open the editor if the type has an editor hook, else reveal the entity, turning its Layers on. Hovering a row does nothing on the map.
- A row whose Layers are all off is **dimmed**.
- For the Key tier, a last row **What's there?** sends the Assistant the question with the Cell's key and the clicked point in map units, such as `What's there? cell:4512, x:812.35, y:409.2`. The point matters for distances; the map tools read everything else from the Cell.

Right-click on the map is reserved for the menu. The Journey path editor moves to Backspace (undo the last point) and double-click (remove a control point). Shift+right-click still opens the browser's own menu. In a customization mode (heightmap editing, annexing) the menu doesn't open.

## User Stories

1. As a map maker, I want right-click on the map to open a menu at the cursor, so I can act on a place without searching for the right panel.
2. As a map maker, I want the menu to list everything at the spot across all Layers, so I can reach things hidden under others.
3. As a map maker, I want the entity left-click would open listed first, so the menu agrees with what I see on top.
4. As a map maker, I want the other rows ordered from the most specific to the broadest, so a Burg comes before its Province and its State.
5. As a map maker, I want each row to show the entity's icon, name and kind, so I can tell a Burg from a Marker with the same name.
6. As a map maker, I want the Province, State, Culture, Religion and Biome of the spot listed, so I can reach them without finding their shapes.
7. As a map maker, I want the Zones that contain the spot listed, so I can reach overlapping Zones.
8. As a map maker, I want the spot's Feature listed (continent, island, lake or ocean).
9. As a map maker, I want the River and Routes of the Cell listed even when I missed their thin lines, so I don't need pixel-precise clicks.
10. As a map maker, I want the Burg and Markers of the Cell listed even when their icons are covered or hidden.
11. As a game master, I want Regiments, Emblems and Journeys drawn at the spot listed, so I can reach a Regiment standing on a Burg.
12. As a map maker, I want "none" entities (Neutrals, Wildlands, No religion) and removed entities left out, so the list shows only real content.
13. As a map maker, I want each entity listed once even when it was found both drawn and in the Cell.
14. As a map maker, I want clicking a drawn row to open the same editor left-click opens for it.
15. As a map maker, I want clicking any other row to show the entity the way search does, so I can find it on the map.
16. As a map maker, I want rows on hidden Layers dimmed, so I know they're there but not visible.
17. As a map maker, I want clicking a dimmed row to turn its Layer on, so I don't have to find the Layer toggle.
18. As a Key-tier user, I want a *What's there?* row, so I can ask the Assistant about a place in one click.
19. As a Key-tier user, I want *What's there?* to give the Assistant the exact Cell and point I clicked, so the answer is about that place and distances are measured from it.
20. As a Key-tier user, I want the question shown in the Chat like one I typed, so I can follow up.
21. As a Key-tier user, I want *What's there?* to use my current Chat for this Map when it can.
22. As a Key-tier user, I want *What's there?* clicked while an answer is in flight to wait in the input rather than interrupt.
23. As a Guest or Member, I don't want to see *What's there?*, because the free Assistant can't read the Map.
24. As a map maker, I want the menu to close on Escape, a click outside, a row click, zoom, pan, window blur or a new map.
25. As a map maker, I want the menu kept inside the window near its edges.
26. As a keyboard user, I want arrow keys to move between rows and Enter to activate one.
27. As a power user, I want Shift+right-click to open the browser's own menu.
28. As a Journey editor user, I want Backspace to undo the last point while drawing a path.
29. As a Journey editor user, I want to double-click a control point to remove it.
30. As a Journey editor user, I want the editor's hints to name the new inputs.
31. As a user of a customization mode, I want right-click not to open the menu, so the mode isn't disturbed.
32. As a 3D view user, I want right-click drag to keep rotating the 3D view.
33. As a user with another UI language, I want the menu and the *What's there?* question in my UI language.
34. As a maintainer, I want the Cell lookup to live in the existing entity config, so a new entity type declares it in the same place as everything else.
35. As a maintainer, I want the menu to be one closed class like the Omnibar, so it's understandable on its own.
36. As a maintainer, I want no Editor or tool to listen for right-click on the map, so the input has one owner.

## Implementation Decisions

Rule: the smallest change that delivers the stories. Enlarge existing configs and modules rather than adding new ones. One new source file.

### `MapEntities` (enlarged)

- New optional field on the entity definition: `isAt?: (ref: EntityRef, cell: number) => boolean`, whether a Cell holds the entity, for types not assigned through `cells`. A predicate on the ref, not a list of ids, so a Regiment (a State id plus a regiment id) fits too. It's declared for Burg (`cells.burg`), River (`cells.r`), Feature (`cells.f`), Route (the values of `cells.routes[cell]`), Marker (`marker.cell`), Zone (`zone.cells`), Journey (the cell of each segment point), Market (`cells.market`), Regiment (the Cell at its current `x`, `y`; its `cell` stays where it was raised) and Good (`cells.good`, or a production record of the Cell's Burg).
- New method `at(cell: number): EntityRef[]`. For every type, it keeps the refs of the type's own `refs()` that `cells()[cell]` assigns or `isAt` accepts. That reuses the existing rule for which ids are real (index 0 of States, Provinces, Cultures and Religions excluded, Biome 0 kept, removed entities dropped). Results come back in config order.
- `resolveTarget` also reads the layers that carry an id in a data attribute: Burg icons and Goods burg plates (`data-id`), State, Province and Burg Emblems (`data-i`), Goods icons (`data-i`), Ice (`data-id`), Relief icons (`data-id`, the `pack.relief` index), Lakes and Coastline (`data-f`). A Measurer is its group's index in `#ruler`, as in the Measurers editor. The note tooltip shares it, so hovering an Emblem shows its owner's note.
- No other `MapEntities` change. Search and the Assistant are unaffected.

### Left-click routing (refactored, not changed)

- The body of the click handler becomes an exported `openEditor(target: Element): boolean`: it opens the editor the element routes to and returns whether it found one. The click handler calls it. Left-click behaviour is identical.
- The default viewbox events gain a `contextmenu` handler. Unless Shift is held, it prevents the native menu and calls `Controllers.ContextMenu.open(event)`. It does nothing in a customization mode.

### `ContextMenu` controller (new, the only new source file)

- One closed class, `ContextMenuController`, exported as the `ContextMenu` singleton and registered lazily in `Controllers` like the Omnibar. Public API: `open(event: MouseEvent)` and `close()`. Everything else is private.
- On open: find the Cell under the cursor (`getPointer` + `Pack.findCell`), resolve `elementsFromPoint` through `MapEntities.resolveTarget` (keeping each entity's topmost element), append `MapEntities.at(cell)`, and dedupe by `MapEntities.key`. The first row stays first and the rest are sorted by `getDisplay(ref).scale`, highest first.
- Row element: the topmost element under the cursor; for an entity found only in the Cell, its own element (`getElementId`) when its Layers are on, never a Label (a territory's element is its Label, which would open the Label editor).
- Only a drawn hit is pinned first; when nothing is drawn under the cursor, all rows are ordered by scale.
- Row click: `openEditor(element)` for a drawn row. When there's no drawn element, or the routing has no editor for it, fall back to `MapEntities.open(ref)` and then `revealEntity(ref)`, exactly as the Omnibar does.
- Dimmed rows: none of `getDisplay(ref).layers` is on (`Layers.isOn`).
- *What's there?*: shown when `Connection.isConnected()` (the Key tier's definition). It calls `Controllers.Assistant.ask(question)` with the translated label, the Cell key and the point in map units rounded to 2 decimals, for example `What's there? cell:4512, x:812.35, y:409.2`.
- Lifecycle copied from the Omnibar: inline `<style>`, capture-phase key handling while open (Escape, ArrowUp/Down, Enter, Space; their keyup is stopped too, since the global hotkeys act on keyup: Escape closes dialogs, arrows pan, Space opens search), closing on outside pointer-down, wheel, blur and `map:generated`, and an `AbortController` that drops every listener on close. The menu is positioned at the cursor and clamped to the window.

### Assistant (enlarged)

- New `ask(question: string): Promise<void>` on the existing `Assistant` export. It opens the dialog, waits for the first initialization, starts a Chat if the current one isn't writable and sends the question, keeping the user's draft in the input. While an answer is in flight the question waits in the input, if it's empty.
- No new tool and no system prompt change. The existing map tools read the keys.

### Journey path editor (changed)

- Both `contextmenu` listeners are removed. Backspace in the existing key handler undoes the last drawn point. Double-click on a control point removes it, stopping propagation so the map doesn't zoom. A click on a point without dragging no longer redraws the overlay, which would replace the point between the two clicks.
- The five hint and warning strings mentioning right-click are reworded, and every locale catalog is updated.

### Generated files

- `en.json` is regenerated by `extract-strings`, and the Assistant's registry context by `generate:assistant-context`.

## Testing Decisions

Tests check observable behaviour: refs returned and their order, rows shown, what the Assistant receives. They don't check private helpers.

- **`MapEntities.at`**: added to the existing `map-entities.test.ts`, using its fake `pack`. Covers: territory ids taken from the Cell, index-0 territories skipped and Biome 0 kept, Burg, River, Routes, Markers, Zones, Feature, Journeys, Market, Regiments and Goods (resource and produced) found, removed entities dropped. `resolveTarget` cases for Ice, Relief, Goods, Emblems and Measurers.
- **`ContextMenu`**: one new DOM test file, modelled on `omnibar.test.ts`. Covers: the first hit stays first and the rest are ordered by scale, duplicates are merged, *What's there?* appears only for the Key tier, hidden-Layer rows are dimmed, Escape and outside clicks close the menu.
- **`Assistant.ask`**: added to the existing `controllers/assistant/shell.test.ts`. Covers: the question is sent in a writable Chat, and it waits in the input while busy.
- No Playwright tests. The Journey editor inputs are checked by hand.

## Out of Scope

- Editor hooks for territory types. A State row reveals the State today, like search does. Adding `open` hooks to the entity config would also change search, so it's a separate decision.
- Labels as rows separate from their owners. A Label resolves to its owner, as everywhere else.
- Actions other than *What's there?*: zoom here, copy coordinates, add a Burg, Marker or Label here.
- Menu items contributed by Editors or tools.
- iOS long-press, opening the menu from the keyboard, right-click outside the map.
- *What's there?* for the Guest and Member tiers.

## Further Notes

- The help wiki pages on Journeys, and the Knowledge Base page that feeds the Assistant, need the new inputs and a short description of the menu.
- Glossary addition: **Map context menu**, the right-click list of everything at a spot on the Map.
