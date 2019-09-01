# GIS Support

There is simple GIS support in this release, allowing the export to tools like Quantum GIS (https://qgis.org).


## Burg Data

This version exports position information (longitude, latitude and height) for burgs. These can be imported into QGIS by choosing Layer -> Add Layer... -> Add Delimited Text Layer...

Choose the exported .csv file. It should all be set up correctly automatically, so just check that x and y are correctly set to the longitude and latitude fields.


## Cell Data

In the Save... menu is a new option ".json" to save the cell data into a GeoJSON file. These can be imported into QGIS by choosing Layer -> Add Layer... -> Add Vector Layer...

Choose the saved .geojson file. It should be set up correctly as well, but doesn't show much. For the biomes, a prepared style can be found in the QGIS subdirectory here. Load it for the new layer you just created and the biomes should show up.

There is additional cell information such as population, height (for a heightmap), but also states, provinces, culture, etc. exported, all of which can be used in QGIS to render this information


## Rivers, Roads, Borders etc.

Not yet supported, planned.



## Questions, etc.

Make a pull request:

https://github.com/tvogt/Fantasy-Map-Generator
