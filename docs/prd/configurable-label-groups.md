# PRD: Configurable Label Groups and Unified Province Labels

## Problem Statement

FMG currently has three partially overlapping label systems:

- State, Burg, and added labels use the generic Labels layer and reusable Label Groups.
- Province labels are generated inside the Provinces SVG layer, have a separate visibility control, and cannot use the
  Label Editor or Label Group styles.
- Label visibility on zoom is hard-coded in the global zoom handler and inferred from each SVG group's `data-size`.

This division prevents users from treating labels as one coherent map feature. Province labels cannot be edited like
State labels, a dense map cannot selectively reveal labels at useful zoom levels, and labels can remain visible when the
map layer that gives them meaning is hidden. For example, a River label without the Rivers layer or a Province label
without the Provinces layer is confusing.

The current automatic visibility rule is also too implicit. It derives a temporary font size and hides any group whose
screen size falls outside a fixed range. Users cannot inspect or change the resulting level of detail (LOD), cannot
disable a single group without changing its visual style, and cannot define a dependency on another layer. The global
`hideLabels` and `rescaleLabels` DOM controls mix map behavior with Style Editor concerns and make the DOM a source of
truth.

Label Group management is likewise fragmented. The individual Label Editor creates and deletes groups even though
groups are shared map configuration, while Configure Burg Groups can create or reclassify Burg groups that implicitly
affect Burg labels. Moving many labels between groups requires editing them one at a time. Existing group names are also
used directly as SVG IDs, so common names such as `capital`, `city`, or `states` can collide with IDs elsewhere in the
document.

Province labels cannot simply be enabled by default under the current system: on a map with dozens of provinces they
make the map crowded at the overview scale. They need the same editable, group-based, zoom-aware system as other labels
before they can become a default part of the Labels layer.

## Solution

Introduce a **Configure Labels** controller that owns all non-visual Label Group configuration:

- create, rename, delete, activate, and reorder groups;
- set each group's fixed label type and name mode;
- define inclusive minimum and maximum zoom bounds;
- optionally link group visibility to an existing FMG layer;
- open the Style Editor for the group's visual style;
- open a bulk assignment dialog for moving many labels to one group;
- configure the global `resizeOnZoom` and `showAll` options.

Unify Province labels with State, Burg, and added labels under the generic Labels layer. Province labels use the
State-like curved-path placement and editing workflow, have a protected default `provinces` group, and are active by
default. Their default layer dependency is `toggleProvinces`, so they disappear when the Provinces layer is off without
needing a second Province-label toggle.

Move Label Group behavior into `options.labels`, persisted in `.map` files and in local storage for newly created maps.
Keep visual values such as font family, relative font size, fill, stroke, shadow, opacity, and offsets in
`style.labels.groups`. Style Presets may change only those visual values; applying a preset never changes activation,
LOD, dependency, type, mode, or rendering order.

Replace per-group `data-size` zoom resizing with one parent font size on `#labels`. The parent starts at `100px`; every
Label Group uses a relative percentage, and individual label overrides remain relative percentages. When
`options.labels.resizeOnZoom` is enabled, the parent follows the existing dampened zoom curve. Group LOD becomes an
explicit policy evaluated independently from resizing.

A group is rendered exactly when the master Labels layer is on and either `showAll` is enabled or all of the group's
normal restrictions pass:

1. the group is active;
2. the current map zoom is within its inclusive minimum and maximum bounds;
3. its configured dependent layer, if any, is on.

The selected UI is the compact Variant A prototype, rebuilt with current FMG dialog conventions: one-height table rows,
FMG buttons, native FMG inputs, `Active` terminology, and order controls on the right.

## User Stories

1. As a map author, I want Province labels to use the generic Labels layer, so that all map labels have one master
   visibility control.
2. As a map author, I want Province labels enabled by default, so that provinces are identifiable without opening the
   Provinces Editor.
3. As a map author, I want Province labels hidden when the Provinces layer is off, so that names do not appear without
   the geography they describe.
4. As a map author, I want Province labels to follow curved paths like State labels, so that long names fit irregular
   province shapes.
5. As a map author, I want to click a Province label and open the Label Editor, so that it is editable in the same way as
   State and added labels.
6. As a map author, I want to customize a Province label's text, path, offset, relative size, and letter spacing, so that
   important provinces can be presented deliberately.
7. As a map author, I want renaming a Province to redraw its default label, so that the map stays consistent with world
   data.
8. As a map author, I want a manually overridden Province label text to survive an unrelated Province redraw, so that my
   edit is not silently lost.
9. As a map author, I want deleted or merged Provinces to lose their obsolete labels and text paths, so that no orphaned
   names remain on the map.
10. As a map author, I want newly created Provinces to receive default labels automatically, so that the label layer does
    not require manual repair.
11. As a map author, I want a Configure Labels tool under Tools → Edit, so that Label Group behavior is discoverable
    alongside other FMG editors.
12. As a keyboard user, I want Shift+L to open Configure Labels, so that I can reach the controller quickly.
13. As a Coastline Settings user, I want Shift+L to have only one meaning, so that the old Coastline shortcut does not
    conflict with Configure Labels.
14. As a map author, I want Ctrl-click on the Labels layer to keep opening the Style Editor, so that the existing style
    shortcut remains unchanged.
15. As a map author, I want the Style Editor reachable from every Configure Labels row, so that visual changes are one
    click away.
16. As a map author editing one label, I want the Label Editor's Style button to remain available, so that I can style
    the selected label's group in context.
