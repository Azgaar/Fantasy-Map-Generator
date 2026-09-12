_Coastline Editor_ shapes the coastlines of the map: how rough or smooth the shores are, how deep the inlets cut, and where along the coast the rough stretches fall. It works on every island and lake at once, or on a single feature.

Open it from _Tools_ → _Coastlines_. The polygon icon in the [Geographical Features Overview](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Geographical-Features-Overview) opens it for that feature alone.

## How coastlines are drawn

The heightmap gives every island and lake a polygon: a chain of cell vertices, joined by smooth arcs. On its own it is a clean but bland outline. The Coastline Editor _fractalizes_ it: each edge is split in the middle, the midpoint is pushed sideways, and the halves are split again, a few levels deep. The displacement is scaled by a **roughness field** — noise laid over the map — so some stretches of coast are carved into deep bays and headlands while others stay glassy arcs.

The displacement depends only on where an edge lies on the map, not on the order the edges are drawn in. Editing the heightmap in one place therefore changes the coast there and nowhere else, and the same map with the same settings always gets the same coastline.

Fractalization changes the outline only. Cells, land area, ports and routes are untouched: a burg on the shore stays on the shore.

## Scope

The selector at the top decides what the editor shapes:

* **Map default** — every coastline of the map. Changes redraw the whole map
* **an island or a lake** — that feature alone. The first change gives the feature its own settings, and from then on the map settings no longer touch it

Islands are listed first and lakes after, each group from the largest down. A feature with its own settings is marked with **•**. The **Reset** button next to the selector removes them, so the feature follows the map settings again.

Own settings are saved with the map. Use them to give one continent fjords while the rest of the world keeps gentle shores, or to calm a single lake.

## Toggle and presets

* **Toggle** — turns fractalization on or off for the scope. Off, coastlines are plain arcs between vertices: the fastest to draw, and the shape you may want for a stylised map. The sliders are greyed out and the previews are marked _OFF_
* **Presets** — _Default_, _Smooth_, _Rocky_, _Fjords_, _Archipelago_. A preset sets every slider except _Variant_; tune from there

## Sliders

Each slider has a reset arrow. For the map, it brings the value back to the default; for a feature, back to the map setting.

* **Detail depth** — how many times an edge is split, `1`–`5`, default `4`. Each level can double the point count in rough zones, so it is the main cost control: `5` gives a tiny isle a real shoreline but makes a continent heavy to draw
* **Roughness amplitude** — the peak sideways push, default `1.5`. It scales with the square root of the edge length, so long edges stay proportional. `0` keeps the arcs as they are; high values carve deep inlets
* **Amplitude decay** — how much the push shrinks at each level, default `0.9`. Low values fade the detail quickly into smooth curves; above `1` the finest level is pushed the most, a spiky, crumbled shore
* **Minimum edge** — edges shorter than this, in map units, are never split, default `1`. Small values let tiny isles get detail; large ones leave only the big features rough
* **Smooth threshold** — where the roughness field is below this the coast gets no displacement at all, default `0.25`. `0` makes the whole coast rough, `0.9` leaves only the rare peaks
* **Roughness contrast** — a power applied to the roughness field, default `1.5`. Below `1` the roughness spreads evenly along the coast; higher makes the calm/rough transition sharper
* **Roughness zone size** — the length of a calm or rough stretch, in map units, default `60`. A few units vary the shore of a single isle; hundreds give a continent a few long calm and rough coasts
* **Variant** — reshuffles the coastline, `0`–`99`. Each value is a different set of coasts with the same character. Change it when the shape is right but a bay landed in the wrong place
* **Lake smooth multiplier** — the smooth threshold multiplied for lake shores, default `2`. `1` makes lakes as rough as the ocean, `0` makes every lake shore rough, high values give glassy lakes. Hidden when an island is selected

## Previews

The previews are built from the map itself: the selected feature, or every island and lake of the map, each drawn with the settings that apply to it.

* **Shape preview** — the coastlines fitted into the canvas, with a fringe on the water side coloured by zone: **orange** where the coast is rough, **teal** where it is calm. On a large feature single subdivisions are too small to see, so a magnifier shows the roughest stretch of the coast at ×2 to ×8; a white circle on the main view marks where it looks
* **Roughness along the coast** — the roughness field sampled on a walk around every shore, with the smooth threshold as a dashed line. The part above it is orange (rough), the part below teal (calm); the vertical line marks where the magnifier looks. Raise or lower _Smooth threshold_ and watch the share of the curve that crosses the line
* **Points · % rough** — the number of points in the coastline path, which is its drawing cost, and the share of the coast in rough zones

## Performance

Point count is what matters. A map of a few large continents at _Detail depth_ `5` with a low _Minimum edge_ can reach hundreds of thousands of points and make every redraw slow. If the map feels sluggish, lower _Detail depth_ first, then raise _Minimum edge_ or _Smooth threshold_. The point count in the preview header shows the effect at once.

Close the Editor when customization is done.
