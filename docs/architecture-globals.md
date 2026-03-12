# Fantasy Map Generator — Global Variable Architecture

## Critical: main.js is NOT an ES Module

`public/main.js` (and all other `public/modules/**/*.js` files) are loaded as plain
`<script defer>` tags — **not** ES modules. Every `var`, `let`, `const`, and `function`
declaration at the top level of these files is automatically a **property of `window`**
(the global object).

### Key globals exposed by main.js

| Variable      | Type              | Description                                  |
| ------------- | ----------------- | -------------------------------------------- |
| `scale`       | `number`          | Current D3 zoom scale factor (initially `1`) |
| `viewX`       | `number`          | Current D3 zoom translate X (initially `0`)  |
| `viewY`       | `number`          | Current D3 zoom translate Y (initially `0`)  |
| `graphWidth`  | `number`          | Map canvas width in SVG user units           |
| `graphHeight` | `number`          | Map canvas height in SVG user units          |
| `svgWidth`    | `number`          | SVG element rendered width (px)              |
| `svgHeight`   | `number`          | SVG element rendered height (px)             |
| `pack`        | `object`          | Packed voronoi graph + all generated data    |
| `grid`        | `object`          | Initial grid graph                           |
| `viewbox`     | D3 selection      | D3 selection of `#viewbox` `<g>`             |
| `svg`         | D3 selection      | D3 selection of `#map` `<svg>`               |
| `zoom`        | D3 zoom behaviour | The active d3-zoom instance                  |
| `seed`        | `string`          | Current map seed                             |
| `options`     | `object`          | Global render/UI options                     |

### Rule for TypeScript/ES-module code in `src/`

All main.js globals are declared as ambient globals in `src/types/global.ts`.
Just **use them directly** — no `window.` prefix, no `(window as any)`, no `globalThis`.
TypeScript already knows their types.

```ts
// ✅ CORRECT — declared in src/types/global.ts, use as bare globals
buildCameraBounds(viewX, viewY, scale, graphWidth, graphHeight);
viewbox.on("zoom.webgl", handler);

// ❌ WRONG — unnecessary indirection
(window as any).scale(globalThis as any).viewX;
```

### Other public/modules globals of note

`toggleRelief`, `drawRelief`, `undrawRelief`, `rerenderReliefIcons`, `layerIsOn`,
`turnButtonOn`, `turnButtonOff`, `byId`, `tip`, `rn`, `P`, `gauss` — all utility
functions defined in public JS files and available globally.

## Module loading order

1. `public/libs/*.js` — third-party (d3, jQuery, etc.)
2. `src/utils/index.ts`, `src/modules/index.ts`, `src/renderers/index.ts` — ES modules
   (bundled by Vite); these run **before** the deferred legacy scripts
3. `public/main.js` and `public/modules/**/*.js` — deferred plain scripts
