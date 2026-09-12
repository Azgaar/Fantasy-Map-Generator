_Coastline Editor_ shapes the coastlines of the map: how rugged or calm the shores are, how deep the bays cut, and where along the coast the rough stretches fall. It works on every island and lake at once, or on a single feature.

Open it from _Tools_ → _Coastlines_. The polygon icon in the [Geographical Features Overview](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Geographical-Features-Overview) opens it for that feature alone.

## How coastlines are drawn

The heightmap gives every island and lake a polygon: a chain of cell vertices, joined by smooth arcs. On its own it is a clean but bland outline. The Coastline Editor bends it into a natural-looking shore: each edge is split in the middle, the midpoint is pushed sideways, and the halves are split again, a few levels deep. How far a place is pushed depends on a **roughness** noise laid over the map, so some stretches of coast are carved into deep bays and headlands while others stay calm arcs.

The shape depends only on where an edge lies on the map, not on the order the edges are drawn in. Editing the heightmap in one place therefore changes the coast there and nowhere else, and the same map with the same settings always gets the same coastline.

Only the outline changes. Cells, land area, ports and routes are untouched: a burg on the shore stays on the shore.

## Scope

The selector at the top decides what the editor shapes:

* **Whole map** — every coastline of the map. Changes redraw the whole map
* **an island or a lake** — that feature alone. The first change gives the feature its own settings, and from then on the map settings no longer touch it

Islands are listed first and lakes after, each group from the largest down. A feature with its own settings is marked with **•**. The **Use map settings** button next to the selector removes them, so the feature follows the map settings again; until then the editor says _follows the map settings_.

Own settings are saved with the map. Use them to give one continent fjords while the rest of the world keeps gentle shores, or to calm a single lake.

## Natural shores and presets

* **Natural shores** — the switch turns the shaping on or off for the scope. Off, coastlines are plain arcs between vertices: the fastest to draw, and the shape you may want for a stylised map. The sliders are greyed out and the previews are marked _OFF_
* **Presets** — _Default_, _Smooth_, _Rocky_, _Fjords_, _Skerries_. A preset sets every slider except _Variant_; tune from there

## Sliders

Each slider has a reset arrow. For the whole map, it brings the value back to the default; for a feature, back to the map setting.

* **Detail** — how fine the shore detail is, `1`–`5`, default `4`. Each step adds ever smaller bays and points, and can double the point count in rough zones, so it is the main cost control: `5` gives a tiny isle a real shoreline but makes a continent heavy to draw
* **Ruggedness** — how far the coast bends in and out, default `1.5`. `0` keeps the smooth arcs; high values carve deep bays and headlands. Long edges are pushed further than short ones, so the coast stays proportional
* **Fine detail** — how much the small details stand out, default `0.9`. Low values give soft, rounded shores; above `1` the smallest details are pushed the most, a jagged, crumbly shore
* **Smallest edge** — coast segments shorter than this, in map units, stay as they are, default `1`. Small values let tiny isles get detail; large ones keep them simple and the map faster to draw
* **Calm shores** — how much of the coast stays calm, default `0.25`. `0` makes every shore rough, `0.9` leaves only a few rough stretches
* **Contrast** — how sharply calm shores turn into rough ones, default `1.5`. Low values blend them along the coast; high values give clear-cut calm and rough coasts
* **Stretch length** — how long a calm or rough stretch of coast is, in map units, default `60`. A few units mix them along the shore of a single isle; hundreds give a continent a few long coasts of each kind
* **Variant** — reshuffles where the calm and rough stretches fall, `0`–`99`, keeping the same look. Change it when the shape is right but a bay landed in the wrong place
* **Calmer lakes** — how much calmer lake shores are than the sea, default `2`. `1` makes lakes as rough as the sea, `0` makes every lake shore rough, high values give glassy lakes. Hidden when an island is selected

## Previews

The previews are built from the map itself: the selected feature, or every island and lake of the map, each drawn with the settings that apply to it.

* **Shape preview** — the coastlines fitted into the canvas, with a fringe on the water side coloured by zone: **orange** where the coast is rough, **teal** where it is calm. On a large feature single details are too small to see, so a magnifier shows the roughest stretch of the coast, from ×2 on a small island up to ×20 on a continent; a white circle on the main view marks where it looks
* **Roughness along the coast** — the roughness sampled on a walk around every shore, with _Calm shores_ as a dashed line. The part above it is orange (rough), the part below teal (calm); the vertical line marks where the magnifier looks. Move _Calm shores_ and watch the share of the curve that crosses the line
* **Points · % rough** — the number of points in the coastline paths, which is their drawing cost, and the share of the coast in rough zones

## Performance

Point count is what matters. A map of a few large continents at _Detail_ `5` with a low _Smallest edge_ can reach hundreds of thousands of points and make every redraw slow. If the map feels sluggish, lower _Detail_ first, then raise _Smallest edge_ or _Calm shores_. The point count above the preview shows the effect at once.

Close the Editor when customization is done.
