# PR #1583 re-review — fixes at 81ef0851

Re-verified all 18 findings from the first review (docs/pr-1583-review-notes.md) against the new head 81ef0851 (fix range 9c292818..81ef0851, 13 commits). Verdicts trace the failure mechanism at the new head, not commit messages. All line references are at 81ef0851.

## Summary

| # | Finding | Verdict |
|---|---|---|
| 1 | Routes toggle deletes custom route groups | FIXED |
| 2 | Precipitation toggle deletes `#wind` | FIXED |
| 3 | Icons toggle reverts unsaved style edits | FIXED |
| 4 | Legacy label `layerDependency` ids fail open | **NOT FIXED — looks missed** |
| 5 | Export runs drawScaleBar on hidden scale bar | FIXED |
| 6 | Load redraws every layer | PARTIALLY FIXED (now documented as intended; ocean re-roll gone) |
| 7 | Attribute-hidden layers migrate active-but-invisible | FIXED |
| 8 | `Layers.show()` redraws already-on layers | FIXED |
| 9 | Heightmap toggle mid-edit | PARTIALLY FIXED (tip restored; residual → B2) |
| 10 | drawTexture literal `href="null"` | FIXED |
| 11 | Preset switch runs every renderer | NOT FIXED (documented as intended) |
| 12 | style.js renders hidden layers into the save | FIXED |
| 13 | Heightmap keep-mode display ownership | FIXED |
| 14 | Ctrl+click Icons opens wrong style section | NOT FIXED (ignored) |
| 15 | Pre-1.144 custom layer presets destroyed | **NOT FIXED — looks missed** |
| 16 | debugUtils helpers throw | FIXED |
| 17 | savePreset duplicate options | NOT FIXED (ignored) |
| 18 | Six-way force-cells flag | NOT FIXED (ignored) |

The two bolded ones are correctness/data findings that read as missed rather than declined: #4 is unchanged byte-for-byte (localStorage `options.labels` is still never remapped, so the fail-open dependency check still misfires for returning users on new maps), and #15 still destroys pre-1.144 custom layer presets irrecoverably on the next save (only the import line of layers-presets.ts changed).

## New issues introduced by the fix range

### B1. tsc is red at HEAD — `src/generators/ocean-generator.ts:1`
The "no random ocean layers" commit deleted the only use of `P()` but left the import; `noUnusedLocals` makes TS6133 a build failure. One-word fix. (Only tsc error at HEAD; vitest is green, 321 tests.)

### B2. Toggling Heightmap mid-edit leaves the layer on and permanently blank — `src/components/layers.ts:149` + `src/controllers/heightmap-editor.ts:465`
Combination of the new #9 tip guard and the new `set()` semantics. Pressing H (or clicking Heightmap in the Layers tab — both still lack a `customization` guard) during a heightmap edit sets the registry active while `drawHeightmap` early-returns; on finalize, `Layers.set(storedLayers)` draws only ids not already active, so heightmap is skipped. Result: button on, `#terrs` empty, until a manual off/on cycle. Same shape for any layer toggled on mid-edit that was also in `storedLayers` — it keeps stale pre-edit content after `regenerateErasedData` rebuilds the pack. Fix at the registry (`set()` redraws every requested layer) or add the missing `customization` guard to `hotkeys.ts:79` and `layers-tab.ts:75`.

### B3. Removing the "Random" ocean outline silently blanks maps saved with it — `src/generators/ocean-generator.ts:15-18`
The option and the `"random"` branch are gone, but saved maps carry `layers="random"` on `#oceanLayers`. `getLimits("random")` now yields `[NaN]`, which produces zero rings — the ocean outline vanishes with no error, and the Style editor select shows no matching option so the cause is invisible. `auto-update.ts:250` only rewrites the attribute for pre-1.11.0 maps. Fix: map `"random"` to a concrete preset (e.g. `-6,-3,-1`) in the 1.144.0 auto-update block, or a `"random" → default` fallback in `getLimits`.

## Fixed — evidence in brief

- **1/2/3:** per-layer `erase` functions (`removeRoutes`, `removePrecipitation`, `removeBurgIcons` — layers.ts:316/348/369) now remove only content elements, preserving groups, `#wind`, and user style attributes; exactly the declared-ownership direction the first review suggested.
- **5:** `draw-scalebar.ts:8-10` restores the display-none guard; the export clone is attached before the call so computed style resolves.
- **7:** `auto-update.ts:1565-1571` normalizes the SVG `display` attribute to inline style before the visibility sniff.
- **8:** `show`/`hide` filter to layers actually changing state and early-return; no-op calls do zero work and fire no emit. Covered by 12 new layers.test.ts cases.
- **10:** `draw-texture.ts:5-6` returns and clears when `data-href` is absent.
- **12:** all 13 style.js sites route through `Layers.draw(...)`; the raw `window.draw*` globals are deleted with no surviving references.
- **13:** both editor writes to registry-owned `display` are gone; keep-mode erases content instead of hiding, and the registry alone owns visibility.
- **16:** debugUtils uses `select("#debug")`; the `debug: any` Window declaration is removed.

## Also checked, clear

Deleted globals (`drawCompass`, `OceanLayers`, `drawRelief`, `drawStates`, `drawLabels`, `drawGoods`, `drawMarketsLayer`, `drawRegiments`, `redrawLegend`, `clearEmblems`) leave no dangling callers in public/, src/ or tests/ — the ReferenceError class tsc cannot see in classic JS. Declared-children adoption does not widen any erase (compass's `use#compassRose` is preserved and legacy maps get the id stamped). Emblem cache invalidation via `data-coa` covers the removed `clearEmblems`. `Burgs.add` route-drawing moved to both call sites correctly.

## Verification at 81ef0851

`npm install` clean; `npx tsc --noEmit` fails with exactly the B1 unused import; `npx vitest run` 35 files / 321 tests, all passing.
