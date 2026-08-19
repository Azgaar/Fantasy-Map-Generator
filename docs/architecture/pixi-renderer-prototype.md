# Pixi renderer prototype

The Pixi renderer is an opt-in performance experiment. SVG remains the default renderer and the source used for
editing, saving, and export.

## Run

Start the app normally and add the renderer query parameter:

```text
/?renderer=pixi&pixiTheme=states
/?renderer=pixi&pixiTheme=biomes
```

`states` renders grouped state-cell fills, relief sprites, and the existing generated border paths through Pixi.
`biomes` renders grouped biome-cell fills. The Pixi dependency is dynamically imported only when the prototype is
enabled.

The prototype is also available from the browser console:

```js
await PixiMapPrototype.enable("states");
await PixiMapPrototype.enable("biomes");
await PixiMapPrototype.rebuild();
PixiMapPrototype.getSnapshot();
await PixiMapPrototype.disable();
```

`getSnapshot` reports the last build duration, source cell count, graphics-batch count, relief-sprite count, and active
Pixi renderer. Rebuild duration is also recorded as `pixi:rebuild` in `MapPerformance`.

## Prototype constraints

- The canvas is embedded at map resolution and inherits the SVG viewbox transform. This makes pan and zoom cheap, but
  high zoom levels can expose raster softness.
- State hatching paint servers currently use a neutral fallback color.
- SVG filters, masks, halos, exact water gaps, editing targets, and label rendering remain outside the prototype.
- In state mode, relief, state fills, and borders share one canvas position in the SVG stack, so combinations with
  religions and cultures are not yet pixel-identical to the SVG layer ordering.
- Borders reuse the already-generated SVG path. The prototype currently measures Pixi paint performance, not a new
  border-generation algorithm.

Saving and exporting remove the experimental canvas and restore the untouched SVG fallback in the cloned document.
