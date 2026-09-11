# PRD — Omnibar

Finding a map feature and opening its editor requires navigating separate overviews or locating it on the map. Commands, layer controls, and generation actions are spread across the application. Hidden layers and repeated names make discovery harder, and a feature may be remembered by its description rather than its name.

## Solution

Provide a compact, keyboard-operated search overlay 10px below the top edge of the window. Plain Space opens an empty, focused input with recently used commands below it. Typing searches supported commands and meaningful map entities together. Commands have a `>` prefix; typing `>` restricts results to commands. Selecting a feature reveals its layer, navigates to it, and highlights its rendered element when available. Escape dismisses the overlay.

Follow VS Code command-palette interaction conventions, adapted to the map and its existing shortcuts. Preserve Space wherever another control or tool owns it.

## User Stories

1. As a map maker, I want to open search with plain Space while the map is active, so I can find things without memorizing shortcuts.
2. As a keyboard user, I want the input focused immediately, so I can start typing.
3. As a returning user, I want an empty input and my recent commands below it, so I can repeat an action quickly.
4. As a keyboard user, I want arrow-key navigation and Enter activation, so the entire flow works without a mouse.
5. As a mouse user, I want to click any available result, so keyboard use is optional after opening.
6. As an editor user, I want Escape to close only search and restore my previous focus, so my editing context remains usable.
7. As a writer, I want Space to keep typing spaces in all editable fields, including rich text.
8. As a keyboard user, I want Space to keep activating focused controls and scrolling panels.
9. As a Wrap Tool user, I want Space+drag to continue panning the map.
10. As a user, I want commands and entities in one ranked list, so I do not need to choose a category first.
11. As a user, I want commands marked with `>`, so I can distinguish actions from places.
12. As a frequent command user, I want a leading `>` to show only commands.
13. As a user, I want literal partial-name and multi-word matching and useful aliases, so partial recollection still finds a result.
14. As a user, I want exact names above weaker name matches and note matches, so the most likely target is easy to select.
15. As a map maker, I want to search settlements, territories, waterways, points of interest, routes, and other meaningful entities.
16. As a cartographer, I want labels listed separately from their owners, so I can locate either the text or its owning entity.
17. As a user, I want result types and context, so repeated names remain distinguishable.
18. As a writer, I want note and description text searched, with a matching excerpt, so remembered lore can lead me to a feature.
19. As a user, I want hidden and offscreen entities to remain searchable, so visibility does not determine discoverability.
20. As a user, I want selecting a feature to reveal it, navigate to it, and highlight it as the view moves, without opening an editor.
21. As a user, I want editor-opening commands and layer toggles available alongside entity results.
22. As a user, I want generation commands to use the same workflows and confirmations as their existing buttons.
23. As a user, I want unavailable commands visible with a reason, so I understand what mode or prerequisite prevents their use.
24. As a returning user, I want recent commands retained across sessions without retaining entities from another map.
25. As a user, I want loading or regenerating a map to discard obsolete search targets.
26. As a maintainer, I want one clear developer-maintained configuration controlling supported commands and entity types.
27. As a maintainer, I want one isolated class with a small public API, so the feature is understandable without following a framework across files.
28. As a maintainer, I want existing map data, generation logic, and controller behavior reused, so search adds little integration code.

## Functional Requirements

### Opening, focus, and dismissal

- Plain, unmodified Space opens search only when nothing but the document body owns focus: like every other hotkey it fires on keyup, through the same handler and guard. Do not insert the opening Space into the query.
- Space keeps its well-known default wherever something else owns it: composition, text selections, editable content, a focused button or link or scrollable control, a modifier combination. The hotkey does not blur or override a focused control; a clicked menu button that still holds the focus re-fires on Space, as any button does.
- An active tool that owns Space, especially Wrap Tool panning, takes precedence: when that tool lands, its handler must consume the keyup before the hotkey sees it.
- Opening is idempotent. The input starts empty each time; no remembered query or automatic `>` prefix.
- Up/Down navigates the list, Enter activates, Escape closes, and pointer click activates. Keyboard navigation keeps the current row visible. Tab must not reach the application's options-pane shortcut while the palette owns focus.
- Disabled rows expose their reason and cannot activate. The initial selection is the first enabled result; navigation may focus disabled rows so their reason is available to keyboard and assistive-technology users.
- Escape must not also close underlying dialogs or cancel a map tool on keyup. Restore prior connected focus on dismissal; command activation can transfer focus to its destination; feature activation returns to the map.
- The palette has one runtime gate for map-dependent work: with no map, in edit mode, or in the 3D scene, opening is refused and, when it is already open, every row is disabled with that one reason. An open palette outlives a map that is replaced, so activation revalidates the target against the map that is on screen now.
- Use accessible input/listbox relationships, an announced active result, disabled state, and a useful no-results message. Keep the overlay usable in a narrow viewport.

### Search and results

