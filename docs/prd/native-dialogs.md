# PRD — Native Dialogs (jQuery Removal)

## Status

Implemented. jQuery, jQuery UI and Touch Punch are gone from the app, its tests and `public/libs/`. Every dialog runs on `Dialog` (`src/ui/dialog/dialog.ts`), the only dialog interface: `open`, `update`, `close`, `closeAll`, `isOpen`, `destroy`, `message`, `confirm` and `prompt`. Lists reorder through `ui/sortable-list.ts` and floating panels move through `ui/draggable.ts`, both on `ui/pointer-drag.ts`. The inventory below describes the jQuery build that was replaced; the later sections describe what shipped, including where it differs from the first plan.

## Problem Statement

Every editor, overview, tool and message in FMG opens in a jQuery UI dialog. Three vendored scripts carry this: jQuery 3.1.1 (87 KB), a hand-patched jQuery UI 1.12.1 build (108 KB) with its theme (11 KB), and Touch Punch (1 KB). They are the last runtime globals besides three.js and load synchronously before `main.ts` on every boot.

- **Typing.** `$` is declared as `(selector: any) => any`, so 360+ `.dialog(…)` calls in 90 files are unchecked. Option typos, wrong `this`, and calls on uninitialized widgets surface only at runtime.
- **Touch.** Touch Punch emulates mouse events and `preventDefault`s touches on the titlebar, which killed the close and minimize buttons on Android tablets. `app/shell.ts` patches this in the capture phase. The dialogs that do close are the ones whose drag handlers were destroyed by accident, so they cannot be dragged by touch at all.
- **Hand-patched library.** The build adds the minimize button in `_createTitlebar`, defaults `appendTo` to `#dialogs`, drops the default width, and empties `_focusTabbable`. It also carries a `closest()` truthiness bug: a mousedown on the titlebar never focuses the dialog. No upstream release can replace it.
- **Scattered styles.** The dialog look is split across `public/libs/jquery-ui.css` (patched theme), `src/index.css` (`.ui-widget-header`, `.ui-dialog …` input rules, `.dialog` scrollbars) and controllers' injected `<style>` blocks that target `.ui-dialog*` internals.
- **Shared mutable alert.** One `#alert` element serves 45 direct `$("#alert").dialog({…})` calls plus `alertDialog`, `confirmationDialog` and the limitation picker. Each caller must reset options the previous caller left (height, modality, close handler, buttons). A model module (`cultures-generator`) opens it directly, which breaks the layering rule.
- **Leaky teardown.** Content that is `.remove()`d without `.dialog("destroy")` orphans its `.ui-dialog` wrapper. The architecture doc needs a dedicated rule for this, and `destroyDialog` exists only to enforce it.
- **Unit tests stub `$`.** 22 test files fake the jQuery chain (`dialog`, `one`, `not`, `each`, `draggable`…) by hand. Seven e2e specs query `.ui-dialog*` class names.