17. As a map author, I want Configure Labels to use compact, single-line FMG table rows, so that more than twenty groups
    remain practical in one dialog.
18. As a map author, I want the visibility column called `Active`, so that it matches Configure Burg Groups and other FMG
    terminology.
19. As a map author, I want order controls on the right side of each row, so that group identity and behavior fields are
    read first.
20. As a map author, I want to activate or deactivate one Label Group, so that I can hide a category without altering its
    style.
21. As a map author, I want every group to define an optional minimum zoom, so that detailed labels can appear only after
    I zoom in.
22. As a map author, I want every group to define an optional maximum zoom, so that overview labels can disappear when I
    zoom into local detail.
23. As a map author, I want a blank minimum or maximum to mean no restriction in that direction, so that one-sided LOD
    rules are easy to express.
24. As a map author, I want zoom boundaries to be inclusive, so that a group configured for zoom 2 through 10 is visible
    at exactly 2 and exactly 10.
25. As a map author, I want invalid zoom ranges rejected, so that a minimum greater than the maximum cannot produce
    surprising visibility.
26. As a map author who changed FMG's global zoom extent, I want Label Group LOD values to remain unchanged, so that a
    rare global preference change does not rewrite my map design.
27. As a map author, I want changing a group's font size to leave its LOD unchanged, so that typography and visibility
    remain independent after initialization.
28. As a map author, I want applying Watercolor or another Style Preset to preserve LOD, so that choosing a visual theme
    does not change which labels are shown.
29. As a map author, I want a group to depend on a selectable FMG layer, so that its labels disappear when that layer is
    off.
30. As a map author, I want to remove a layer dependency by selecting None, so that a group can be independent.
31. As a map author, I want the default State and added groups independent of other layers, so that they behave like
    today's general labels.
32. As a map author, I want default Burg groups linked to Burg icons, so that Burg names do not float on a map where Burg
    icons are intentionally hidden.
33. As a map author, I want the default Province group linked to Provinces, so that Province names follow Province-layer
    visibility.
34. As a future River-label user, I want River groups linked to Rivers by default, so that names cannot appear without
    river geometry.
35. As a future Route-label user, I want Route groups linked to Routes by default, so that names cannot appear without
    route geometry.
36. As a map author, I want dependencies to use the current layer toggle IDs such as `toggleProvinces`, so that this
    feature does not depend on the future Layers Registry migration.
37. As a map author, I want the master Labels layer to override every group, so that turning Labels off always hides all
    labels.
38. As a map author debugging a map, I want `Show all labels` to bypass active, LOD, and dependency restrictions, so that
    I can inspect every rendered label at once.
39. As a map author, I want `Show all labels` still to respect the master Labels layer, so that the master layer remains
    authoritative.
40. As an export user, I want the existing Show all labels export checkbox to read and write
    `options.labels.showAll`, so that export and Configure Labels never disagree.
41. As a map author, I want label resizing on zoom controlled by `options.labels.resizeOnZoom`, so that the behavior is
    serialized and not inferred from a DOM checkbox.
42. As a map author, I want the existing dampened resizing curve preserved, so that labels change smoothly rather than
    snapping or scaling linearly.
43. As a map author, I want resizing to affect the parent Labels layer, so that every group responds consistently without
    per-group `data-size`.
44. As a map author, I want individual label size overrides to remain percentages of the group size, so that existing
    emphasis such as a 125% capital label continues to work.
45. As a map author, I want every group to have `auto`, `short`, or `full` name mode, so that the naming choice is part of
    the group configuration.
46. As a map author, I want all newly created groups to start in `auto` mode regardless of type, so that the safest fitting
    behavior is the default.
47. As a State-label user, I want `short` to use the State name and `full` to use the State full name, so that political
    naming is predictable.
48. As a Province-label user, I want `short` to use the Province name and `full` to use its full name, so that Province
    labeling matches State labeling.
49. As a user with custom label text, I want that explicit text to win over generated short/full names, so that changing
    group mode does not erase my wording.
50. As a Burg or added-label user, I want all three modes to be stored even when the entity has no alternate generated
    name, so that the schema is uniform and future behavior can be added without migration.
51. As a map author, I want a protected default group for every in-scope label type, so that every label always has a
    valid fallback.
52. As a map author, I want the protected defaults for States, Provinces, and added labels to be named `states`,
    `provinces`, and `added`, so that their purpose is obvious.
53. As a Burg user, I want the current default Burg classification group (normally `town`) to be the Burg-label fallback,
    so that Burg icons and unoverridden Burg labels stay aligned.
54. As a map author, I want protected default groups to allow activation, LOD, dependency, mode, style, and order changes,
    so that protection prevents data corruption without making the group immutable.
55. As a map author, I want protected default groups to reject rename and deletion, so that fallback references cannot be
    broken.
56. As a map author, I want to create a group by first selecting its fixed type, so that FMG knows which defaults to copy.
57. As a map author, I want a new group to inherit its type default's LOD, mode baseline, dependency baseline, and visual
    style, so that it is useful immediately.
58. As a map author, I want a group's type fixed after creation, so that changing type cannot silently reinterpret shared
    defaults.
59. As a map author who chose the wrong type, I want to create a new correctly typed group and reassign labels, so that
    correction is explicit.
60. As a map author, I want group names to be globally unique, so that references and styles are unambiguous.
61. As a map author, I want group names valid for use in an HTML/SVG ID, so that generated DOM identifiers and selectors
    remain safe.
