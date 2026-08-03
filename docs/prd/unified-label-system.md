# Unified Label System

## Summary

Labels use one style, grouping, editing, and persistence model while retaining two efficient SVG renderings:

- State and user-added labels render on `<textPath>`.
- Burg labels render as positioned `<text>` elements and do not allocate SVG paths.
- `burg.group` is the Burg label's default Label Group; `burg.label.group` is a rare override.
- Any State, Burg, or added label may use any Label Group.
- Label Groups render as direct children of the `#labels` SVG Layer.

## Data model

```ts
const DEFAULT_STATE_LABEL_GROUP = "states";
const DEFAULT_BURG_LABEL_GROUP = "town";
const DEFAULT_ADDED_LABEL_GROUP = "addedLabels";

interface Label {
  text?: string;
  group?: string;
  dx?: number;
  dy?: number;
  fontSize?: number;
  letterSpacing?: number;
}

interface PathLabel extends Label {
  pathPoints?: Point[];
  startOffset?: number;
}

interface LabelStyle {
  groups: Record<string, LabelGroupStyle>;
}

style.labels: LabelStyle;
```

`LabelGroupStyle` retains the existing optional `data-dx` and `data-dy` fields. The Style module turns them
into one parent-group CSS transform. The persisted data remains compatible with style documents, while the
transform automatically affects every child and composes with per-label translation.

## Group resolution

The Labels module is the only module that resolves a label's group.

```ts
const requestedGroup = burg.label?.group || burg.group || DEFAULT_BURG_LABEL_GROUP;
const resolvedGroup = style.labels.groups[requestedGroup] ? requestedGroup : DEFAULT_BURG_LABEL_GROUP;
```

State labels fall back to `states`; added labels fall back to `addedLabels`. Required fallback styles are
created before rendering. If malformed data omits a fallback style, the renderer recreates it from the
built-in default.

### Example: Burg using its classification group

```ts
pack.burgs[12] = { i: 12, name: "Northpass", group: "capital", x: 410, y: 220 };

style.labels.groups.capital = {
  "font-family": "Almendra SC",
  "font-size": 6,
  "data-dx": 0,
  "data-dy": -0.5,
  fill: "#3e3e4b"
};
```

```svg
<g id="capital" data-dx="0" data-dy="-0.5" style="transform: translate(0em, -0.5em)">
  <text id="burgLabel12" data-label-type="burg" data-id="12" x="410" y="220">Northpass</text>
</g>
```

### Example: cross-entity group sharing

```ts
pack.states[3].label = { group: "capital" };
pack.burgs[12].label = { group: "states" };
```

The State uses `capital` typography and remains path-rendered. The Burg uses `states` typography and remains
positioned text.

### Example: missing style

If a Burg belongs to `metropolis` but `style.labels.groups.metropolis` is missing, the Burg remains classified
as `metropolis` while its label renders with `town`. Editing the Burg-group label style creates `metropolis`
by cloning `town`.

### Example: old style-name collision

Old maps could contain a Burg style and an added-label style both named `capital`, because they lived in
separate namespaces. Migration keeps the Burg style as `capital`, renames the added-label style to
`capital_labels` (adding another `_labels` suffix if needed), and updates the affected added labels. The new
runtime then has one unambiguous style per Label Group id.

## SVG and rendering

- Render Label Groups as direct `#labels > g` children; the group id is the style key and no additional marker
  attribute is required.
- Create configured groups in `style.labels.groups` insertion order, including empty groups, so Style Editor
  selection and SVG stacking are stable.
- Mark every label with `data-label-type` and `data-id`.
- Preserve stable element ids such as `stateLabel3`, `burgLabel12`, and `addedLabel7`.
- Share escaping, multiline markup, typography, group creation, cleanup, and redraw orchestration.
- Apply `data-dx` and `data-dy` once on the group as `translate(<dx>em, <dy>em)`.
- Render Burg labels without paths.

## Editing and reset

The Label Editor opens labels by `{type, id}` rather than by a specific SVG child structure.

- Normal Burg-label and Burg-icon clicks open the Burg Editor.
- The Burg Editor has an explicit Edit Label action.
- Burg editing supports text, group override, size, letter spacing, dragging, style, legend, and reset.
- Burgs do not expose path, alignment, or start-offset controls.

`Labels.reset({type, id})` restores defaults:

- State: delete `state.label` and rerender the generated text and fitted path.
- Burg: delete `burg.label` and rerender from the Burg name, coordinates, and `burg.group`.
- Added label: retain `i`, `text`, `pathPoints`, and `group`; remove `dx`, `dy`, `startOffset`, `fontSize`, and
  `letterSpacing`.

The Editor remains open, reselects the new SVG element, refreshes values, and rebinds dragging.

## Group lifecycle

- Creating a Burg Group creates a same-named Label Group cloned from `town` when missing.
- An existing same-named Label Group is intentionally shared.
- Renaming a Burg Group copies its old Label Group style to the new id when needed and preserves the old style.
- Deleting a Burg Group preserves its Label Group.
- Label Groups matching active Burg Group ids may be edited but not renamed or deleted directly.
- Deleting another custom Label Group removes matching State/Burg overrides and moves added labels to
  `addedLabels`.
- `states`, `town`, and `addedLabels` cannot be renamed or deleted.

## Compatibility and migration

The current runtime supports only `style.labels.groups` and the flat SVG representation. The pre-`1.140.0`
auto-update program migrates old maps:

- The State style is read from `#labels > #states`.
- Burg styles are read from the actual `#burgLabels > g` elements and become same-named generic Label Groups.
- Added-label styles are read from their actual `#labels > g` elements.
- `data-dx` and `data-dy` retain their style-document representation.
- Legacy SVG nesting is flattened and labels are redrawn.

Bundled presets retain `data-dx` and `data-dy` but use flat selectors. Current load, save, preset, Editor, and
Renderer modules contain no branches for the legacy style containers or `#burgLabels` topology.

Current maps serialize the complete global `style` object as the normal `.map` data entry at index 48. Load
parses that JSON directly and then renders the SVG groups from `style.labels.groups`. There is no label-specific
`data-label-styles` payload.

Pre-1.140 maps do not have the style entry. `auto-update.ts` reconstructs the complete style object from the
actual legacy SVG groups, performs the label migration, and writes the modern JSON entry to index 48 before
normal loading continues. `load.ts` contains no legacy style reconstruction.

## Acceptance criteria

- Burg labels allocate no paths.
- All label types can share groups without changing their rendering primitive.
- Group offsets apply uniformly through a parent transform.
- State, Burg, and added-label reset behavior matches the rules above.
- Old maps migrate through auto-update and new maps round-trip the new format.
- Unit tests and production build pass.
