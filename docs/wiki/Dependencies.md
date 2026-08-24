The unsorted list of used libraries. Many thanks to the authors.

## Current npm dependencies

The source build uses these runtime packages:

* [D3.js v7](https://d3js.org) by Mike Bostock and contributors
* [Delaunator](https://github.com/mapbox/delaunator) by Vladimir Agafonkin
* [Polylabel](https://github.com/mapbox/polylabel) by Vladimir Agafonkin
* [Lineclip](https://github.com/mapbox/lineclip) by Vladimir Agafonkin
* [Three.js](https://github.com/mrdoob/three.js) by mrdoob and Three.js contributors
* [Driver.js](https://driverjs.com) for the guided UI tour
* [Alea](https://github.com/coverslide/node-alea) for seeded random numbers

Vite, TypeScript, Vitest, Playwright and Biome are used as development tools. Node.js 24 or newer is required to build.

## Vendored browser bundles

`public/libs/` holds vendored browser bundles that legacy, non-migrated code still loads as classic scripts. They are not npm dependencies — check `package.json` and the individual imports before adding or removing one.

Loaded on page load from `src/index.html`:

* [jQuery](https://jquery.com) and [jQuery UI](https://jqueryui.com) by the jQuery team — dialogs and sortable lists
* [jQuery UI Touch Punch](https://github.com/furf/jquery-ui-touch-punch) — touch support for the jQuery UI widgets
* D3.js v5 — the global `d3` used by the non-migrated modules
* [flatqueue](https://github.com/mourner/flatqueue) by Volodymyr Agafonkin — priority queue used by the generators
* Delaunator, Alea and Polylabel browser builds
* `indexedDB.js` — a thin wrapper around IndexedDB used for browser storage
* [simplify.js](https://mourner.github.io/simplify-js/) by Volodymyr Agafonkin — coastline simplification
* [RgbQuant.js](https://github.com/leeoniya/RgbQuant.js) by Leon Sorokin — color quantization for the heightmap image converter

Loaded on demand:

* [Three.js](https://threejs.org) with `OrbitControls`, `mapControls`, `loopsubdivison` and `OBJExporter` — the 3D scene
* [JSZip](https://github.com/Stuk/jszip) by Stuart Knightley, David Duponchel, Franz Buchinger and António Afonso — tile export
* [Dropbox SDK](https://github.com/dropbox/dropbox-sdk-js) — saving to and loading from Dropbox
* [TinyMCE](https://www.tiny.cloud) — the rich text editor in the Notes editor
* [OpenWidget](https://openwidget.com) — the optional in-app assistant
