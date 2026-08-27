Part of the [FMG Q&A](Q&A). Related topics are listed there.

## Exporting

### Can I export a created map?
Yes, several ways:
* Export .png: the currently displayed map fragment as a raster image.
* Export .svg: the full map as a scalable vector image, editable in vector graphics editors.
* Export to tiles as .zip: the map split into .png chunks — combine them for giant raster images.
* Export to .json: map data for GIS software, see [GIS data export](GIS-data-export).

Table-based editors (states, burgs, cultures...) can also export their data as .csv.

### How can I export the heightmap as an image?
Set the Layers preset to Heightmap and the style to Monochrome, then export as PNG. Native heightmap resolution is low, so add fine detail in external software if needed.

### How do I get an FMG map into Roblox Studio or a similar engine?
FMG and game engines are not directly compatible. Export a heightmap image (Monochrome style, PNG) and import it into the engine's terrain tool.

### Can I embed the map into my website?
Yes, and it's easy — follow [the guide](https://sites.google.com/view/fantasy-map-generator-embedded/home).
