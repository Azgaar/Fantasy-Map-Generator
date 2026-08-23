Here is a list of parameters you can add to URL in order to set generator options and control its behavior on load. It can be used to share exactly the same generated map without need to send the file, or even to show exact place on that map.

## Azgaar's Fantasy Map Generator parameters:
* `maplink` - open .map file from the provided URL, use like [`https://azgaar.github.io/Fantasy-Map-Generator/?maplink=https://dl.dropboxusercontent.com/s/xgs3y1awlokio7x/Atlas%20046.map`](https://azgaar.github.io/Fantasy-Map-Generator/?maplink=https://dl.dropboxusercontent.com/s/xgs3y1awlokio7x/Atlas%20046.map). Due to browser security restrictions, it works only for servers that allow CORS (e.g. DropBox, but not Google Drive)
* `seed` - map seed, actual map generation depends not only on seed, but also on options and map size. So to share the same map via a link you need to use it like [`http://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&width=1536&height=722&options=default`](http://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&width=1536&height=722&options=default). It will work only if codebase is the same, so till the next generator update. To share exactly the same map you have to send a .map file (e.g. via `maplink`)
* `options` - set to `default` to allow generator to ignore options set by user. It's required for sharing the same map, see above
* `width`, `height` - map canvas size in pixels
* `scale` - map zoom level, where `0.5` is 50% zoom, `1` is 100%, `2` is 200% and so on
* `x`, `y` - point coordinates that should be focused. Obviously works only if `scale` is greater than 1. Try [`http://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&width=1536&height=722&options=default&scale=8&x=768&y=361`](http://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&width=1536&height=722&options=default&scale=8&x=768&y=361)
* `burg` - burg id or name to focus on, works only if `scale`  is greater than 1. Try [`http://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&width=1536&height=722&options=default&scale=8&burg=2`](http://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&width=1536&height=722&options=default&scale=8&burg=2)
* `cell` - cell if to focus on, Try [`http://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&width=1536&height=722&options=default&scale=8&cell=1000`](http://azgaar.github.io/Fantasy-Map-Generator/?seed=123456789&width=1536&height=722&options=default&scale=8&cell=1000)

## Watabou's Medieval Fantasy City Generator parameters:
This parameters are used by MFCG and not intended to be set manually. 
* `from`- if equals to `MFCG`, generator will consider the URL as coming from MFCG
* `size` - MFCG city size, equals to population point in FMG 
* `coast` - `1` if city is on a coastline
* `port` - `1` if city is a port
* `river` - `1` if city is on a river