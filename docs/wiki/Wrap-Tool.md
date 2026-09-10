_Wrap Tool_ reshapes the cells of the map with a brush. Use it to nudge a coastline, round off a lake shore, or make a state border bend the way you want — the small adjustments that are awkward to get out of the Heightmap editor.

Open it from _Tools_ → _Create_ → _Wrap_, or press <kbd>Shift</kbd> + <kbd>W</kbd>. While it is open the map is in customization mode, so clicking the map or pressing an editor shortcut will not open another editor over it.

## What it changes

The tool moves the **corners of map cells** — the shared points that every cell-based layer is drawn from. Coastlines, lake shores, state, province, culture, religion and biome borders, zones and the heightmap all follow, because they are all drawn from the same cells.

Nothing else moves. Burgs, rivers, routes, labels, relief icons, markers, military units and journeys stay exactly where they are, so a large pull can leave a port sitting away from its new coastline. Cell heights, populations, cultures and every other generated value are untouched too: the shapes change, the world data does not.

For anything bigger than a nudge — creating an island, turning land into water, raising a mountain range — use _Tools_ → _Heightmap_ instead.

## Using the brush

* **Drag on the map** to push the cell corners under the brush in the direction you drag. The movement fades out towards the edge of the brush, so the change blends into the surrounding cells
* **Work on a single corner** by shrinking the brush: the smallest radius is 1, well below the size of a cell, so a small brush over a corner moves that corner alone
* **Hover** to see what the brush covers: the affected corners are shown as red dots and the cells they shape are outlined. While you drag, this structure follows the pointer — the map itself is redrawn once you release the mouse, so dragging stays smooth even on a big map
* **Resize the brush** with <kbd>Shift</kbd> + drag on the map — right or up grows it, left or down shrinks it — with the <kbd>+</kbd> and <kbd>−</kbd> keys (one unit per press, for precise work), or with the _Radius_ slider
* **Zoom and pan** as usual: the wheel zooms, <kbd>Space</kbd> + drag pans the map
* Press <kbd>Escape</kbd> to cancel a drag in progress, or again to close the tool and discard the session

The brush stops when a cell would fold over itself or collapse, and every corner has a limited travel distance measured from where the generator originally put it. If the shape stops responding, you have reached that limit — the change you want is a job for the Heightmap editor.

## Buttons

The row at the bottom of the dialog, left to right:

* **Undo** and **Redo** (the two circular arrows) — step through the strokes of the current session, one entry per drag (<kbd>Ctrl</kbd> + <kbd>Z</kbd> / <kbd>Ctrl</kbd> + <kbd>Y</kbd>)
* **Reset session** (the eraser) — put every corner back where it was when you opened the tool and clear the session history. The tool stays open, so you can start over without leaving it
* **Revert all** (the bin) — drop every vertex edit ever made on this map, including edits made in earlier sessions and edits loaded from the .map file. It asks for confirmation and cannot be undone
* **Apply** (the tick) — keep the changes made so far and carry on editing; it starts a fresh session, so what you do next can still be discarded

**Closing the tool is cancelling.** The dialog's close button and <kbd>Escape</kbd> discard everything done since the last Apply — Apply is the only way to keep it. Applied edits are stored in the .map file, so they survive saving, loading and export, and a later session starts from them.

## Tips

* Work zoomed in. The brush radius is measured in map units, so at a low zoom a small brush covers a lot of cells, and a single corner is easier to hit at a high zoom
* Small overlapping strokes give a smoother result than one long pull
* To move a border rather than reshape it, reassign whole cells instead: open the relevant editor (States, Provinces, Cultures, Religions, Biomes, Zones) and use its brush
* If a coastline starts to look ragged, undo rather than trying to smooth it out with more strokes
