_The tutorial describes the current UI; exact labels and screenshots may change._

![loading_screen](https://github.com/user-attachments/assets/154617dd-a690-4da5-a36c-187cd51a5c04)

Also watch the [video tutorial](https://www.youtube.com/playlist?list=PLtgiuDC8iVR2gIG8zMTRn7T_L0arl9h1C).

## Introduction
_Fantasy Map Generator_ is a tool that creates highly customizable fantasy worlds for you. It runs in a browser and does not require any software installation. It’s free and you can use created maps for any purposes including commercial.

The tool generates a new fantasy map on opening. The map is auto-generated, but it doesn’t mean that you cannot control the generation. To open the controls click on the arrow button at the top left corner of the screen or press <kbd>Tab</kbd>. You can either change the generation parameters and generate a new map, or edit the current map. You can also create a new map from scratch using paint brushes.

## Moving around
The map is generated fully zoomed out. Double click on the map to zoom into the clicked area. Double click again to zoom in even more. The maximum zoom level is 20x, but it can be increased in the options. To zoom out hold <kbd>Shift</kbd> and double click. Click and drag to move around the enlarged area.

The same operations can be performed using keyboard. Press <kbd>+</kbd> to zoom in, <kbd>-</kbd> to zoom out. Use <kbd>1</kbd>-<kbd>9</kbd> number keys to set an exact zoom level. Press <kbd>0</kbd> to reset zoom to default. Use arrows keys to move around.

## Map layers
By default the map shows the world’s political situation, but it’s not the only available preset. Open the first tab of the menu – _Layers_ – to change the preset. _Preset_ is a set of layers to be toggled on. The default presets are Political map, Cultural map, Religions map, Provinces map, Biomes map, Heightmap, Physical map, Places of interest, Goods map, Trade animation, Military map, Emblems and Pure landmass. You can either select one of the presets or use buttons below to display or hide a particular layer.

![menu](https://github.com/user-attachments/assets/70171c15-a44e-4460-9e33-4f4eed7f1b2a)

To make it simple each layer has a shortcut assigned. Hover the mouse over the layer button to see a tooltip showing what the button does and which key is assigned to it. Check out [the Hotkeys](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Hotkeys) wiki-page to get a full list of shortcuts. Click on the plus button next to the presets list to save the current layers as a custom preset. On Generator reload the map preset will be defaulted to the the previously selected one.

Some layers may not be visible if an upper (top) layer is toggled on. You can drag the layer button to change the layer's order.

## Styling and filters
There are cases when you may want to see several full map-covering layers simultaneously. The only way you can do it is to make the upper layer partially transparent. Open the _Style_ and choose the required layer from the _Select element_ drop-down list and change the opacity slider. Note that this may not work if clipping is enabled.

The same approach is used for styling all map elements. For example if you want to change the color of state borders, select _Borders_ element, then border group (type) and click on the color box to set a new color. Here you can also change border stroke width, its style and apply a visual filter. Different map elements have different styling controls. To restore the default style to all elements click on the counter-clockwise arrow next to the elements list.

![style_borders](https://github.com/user-attachments/assets/7e47b11a-259d-400f-bd83-a5a919bffc41)

The _Toggle global filters_ section below allows to apply a color filter to the whole map.

## Performance tips
Some users report performance issues on map dragging and zooming. These are number of tips that will allow you to avoid problems with performance.
* Toggle off layers you are not working on. Especially take care of the _Relief Icons_ layer – it’s the most resource-demanding one.
* If you have a wide screen, open the Generator in a separate browser window, make it _much_ smaller (about 900 x 560 pixels) and re-generate the map. Then zoom in to see the map in detail. It will reduce the rending area and drastically improve the performance.
* Generate maps with _Points number_ = 10K. Points (cells) number highly affects performance. 
* Toggle off map and element filters.
* Close all irrelevant browser tabs and applications.
* Use the top-edge browser. As for now the best performance is observed in _Chrome_. _Firefox_ is also pretty fast, but there are some minor UI issues specific to this browser. Other browsers may not be supported.

## Saving the map
If you like the current map you probably want to **Save** it for a later use. There are 3 saving options:

* _Save to machine_. Download `.map` file that stores all the map data including your manual changes to your machine. The file then can be directly loaded into the Generator. It's highly recommend to save the map you are working on at least every 30 minutes.

* _Save to dropbox_. Log into your Dropbox account and save the `.map` file there.

* _Save to browser_. Save the `.map` file to the browser storage. Then it can be loaded as a fully-functional map. Press <kbd>F6</kbd> for a quick save and <kbd>F9</kbd> for a quick load. Please use it only for a quick safe, browser storage can be purged from time to time and you can lose your progress. Always keep `.map` file saved on your machine.

The only reliable method is to have a `.map` file saved on your machine, preferably with multiple copies on Cloud or other machines in case of your machine collapse. FMG doesn't store any of your data and cannot restore the map if you lost the file!

![save_options](https://github.com/user-attachments/assets/b04fb365-7169-4179-88f2-98c292a7f58d)

There are also a few ways how you can get the map _image_ or map _data_. Click on **Export** and use one of the options there. Please note that image (png, svg, or jpeg) is not a fully-functional `.map` file and cannot be loaded back to the tool. Consider it as a screenshot.

## Generation and UI settings
Let’s move to the settings overview. Open the Menu and click on the _Options_ tab. There are multiple options split into 2 categories. Map generation options require a new map to be applied. Generator settings are getting applied immediately on change.

![options](https://github.com/user-attachments/assets/65fefee6-cdc7-439f-83e2-374c21f9a455)

* _Canvas size_: the size of the map in pixels. There is no way to change the map size after the map generation and it's always advised to use the default value. The button on the left resets the size back to the default.
* _Map seed_: a number defining random values generation. If options and map size are the same, two maps generated with the same seed will be exactly the same. The seed cannot store user’s changes, so please don’t use it as a save function. The small button on the left allows to browse through generated seeds and restore previous maps if map options where not locked.
* _Points number_: the number of generated points and cells. The more points are generated, the more detailed the map. Points number highly affects performance, so 10K is the recommended value.
* _Map name_: the name of the map or the world. Click on button with arrows to re-generate the name.
* _Year and era_: current year of the world and the era name. Used for some text generation.
* _Heightmap_: template to be applied on heightmap generation. Basically a type of the landmass: high island, continents, archipelago etc. You can create your own template or change the existing in the _Template Editor_ (part of the _Heightmap Editor_ tools).
* _Cultures number_: the number of cultures to be generated. Cultures can be edited via the _Cultures Editor_.
* _Cultures set_: a set of cultures to be used for map generation. Can be a list of real-world-like or fantasy cultures.
* _States number_: the number of countries (_states_) to be generated. States can be edited via the _States Editor_.
* _Provinces ratio_: the percentage of burgs that will have their own province. Provinces are sub-units of states and can be edited via the _Provinces Editor_.
* _Size variety_:  defines how much states area should be different. The lower value, the more uniform state areas are.
* _Growth rate_: defines how far states and cultures will expand into neutral lands on generation. The lower value you have, the more lands will stay politically neutral.
* _Burgs number_: the number of burgs (settlements) to be generated. If there is not enough suitable space for the requested number, the Generator will place fewer. Set it to `auto` to let the Generator decide.
* _Religions number_: the number of religions to be generated. Controls only the number of organized religions and cults. Religions can be edited via the _Religions Editor_.

Generator settings:
* _Interface size_: size of the control panes. If the GUI size is too small, please also check out browser's zoom level (<kbd>Ctrl +</kbd>, <kbd>Ctrl -</kbd>).
* _Tooltip size_: size of the tooltips displayed at the bottom of the screen.
* _Theme color_: main color of the control panes.
* _Transparency_: opacity of the control panes.
* _Autosave interval_: number of minutes the map should be auto-saved to browser memory. Set to `0` to disable the autosave.
* _Onload behavior_: define what should be done when Generator is opened: a new map generated or a previously saved map auto-opened.
* _Azgaar assistant_: show or hide the in-app chat assistant.
* _Speaker voice_: select the voice used to speak burg and other names. Voice synthesis is provided by the browser.
* _Emblem shape_: defines shield shape used during emblems generation.
* _Zoom extent_: minimal and maximal zoom levels. Click on the button on the right to restore the default values.
* _Rendering_: set map rendering quality. Best quality can reduce the map performance.
* _Language_: load Google Translate and select a language to translate the interface. Automatic translation can break some functionality — use the reset icon or refresh the page if it does.

There is also the _Restore default options_ button. It cancels all user changes and refreshes the page.

## Climate configuration
Click on _Configure World_ to set up map position on a globe and climate. Toggle biomes, precipitation or temperature layers on to see how configuration changes affect the map.

![configure_world](https://github.com/user-attachments/assets/f36932b0-db18-4633-ad5b-0fe475afc44e)

The Globe on the right shows relative position of the map as a brighter area. The map position is calculated based on two inputs: _Map size_ and _Latitudes_. The North is always on the top, the West is on the left and so on. Map size defines a relative size of the map to the whole world. With 100% size the generated map will cover all the world; with 50% - half of the world and so on. If the size is not 100%, the map can be shifted towards North or South. The shift is controlled by the _Latitudes_ input. With Latitudes equal to 0 the map North edge will be at the North pole, with 100 - South edge will be on the South pole, with 50 - the world equator will lie through the center of the map.

The map latitudes affects the temperature gradient and winds applied to the map. You can change the temperature on Equator and Poles and it will be re-calculated based on map position on a globe. To change winds use the arrows on the right. Please note that wind is also latitude-dependent.

The _precipitation_ value defines how much vapor clouds can bring and spread across the map. The bigger the precipitation value, the greater number of rivers and fewer deserts you get. With zero precipitation the entire world will be an unlivable desert.

## Heightmap editing
If you don’t like the heightmap generated automatically, you may edit it or even create a new one from the scratch. Open the _Tools_ tab in the menu and click on _Heightmap_. Now you need to select an edit mode. All secondary data (rivers, burgs, states, markers and so on) depend on the heightmap, so changing the height manually will break the default generation logic. The best practice here is to use the _Erase_ mode, create the heightmap you want and let the system to re-generate the secondary data. It will remove all the changes made for burgs rivers and so on, but it will guarantee the smooth generation.

![edit_heightmap](https://github.com/user-attachments/assets/4f1f890a-31ab-4c5d-a4b1-38824ee2f4c0)

If you want to perform just a minor change, select the _Keep_ mode. You won’t be able to change the coastline, but all the data, including manually placed relief icons and rivers, will be kept as it is. So it’s more like a visual change without changing the underlying data.

If you have done some changes and still need to amend the coastline, you may use the _Risk_ mode. As the title says, it’s not safe and can cause some issues. So please use this mode only if you really need to.

Heightmap editing process has multiple build-in tools. These tools won’t be covered in this tutorial, just note that they allow you to use brushes to "paint" the map, to edit and apply heightmap template and to convert any image into a heightmap.

![paint_brushes](https://github.com/user-attachments/assets/dab037a3-797e-447a-ab96-6c99af1342d9)

## Customization tools
The Heightmap Editor tools are not the only ones available. The _Tools_ tab is split into five sections:

* **Edit** — the editors and overviews: Biomes, Burgs, Cultures, Diplomacy, Emblems, Goods, Heightmap, Markers, Markets, Measurers, Labels, Military, Namesbase, Notes, Provinces, Religions, Rivers, Routes, States, Trade animation, Units and Zones. Most of them have a keyboard shortcut shown in the tooltip.
* **Regenerate** — re-runs a single generation step. If, for example, you have added and moved some burgs, they will not be connected by routes anymore; regenerating routes reconnects them. You can also regenerate cultures, emblems, goods, ice, state labels, markers, markets, military, population, production, provinces, relief icons, religions, rivers, states and zones.
* **Add** — click a tool and then click on the map to place a feature, burg, label, marker, river or route. Hold <kbd>Shift</kbd> and click multiple times to add several objects.
* **Show** — the Cells details view, the Data charts and the Minimap.
* **Create** — the Submap and Transform tools, which rebuild the map from a fragment of the current one or reproject it.

## Editing map elements (labels, rivers, roads etc.)
Individual map elements such as rivers, routes, relief icons, labels, markers, burgs and labels can be edited on mouse click. The editor screen that is opened is different for each element and it’s also out of this tutorial's coverage.
 
![label_editor](https://github.com/user-attachments/assets/37e706d1-7674-4c81-abc4-0be166c85d5b)

## Points of contact
That was a brief overview of the main Generator elements and approaches. It’s not full by any meaning and just serves as a starting point. You can always find more details and help on our supportive [Discord server]( https://discordapp.com/invite/X7E84HU) and [Reddit community]( https://www.reddit.com/r/FantasyMapGenerator).
