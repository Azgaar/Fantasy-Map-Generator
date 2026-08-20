# Pixi viewer contract spike

V-001 proves that the production `PixiMapRenderer` can be mounted without loading the editor, classic scripts, SVG
map stack, or global `pack` state. It is a contract and bundling spike, not yet the final embeddable viewer API.

## Entry and command

- `src/viewer/pixi-map-viewer.ts` is the editor-independent mount/update/destroy API.
- `src/viewer/pixi-viewer-entry.ts` mounts a checked-in static world fixture into `src/viewer.html`.
- `npm run build:viewer` writes the standalone build to the ignored `dist/viewer` directory.

The 2026-08-20 reference build produced a 6.03 kB bootstrap chunk (2.69 kB gzip) and a lazy 228.54 kB renderer chunk
(66.10 kB gzip). Pixi also emitted separately cached renderer and system chunks. These numbers are diagnostic, not a
release budget: later tree-shaking work should select the required Pixi backends and extensions explicitly.

## Current contract

The host supplies an HTML surface, `PackedGraph`, semantic `MapStyle`, typed camera, optional initial visibility, and
optional theme. The returned handle supports renderer-independent updates, camera changes, visibility changes, and
idempotent destruction. The default factory dynamically imports the production renderer; tests can inject a renderer
through the same `MapRenderer` contract.

## Assumptions and open work

- The host owns sizing and the initial camera. The renderer observes later surface resizes.
- World data and styles are already parsed and migrated. A public loader/validation contract is still required.
- The static fixture has no external images or fonts. Relief, texture, emblem, and glyph assets still need an explicit
  URL/CORS/base-path policy and missing-asset behavior.
- The host must provide browser APIs required by Pixi, including canvas/WebGL and `ResizeObserver`.
- Interaction, accessibility alternatives, selection, persistence, and export are outside this spike.
- The separate build has compile and bundle evidence. Browser startup, context-loss recovery, visual output, and embed
  integration remain to be verified when browser automation is available.
