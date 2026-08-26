Part of the [FMG Q&A](Q&A). Related topics are listed there.

## Heightmap and terrain

### How do I change the land — add or remove landmass?
Go to Tools → Heightmap and read the mode dialog carefully: **Erase** discards all data and regenerates from the new heightmap; **Keep** preserves everything but won't let land become water; **Risk** allows real land/water changes while keeping most data — usually what you want on an existing map. Then use the brushes on the top right. If you sink land that has burgs, remove those burgs first or they will remain as islands. See [Heightmap customization](Heightmap-customization).

### How do the heightmap brushes work?
In the Heightmap editor pick a brush (raise, lower, smooth, align...), set its size and power at the top right, then click and drag on the map. Small size and low power give fine control.

### How do I make mountains taller?
Raise them in the Heightmap editor (Erase or Risk mode). To change how heights translate to displayed altitude, open Tools → Units and adjust the altitude exponent.

### How do I create a lake?
In Tools → Heightmap (Risk or Erase mode), lower cells below sea level while keeping them fully surrounded by land — the depression automatically becomes a lake. There is no way to add a lake without a heightmap edit, and rivers will be recalculated.

### How do I add an island and name it?
Draw it with a raise brush in the Heightmap editor (Risk mode to keep existing data). Name it by adding a label: Tools tab → Add label → click the island.

### Can I use the Coastline Editor (the red dots on the coast) to change the land?
Use the Heightmap tool for 99% of land changes. The coastline points are only for final fine-tuning of the shape — overusing them causes artifacts.

### There are white bits / transparent land on my map. Why?
Usually the coastline became too complex for the renderer — often from overusing the coastline editor. Edit the heightmap in Risk mode and change some land cells to force a redraw, or regenerate the affected layer.

### Can I increase the number of cells / detail of an existing map?
Use the Transform tool (Tools → Transform): it rebuilds the map with a new cell count while trying to keep your data. It is still a regeneration, so some details may change. To zoom into a region as its own map, use Tools → Submap.

### Can I take a part of my map and make it a new map?
Yes — Tools → Submap generates a new map from the current viewport. Zoom so the area fills the screen, then run Submap.

### Can the tool add generated detail on top of my imported heightmap?
No. You can import heightmaps, but FMG won't generate extra terrain patterns onto them. Workaround: generate a random map you like, export it as an image, blend it with your heightmap in an image editor, and import the result.

### How do I import an image to create terrain?
Tools → Heightmap → Erase → Image Converter. Ideally use a grayscale heightmap (lighter = higher). For a political or artistic map, you'll need to assign heights to colors manually in the converter, then refine with brushes.

### I only have a screenshot of an old map. Can I recreate it?
Not automatically. Import the screenshot via the Image Converter: if it shows a heightmap you can auto-assign heights; if it's political you must map each color to a height by hand, then rebuild details with the editors.

### Where can I find a real-world heightmap to import?
Create a heightmap of any Earth region with the [Heightmapper](https://tangrams.github.io/heightmapper) — export it and load it via the Image Converter.

### How do I change the heightmap colors?
Style → select the heightmap element → pick one of the color schemes or define a custom one. The "Reduce layers" slider skips height steps for a cleaner look; "Simplify line" smooths the isolines. Rendering of ocean height cells is toggled in the oceanHeights group there.

### How do I change the map's physical size (km/miles)?
The canvas size in pixels is fixed after generation, but distance is just a scale: Tools → Units, change the km/miles per pixel — see [Scale and distance](Scale-and-distance). World dimensions (including meridian length) are set in Options → Configure World → Map size. To add more land outside the canvas, export the image, extend it externally, and re-import via the Image Converter.