62. As a map author, I want invalid or duplicate names rejected before create or rename, so that the map never enters an
    ambiguous state.
63. As a map author, I want to rename a custom group and have all State, Province, Burg, and added-label references move
    with it, so that no labels fall back unexpectedly.
64. As a map author, I want to delete a custom group only after confirmation, so that a shared operation cannot happen by
    accident.
65. As a map author deleting a group, I want every affected label reassigned to the default for its own entity type, so
    that a cross-type assignment is recovered safely.
66. As a map author, I want the deletion confirmation to show affected-label counts by type, so that I understand the
    impact before proceeding.
67. As a map author, I want group creation and deletion removed from the individual Label Editor, so that shared
    configuration has one owner.
68. As a map author, I want the individual Label Editor to retain group selection, so that moving one label remains fast.
69. As a map author assigning a Burg label to a State-type group, I want a confirmation on the selection change, so that a
    cross-type style and policy change is intentional.
70. As a map author cancelling a cross-type confirmation, I want the selector restored to its prior group, so that no
    partial assignment occurs.
71. As a map author, I want cross-type assignment allowed after confirmation, so that a capital Burg can deliberately use
    the `states` Label Group.
72. As a map author, I want cross-type assignment to preserve the entity's renderer, so that a Burg remains positioned
    Burg text while inheriting the target group's style, LOD, mode, activity, and dependency.
73. As a map author with many labels, I want a bulk Assign Labels dialog, so that I do not have to move labels one at a
    time.
74. As a map author, I want the bulk dialog to show one selected entity type at a time, so that States, Burgs, Provinces,
    and added labels remain understandable.
75. As a map author, I want every row to show the label and its current group, so that I can audit assignments before
    changing them.
76. As a map author, I want checkboxes and a select-all checkbox, so that I can choose an arbitrary subset or the entire
    category.
77. As a map author, I want one target-group selector for the selected rows, so that a mass change has one clear result.
78. As a map author, I want the target selector to expose all groups, grouped by type, so that deliberate cross-type bulk
    assignments remain possible.
79. As a map author, I want cross-type bulk targets to use the same confirmation behavior as the individual Label Editor,
    so that mass changes receive equal protection.
80. As a map author, I want bulk assignment to change nothing until Apply, so that I can safely review the selection.
81. As a map author, I want Cancel to discard every pending bulk assignment, so that the dialog is transactional.
82. As a map author, I want the bulk table to scroll rather than paginate or stop at twenty labels, so that all labels of
    the selected type are available in one operation.
83. As a Burg user, I want Label Groups matching Burg groups to exist automatically, so that a Burg classification can
    immediately supply its default label style and behavior.
84. As a Burg user creating a new Burg group, I want its Label Group inserted using the Burg group's order once, so that
    the initial stack is sensible.
85. As a Burg user, I want later Burg-group reordering not to rewrite Label Group order, so that icon order and label order
    can diverge intentionally.
86. As a Burg user, I want Burg-managed Label Groups protected from rename and deletion in Configure Labels, so that
    Configure Burg Groups remains the source of their identity.
87. As a Burg user, I want changing Configure Burg Groups to reclassify only Burgs without a preserved label-group
    override, so that manually assigned Burg labels stay where I put them.
88. As a Burg user, I want Configure Burg Groups to explain this interaction, so that a manually assigned label remaining
    in another Label Group is not mistaken for a bug.
89. As a Burg user, I want adding, renaming, or deleting a Burg group to reconcile its managed Label Group safely, so that
    the two configurations do not drift.
90. As a new-map user, I want my Label configuration loaded from local storage and aligned with my locally configured
    Burg groups, so that new maps use my preferred setup.
91. As a saved-map user, I want loading a `.map` file to use the file's Label and Burg configuration rather than local
    storage, so that the map reproduces exactly on another machine.
92. As a saved-map user, I want group order, mode, activation, LOD, dependency, and global Label options serialized, so
    that reopening the map reproduces the same visibility.
93. As a saved-map user, I want style data serialized separately from Label behavior, so that the state remains compatible
    with FMG's style architecture.
94. As a Style Preset user, I want all built-in presets to contain visual styles for every required Label Group, so that
    switching presets never leaves a default group unstyled.
95. As a Style Preset user with a custom or Burg-managed group absent from the preset, I want FMG to retain or clone a
    valid type-default style, so that applying the preset does not delete the group.
96. As a legacy-map user, I want existing State, Burg, and added label assignments preserved through migration, so that
    opening an old map does not scramble names.
97. As a legacy-map user, I want each old group's initial LOD derived once from its old font size, so that the old automatic
    visibility behavior is approximated by explicit data.
98. As a legacy-map user, I want old `rescaleLabels` behavior migrated to `options.labels.resizeOnZoom`, so that my zoom
    preference is preserved.
99. As a legacy-map user, I want the old automatic visibility checkbox ignored during migration, with all migrated groups
    active, so that hidden DOM state is not mistaken for authored group configuration.
100. As a legacy-map user, I want migrated groups to start without layer dependencies, so that old independent behavior is
     preserved.
101. As a legacy-map user, I want the old `addedLabels` default renamed to `added`, including all references and styles, so
     that the new vocabulary is consistent.
102. As a legacy-map user, I want a custom group that collides with a required or Burg-managed name renamed to
     `<oldName>_migrated`, so that both groups survive.
103. As a legacy-map user, I want repeated migration-name collisions resolved deterministically, so that migration never
     overwrites a group.