- A normal query searches commands and entities together. Strip a leading `>` and search only commands when present.
- Use case-insensitive literal substring and multi-word matching, readable aliases, highlighted contiguous matches, and stable ordering. Do not match scattered letters or punctuation-only queries. Prefer exact names, then stronger name/alias matches, then weaker matches; notes and descriptions rank below name matches.
- An empty normal query shows only recent commands. With no history, show only the empty input, without a hint or footer. A bare `>` lists configured commands, with recent commands first.
- Show commands with `>` and action-oriented names, such as “Add burg”, “Open States Editor”, and “Toggle rivers”. Show layer state where useful.
- Show entities with their type and useful context: full state names for burgs/provinces, basin names for rivers, and route groups/endpoints. Never show internal IDs. Marker previews always start at the beginning of the note. Entity and label results have distinct stable keys, even when their displayed names match.
- Search notes as plain text extracted from their existing HTML. Show a short matching excerpt within the single right-aligned details field, cut by letter so accented and non-Latin text stays whole. Render names, snippets, and highlights safely as text rather than inserting map-provided HTML.
- Enumerate map state, not only visible SVG. Exclude removed records, placeholders, invalid references, and entities with no place on the map (an ocean, a river with no cells, a territory with no cells) unless an editor stands in for the place. Notes must not create a second duplicate entity result.
- An entity with no name of its own is titled by its kind, is found through its context and note only, and ranks below every named match. When the cap hides matches, the status says how many there were.
- Keep query work bounded: build normalized records once per opening, cap rendered results, and avoid label layout or geometry fitting on each keystroke. Rebuild on reopening and revalidate against current map state at activation.
- Do not retain entity objects or SVG nodes across map replacement. A stale result must not open a different entity whose numeric ID has been reused.

### Coverage and activation

- Search is navigation: feature results navigate or open the one editor that stands in for a non-spatial definition. Commands remain explicit actions.
- Exception: a good opens the Goods Editor with that one good visible on the Goods layer, hiding the others. Goods visibility is map state, so this is the one activation that writes to the map; it is accepted because a good has no place of its own to zoom to and the layer is the way to see where it is.
- Use type-specific icons from the existing icon font. Keep `>` for commands.
- Each result occupies one line: icon and name on the left, smaller gray details aligned right. Note excerpts share that details field.
- Use a neutral light background with the configured dialog opacity, compact spacing, and a light border/shadow. Theme colors are accents for focus, selection edges, and matching text only.
- Non-spatial definitions show the existing-style no-location message instead of opening an editor.

- Include burgs, states, provinces, cultures, religions, rivers, lakes, routes, markers, zones, journeys, markets, regiments, and all supported label types.
- Include meaningful named biomes, goods, and geographic features where the application provides a useful editor, overview, or notes destination. Derive location from real geometry or placement; do not invent a point for a non-spatial definition.
- Unnamed decorative relief, raw vertices, every individual cell, and derived transaction rows are not useful global entity results. Their relevant tools remain commands. Lack of a name alone must not exclude an otherwise recognizable entity with a useful generated title or ID context: an unnamed landmass or water body is titled by its subtype and id, such as “isle 12”, so it stays findable and distinct.
- Selecting a spatial result reveals required layers and centers or frames the target at a useful scale. Highlighting starts on a fixed delay after the zoom begins, so the outline animates in while the view is still moving; it must not wait for the zoom to settle. The viewport renderer draws rivers and labels only once the zoom settles, so when the target element is not in the DOM yet its own geometry (the river's cells, the label's anchor) is outlined instead. Feature results navigate instead of dispatching commands; a non-spatial definition with a useful editor opens it. Large territories and long paths should not use the same tight zoom as a burg.
- Labels are separate results for state, province, burg, river, route, and added labels. Resolve their group dependencies and viewport rendering before highlighting an existing label. Preserve label text and style; do not silently rewrite visibility policies to force an unsupported state.
- Commands cover user-facing editor/overview opening, creation tools, layer toggles, generation workflows, and the export and chart actions the shell and editors expose. Support is explicit configuration, not reflection over every internal method. Three result kinds exist: commands dispatch one of these entries, entities and labels navigate.
- Reuse existing action entry points and their mode guards. Generation commands launch existing confirmation flows, including the application's remembered “do not ask again” choice; never invoke lower-level generators as a shortcut.
- A result with no map location either opens its editor when the application provides one, or reports that it has no location. It never invents a point, and it never falls through to an unrelated zoom.
- Disabled rows expose the reason they are disabled and cannot activate. Check availability again immediately before activation.
- Close after an accepted activation. Prevent repeated Enter from launching the same action twice while dispatch is pending. Surface a useful message if a destination fails to load or is no longer available: an editor open is awaited, so its loading failure is reported like a command's.
- While the palette is open, the browser's own shortcuts that the map hotkeys already suppress (save page, function keys) stay suppressed; copy and paste in the input keep working.

### Recent commands

- Store command IDs only in localStorage under `fmg-omnibar-history`.
- Keep a bounded, deduplicated most-recent-first list. Ignore malformed storage, unknown IDs, and commands removed from configuration. Storage failure must not prevent search from working.
- Never store map entities, note content, or query text in this history.
- Record an accepted command dispatch, including launching an existing confirmation dialog. Cancelling that downstream dialog does not require the omnibar to inspect the generator's outcome.

