The unsorted list of used libraries. Many thanks to the authors.

## Current npm dependencies

The source build uses these runtime packages:

- [D3.js v7](https://d3js.org) by Mike Bostock and contributors
- [Delaunator](https://github.com/mapbox/delaunator) by Vladimir Agafonkin
- [Polylabel](https://github.com/mapbox/polylabel) by Vladimir Agafonkin
- [Lineclip](https://github.com/mapbox/lineclip) by Vladimir Agafonkin
- [Three.js](https://github.com/mrdoob/three.js) by mrdoob and Three.js contributors
- [Driver.js](https://driverjs.com) for the guided UI tour
- [Quill 2](https://quilljs.com) — the rich text editor in the Notes editor
- [Alea](https://github.com/coverslide/node-alea) for seeded random numbers
- [JSZip](https://github.com/Stuk/jszip) by Stuart Knightley, David Duponchel, Franz Buchinger and António Afonso — tile export and icon archives, loaded on demand
- [Dropbox SDK](https://github.com/dropbox/dropbox-sdk-js) — saving to and loading from Dropbox, loaded on demand
- [RgbQuant.js](https://github.com/leeoniya/RgbQuant.js) by Leon Sorokin — color quantization for the heightmap image converter

Two small libraries are kept as typed source in `src/utils/` rather than as dependencies: [flatqueue](https://github.com/mourner/flatqueue) and [simplify.js](https://mourner.github.io/simplify-js/) by Volodymyr Agafonkin — the generators' priority queue and coastline simplification.

Vite, TypeScript, Vitest, Playwright and Biome are used as development tools. Node.js 24 or newer is required to build.

## Vendored browser bundles

`public/libs/` holds the browser bundles the app still loads as classic scripts. They are not npm dependencies.

- [Three.js](https://threejs.org) r140 with `OrbitControls`, `mapControls`, `loopsubdivison` and `OBJExporter` — the 3D scene, loaded on demand

## Services

- Azgaar server at [ask.azgaarsfmg.com](https://ask.azgaarsfmg.com) — answers Guest and Member questions in Azgaar Assistant; the app contacts it only on the official site