104. As a legacy-map user, I want old Province-label offsets recovered where possible and the old Province label SVG group
     removed, so that there is only one Province-label renderer after migration.
105. As a legacy-map user, I want migration to remove `data-size` only after converting group sizes to percentages, so that
     labels keep their effective size.
106. As a maintainer, I want label visibility expressed as a pure policy function, so that combinations of master layer,
     show-all, active, LOD, and dependencies can be unit-tested without SVG.
107. As a maintainer, I want Label/Burg group reconciliation isolated from either dialog, so that startup, map load, and
     Configure Burg Groups share the same rules.
108. As a maintainer, I want State-like region label fitting shared by States and Provinces, so that placement fixes do not
     diverge between two copied algorithms.
109. As a maintainer, I want renderers to project serializable options and style into SVG without mutating world state, so
     that the implementation follows FMG 2.0 separation of concerns.
110. As a maintainer, I want future River, Route, Lake, and Zone labels to plug into the same group policy later, so that
     this version does not paint the architecture into a corner.

## Implementation Decisions

### Data model and ownership

- `options.labels` is the source of truth for global label behavior and ordered Label Group configuration.
- `style.labels.groups` remains the source of truth for visual values. It is a record keyed by Label Group name.
- Group names are deliberately duplicated: every options entry contains `name`, and the corresponding style is stored
  under that name. Rename is a single transactional operation that updates both structures and all label references.
- `options.labels.groups` is an **ordered array**, not a record with a numeric `order`. Array order is SVG rendering order;
  later entries render above earlier entries. Up/down buttons mutate the array.
- Burg icon groups retain their existing numeric `order`. When a Burg-managed Label Group is first created, Burg order
  determines its insertion point once. Subsequent Burg ordering does not synchronize Label Group order.
- The decision-rich schema is:

  ```ts
  type LabelNameMode = "auto" | "short" | "full";

  type LabelGroupOptions = {
    name: string;
    type: LabelType;
    active: boolean;
    layerDependency: string | null;
    zoom: { min: number | null; max: number | null };
    mode: LabelNameMode;
  };

  type LabelsOptions = {
    resizeOnZoom: boolean;
    showAll: boolean;
    groups: LabelGroupOptions[];
  };
  ```

- `applyLod` does not exist. LOD is enabled or disabled only by whether an individual group's `zoom.min` or `zoom.max` is
  non-null. `showAll` is the explicit temporary override for all restrictions.
- The existing global State-label mode is retired. Its behavior moves to each group's `mode`.
- Province world data gains the same optional path-label override shape used by States. Automatically calculated label
  paths do not have to be persisted; user-edited text, path, offset, relative size, start offset, and letter spacing do.
- Label Group type describes defaults, name selection, configuration categorization, and warnings. It does **not** change
  an entity's renderer. A Burg assigned to a State-type group remains lightweight positioned Burg text; it adopts the
  target group's style and policies.

### Protected groups and defaults

- Required non-Burg defaults are:

  | Group       | Type        | Active | Default dependency | Default mode |
  | ----------- | ----------- | ------ | ------------------ | ------------ |
  | `states`    | `states`    | true   | None               | auto         |
  | `provinces` | `provinces` | true   | `toggleProvinces`  | auto         |
  | `added`     | `added`     | true   | None               | auto         |

- The Burg fallback is the Burg group marked as default by Configure Burg Groups, normally `town`. Every current Burg
  group also owns a Burg-managed Label Group with the same name. These groups default to active and
  `toggleBurgIcons`.
- Required defaults cannot be renamed or deleted. Burg-managed groups cannot be renamed or deleted from Configure
  Labels, because Configure Burg Groups owns their identity. All other fields remain editable.
- A new custom group requires a type and valid unique name. It copies the selected type default's current style,
  activation baseline, dependency, and exact LOD values, but always starts with `mode: "auto"`.
- Normal custom groups are inserted after the last group of the selected type. The user can immediately move them with
  up/down controls.

### Naming and DOM identity

- Label Group names use the same Unicode-aware identifier rule as Burg groups: start with a letter or underscore, then
  contain only letters, digits, underscores, or hyphens. Spaces and a leading digit are invalid.
- Names are unique across every Label Group type and every Burg-managed group.
- Real validation examples:

  | Proposed name  | Result                  | Reason                                    |
  | -------------- | ----------------------- | ----------------------------------------- |
  | `royal_cities` | valid                   | starts with a letter; underscores allowed |
  | `river-port`   | valid                   | hyphens allowed after the first character |
  | `_debug`       | valid                   | underscore may start an identifier        |
  | `Royal Cities` | invalid                 | spaces are not allowed                    |
  | `12towns`      | invalid                 | starts with a digit                       |
  | `states`       | invalid for a new group | protected name already exists             |

- SVG Label Groups are direct children of `#labels`. Their DOM ID is prefixed (`labels-${name}`) and the logical name is
  also stored in `data-group`. Code and persisted state use the logical name, never the prefixed DOM ID. This prevents
  collisions such as `#capital` under Labels and Burg icons.
- Every label element carries its entity type and entity ID in data attributes, allowing click-to-edit and bulk auditing
  without parsing a DOM ID.

### Visibility policy

- A pure visibility evaluator receives the master Labels state, global options, one group, current zoom, and a
  `layerIsOn` dependency lookup.