## Implementation Decisions

- The TypeScript controller in `src/controllers/omnibar.ts` contains a non-exported class and a single exported omnibar instance. Its only public methods are `open` and `close`. Everything else — dismissal, availability, ranking, rendering — stays private, and tests drive the palette through those two methods plus the rendered input and list. It is registered in the lazy controller registry and loaded on first use, so nothing of it sits in the initial bundle.
- The class owns DOM and scoped styles, listeners, focus, search records, ranking, result rendering, and history. Entity enumeration, geometry, and command definitions live in shared modules with small interfaces.
- The palette styles itself. Its rules live in the `<style>` element the class renders into its own root, scoped under `#omnibar`, and they leave with it on close. Keep the global stylesheet free of omnibar rules, so the feature can be understood, restyled, or deleted from one file.
- `src/components/map-commands.ts` defines one command list with stable IDs, names, aliases, and direct function calls. Both the Tools tab and Omnibar use it; generation keeps its existing confirmations, session preference, redraws, and refreshes. Commands do not click buttons.
- `src/components/map-entities.ts` owns shared references, lookup, names, context, anchor positions, full geometry, keys, and SVG target resolution, plus the per-type display settings search needs: kind, icon, layers to reveal, zoom scale, and the shape to highlight. Its collection can be restricted to located entities; territories are checked by one pass over the cell assignments, not one per entity. Oceans are not features it lists. Notes (`src/components/notes.ts`) owns note storage and delegates entity access to this module; it lives in components because it depends on this lookup and renders the note buttons, so it is not a generator. Tooltips reuse target resolution and names without collecting search results or computing geometry on hover.
- Omnibar enumerates every entity type from that one configuration, adds label results from the label data, and owns map navigation, including when highlighting starts during the zoom. It has no per-type knowledge of its own and no dependency on the Notes store.
- A result is one of a command, an entity, or a label — never a partial mix. Model them as distinct shapes so activation reads the kind it handles, without optional fields or non-null assertions.
- No provider framework, generic command bus, plugin system, new service registry, event bus, runtime registration API, or production dependency.
- Integrate through the existing hotkey module with a small delegation: Space is a regular keyup hotkey that opens the controller through the registry when the body owns focus and no modifier is held. A focused control keeps its Space. Focus and key-swallowing rules stay inside the class. Do not add an omnibar global.
- The menu's Search button sits next to the zoom reset, which is relabelled “Zoom out” to fit the row. That button still resets the zoom; the “Zoom Out” command in the palette zooms one step out. The two share a label on purpose: the menu row has no room for the full name, and the command palette keeps the precise ones.
- Reuse existing Controllers, Layers, viewport, highlighting, and rendering APIs. Keep click-to-edit dispatch in viewbox events separate from search navigation. Track staleness through the existing `map:generated` signal instead of comparing entity or container identities: it already fires after generation, load, submap, and transform.
- Keep integration focused on shared command/entity consumers; avoid duplicating editor workflows or introducing a registration framework.
- No map schema, save format, or generator changes. Only the command history is persisted.

## Testing Decisions

- Verify public behavior, not private matching helpers or configuration implementation. Drive the public keyboard/open/close API and the rendered input/list, and observe calls to existing controller/layer/action boundaries.
- Cover mixed ranking, `>` filtering, note text with accented letters, unnamed entities, unlocated entities, duplicate names and separate labels, disabled activation, recent command persistence, and stale targets after map replacement. Assert that the highlight begins during the zoom rather than after it settles, and that a culled target is outlined by its geometry.
- Cover Space in plain map context versus fields and focused buttons, and with each modifier. Check Escape and Enter across both keydown and keyup.
- Follow repository Vitest conventions. Focused Node/jsdom suites cover the public API; browser testing remains manual. Do not export internals or create fake public methods to simplify tests: close the palette the way a user does — Escape, or a click outside.
- Building the search records must not parse notes that do not exist. Extraction is skipped for an entity with no note, so opening the palette stays cheap on a map with thousands of entities and a handful of notes.
- Run focused applicable tests and the TypeScript/Vite build after implementation. Do not automatically run Playwright, including the Playwright-backed Vitest browser suite, per repository instructions. Keep manual keyboard/browser acceptance explicit until those tests are authorized.

## Out of Scope

- End-user command configuration, synchronized history, entity history, or a settings screen.
- Natural-language execution, semantic/vector search, AI interpretation, or a generic automation API.
- Replacing existing editors, confirmation dialogs, shortcuts, generation flows, or layer ownership.
- Live map navigation merely while moving the selected result; activation performs navigation.
- Broad controller, data model, SVG, or application-shell refactors.

## Further Notes

The design was agreed in the omnibar interview, including separate labels, notes search, developer configuration, unavailable-but-visible commands, and command-only local history. Implementation defaults such as history/result limits may be kept as private constants and tuned without expanding the public API.

Space ownership must be rechecked when the Wrap Tool branch meets this one.
