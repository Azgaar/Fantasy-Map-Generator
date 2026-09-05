Welcome to the ***Fantasy Map Generator*** wiki!

_These pages are maintained in [docs/wiki](https://github.com/Azgaar/Fantasy-Map-Generator/tree/master/docs/wiki) in the main repository and mirrored here automatically — please open a pull request instead of editing the wiki directly._

## Introduction 
_**Fantasy Map Generator**_ (FMG) is a free tool that [procedurally generates](https://en.wikipedia.org/wiki/Procedural_generation) highly customizable fantasy maps. You can use auto-generated maps or create your own world from scratch. 

The project is under active development. Join our [Discord server](https://discordapp.com/invite/X7E84HU) and [Reddit forum](https://www.reddit.com/r/FantasyMapGenerator) for the latest updates and to get help from the community.

[Q&A](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Q&A) |
[Quick Start Tutorial](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Quick-Start-Tutorial) |
[Current Generator version](https://azgaar.github.io/Fantasy-Map-Generator/) |
[Changelog](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog) |
[Blog](https://azgaar.wordpress.com/) |
[Development board](https://trello.com/b/7x832DG4/fantasy-map-generator)

## Wiki pages

**Getting started**
[Quick Start Tutorial](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Quick-Start-Tutorial) ·
[User Interface](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/User-Interface) ·
[Hotkeys](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Hotkeys) ·
[Q&A](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Q&A)

**Terrain**
[Heightmap customization](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Heightmap-customization) ·
[Heightmap template editor](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Heightmap-template-editor) ·
[Heightmap image overlay](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Heightmap-image-overlay) ·
[River Editor](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/River-Editor)

**World building**
[Culture sets](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Culture-sets) ·
[Culture types](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Culture-types) ·
[Markers](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Markers) ·
[Journeys](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Journeys) ·
[Goods spread functions](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Goods-spread-functions) ·
[Military Forces](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Military-Forces) ·
[Battle Simulator](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Battle-Simulator) ·
[Scale and distance](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Scale-and-distance)

**Running and integrating**
[Run FMG locally](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Run-FMG-locally) ·
[Install with Nix](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Install-with-Nix) ·
[Working offline](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Working-offline) ·
[URL parameters](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/URL-parameters) ·
[GIS data export](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/GIS-data-export) ·
[Ollama text generation](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Ollama-text-generation) ·
[Dependencies](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Dependencies) ·
[Policy](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Policy)

## How can I use the tool? 

* *Exploration* - click on the _New map!_ button to get a random map. Open the _Layers_ tab (press <kbd>Tab</kbd>) and select a desired layers preset. Zoom in and explore the generated world

* *Tuning* - go to _Options_, change the default settings like map template and states number and generate a new map to better fit your needs

* *Customization* - open the _Tools_ tab, select one of the available editors and change the map in any desired way

* *Controlled generation* - open the _Tools_ tab, then click on _Heightmap_ and select an _Erase_ mode. Click on _Template editor_ and create your own heightmap template. Apply the template to see the result. Don't forget to share good templates with the community

* *Conversion* - if you already have a map image and want to re-create it in a generator, open the _Image converter_ (the button next to _Template editor_), load the image and fine-tune the conversion into a heightmap. Then edit the map using the _Tools_ provided

* *Drawing* - use the _Paint brushes_ to draw a map from scratch. It may takes a lot of time, so I would recommend you to follow the _Controlled generation_ approach to get a basic landmass and then use _Paint brushes_ for a fine-tuning