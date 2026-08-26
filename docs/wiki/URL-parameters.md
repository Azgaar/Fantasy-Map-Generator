Here is a list of parameters you can add to URL in order to set generator options and control its behavior on load. It can be used to share exactly the same generated map without need to send the file, or even to show exact place on that map.

## Azgaar's Fantasy Map Generator parameters:
* `maplink` - open .map file from the provided URL, use like [`https://azgaar.github.io/Fantasy-Map-Generator/?maplink=https://dl.dropboxusercontent.com/s/xgs3y1awlokio7x/Atlas%20046.map`](https://azgaar.github.io/Fantasy-Map-Generator/?maplink=https://dl.dropboxusercontent.com/s/xgs3y1awlokio7x/Atlas%20046.map). Due to browser security restrictions, it works only for servers that allow CORS (e.g. DropBox, but not Google Drive)
* `seed` - generate a map from the supplied seed. The seed is applied only on the very first generation of the session. The result also depends on the generation options and the map size, so add `options=default` and `width`/`height` to make it reproducible. Even then a different generator version will produce a different map, so to share exactly the same map send a `.map` file (e.g. via `maplink`)
* `options` - set to `default` to allow generator to ignore options set by user. It's required for sharing the same map, see above
* `width`, `height` - map canvas size in pixels
* `scale` - map zoom level, where `0.5` is 50% zoom, `1` is 100%, `2` is 200% and so on
* `x`, `y` - point coordinates that should be focused. Obviously works only if `scale` is greater than 1. Try [`http://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&width=1536&height=722&options=default&scale=8&x=768&y=361`](http://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&width=1536&height=722&options=default&scale=8&x=768&y=361)
* `burg` - burg id or name to focus on, works only if `scale`  is greater than 1. Try [`http://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&width=1536&height=722&options=default&scale=8&burg=2`](http://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&width=1536&height=722&options=default&scale=8&burg=2)
* `cell` - cell if to focus on, Try [`http://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&width=1536&height=722&options=default&scale=8&cell=1000`](http://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&width=1536&height=722&options=default&scale=8&cell=1000)
* `preset` - layers preset to apply on load. Use the dropdown key (`political`, `religions`, `heightmap`, and so on) or the displayed name (`Religions map`). Try [`http://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&width=1536&height=722&options=default&preset=religions`](http://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&width=1536&height=722&options=default&preset=religions)
* `layers` - comma-separated layers to show on load, other user layers will be hidden. Ids match the Layers tab (`states`, `borders`, `lakes`, `burgIcons` for Icons, `scaleBar` for Scale Bar). If both `preset` and `layers` are set, `layers` is used. Try [`http://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&width=1536&height=722&options=default&layers=provinces,borders,lakes,rivers`](http://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&width=1536&height=722&options=default&layers=provinces,borders,lakes,rivers)

## Watabou's Medieval Fantasy City Generator parameters:
These parameters are set by MFCG when it links back to FMG and are not intended to be set manually. They are honored only when `from=MFCG` and the page has a referrer.
* `from`- if equals to `MFCG`, generator will consider the URL as coming from MFCG
* `size` - MFCG city size, equals to the population point in FMG
* `coast` - `1` if the city is on a coastline
* `port` - `1` if the city is a port
* `river` - `1` if the city is on a river

When `from=MFCG` and the `seed` is 13 characters long, the last 4 characters are read as a burg id and the map is focused on that burg. Otherwise FMG picks the burg that best matches `size`, `coast`, `port` and `river`.