- Normal visibility is:

  ```text
  labelsLayerOn
  AND group.active
  AND (group.zoom.min is null OR scale >= group.zoom.min)
  AND (group.zoom.max is null OR scale <= group.zoom.max)
  AND (group.layerDependency is null OR dependency layer is on)
  ```

- Override visibility is:

  ```text
  labelsLayerOn AND options.labels.showAll
  ```

- `showAll` bypasses group activity, both LOD bounds, missing/off dependencies, and future restrictions. It never bypasses
  the master Labels layer.
- Bounds are inclusive. Blank values serialize as `null`. Numeric values must be finite and within FMG's supported map
  zoom range of 0.01–200. When both values exist, minimum must be less than or equal to maximum.
- An unknown dependency ID is treated as off and visibly flagged in Configure Labels. The user can select None or another
  known layer. This fails closed rather than unexpectedly showing context-free labels.
- Visibility is reapplied when any of the following changes: map zoom, master Labels layer, group options, `showAll`, or a
  layer that may be a dependency. Zooming toggles group visibility only; it does not regenerate label geometry.
- The implementation uses one shared hidden mechanism and removes stale legacy `hidden` classes during render and
  migration.

### LOD initialization

- Existing automatic visibility used:

  ```text
  relative = (desired + desired / scale) / 2
  visible when 6 <= relative * scale <= 60
  ```

  Solving for scale yields:

  ```text
  min = 12 / desired - 1
  max = 120 / desired - 1
  ```

- Initial values are rounded to two decimals. A non-positive lower bound becomes `null`; invalid or non-positive font
  sizes fall back to the selected type default.
- Real migrations from the default style:

  | Existing group          | Old desired size | Initial explicit zoom |
  | ----------------------- | ---------------: | --------------------- |
  | `states`                |               22 | min null, max 4.45    |
  | `addedLabels` → `added` |               18 | min null, max 5.67    |
  | `capital`               |                6 | min 1, max 19         |
  | `city`                  |                5 | min 1.4, max 23       |
  | `town`                  |                4 | min 2, max 29         |
  | default Province style  |               10 | min 0.2, max 11       |

- The value is calculated once when a default or migrated group is defined. It is not recalculated when the font size,
  Style Preset, or global zoom extent later changes.
- A new custom group inherits its type default's existing LOD rather than recalculating it.
- A newly created Burg-managed group inherits the current default Burg Label Group's LOD. A migrated old Burg group
  derives its own initial LOD from its own old font size, preserving the closest approximation of previous behavior.

### Parent-level zoom resizing

- `#labels` owns a base font size of `100px`.
- Every Label Group converts its former numeric font size to a percentage: an old `22` becomes `22%`, `6` becomes `6%`,
  and so on. `data-size` is removed.
- Individual label sizes are already relative percentages and remain unchanged. For example, a State label at `125%`
  inside a `22%` group remains 27.5px at scale 1.
- If `resizeOnZoom` is false, the parent stays at `100px`.
- If `resizeOnZoom` is true, the parent follows the existing dampened curve:

  ```text
  parentFontSize = max(round((100 + 100 / scale) / 2, 2), 1) px
  ```

  Real values are 100px at scale 1, 75px at scale 2, 62.5px at scale 4, and 52.5px at scale 20.

- The global zoom handler delegates Label behavior to a dedicated label zoom/visibility module. It no longer loops over
  groups, reads `data-size`, reads `hideLabels`, or reads `rescaleLabels`.

### Province label integration

- Province labels move from the Provinces layer into the same flat Label Group renderer used by other labels.
- Province label layout uses the State path-label algorithm generalized into a region-label layout module. The module
  accepts region cells, pole, generated short/full names, optional overrides, and the group's effective typography.
- `auto` chooses the fitting short or full Province name; `short` uses `province.name`; `full` uses
  `province.fullName`. Explicit custom label text always wins.
- Province labels use text paths and may be dragged/reshaped through the Label Editor. They are no longer dragged or
  toggled from the Provinces Editor.
- The Province Editor's label button and its private label-toggle function are removed. The editor no longer owns label
  visibility.
- Drawing, renaming, creating, removing, merging, releasing, or regenerating Provinces updates the corresponding generic
  labels and text paths without redrawing unrelated label types.
- Turning on the Provinces layer does not force the master Labels layer on. When Labels is off, Province labels remain
  hidden even though their dependency passes.

### Configure Labels controller

- The controller is lazy-loaded through the existing Controllers registry and creates/releases its dialog on demand.
- It is available as `Labels` under Tools → Edit and by Shift+L.
- Shift+L is removed from Coastline Settings to avoid double dispatch. Coastline Settings remains available from Tools;
  assigning it a replacement shortcut is outside this feature.
- The selected layout is the approved dense-table prototype:

  | Column           | Control                                        |
  | ---------------- | ---------------------------------------------- |
  | Active           | FMG-native checkbox                            |
  | Group            | protected/managed indicator plus one-line name |
  | Type             | read-only type                                 |
  | Name mode        | `auto` / `short` / `full` select               |
  | Zoom min         | compact optional number input                  |
  | Zoom max         | compact optional number input                  |
  | Layer dependency | existing-layer select                          |
  | Labels           | current resolved-label count                   |
  | Order            | compact up/down FMG icon buttons               |
  | Actions          | Style, Rename, Delete FMG icon buttons         |

- Rows remain one text line high. The table scrolls for large group counts. It uses current FMG `.dialog`, `.table`,
  checkbox, input, select, tooltip, icon, and jQuery dialog approaches rather than prototype-specific styling.
