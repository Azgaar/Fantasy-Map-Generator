# Pixi renderer prototype

The Pixi renderer is an opt-in performance experiment. SVG remains the default renderer and the source used for
editing, saving, and export.

The phased production roadmap is in [pixi-renderer-migration.md](pixi-renderer-migration.md).

## Run

Start the app normally and add the renderer query parameter:

```text
/?renderer=pixi&pixiTheme=states
/?renderer=pixi&pixiTheme=biomes
```

`states` renders grouped state-cell fills, relief sprites, and border geometry through Pixi.
`biomes` renders grouped biome-cell fills. The Pixi dependency is dynamically imported only when the prototype is
enabled.

Pixi-owned layers are no longer rendered into the live SVG first. The prototype currently owns states, relief, and
borders in `states` mode, and biomes in `biomes` mode. It temporarily materializes those SVG layers only while saving,
exporting, switching themes, or disabling Pixi.

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

- The opaque canvas is embedded at map resolution and inherits the SVG viewbox transform. High zoom levels can expose
  raster softness, and moving to a viewport-sized HTML canvas is the next camera optimization.
- State hatching paint servers currently use a neutral fallback color.
- SVG filters, masks, halos, exact water gaps, editing targets, and label rendering remain outside the prototype.
- In state mode, relief, state fills, and borders share one canvas position in the SVG stack, so combinations with
  religions and cultures are not yet pixel-identical to the SVG layer ordering.
- Borders and the SVG renderer share the same extracted border-path builder. The result still uses path tessellation,
  and retained GPU geometry is future work.

Saving and exporting materialize the SVG fallback for the clone, remove the experimental canvas, and then release the
temporary live SVG geometry.
