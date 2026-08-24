The unsorted list of used libraries. Many thanks to authors.

## Current npm dependencies

The source build currently uses these runtime packages:

* [D3.js v7](https://d3js.org) by Mike Bostock and contributors
* [Delaunator](https://github.com/mapbox/delaunator) by Vladimir Agafonkin
* [Polylabel](https://github.com/mapbox/polylabel) by Vladimir Agafonkin
* [Lineclip](https://github.com/mapbox/lineclip) by Vladimir Agafonkin
* [Three.js](https://github.com/mrdoob/three.js) by mrdoob and Three.js contributors
* [Driver.js](https://driverjs.com) for the guided UI tour
* [Alea](https://github.com/coverslide/node-alea) for seeded random numbers

The project also uses Vite, TypeScript, Vitest, Playwright, and Biome as development tools.

## Legacy browser bundles

The `public/libs` directory still contains vendored browser bundles used by parts of the legacy UI, including jQuery/jQuery UI, JSZip, OrbitControls, OpenWidget, `flatqueue`, and other utilities. Their presence does not mean they are current npm dependencies; check `package.json` and the individual imports before adding or removing one.

* [jQuery](https://code.jquery.com/jquery-3.1.1.min.js) and [jQuery-ui](https://jqueryui.com) by jQuery team
* [OrbitControls](https://github.com/mrdoob/three.js/blob/master/examples/js/controls/OrbitControls.js) by qiao, mrdoob, alteredq, WestLangley, erich666 and ScieCode
* [JSZip](https://github.com/Stuk/jszip) by Stuart Knightley, David Duponchel, Franz Buchinger and António Afonso
* [Alea](https://github.com/coverslide/node-alea) is also available as a vendored browser bundle.