- Global controls are `Resize labels on zoom` and `Show all labels`. They edit `options.labels` immediately.
- Row edits apply immediately after validation and redraw/reapply only what is necessary. The dialog has no redundant
  Apply transaction.
- Style opens the existing Style Editor with Labels and the logical group preselected.
- Rename is available only for ordinary custom groups. Delete is available only for ordinary custom groups and always
  opens the standard FMG confirmation dialog.
- The count column uses resolved assignments, including Burgs that inherit `burg.group` because
  `burg.label.group` is absent.

### Group mutation semantics

- Rename updates, as one operation:
  - the options entry name;
  - the `style.labels.groups` key;
  - explicit State, Province, Burg, and added-label group references;
  - the last-selected Label Editor group;
  - the rendered group's prefixed DOM ID and `data-group`.
- Delete confirmation shows affected counts by actual entity type. On confirmation:
  - State overrides to the deleted group are cleared, resolving to `states`;
  - Province overrides are cleared, resolving to `provinces`;
  - Burg label-only overrides are cleared, resolving to the Burg's current `burg.group` and ultimately the default Burg
    group;
  - added labels are explicitly assigned to `added`;
  - the options entry and style entry are removed.
- Example: deleting a Province-type group `regional_names` that contains 12 Provinces, two States, and one capital Burg
  sends the Provinces to `provinces`, the States to `states`, and clears the capital's label override so it follows its
  Burg group. It does not send all 15 labels to `provinces`.
- Changing an individual label to a group of another type opens the standard confirmation dialog on the select change.
  Confirm applies and redraws the label; Cancel restores the prior option.
- Moving a capital Burg into `states` is legal after confirmation. It uses State-group visual and visibility policy but
  remains positioned Burg text; it does not acquire a State polygon path.

### Bulk assignment

- Configure Labels opens an `Assign Labels` subdialog.
- The category selector supports the four in-scope entity types. The table lists all valid, non-removed entities of that
  type in a scrolling body with Select, Label, and Current group columns.
- State and Province rows show the current rendered/default name; Burg rows show the Burg name; added rows show their
  text. The current group is the fully resolved group, not merely the optional override field.
- A header checkbox selects or clears all visible rows. There is no twenty-row cap and no pagination.
- The target select includes every group, visually grouped by fixed type. A cross-type target uses the same confirmation
  rule as the individual editor.
- Apply validates the target, applies all selected assignments as one transaction, redraws affected label types once, and
  closes. Cancel closes without changing world data.
- If no labels are selected or no valid target exists, Apply is disabled or reports an FMG error tip.

### Configure Burg Groups reconciliation

- A dedicated reconciliation module compares Burg groups with Burg-managed Label Groups. It is used at new-map startup
  and after Configure Burg Groups applies changes.
- New Burg groups create same-named Label Groups of type `burgs`, inheriting the default Burg Label Group's behavior and
  visual style. Their initial insertion uses Burg order only once.
- Renaming a Burg group renames its managed Label Group and updates Burg references, provided the target name is globally
  valid and unique.
- Deleting a Burg group removes its managed Label Group. Explicit labels that directly referenced that deleted group are
  reassigned by the same per-entity fallback rules used for Label Group deletion.
- Burg reclassification continues to change `burg.group`. A Burg without `burg.label.group` follows the new
  classification automatically. A Burg with a manual label-only override keeps that override if the target Label Group
  still exists.
- Configure Burg Groups displays this explanatory note:

  > Applying Burg-group changes reclassifies Burgs and therefore their default Label Groups. Burg labels manually
  > assigned to another Label Group keep that label-only assignment.

- Label Group order is not continuously synchronized with Burg icon order. This is called out in the tooltip for the
  order controls.

### Style Editor and Style Presets

- Style Editor remains responsible only for visual fields: font family, relative group font size, fill, stroke,
  stroke-width, opacity, shadow, letter spacing, filter, and group offsets.
- Group Active, LOD, dependency, type, mode, order, `resizeOnZoom`, and `showAll` are absent from Style Editor.
- The old `Hide selected group`, `Toggle visibility automatically`, and `Rescale on zoom` Label-style controls are
  removed.
- Font size is displayed/stored as a relative group percentage. Visual editing updates `style.labels.groups[name]` and
  the rendered SVG projection.
- The Style Editor group selector is populated from the ordered options array rather than relying on raw DOM IDs.
- Ctrl-click on the Labels layer continues to open Style Editor. It does not open Configure Labels.
- Each built-in Style Preset contains visual entries for `states`, `provinces`, `added`, and all built-in Burg groups.
  Missing required entries are copied from the correct type default as part of the preset migration.
- Applying a Style Preset updates only style data. Example: Default → Watercolor may change `states` from 22% to 18% and
  its font family, while a user-authored State LOD of max 6 remains max 6.
- A preset that does not mention a user-created group does not delete or reconfigure it. Its current visual style remains
  valid; groups created while that preset is active clone the effective type-default style.

### Persistence and startup

- `.map` serialization already stores the global `options` object and `style` separately; the new Label configuration
  uses those existing channels.
- New-map startup reads Label options from a dedicated local-storage value. If absent or invalid, FMG creates defaults.
  It then reconciles the result with the Burg groups loaded from local storage.
- Every successful Configure Labels mutation updates local storage for future newly generated maps.
- Loading a modern `.map` file uses `options.labels`, `options.burgs`, and `style.labels` from that file. It does not merge
  local Label or Burg configuration into the loaded map.