The migration plan in [architecture.md](../architecture/architecture.md#migration-plan) (item 2) already sets the target: a small dialog primitive in `ui/dialog/` that retires the three scripts.

## Solution

Build a `Dialog` singleton in `src/ui/dialog/` with five public methods: `open`, `update`, `close`, `closeAll` and `isOpen`. It renders a window that **replicates the current jQuery UI dialog as closely as possible**: the same structure, metrics, colors, glyphs, positioning, eight-sided resizing, dragging, stacking, minimize, keyboard and focus behavior. Its stylesheet is owned by the component and scoped to its root class, so no other file styles the dialog chrome. It covers only the jQuery UI subset FMG uses (inventoried below), and it keeps remembered positions, the reset button, Shift-click confirmations and saved layouts.

Port the shared helpers first so most call sites migrate mechanically. Then migrate controllers one domain at a time while both systems coexist. Replace the four `sortable` lists and the two `draggable` panels with pointer-event utilities. Finally delete the vendored scripts, the theme, the `$` global, the Touch Punch workaround and the jQuery-specific rules in the docs.

## Current Usage Inventory

Measured on `v1.156.0` (non-test `src/**/*.ts`).

### Scale

| What | Count |
| --- | --- |
| Files referencing `$` | 94 |
| `.dialog(` calls | 364 in 91 files |
| `.dialog({…})` option calls | 148, for about 55 distinct dialog ids |
| `$("#alert").dialog` direct callers | 45 calls in 24 files |
| `closeDialogs(…)` callers | 75 |
| `confirmationDialog` / `alertDialog` / `promptDialog` callers | 78 / 17 / 6 |
| Unit test files stubbing `$` | 22 |
| e2e specs using `.ui-dialog*` selectors | 7 (29 selector uses) |

By area: `controllers/political` 97 calls, `economy` 67, `physical` 40, `story` 25, `society` 16, `style` 15, `app/chrome` 13, `services/io` 11, `annotations` 8, `graph` 8, `icon-picker` 7, `view-3d` 7, and fewer than 5 each elsewhere (including `model/society/cultures-generator.ts`).

### jQuery methods used

Outside dialogs, jQuery is used for almost nothing: `.sortable` (4), `.draggable` (2), `.disableSelection` (1), and `.one`/`.off`/`.on`/`.not`/`.each`/`.parent`, which serve dialog events and `closeDialogs`. No DOM querying, AJAX, animation or effects code depends on jQuery.

### Dialog options used

| Option | Files | Notes |
| --- | --- | --- |
| `title` | 88 | Plain text; `market-overview` changes it while open |
| `close` | 78 | Teardown; must fire once on every close path |
| `resizable` | 76 | `false` in 104 calls, `true` in 6 (`view-3d`, `notes-editor`, assistant and a few overviews) |
| `position` | 69 | `{ my, at, of, collision: "fit" }`; `of` is `"svg"` (93), `"#map"` (10), `window` (3), another dialog (5) or an element (anchor, label, burg) |
| `width` | 56 | `"fit-content"`, `"auto"`, em strings, numbers |
| `buttons` | 41 | `{ [label]: fn }` with `this` bound to content; `limitation-picker` swaps them via `option` |
| `height` / `maxHeight` / `minHeight` / `minWidth` / `maxWidth` | 7 / 5 / 2 / 2 / 1 | Mostly viewport-relative numbers |
| `open` | 6 | Reaches into the wrapper: footer checkbox (`world-configurator`, `good-editor`), button tips (`military-overview`, `markers-settings`), a wrapper class (`minimap`) |
| `beforeClose` | 2 | `wrap-tool` and `heightmap-editor` image converter return `false` to veto, then confirm |
| `closeOnEscape: false` | 1 | `wrap-tool` |
| `autoOpen: false` | 1 | `burg-editor`, which creates the dialog before its iframe navigates, then opens it |
| `resizeStop` | 1 | `view-3d` resizes the WebGL canvas |
| `modal: true` | 1 | CSV upload preview (`confirmationDialog({ modal: true })`) |

Methods: `close` (55), `destroy` (36), `widget` (3), `option` for `position`/`title`/`buttons`/`width`/`height` (notes fullscreen), `open` (1). Events: `dialogcreate`, `dialogopen` and `dialogdragstop` on `document` (position persistence, reset button, titlebar translation), and `dialogclose` (`table.ts`, `highlighting.ts` cleanup).

### Behavior of the patched build

This is the contract the new component replicates.

- **Structure.** A `div.ui-dialog[role=dialog][tabindex=-1]` contains the titlebar (`span.ui-dialog-title`, then `_` minimize, then `✕` close), the content element, and the optional button pane (`div.ui-dialog-buttonpane > div.ui-dialog-buttonset > button`). `dialog-helpers` inserts a reset button (`icon-ccw`, hidden without a saved layout) before minimize and translates the tooltips. The Assistant inserts its own "open chats" button before reset.
- **Mount.** Wrappers are appended to `#dialogs` (patched `appendTo`) and inherit its `--bg-dialogs` background. Without `width` the window sizes to its content (the patch removed the 300px default). `minWidth` defaults to 150, `height` to `auto`.
- **Placement.** `my`/`at` keywords with `±N` offsets against `of`, and `collision: "fit"`. A patched `using` callback shifts the window down if its top would be above the viewport. The default is the center of `window`. A drag stop rewrites the dialog's `position` option to `left top` at the dropped offset relative to `window`.
- **Minimize.** `_` toggles only the content element. The button pane stays visible, which is a bug the new version fixes.
- **Dragging.** The titlebar is the handle; the content and the close button cancel a drag. Containment is the document. During drag and resize, transparent blocks cover every iframe so they don't swallow the pointer. A drag stop saves `{ top, left }` to `dialogState` under the dialog id. That position is restored on every open and clamped to the viewport. `#alert` is excluded.
- **Resizing.** `resizable: true` (the default) gives eight handles: `n, e, s, w, se, sw, ne, nw`. The theme makes the edges 2px and the corners 7×7px, flush with the window border. Resizing respects the min and max bounds, recalculates the content height, and fires `resizeStop` at the end.
- **Stacking.** A mousedown anywhere on a window, or opening it, sets its z-index to one above the highest visible `.ui-front` sibling. The base is 100.
- **Focus.** `_focusTabbable` is patched to a no-op. Opening a dialog **does not move focus**, so focus stays on whatever opened it (typically the clicked button) and map hotkeys keep working. On close, focus returns to the element that had it when the dialog opened, if that element is still focusable. Otherwise the active element is blurred.
- **Keyboard.** With focus inside a window, Escape on keydown closes it unless `closeOnEscape: false`. Tab and Shift+Tab wrap between the first and last tabbable elements of the window, for every dialog, modal or not. Separately, the global Escape hotkey closes every dialog on keyup through `closeDialogs()`.
- **Modal.** A fixed full-viewport overlay (`#aaa` at 0.3 opacity) sits one z-index below the dialog and blocks the map and other dialogs.
- **Close order.** `beforeClose` can veto. Then the overlay is removed, focus is restored, and `close` fires. The content stays in the DOM until the controller calls `destroy` and `remove`.
- **Persistent dialog.** The Assistant is built once and only hidden. `cellInfo` and similar dialogs check `offsetParent` or `ui-dialog-content` to mean "open".
- **`closeDialogs(except)`.** It closes every visible `.dialog` not matching the selector. `.stable` marks dialogs (minimap, 3D, Assistant, units, cell info…) that survive opening an editor.

### Non-dialog widgets

- `#mapLayers` (`layers-tab`): `sortable({ items: "li:not(.solid)", containment: "parent", cancel: ".solid", update })` reorders layers through `Layers.move`. `disableSelection()` is applied too.
- `zones-editor`, `relief-rules-editor`: `sortable({ items: "div.states", handle: ".icon-resize-vertical", axis: "y", containment: "parent", update })`.
- `heightmap-editor` template body: `sortable({ items: "> div", handle: ".icon-resize-vertical", axis: "y" })`, which is read back by DOM order.
- `#optionsContainer`: `draggable({ handle: ".drag-trigger", snap: "svg", snapMode: "both" })`. `#heightmapFinalize`: `draggable({ handle: "div" })`.

## User Stories

1. As a map maker, I want dialogs to look exactly as they do today, so the migration is invisible to me.
2. As a map maker, I want every editor to open where it opens today.
3. As a map maker, I want my dragged dialog positions to survive the migration, so I don't have to rearrange my layout.
4. As a map maker, I want the reset button to keep restoring a dialog's default position, columns and sorting.
5. As a map maker, I want to minimize a dialog to its titlebar, button row included, and restore it.
6. As a map maker, I want to resize resizable dialogs from any edge or corner.
7. As a tablet user, I want to drag dialogs by their titlebar, resize them, and tap ✕ and _ reliably.
8. As a tablet user, I want to reorder layers, zones, relief rules and heightmap template steps by touch.
9. As a keyboard user, I want opening a dialog to leave my focus alone, so map hotkeys keep working.
10. As a keyboard user, I want focus to return where it was when I close a dialog.
11. As a keyboard user, I want Escape to close dialogs as it does today, while the Wrap Tool keeps asking before discarding edits.
12. As a keyboard user, I want Tab to cycle inside the dialog I'm working in.
13. As a keyboard user, I want Enter to confirm and Shift-click to skip confirmations.
14. As a user, I want the clicked dialog to come to the front.
15. As a user of a small screen, I want dialogs kept within the viewport, including positions saved on a wider screen.
16. As a user, I want the CSV upload preview to block the map until I choose Apply or Cancel.
17. As a desktop app user, I want dialogs to behave identically in Electron.
18. As a user, I want a faster first load, without 200 KB of render-blocking scripts.
19. As a maintainer, I want one small typed `Dialog` API, so wrong options fail at compile time.
20. As a maintainer, I want all dialog chrome styles in the component, so no other stylesheet can drift the look.
21. As a maintainer, I want closing a dialog to tear it down fully, so I never need a separate destroy step.
22. As a maintainer, I want messages and confirmations to have their own instances, not one shared `#alert` whose options leak between callers.
23. As a maintainer, I want unit tests to use the real dialog in jsdom instead of hand-written `$` stubs.
24. As a maintainer, I want the controllers migrated domain by domain while the app ships in between.

## Functional Requirements

### API

```ts
class DialogManager {
  open(id: string, options?: DialogOptions): void; // wrap #id and show it
  update(id: string, options: Partial<DialogOptions>): void; // title, buttons, size, position… while open
  close(id: string): void; // honors beforeClose
  closeAll(except?: string, { keepMessages }?): void; // replaces closeDialogs; same selector semantics
  isOpen(id: string): boolean;
  destroy(id: string): void; // drop without callbacks, before rendering anew
  message(options: MessageOptions): HTMLElement; // a message window of its own; returns the message element
  confirm(options: ConfirmOptions): void; // Shift-click skips it
  prompt<T>(text: string, options: PromptOptions<T>, callback: (value: T) => void): void;
}
export const Dialog = new DialogManager();
```

- `Dialog` is the only dialog interface: controllers never call dialog helpers. Every dialog is addressed by the id of its content element, which keys its saved position too. `open` with options replaces the previous options outright, so nothing leaks from an earlier caller; `open` without options shows a dialog again as it was (the Assistant's reopen).
- Placement, dragging, resizing, stacking, focus, persistence and the reset button are private.
- `DialogOptions` is the inventoried subset and nothing more: `title`, `position`, `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`, `resizable`, `fullscreen`, `buttons`, `footer`, `titlebarButtons`, `className`, `modal`, `closeOnEscape`, `persistent`, `rememberPosition`, `beforeClose`, `onClose` and `onResize`.
- `update` covers every current `option` call: `market-overview` titles, `limitation-picker` buttons, coastline and relief re-fit (`position`), and notes fullscreen (`width`, `height` and a `left top` position at saved offsets of `window`).
- Modules that need to know when a dialog closes without owning it (`table.ts`, `highlighting.ts`) listen for a `dialog:close` event. It is dispatched synchronously, without bubbling, on the content element before removal.

### Lifecycle

- `open` wraps an existing content element (rendered by the controller into `#dialogs`, as today) in a window and shows it synchronously. Code after `open` can rely on the window existing, which replaces the `open` callback.
- Re-opening an open id updates its options and raises it without creating a second window.
- `close` (from ✕, Escape, `closeAll` or a direct call) runs `beforeClose`. If that returns `false` the dialog stays open. Otherwise the overlay is removed, focus is restored, `onClose` and `dialog:close` run exactly once, and the window **and** its content are removed. No separate destroy step exists and no wrapper can be orphaned.
- A `persistent` dialog is hidden instead of removed and keeps its content: the Assistant (draft, scroll and in-flight work), the shared `#alert` message window and the panes built once at load (save, load, export, PNG tiles, advanced options).
- `isOpen(id)` replaces the `offsetParent` and `ui-dialog-content` checks.
- A window is never reparented after creation, and raising doesn't move it in the DOM. `burg-editor` keeps setting its iframe `src` only after `open`.

### Look and structure

- Replicate the DOM shape and every visual value of the current build, as listed in [Visual Specification](#visual-specification): root, titlebar (title, controller buttons, reset, minimize `_`, close `✕`), content, then button pane with a right-aligned button set.
- The window's background is inherited from `#dialogs` (`--bg-dialogs`), as today, so styles and themes that set it keep working.
- Titlebar strings come from `t()` at creation, with no post-hoc translation.
- Minimize hides the content **and** the button pane and keeps the titlebar. Restoring brings back the previous size.
- The reset button is visible only while `dialogState.hasLayout(id)`. It drops the saved layout and re-places the dialog at its default position.
- `titlebarButtons: [{ className, tip, label, onClick }]` inserts controller buttons before reset (the Assistant). `className` adds a class to the window root (minimap padding).

### Style isolation

- The component owns one stylesheet, `src/ui/dialog/dialog.css`, linked from `index.html` right before `index.css`, where `jquery-ui.css` was: an app rule of equal weight still wins, as it did over the jQuery theme. Every selector is scoped under the window root class.
- Into it move all the jQuery UI theme rules that FMG renders, plus every dialog rule in `src/index.css`:
  - from `jquery-ui.css`: the dialog, titlebar, button, button pane, resize, widget and overlay rules;
  - from `index.css`: `.ui-widget-header`, `button.ui-button:disabled`, `.ui-dialog` `user-select`, `button.pressed`, range and number inputs, `.disabled`, `.dialog` scrollbars, `max-width` and the `> div` width rule.
- No other stylesheet or injected `<style>` targets the chrome's internal classes. Controllers style only their own content. A controller that needs a chrome variation gets it from an option (`className`) or a documented CSS custom property, not from selectors on internals. The minimap's zero padding and the Assistant's layout are rewritten that way.
- Content stays in the light DOM, so the app's global content styles (icons, buttons, tables, `data-tip` tooltips) apply unchanged.
- The window classes are `.dialog-window`, `.dialog-titlebar`, `.dialog-title`, `.dialog-titlebar-button` (plus `-reset`, `-collapse`, `-close`), `.dialog-buttonpane`, `.dialog-buttonset`, `.dialog-resize-{n,e,s,w,ne,nw,se,sw}` and `.dialog-overlay`. Content keeps its `.dialog` class.

### Placement

- Accepts the existing `{ my, at, of }` syntax: horizontal `left|center|right` and vertical `top|center|bottom` keywords with `±N` pixel or `%` offsets. `of` takes a selector, an element or `window`. A missing `of` element falls back to `window`. The default is `{ my: "center", at: "center", of: window }`.
- Placement always fits, as `collision: "fit"` does: the window is shifted to stay inside the viewport, and the top edge and titlebar are never above it.
- A saved position overrides the default and is clamped to the viewport. Saved `{ top, left }` values keep their meaning (viewport pixels of the window's top-left), so existing `fmg-dialog-state` entries stay valid.
- A drag stop makes the dropped spot the dialog's position for later re-placement, as jQuery does.

### Size and resizing

- `width`, `height`, `minWidth`, `maxWidth`, `minHeight` and `maxHeight` accept CSS lengths or numbers (as px). Without `width` the window sizes to its content. `minWidth` defaults to 150px and `height` to `auto`. The content scrolls when it exceeds the height bounds.
- `resizable` defaults to `false`. It is set on the dialogs where resizing serves the content: the Notes Editor, Data Charts, the hierarchy tree, the Namesbase Editor, the 3D preview and the Assistant. A resizable window gets all eight handles (`n, e, s, w, ne, nw, se, sw`), sized and placed as today, with the matching resize cursors.
- Resizing uses pointer events with pointer capture, so it works by mouse, touch and pen. It respects the min and max bounds, keeps the window inside the viewport, recalculates the content height as the window grows or shrinks, and calls `onResize` once at the end (`view-3d`).
- While a drag or resize is in progress, iframes do not receive pointer events.

### Dragging and stacking

- The titlebar drags the window with pointer events, pointer capture and `touch-action: none`. Presses on titlebar buttons never start a drag, so taps on ✕ and _ always click. The content area never drags.
- A drag ends clamped to the viewport and saves the position to `dialogState`, except for transient message windows.
- A pointerdown on a window, or opening it, sets its z-index to one above the highest open window, starting at 100, as jQuery does. This uses a z-index, not a DOM move. During coexistence the calculation includes remaining jQuery `.ui-front` wrappers, and their `_moveToTop` sees the new windows as siblings.

### Buttons and footer

- `buttons: [{ label, onClick, tip?, className? }]` renders the button set with jQuery UI's button look. `onClick` receives nothing and closes via `Dialog.close(id)`, so callbacks no longer rely on `this`.
- `footer: string | HTMLElement` renders at the start of the button pane, which replaces the `open`-time insertion used by the world configurator's auto-apply checkbox and the good editor.

### Keyboard and focus

These match the patched jQuery build.

- Opening does not move focus. Focus stays where it was, so map hotkeys keep working until the user clicks into a dialog field. A dialog that must take focus (the prompt input, the confirm button) does so explicitly after `open`.
- Close returns focus to the element that had it at open if that element is still connected and focusable. Otherwise the active element is blurred.
- With focus inside a window, Escape on keydown closes it unless `closeOnEscape: false`. As with jQuery, the keyup then reaches the global Escape hotkey, which closes all non-excepted dialogs through `Dialog.closeAll`; that path still honors `beforeClose`.
- With focus inside a window, Tab and Shift+Tab wrap between its first and last tabbable elements, modal or not.
- The window root has `role="dialog"`, `tabindex="-1"` and `aria-labelledby` pointing to its title. Titlebar buttons have labels.

### Modality

- `modal: true` adds a fixed full-viewport overlay one z-index below the window, styled as today, which blocks pointer interaction with the map and other dialogs. Tooltips stay visible above it.

### Messages and confirmations

- `Dialog.message({ message, title, buttons, width, position, id, … })` builds a window of its own for every message and removes it on close, so messages never share an element or leak options. `message` is markup or an element built beforehand (the bubble charts draw into a detached element, so placement sees their final size). It returns the message element, to wire the controls inside it.
- Message buttons close their window after the handler runs, unless the handler returns `false` (a validation failure, an action that keeps the window open). No buttons means OK; `buttons: []` means none. Defaults are the Warning title, 26em and the map center.
- An `id` addresses a window that is closed or highlighted from elsewhere (the merge forms stay open until the merge is confirmed). Content gets the `message` class, so `closeAll(".message")` spares open messages.
- `Dialog.confirm` keeps the old behaviors: Shift-click skip, Enter confirms unless Cancel has focus, the confirm button's tooltip and initial focus, `modal` and `width`. A confirmation now opens above the window that asked, instead of replacing its content.
- `Dialog.prompt(text, { default, title, min, max, step, required }, callback)` is a standard message window with an input: the question, the focused field, Confirm (refused while the field is invalid) and Cancel; Enter confirms. `limitation-picker` builds its own window.
- Nothing outside `Dialog` reaches into a window: the Notes Editor's fullscreen is the `fullscreen` option, save and JSON export spare open messages with `closeAll(undefined, { keepMessages: true })`, and the Assistant measures its own content.
- `cultures-generator` (a model module) still opens a message: layering debt that stays out of this change.

### Lists and panels

- `sortableList(container, { items, handle?, onReorder? })` in `ui/sortable-list.ts` reorders the container's matching children by pointer drag, horizontally for side-by-side items and vertically otherwise, and swallows the click that ends a reorder. It works by touch. Zones, relief rules and heightmap template steps use it; the template keeps reading order from the DOM.
- The Layers tab no longer reorders its button grid, which is a plain CSS grid of buttons that toggle layers. A sort button at the end of the *Layers preset* row opens the Layers Order dialog (`controllers/layers-order.ts`): the layers drawn in the map, topmost first, each with a drag handle and a visibility toggle, plus Restore (`Layers.resetOrder()`) for the default order.
- `ui/pointer-drag.ts` captures the pointer only once it moves: a captured pointer retargets the following `click`, so capturing on press broke every click on a drag source.
- `#optionsContainer` and `#heightmapFinalize` share the pointer tracking (`ui/pointer-drag.ts`) through `makeDraggable(panel, handle)` in `ui/draggable.ts` and stay inside the viewport. Snapping to the map edges is dropped.
- `disableSelection` becomes `user-select: none` in CSS.

## Visual Specification

These are the values the component must reproduce, taken from the current `jquery-ui.css` and `index.css`. Colors are literal unless they name a token.

| Part | Values |
| --- | --- |
| Window | `position: absolute`; `outline: 0`; `padding: 0`; `background: inherit` (from `#dialogs`); `border: 1px solid #5e4fa2`; `color: #333`; `font-family: var(--sans-serif)`; `user-select: none`; `max-width: 93vw` on content; base `z-index: 100` |
| Titlebar | `display: flex`; `justify-content: space-between`; `align-items: center`; `padding: 0.3em 0.8em`; `font-size: 1.2em`; `min-width: 150px`; `background: var(--header)`; `color: #fff`; bold; `border-bottom: 1px solid var(--dark-solid)`; `cursor: move` |
| Title | `white-space: nowrap`; `width: 100%`; `overflow: hidden`; `text-overflow: ellipsis` |
| Titlebar buttons | `inline-flex`, centered; `margin-left: 0.4em`; `1.6×1.5em` (19×18px at the default UI size; em so the titlebar follows the UI size); `line-height: 1`; `color: #fff`; `background: none`; `border: 1px solid #c5c5c5`; `:active` border `#5d4651`; glyphs `_` and `✕`; reset glyph `font-size: 0.62em` |
| Coarse pointer (touch) | titlebar buttons `2.2×2em`, `margin-left: 0.5em`; the title keeps its size |
| Content | `position: relative`; `border: 0`; `padding: 0.5em 1em`; `background: none`; `overflow: auto`; thin scrollbars (6px, thumb `#aaa`, hover `#666`, radius 6px) |
| Button pane | `text-align: left`; top border `1px solid #ddd`; `margin-top: 0.5em`; `padding: 0.3em 1em 0.5em 0.4em`; button set floats right |
| Pane buttons | `padding: 0.4em 1em`; `margin: 0.5em 0.4em 0.5em 0`; `border: 1px solid #c5c5c5`; `background: #f6f6f6`; `color: #454545`; normal weight; `line-height: normal`; `cursor: pointer`; `:active` color and border `#5d4651`; `:disabled` `brightness(0.95)` with default cursor |
| Resize edges | n and s: full width, `2px` tall, at `top: 0` and `bottom: 0`; e and w: full height, `2px` wide, at `right: 0` and `left: 0`; `n-resize`, `s-resize`, `e-resize`, `w-resize` cursors |
| Resize corners | `7×7px`, flush at each corner; `ne-`, `nw-`, `se-` and `sw-resize` cursors |
| Overlay | `position: fixed`; full viewport; `background: #aaa`; `opacity: 0.3` |
| Content inputs | range: `2px` track `#d4d4d4`, `1em` thumb `#e9e9e9` with `1px solid #9b9b9b` border, radius 15%; number: `width: 4.5em`; `.disabled`: `opacity: 0.2`; `button.pressed`: inset shadow `#ccc`, border `#a6a6da`, background `#ecd8d8`, radius 10% |

## Implementation Decisions

- **Module layout.** `src/ui/dialog/dialog.ts` holds `class DialogManager` and the exported singleton `Dialog`, following the `class BurgModule` / `export const Burgs = new BurgModule()` pattern. Next to it are `dialog.css`, `position.ts` (pure `my`/`at` math) and `dialog-testing.ts` (test helpers). `ui/pointer-drag.ts` is the shared move and resize helper, also used by `ui/draggable.ts` and `ui/sortable-list.ts`. `dialog-helpers.ts` keeps only editor markup helpers (`noteButton`, `noteIcon`) and `refreshEditors`.
- **A `div`, not `<dialog>`.** The root is a plain `div[role=dialog]`, as jQuery's is. A native `<dialog>` brings UA styles to undo. `showModal()` uses the top layer, which would cover tooltips and the color picker and break parity with the stacking. jsdom does not implement `show()` or `showModal()`, which would defeat the real-component unit tests.
- **No shadow DOM.** Scoping under the root class isolates the chrome without hiding content from the app's global styles and delegated tooltip handlers. A shadow root would retarget `data-tip` events, and `::slotted` cannot reach content descendants.
- **No new dependency.** Positioning, dragging, eight-way resizing and sorting are a few dozen lines each. A library would be larger than the subset in use.
- **Persistence stays in `dialogState`.** `initDialogPositionPersistence`'s document-level jQuery events become private steps of `Dialog` (restore on open, save on drag end, reset button on create). "Not persisted" applies to transient message windows instead of the `#alert` id.
- **Helpers folded into `Dialog`.** `closeDialogs` became `Dialog.closeAll`, `updateDialog` `Dialog.update`, `destroyDialog` `Dialog.destroy`, `alertDialog`/`messageDialog` `Dialog.message`, `confirmationDialog` `Dialog.confirm` and `promptDialog` `Dialog.prompt`. The console exposes `FMG.Dialog`.
- **One pass instead of domain PRs.** After the States Editor proved the component, a codemod converted every `$(…).dialog(…)` call and the remaining cases were edited by hand, so the two systems never had to coexist in a release. The removal list was done in full: the script and stylesheet tags, `public/libs/jquery*`, `var $`, the Touch Punch workaround in `app/shell.ts`, the moved `index.css` rules, the jQuery wording in the architecture docs. Nothing in the service worker or Electron build referenced the files.
- **Per-controller conversion.** `$("#x").dialog({ … close: closeX })` becomes `Dialog.open("x", { …, onClose: closeX })`.
  - Delete the `$("#x").dialog("destroy"); ensureEl("x").remove()` lines in `closeX`.
  - Convert `buttons` records to arrays that call `Dialog.close("x")`.
  - Move `open:` wrapper surgery to `footer`, `titlebarButtons` or `className`.

## Testing Decisions

- **Unit (Vitest, jsdom).** Test the component's external behavior through the five methods:
  - open, re-open and close order; `beforeClose` veto; `onClose` and `dialog:close` once per path; teardown leaving no nodes; the `persistent` hide;
  - placement math for each `my`/`at`/offset combination and the fit clamp; saved positions restored and clamped; reset;
  - minimize hiding content and button pane; each of the eight resize handles against the min and max bounds; `onResize` at the end;
  - stacking order; no focus move on open, focus restored on close, the Tab wrap; Escape and `closeOnEscape`; button callbacks;
  - `closeAll` exceptions and `.stable`; `sortableList` reorder results.
  Messages, confirmations (Enter, Shift-skip), the prompt, `destroy`, `fullscreen` and `keepMessages` are covered in `dialog.test.ts`.
- **Stubs out.** No test stubs `$`. Tests drive real windows through `ui/dialog/dialog-testing.ts` (`DIALOGS_MARKUP`, `dialogButton(label, dialogId?)`), or override one method with `vi.mock("@/ui/dialog/dialog")` and `Object.assign(Dialog, { confirm: vi.fn() })`.
- **e2e (Playwright).** The `.ui-dialog*` selectors in the specs were renamed to the new classes (`.dialog-window`, `.dialog-buttonpane`, `.message`…). Still to add: specs for drag, persistence across reload, reset, minimize, resize, Escape and the CSV modal, and a touch spec (`hasTouch`) for the titlebar buttons and dragging.
- **Visual parity.** Checked by comparing computed styles and box geometry against the jQuery build: the States Editor window, its titlebar and buttons, the button pane and a resizable dialog's eight handles matched to the fraction of a pixel, at desktop and 375px widths. A pixel-diff suite was not built.
- **Fingerprint.** Dialog changes must not alter map generation. Existing map-invariance and restoration specs must stay green.

## Out of Scope

- Any visual change beyond the minimize fix: the look is replicated, not redesigned.
- Replacing `refreshEditors`' hard-coded button-click registry with registered refresh callbacks (its existing TODO).
- Moving `#unitsEditor` config state out of the DOM, or other markup-ownership work not forced by this migration.
- three.js and other vendored libraries.
- Docked or tabbed dialog layouts, or persisting the dialog size.

## Further Notes

- **Deliberate differences from the jQuery build.**
  - Minimize also hides the button pane.
  - `#optionsContainer` no longer snaps to the map edge.
  - Touch works natively instead of through Touch Punch.
  - `resizable` defaults to `false`.
  - Each message and confirmation has a window of its own, and a confirmation opens above the window that asked instead of replacing its content.
  - The prompt is a standard dialog window with an input.
  - Layers are reordered in the Layers Order dialog, not on the button grid.
  - A titlebar fits in the window's minimum width, so it no longer overflows a narrow window.
  - The titlebar `closest()` bug is not reproduced.
  Everything else (focus, Escape, Tab wrap, stacking, resize handles, placement) follows the patched jQuery build.
- **Known oddities to clean up while porting.** `world-configurator` passes `width: "minmax(40em, 85vw)"`, which is not a valid width. `limitation-picker` clears `#alert`'s buttons on close only to release closures, which disappears once windows are per-call.
- **Payoff.** About 207 KB fewer render-blocking bytes before `main.ts`, three fewer globals, a five-method typed API over 360+ call sites, every dialog style in one component stylesheet, no Touch Punch workaround, and teardown that can't orphan wrappers.
