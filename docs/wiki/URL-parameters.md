Here is a list of parameters you can add to URL in order to set generator options and control its behavior on load. It can be used to share exactly the same generated map without need to send the file, or even to show exact place on that map.

## Azgaar's Fantasy Map Generator parameters:
* `maplink` - open .map file from the provided URL, use like [`https://azgaar.github.io/Fantasy-Map-Generator/?maplink=https://dl.dropboxusercontent.com/s/xgs3y1awlokio7x/Atlas%20046.map`](https://azgaar.github.io/Fantasy-Map-Generator/?maplink=https://dl.dropboxusercontent.com/s/xgs3y1awlokio7x/Atlas%20046.map). Due to browser security restrictions, it works only for servers that allow CORS (e.g. DropBox, but not Google Drive)
* `seed` - generate a map from the supplied seed. The seed is applied only on the very first generation of the session. The result also depends on the generation options and the map size, so add `options=default` and `width`/`height` to make it reproducible. Even then a different generator version will produce a different map, so to share exactly the same map send a `.map` file (e.g. via `maplink`)
* `options` - set to `default` to allow generator to ignore options set by user. It's required for sharing the same map, see above
* `width`, `height` - map canvas size in pixels. They overwrite the stored and default map size options
* `scale` - map zoom level, where `1` is 100%, `2` is 200% and so on (allowed range is 1 to 20). If `cell` or `burg` is present without `scale`, the generator uses `8`
* `x`, `y` - point coordinates to focus on. They are read only when `scale` is also present, and default to the map center. Try [`https://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&options=default&scale=8&x=768&y=361`](https://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&options=default&scale=8&x=768&y=361)
* `burg` - burg id or exact burg name to focus on. Try [`https://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&options=default&scale=8&burg=2`](https://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&options=default&scale=8&burg=2)
* `cell` - cell id to focus on. Try [`https://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&options=default&scale=8&cell=1000`](https://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&options=default&scale=8&cell=1000)

## Watabou's Medieval Fantasy City Generator parameters:
These parameters are set by MFCG when it links back to FMG and are not intended to be set manually. They are honored only when `from=MFCG` and the page has a referrer.
* `from`- if equals to `MFCG`, generator will consider the URL as coming from MFCG
* `size` - MFCG city size, equals to the population point in FMG
* `coast` - `1` if the city is on a coastline
* `port` - `1` if the city is a port
* `river` - `1` if the city is on a river

When `from=MFCG` and the `seed` is 13 characters long, the last 4 characters are read as a burg id and the map is focused on that burg. Otherwise FMG picks the burg that best matches `size`, `coast`, `port` and `river`.