- Loading an old file without `options.labels` invokes the migration and then uses the migrated in-file state for the
  session.
- The old settings-array positions formerly used by `hideLabels` and `rescaleLabels` remain reserved/empty for file
  compatibility; new saves do not use DOM values there.
- JSON export exposes the new options through the normal options payload and stops emitting authoritative top-level
  `hideLabels`/`rescaleLabels` values.

### Migration

- Migration is version-gated, idempotent, and supports both the older nested SVG structure and the current flat
  Label Group/style structure.
- Legacy structure recognition includes:
  - nested Burg groups under the historical Burg-label container;
  - the single `states` group;
  - the `addedLabels` default;
  - other direct children that represented custom added-label groups;
  - current flat groups already represented in `style.labels.groups`.
- For every migrated group:
  - preserve visual style;
  - convert numeric/equivalent pixel font size to a percentage under the 100px parent;
  - remove `data-size`;
  - derive initial zoom once using the legacy formula;
  - set `active: true`;
  - set `layerDependency: null`;
  - set `mode: "auto"`, except the old global State-label mode may seed the `states` group to preserve an explicit
    short/full choice;
  - preserve explicit label assignments.
- `rescaleLabels` seeds `options.labels.resizeOnZoom`; if missing, the new default is true.
- Old automatic visibility state, per-group `display:none`, stale `hidden` classes, and `hideLabels` are ignored.
  `options.labels.showAll` starts false.
- `addedLabels` becomes `added` everywhere: options, styles, added-label references, fallbacks, selectors, and rendered
  data attributes.
- The new protected `provinces` group is created active with `toggleProvinces` dependency. Its initial visual style is
  extracted from the legacy Province label typography in the effective preset/map style, then represented as a normal
  Label Group style.
- Existing Province label transforms are parsed into Province label offsets where possible. The old Province label
  container is then removed from the Provinces layer, along with its private display state, and Province labels are
  redrawn through the generic renderer.
- When flattening or introducing protected groups causes a collision, the legacy custom group is renamed
  `<oldName>_migrated` and all its references move with it. If that name also exists, append `_2`, `_3`, and so on.
- Real collision example: a legacy custom added-label group named `capital` collides with the Burg-managed `capital`
  group. Burg `capital` keeps its name; the custom group becomes `capital_migrated`, and its added labels are updated.
- Custom flat groups infer a fixed type from their explicit users. A group referenced by one entity type receives that
  type. A mixed group uses the type with the greatest number of explicit references, with a deterministic tie order of
  States, Provinces, Burgs, then added. An unused custom group defaults to `added`. Assignments remain unchanged because
  fixed type does not restrict membership.
- After migration, the old Province label group, old nested Burg-label container, and obsolete Label visibility controls
  are not retained as active sources of state.

### Deep modules and architectural boundaries

- **Label policy module:** validates Label Group options, resolves defaults, evaluates visibility, derives legacy LOD,
  and exposes a small pure interface. This is the primary unit-test target.
- **Label Group reconciliation module:** performs create/rename/delete transactions, resolves entity fallbacks, and
  aligns Burg-managed groups. It accepts world/options/style data and returns changes; dialogs do not duplicate these
  rules.
- **Region label layout module:** generalizes State path fitting for State and Province regions. It owns generated
  short/full/auto selection and path calculation but does not mutate SVG or world state.
- **Label renderer:** projects ordered group options and keyed styles into direct children of `#labels`, draws each entity
  type, and applies visibility. It remains idempotent and does not own configuration.
- **Configure Labels controller:** owns dialog lifecycle and user events. It calls the policy/reconciliation interfaces
  and uses established FMG dialog components and conventions.
- **Migration adapter:** converts legacy serialized/DOM data into the new options/style/world shape once. Runtime modules
  do not retain legacy branching after migration.

### Acceptance examples and behavior matrix

The following combinations are normative:

| Labels layer | Show all | Active | Zoom passes | Dependency passes | Group visible |
| ------------ | -------- | ------ | ----------- | ----------------- | ------------- |
| off          | false    | true   | true        | true              | no            |
| off          | true     | false  | false       | false             | no            |
| on           | true     | false  | false       | false             | yes           |
| on           | false    | false  | true        | true              | no            |
| on           | false    | true   | false       | true              | no            |
| on           | false    | true   | true        | false             | no            |
| on           | false    | true   | true        | true              | yes           |

Real end-to-end examples:

1. `states` has max zoom 4.45, no dependency, and is active. At scale 4 it is visible; at 4.46 it is hidden. Turning on
   Show all makes it visible again. Turning off Labels hides it even with Show all.
2. `provinces` is active, has max zoom 11, and depends on `toggleProvinces`. At scale 3 it is visible only while both
   Labels and Provinces are on.
3. `town` is active, has min zoom 2, and depends on `toggleBurgIcons`. At scale 1.9 it is hidden. At scale 2 it appears
   if Burg icons are on.
4. A user sets `regional_names` to min 3, max 18, then switches to Watercolor. Its font changes through style; 3–18
   remains unchanged.
5. A capital Burg is manually assigned to `states` after confirmation. Configure Burg Groups later changes the Burg from
   `capital` to `city`; its label stays in `states` because `burg.label.group` is explicit.
6. The same Burg with no label override changes from `capital` to `city`; its resolved Label Group changes automatically
   to `city`.
7. Deleting `regional_names` with mixed entity types reassigns each entity to its own fallback, not to the deleted
   group's fixed type default.
