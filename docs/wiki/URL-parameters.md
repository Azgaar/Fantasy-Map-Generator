Here is a list of parameters you can add to URL in order to set generator options and control its behavior on load. It can be used to share exactly the same generated map without need to send the file, or even to show exact place on that map.

## Azgaar's Fantasy Map Generator parameters:
* `maplink` - open .map file from the provided URL, use like [`https://azgaar.github.io/Fantasy-Map-Generator/?maplink=https://dl.dropboxusercontent.com/s/xgs3y1awlokio7x/Atlas%20046.map`](https://azgaar.github.io/Fantasy-Map-Generator/?maplink=https://dl.dropboxusercontent.com/s/xgs3y1awlokio7x/Atlas%20046.map). Due to browser security restrictions, it works only for servers that allow CORS (e.g. DropBox, but not Google Drive)
* `seed` - generate a map from the supplied seed. The result also depends on the current generation options and map size. The current loader does not read `width` or `height`; `options=default` tells it to ignore stored options. Reproducibility therefore depends on the same code, canvas, and options. To share exactly the same map, send a `.map` file (e.g. via `maplink`)
* `options` - set to `default` to allow generator to ignore options set by user. It's required for sharing the same map, see above
* `width`, `height` - legacy parameters; the current loader does not use them
* `scale` - map zoom level, where `0.5` is 50% zoom, `1` is 100%, `2` is 200% and so on. If a focus parameter is present without `scale`, the loader uses `8`.
* `x`, `y` - point coordinates that should be focused. Try [`https://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&options=default&scale=8&x=768&y=361`](https://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&options=default&scale=8&x=768&y=361)
* `burg` - burg id or exact name to focus on. Try [`https://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&options=default&scale=8&burg=2`](https://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&options=default&scale=8&burg=2)
* `cell` - cell id to focus on. Try [`https://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&options=default&scale=8&cell=1000`](https://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&options=default&scale=8&cell=1000)

## Watabou's Medieval Fantasy City Generator parameters:
This parameters are used by MFCG and not intended to be set manually. 
* `from`- if equals to `MFCG`, generator will consider the URL as coming from MFCG
* `size` - MFCG city size, equals to population point in FMG 
* `coast` - `1` if city is on a coastline
* `port` - `1` if city is a port
* `river` - `1` if city is on a river
