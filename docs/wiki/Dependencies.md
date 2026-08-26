The unsorted list of used libraries. Many thanks to authors:

* [D3.js v.5](https://d3js.org) by Mike Bostock and contributors
* [Delaunator](https://github.com/mapbox/delaunator) by Vladimir Agafonkin
* [Polylabel](https://github.com/mapbox/polylabel) by Vladimir Agafonkin
* [Lineclip](https://github.com/mapbox/lineclip) by Vladimir Agafonkin
* [FlatQueue](https://github.com/mourner/flatqueue) by Vladimir Agafonkin
* [RgbQuant.js](https://github.com/leeoniya/RgbQuant.js) by Leon Sorokin
* [jQuery](https://code.jquery.com/jquery-3.1.1.min.js) and [jQuery-ui](https://jqueryui.com) by jQuery team
* [Three.js](https://github.com/mrdoob/three.js) by mrdoob and Three.js contributors
* [OrbitControls](https://github.com/mrdoob/three.js/blob/master/examples/js/controls/OrbitControls.js) by qiao, mrdoob, alteredq, WestLangley, erich666 and ScieCode
* [TinyMCE](https://www.tiny.cloud/) by Tiny Technologies (used for the rich-text Notes editor)
* [driver.js](https://github.com/kamranahmedse/driver.js) by Kamran Ahmed (powers the in-app guided tour)
* [Dropbox SDK](https://github.com/dropbox/dropbox-sdk-js) by Dropbox (map-file integration, see `dropbox.html`)
* [simplify.js](https://github.com/mourner/simplify-js) by Vladimir Agafonkin
* [JSZip](https://github.com/Stuk/jszip) by Stuart Knightley, David Duponchel, Franz Buchinger and António Afonso
* [aleaPRNG](https://github.com/macmcmeans/aleaPRNG) by Johannes Baagøe
* An IndexedDB wrapper (`public/libs/indexedDB.js`, exposed as `ldb`) used to persist the last-saved map locally
* A small OBJ exporter, a loop-subdivision helper and a companion map-camera controller (bundled alongside Three.js/OrbitControls) used by the 3D heightmap export/preview tools
* An embeddable chat-widget script, lazily loaded for the in-app "Assistant" button

All of the above (except the npm-installed D3 v7, see below) are bundled directly under `public/libs/` and loaded as plain `<script>` tags.

## Two versions of D3

The project currently ships **two major versions of D3 side by side**, a side effect of the ongoing migration from classic scripts to TypeScript/Vite modules:

* **D3 v5** (`public/libs/d3.min.js`) is loaded globally (as `window.d3`) for the legacy code that still lives in `public/modules/*.js`.
* **D3 v7** (npm package `d3`) is imported as ES modules by the newer TypeScript code under `src/`.

Both are needed until the migration of `public/modules/` into `src/` is complete; don't assume `d3` behaves identically in both halves of the codebase.

## Build tooling

Beyond the runtime libraries above, the project is built with **Vite** and **TypeScript**, linted/formatted with **Biome**, and tested with **Vitest** and **Playwright**. These aren't bundled into the shipped app, but you'll need them to build or develop the project — see [Run FMG locally](Run-FMG-locally) for setup instructions.