8. A loaded `.map` has custom Label configuration while local storage has different groups. The loaded map uses only the
   file's groups until the user starts a new map.

## Testing Decisions

- Good tests assert external behavior and serialized outcomes, not DOM traversal details, private helper names, or the
  exact implementation of the dialog.
- The pure Label policy module receives exhaustive unit tests for:
  - every row in the visibility matrix;
  - inclusive min/max boundaries and null bounds;
  - invalid numeric values and min greater than max;
  - unknown dependencies;
  - `showAll` bypass behavior while preserving the master layer;
  - the legacy LOD formula and rounding for sizes 22, 18, 10, 6, 5, and 4;
  - one-time inheritance rather than font/preset/global-extent recomputation;
  - identifier validation and duplicate detection.
- The reconciliation module receives unit tests for:
  - protected-group rejection;
  - create with type-default inheritance;
  - transactional rename across options, styles, and all four entity references;
  - deletion with per-entity fallback;
  - mixed-type groups;
  - Burg-group add, rename, delete, and one-time order insertion;
  - preserved `burg.label.group` overrides during Burg reclassification;
  - deterministic collision renaming.
- The region label layout module receives unit tests by extending the existing State-label test style:
  - Province `auto`, `short`, and `full`;
  - explicit text winning over generated names;
  - usable paths for irregular and small regions;
  - empty/removed regions returning no label;
  - offsets and user path overrides preserved.
- Renderer tests assert visible output behavior:
  - ordered direct groups under `#labels`;
  - prefixed IDs and logical `data-group`;
  - percentage group font sizes under a 100px parent;
  - individual percentage overrides preserved;
  - Province labels carry Province type/ID and text paths;
  - no legacy Province label container or nested Burg-label container;
  - group visibility updates without label geometry regeneration.
- Migration tests cover representative serialized fixtures:
  - current flat groups;
  - old nested Burg/State/added structure;
  - `addedLabels` rename;
  - custom/Burg collision to `_migrated`;
  - repeated `_migrated` collision;
  - mixed-type custom group inference;
  - old Province label transform recovery;
  - old `rescaleLabels` on/off;
  - hidden/automatic visibility ignored;
  - migration idempotency.
- Controller-level tests focus on user-observable state transitions:
  - Shift+L resolves only Configure Labels;
  - Tools → Edit opens the controller;
  - cross-type change confirmation applies or rolls back;
  - delete confirmation applies or cancels;
  - bulk assignment Apply is transactional and Cancel is inert;
  - Style actions open the correct logical group;
  - Configure Burg Groups explanatory note is present.
- Persistence tests save and reload options/style/world state and prove:
  - group order is preserved;
  - local storage seeds a new map;
  - `.map` load does not merge local storage;
  - Style Preset changes preserve options;
  - Export Show all and Configure Labels share one option.
- Existing prior art to extend:
  - the Label Group resolution and fallback unit tests;
  - State path-label renderer tests;
  - label markup and 3D label-style tests;
  - layer Playwright tests for master visibility;
  - State-label Playwright tests for editing and path rendering;
  - Burg tests for Configure Burg Groups and persisted groups.
- Playwright tests are authored as part of implementation but are run through the normal test/CI workflow, not
  automatically during exploratory development.

## Out of Scope

- River labels, Route labels, Lake labels, and Zone labels. They are explicit future extensions and do not add enum
  values, default groups, empty UI categories, or renderers in this PRD.
- A Layers Registry. Layer dependencies intentionally store current DOM toggle IDs such as `toggleProvinces` for now.
- Continuous synchronization of Burg icon order and Label Group rendering order.
- Changing Ctrl-click on the Labels layer to open Configure Labels; it continues to open Style Editor.
- Keeping group creation or deletion in the individual Label Editor.
- Keeping the Province Editor's private label visibility control.
- Adding LOD or behavioral metadata to Style Preset JSON.
- Recalculating LOD whenever font size, Style Preset, or global zoom extent changes.
- Changing a Label Group's fixed type after creation.
- Changing an entity's rendering geometry solely because it is assigned to a cross-type group.
- Replacing current FMG jQuery dialogs, tables, buttons, inputs, tooltips, or icon conventions with a new design system.
- Assigning a replacement keyboard shortcut to Coastline Settings.
- A new generic label collision-avoidance engine; this work reuses/generalizes current State path fitting.
- 3D-specific LOD controls beyond consuming the same resolved group styles/options where the existing 3D renderer already
  supports labels.

## Further Notes

- The compact Variant A prototype is the accepted information architecture only. Production must be rebuilt with current
  FMG dialog markup, table density, native controls, tooltips, and icon classes; prototype CSS is not production input.
- The term **Label Group** continues to mean reusable visual and behavioral configuration. The label entity still owns
  its text/path/offset overrides.
- The renderer must stay a projection. It may add/remove SVG elements and visibility classes, but it must not repair
  `options`, `style`, Burg groups, or world labels while drawing.
- `showAll` is intentionally user-accessible despite being primarily diagnostic. It is serialized because exports and
  reopened maps must not disagree with the visible state.
- Future River, Route, Lake, and Zone labels should use path-based rendering. When added, they should extend the same
  options array, visibility evaluator, bulk assignment surface, and migration conventions rather than introduce another
  label container.
- The glossary should be updated when implemented: Label Group will own visual style through `style.labels.groups` and
  behavior through `options.labels.groups`, while the ordered options array defines SVG stacking.
