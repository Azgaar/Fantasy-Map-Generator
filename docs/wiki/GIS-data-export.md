# What is GIS?
A geographic information system (GIS) is a framework for gathering, managing, and analyzing data. Rooted in the science of geography, GIS integrates many types of data. It analyzes spatial location and organizes layers of information into visualizations using maps and 3D scenes.

# Why GIS with a Fantasy Map?
GIS tools are custom-built to handle maps, with large data sets, integrate with other tools such as databases and create interactive maps such as Google Maps.

Being able to import a fantasy map into a GIS system puts all the power of those systems into your hands. Among other things, a GIS map can have many more layers, for example to have a view of the world at different times in history. It can link to a database to bring in as much information about the world as you have. It can also dynamically update itself from that database. For example, online game [Might & Fealty](http://mightandfealty.com) allows to build roads, and roads can deteriorate over time. These roads and their condition are part of the game map.

Also, at this time, it is the only way to zoom from world map to street view without going to a different tool.

What GIS does not do is creating a map, it's made to deal with the real world, it doesn't generate random maps or invent cultures and religions. This is where Fantasy Map Generator comes in order to merge generated data with whatever other data you have in your game and to create an interactive read-only map view.

Here is a fantasy world made with the Fantasy Map Generator and exported to GIS tools: https://lemuria.org/dragoneye/atlas/Auseka


# Quantum GIS
QGIS is a free multi-platform tool for GIS work. It can load, edit and print maps in high quality as well as export the results for interactive online maps. In essence, if you ever thought that having Google Maps for your fantasy world would be incredible cool, this is how you do it.

Download and installation instructions can be found [here](https://qgis.org). There are also many videos and online instructions on QGIS:

* https://freegistutorial.com/qgis-tutorial-beginners/
* https://www.qgistutorials.com/en/
* https://www.youtube.com/watch?v=kCnNWyl9qSE
* https://www.youtube.com/watch?v=ltsKFhYQy_4
* https://www.youtube.com/watch?v=kCnNWyl9qSE

You are not, of course, limited to only QGIS. Data exported can also be used in other GIS tools, such as [GRASS](https://grass.osgeo.org/), [ArcGIS](https://www.arcgis.com) and others.

# Loading into QGIS
Fantasy Map Generator allows you to export some data in a GIS-compatible format. Open the _Export_ dialog from the _Tools_ tab; its _Export to GeoJSON_ section has buttons for **cells**, **routes**, **rivers**, **markers** and **zones**. The separate _Export to JSON_ section (full, minimal, pack cells, grid cells) is plain JSON, not GeoJSON, and is not meant for GIS tools.

Coordinates in the GeoJSON files are geographic (longitude / latitude) and follow the map coordinates set in _Options → Configure world_.

## Cell Data
The cells file is a polygon layer with one feature per cell. Each feature carries these properties: `id`, `height`, `biome`, `type` (feature type, e.g. island or lake), `population`, `state`, `province`, `culture`, `religion` and `neighbors`. Import it into QGIS by choosing _Layer_ -> _Add Layer..._ -> _Add Vector Layer..._.

![Steps](https://azgaar.files.wordpress.com/2019/09/add_vectorlayer.png)

Choose the saved .geojson file. It should be set up correctly as well, but doesn't show much. For the biomes, a prepared style can be found [here](https://raw.githubusercontent.com/evolvedexperiment/FMGImages/master/styles/Style_Biomes.qml). Load it for the new layer you just created and the biomes should show up (click on the properties of the initial "cells" layer and then in the symbology tab of the options, you click style then load.)

![Steps](https://azgaar.files.wordpress.com/2019/09/add_vectorlayer2.png)

All of the properties listed above can be used in QGIS to render thematic maps — population density, elevation, political, cultural or religious maps.

Unfortunately, there are sometimes gaps or overlaps in the cell export data. You can find them in QGIS with _Vector -> Geometry Tools... -> Check Validity_. They are easy to fix by hand, if you need to (only needed if you want to do further processing with the data).


## Burg Data
Burg data can be downloaded as a _.csv_ file from the _Burgs Overview_. The downloaded file contains the burg id, name, province, state, culture, religion, group, population, map coordinates, latitude, longitude, elevation, temperature, the capital / port / citadel / walls / plaza / temple / shanty town flags, the emblem and a preview link. These can be imported into QGIS by choosing _Layer_ -> _Add Layer..._ -> _Add Delimited Text Layer..._

![Steps](https://azgaar.files.wordpress.com/2019/09/add_csv.png)

Choose the exported .csv file. It should all be set up correctly automatically, so just check that x and y are correctly set to the longitude and latitude fields.

![Steps](https://azgaar.files.wordpress.com/2019/09/add_csv2.png)

## Marker Data
Points of interest (markers) also carry location information. They can be exported as GeoJSON from the _Export_ dialog, or as a _.csv_ file from the _Markers Overview_ (id, type, icon, name, note, state, culture, coordinates, latitude and longitude) and imported the same way as burg data.


# Processing in QGIS
To create a political/religious/provinces/culture/etc. map use _Vector_ -> _Geoprocessing Tools_ -> _Dissolve..._ and select the .geojson file as input and the attribute you want to merge by (e.g. "state"). QGIS will merge all the polygons that share the same attribute so that you end up with one multipolygon per state/culture/religion/etc.

![Steps](https://azgaar.files.wordpress.com/2019/09/merge-by-attribute.png)

![Steps](https://azgaar.files.wordpress.com/2019/09/dissolve.png)

Note that QGIs automatically turns a polygon layer into a multipolygon layer for this.

Simply repeat this step for all the layers that you want to use (once for states, once for provinces, etc.). This will give you one layer in QGIS per attribute, and you can then style and hide/show the layers as needed.

# Editing in QGIS

When working with cells, you need to make sure that neighbor cells are changed as well, to prevent overlaps or gaps. QGIS supports [topological editing](https://gis.stackexchange.com/questions/302965/how-can-i-enable-topological-editing-in-qgis-3).

# Rendering

To get that painted look, you want to use textures to fill, especially for biome data. Simply set up the symbology to use a Raster Fill Image, pick your texture and make sure to set the Coord mode to "Viewport":

![steps](https://azgaar.files.wordpress.com/2019/09/symbology.png)

![steps](https://azgaar.files.wordpress.com/2019/09/texturing.png)

# See also
* [How to create an interactive, detailed world atlas of your fantasy game world? Part One](https://www.youtube.com/watch?v=WIqd_WK2cvM)

* [How to create an interactive, detailed world atlas of your fantasy game world? Part Two](https://www.youtube.com/watch?v=C8mZKV9vVp4)

* [How to create an interactive, detailed world atlas of your fantasy game world? Part Three](https://www.youtube.com/watch?v=3Ut4hoiprC0)

* [A script to add random points](https://cdn.discordapp.com/attachments/587406457725779968/620223033205850133/add_random_points.php)
