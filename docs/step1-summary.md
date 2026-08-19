# Style migration — step 1 summary

Step 1 of `docs/prd/style-migration.md`: the `Style` library, built and proved, wired to
nothing. No live code path changes on this branch — the pipeline swap is step 2.

## What landed

- `src/styles/schema.ts` — the `StyleData` shape: one shared `Attrs` vocabulary (`null` =
  remove the attribute), per-layer `options`, per-child `options` for the layers that
  declare children. Unknown layers, attrs, options and children are dropped with a warning;
  only a non-object throws.
- `src/styles/legacy.ts` — `isLegacyPreset`/`upgradeLegacyPreset` turn an old
  selector-keyed document (`"#burgIcons > g#capital": {...}`) into `StyleData`, renaming
  the decision attributes (`data-size`, `scheme`, `data-width`, …) into options on the way.
  `applyStaticDefaults` supplies the three paint attrs a legacy preset never carried because
  the registry hardcoded them; it runs on this path only.
- `src/styles/style.ts` — the class: `fromJSON`/`toJSON`, `applyTo(layer)`, `applyMapStyle()`
  for the `#map` root, `setAttr`/`setOptions` with a rAF-coalesced redraw scheduler.
- `src/styles/index.ts` — the folder's only public surface. Nothing outside imports it yet.
- `tools/convert-style-presets.mjs` — rewrites `public/styles/*.json` through the upgrader.
  Not run: the 12 shipped presets are still legacy on disk, and converting them belongs to
  the swap.

The API is the PRD's, unchanged — two addressing parameters, layer and child:

```ts
style.options("markers").rescale;
style.options("heightmap", "landHeights").scheme;
style.setAttr("routes", "roads", "stroke", "#803a2b");
style.setOptions("coordinates", {fontSize: 14});
```

Two things that do not obviously fit two levels, and how they do:

- **Label groups** are keyed bare (`capital`) in the tree and the setters, but render as
  `<g id="labels-capital">`. `applyTo` maps the key to the element id, for that layer only.
- **Burg icons and anchors** are two ordinary layers with dynamic children
  (`style.setAttr("anchors", "capital", "fill", …)`). The DOM nests them —
  `#icons > #burgIcons > g#capital` — so `applyTo`, invoked with the registry's icons layer,
  maps the two style layers onto their container groups. Same shape of mapping as labels.

## The proofs

- `npx vitest run src/styles/` — 105 tests over 4 files: schema (42), legacy upgrader (8),
  the class (30), preset conversion (25). Full node suite: 429 passing.
- `CHROMIUM_PATH=… npx vitest run --config vitest.browser.config.ts src/styles/style.dom.test.ts`
  — 10 tests. `applyTo` writes real attributes to a real DOM; the node environment's document
  stub cannot express it, so these run in a browser and are excluded from the node run.
  (`CHROMIUM_PATH` is an env gate for a system-installed browser; unset, Playwright uses its own.)
- **Converter fidelity** (`src/styles/presets.test.ts`): for each of the 12 shipped presets,
  every selector is consumed, the only dropped keys are the two dead ones (`auto-filter`, and
  `#provs`'s unread `data-size`), and the converted document re-parses to itself with no
  warning. That is the guarantee the converter rests on, proved without writing to
  `public/styles`.
- **Nothing changed** (`tests/e2e/style-parity.spec.ts`): every styling attribute on every
  layer group, snapshotted for a loaded reference map and for a freshly generated one, both
  matching baselines captured on master. On this branch they are the dormancy guarantee; at
  the swap they become the parity guarantee.
- `git diff 61008d7c..HEAD -- public/ src/services/ src/components/ src/index.html src/types/`
  is empty. Build-file diffs are `tsconfig.json` (node types, for the preset test's file read)
  and the two vitest configs.
- `npx tsc --noEmit`, `npm run build`, `npm run lint` clean.
  `npx playwright test style-parity layers load-map layer-teardown` — 58 passing.

## Before the swap step, decide

`docs/prd/style.md` says `applyTo` runs inside the registry's redraw path, on the rationale
that erasing overrides is what makes the hand-written `erase` overrides deletable.
`layer-teardown.spec.ts` asserts the opposite contract today — raw DOM edits on a layer
survive a hide/show cycle — and a redraw-reapply model reverts them. The two cannot both
hold while the style editor still writes raw DOM. Which one step 2 honours is your call:
the PRD sentence as written, or the existing test, with the PRD amended.

## Flagged

**zod** is a new runtime dependency, for schema validation (your suggestion in the PRD
discussion). Nothing in the library's API depends on it — a hand-rolled validator behind the
same `parseStyleData` signature is a drop-in. The call is yours.
