# Knowledge Base

### How can I change the land?

Go to Tools -> Heightmap (read the options that appear) -> use the brushes that appear on the top right

### How do I make my map bigger?

Bigger like covering more distance. Go to Tools -> Units and increase the '1 map pixel' distance scale. Adding more land outside of the map is not possible in FMG, you have to export the image, edit it in an external editor and reimport it back to the FMG via the image importer (Tools -> Heightmap -> Erase -> Image Converter)

### How can I export heightmap image?

Go to Tools -> Heightmap, select any edit mode (Keep, Risk or Erase) and click on Preview. A small monochrome heightmap appears at the bottom left, click on it to download a screen-sized image. For a bigger image exit the customization, set Style preset to Monochrome, keep only the Heightmap layer visible and export the map as .png

### How can I get a higher resolution heightmap?

Native FMG heightmap resolution is very low, so you'll probably have to add details using external software. You can also try to export the map as an image with the Heightmap layer on

### Why I don't have burgs or states in an area?

Could be cause you don't have a culture over that area or that the biome on that area its not habitable, most commonly Glacier

### Where can I get a specific map like Earth or Europe? Or maybe a map of Tamriel or map of Westeros

For Earth-based maps go to Options -> Heightmap and click on the field to open the heightmap gallery, it contains dozens of precreated real-world heightmaps (Earth, Europe, Africa and so on). For other pre-generated maps go to https://cartographyassets.com/asset-category/specific-assets/azgaars-generator. If nothing is there, you can import your own heightmap using the image converter: Tools -> Heightmap -> Erase -> Image Converter

### How can I get an empty map to start with?

To get a blank map go Tools -> Heightmap -> Erase and use the brushes on the top right to delete all the land

### How can I show burg labels from afar?

Labels are shown and hidden based on zoom bounds defined per label group. Open Tools -> Labels and click on the groups configuration button. There you can check 'Show all labels' to ignore zoom bounds completely, or raise the max zoom value for a specific group

### How do I force state labels to show the full state name?

The name form is set per label group and no longer in Options, where it used to be the 'stateLabelsMode' setting. Open Tools -> Labels, click on the groups configuration button and set the state group's 'Mode' to 'full'. The default 'auto' uses the full name when it fits the state's area well enough and switches to the short name when it does not, while 'short' always uses the short name. Mode applies to state and province groups only

### How do I import an image? Can I put an image to create world based on it?

Yes, it can be done via the Image Converter. Go to Tools -> Heightmap -> Erase -> Image converter

### Why cant I make a border stop at the rivers?

This its because the border of states or provinces follow the border of the cells while the river flows through the centre of the cell (for making them pretty)

### Why is there no autosave?

There is an autosave. Go to Options -> Generator settings -> Autosave interval and set the interval in minutes (0 disables it). The map is saved to the browser storage, and browser storage can be cleared accidentally, so also save .map file backups to your machine from time to time

### Why is there no undo button?

There is no global undo for the whole map, but undo and redo (Ctrl + Z / Ctrl + Y) work in the editors that support it: Heightmap brushes and Template Editor, Paint brushes, Notes Editor, Routes Overview and Transform tool. It's still recommended to save the project as a .map file at least once every 30 minutes of work

### Can I increase the number of cells?

Not on an already generated map directly, but you can rebuild the map with a different points number using the Transform tool: Tools -> Create -> Transform. It recreates the map based on the existing one and tries to keep the details. The Submap tool does the same for a part of the map. Alternatively export the image, set a higher points number and import the image back as a heightmap

### Can I export map data as a text file?

Map data can be exported, but only a little of it can be imported back. Overview editors (Burgs, Rivers, Routes, Markers, States, Military and others) have a download button that saves their table as a .csv file, and the Export menu offers GeoJSON (cells, routes, rivers, markers, zones) and JSON (full, minimal, pack cells, grid cells). The text data you can upload back is burg names (.txt or .csv), namesbases, notes (legends) and heightmap templates

### Can I add new relief icons?

You can add and remove relief icons on the map with the Relief Editor: turn the Relief icons layer on and click on an icon, or use the bulk add and bulk remove brushes. You can also switch between the bundled icon sets. Uploading your own relief icon graphics is not supported

### How can I use rulers in a map?

Rulers are managed by the Measurers Editor: Tools -> Measurers (Shift + =). There you can place a linear ruler, an opisometer (curve length), a route opisometer (a curve that sticks to routes) and a planimeter (polygon area). Remove a single measurer from the list in the editor or use the trash button to remove them all

### Can I use the Coastline Editor (red dots that appear on the coast) to make changes to the land?

You should use the Heightmap tool to do 99.9% of the changes of the map, but you can later finesse the shape with this tool

### I have white bits on the map why they are?

You may have abused the coastline editor in which case regenerate the layer and do the changes of land with the Heightmap tool or you may have a way too complex shape for the generator

### Does time exists?

There is no a thing as time at the moment on the generator. The era and year thing in Options is just to define time messages on legends of military regiments, battles and similar things with a date on the notes

### I have made the menu too big. How to put it normal again?

Zoom out the browser (ctrl and the wheel) to 100%. Or set Interface size to 1 in Options

### How do I change state / culture / religion / province borders?

Go to tools and select the desired option. Click on the brush button on the bottom, click and drag to paint on the map, remember to confirm the changes when done

### How do I change habitability?

Habitability is determined by biomes. Go to Tools -> Biomes, here you can change biome habitability percentage

### Is there a way to place a marker for a dungeon yourself and have it generate a dungeon map for it?

You need to know the dungeon seed. Create a new marker, and edit the notes. Then click the Source code button on the top-left and enter something like this (change YOUR_SEED): <p><a href="https://watabou.github.io/one-page-dungeon/?seed=YOUR_SEED" target="_blank">Click here to go to the dungeon</a></p><p><iframe src="https://watabou.github.io/one-page-dungeon/?seed=YOUR_SEED"></iframe></p>

### How can I cover both ends of my map with ice? Top and bottom

Options -> Configure world -> Change the temperature of the poles. After that, Tools -> regenerate ice

### How can I make mountains taller?

Edit the heightmap in Erase or Risk mode. Alternatively go to the Tools -> Units editor, then the altitude subsection and change the exponent a bit

### What does each city feature icon mean?

Hover it over, you will see some tips at the bottom on the page

### How can I remove part of my map to expand my ocean?

Open Tools -> Heightmap. When you click on it, a popup asks whether to use Keep, Risk or Erase mode. Select Risk if you want to keep the other layers (states, burgs, etc.), Keep mode won't let you change the coastline at all. Sink the land with the brushes and finalize the edit. Burgs that end up on water are moved to the closest available land cell and ordinary burgs with no land nearby are removed, but capitals are always preserved, so deal with them (reassign the capital status or remove the state) before sinking their land

### What is burg? What is berg?

Burg is an internal name used for all settlements in the Fantasy Map Generator. It comes from German 'burg' meaning 'fortified settlement'

### I have issues with the Generator, what should I do?

Please try to reproduce the issue on your own. If it's reproducible, please log an issue on GitHub or Discord. A lot of issues are caused by browsers, please also try to use incognito mode and/or another browser. We recommend Chrome as the fastest browser in terms of svg rendering

### The map performance is poor, how can I improve it?

Toggle off unnecessary layers. Be mindful of the Relief Icons layer in particular – it’s the most resource-demanding one. Open the Generator in a separate browser window, make it much smaller (about 900 x 560 pixels) and re-generate the map. Then, zoom in to see the map in detail. It will reduce the rending area and drastically improve the performance. When generating maps, set Points number to 10K. Points (cells) number highly affects performance. Toggle off map and element filters. Close all irrelevant browser tabs and applications. Use a leading edge browser (fresh versions on Chrome or Edge). Firefox is reported to be slower. Set 'Redraw on zoom' in the Options tab to 'After zoom' to redraw labels, icons and relief once per gesture instead of on every frame

### Who owns the maps created?

You. The Generator is licensed under MIT license and derivative works such as maps are free of charge. You can sell them or make them available for free

### My saved map is not working properly. What should I do?

If there is no version conflict, please raise a defect on GitHub. Compatible maps from v0.70.0 onward are checked and auto-updated when loaded. Older maps are considered ancient and require the matching old version of the Generator, there is no way to update them. The tool is under development and version conflicts are inevitable

### Can I export a created map?

Sure, there are a number of available options. Save to machine: .map file that can be directly loaded back to the Generator. Save to Dropbox: the same file stored in your cloud. Save to storage: map data is saved to the browser's internal database and can be loaded on page refresh; bear in mind that saving to the machine is safer since browser storage can be accidentally cleared. Export .svg: save a full map as a scalable vector image, you can open the file in a browser or edit it in a vector graphics editor. Export .png or .jpeg: save the currently displayed map fragment as a raster image, up to 8x resolution. Export to tiles as .zip: split the map into .png chunks and save them as a single archive, it allows to save giant raster images once chunks are combined. Export to GeoJSON: save cells, routes, rivers, markers or zones to be used in GIS software. Export to JSON: save the raw map data (full, minimal, pack cells or grid cells) for your own tooling

### How can I open a saved .gz or .map file?

Open the generator, click on Load and select the file. Or just drag and drop the file onto the Generator window

### Can I manually edit save file?

`.map` files are plain text, so it's technically possible, but it's better not to do it as broken formatting makes the file unloadable. The common error is that most text editors automatically split the embedded svg into separate lines. `.gz` files are gzip-compressed and have to be decompressed first

### Can I use the Generator offline?

Yes, you can with some limitations. The easiest way is to install the PWA. Make sure you open the App when you have a connection so that all required files can be cached on your machine, after that the PWA should work offline. Another option is to run the tool locally from the source code, but it requires a build step now: install Node.js, then run `npm install` and `npm run dev`, see the Run FMG locally wiki page. Please note that assets loaded from external URLs, like alternative Fonts or Styles, are not available offline

### Is there a desktop version?

There is no separate desktop application, but the web app can be installed as a PWA and behaves like a desktop application. Chromium-based browsers (Chrome, Edge, etc.) offer an 'Install' button in the address bar, alternatively use Chrome menu -> Cast, save and share -> Install page as app. The installed tool is added to your desktop and can be opened like a normal app. Internet connection is required for the first run, after that it may work offline with some limitations

### Which browsers are supported?

The Generator targets modern browsers. Chromium-based browsers (Chrome, Edge, Opera, etc.) are the primary tested environment, the tool is developed in Chrome, so it has the best support. Firefox and other browsers work, but may be slower or differ in some features. Outdated browsers like Internet Explorer are not supported. If you find a reproducible problem in a specific browser, please report it

### Can I use the Generator on mobile?

You can, but I doubt you will enjoy the experience. The Generator GUI is not suitable for mobile devices and performance is subpar. In general, I would say mobile devices are not supported

### What about non-English localization?

Localization is planned, but not ready from the coding side. Preparation can take a lot of time as it's not a current priority. As for now, open Options and click on the 'Init Google Translate' button in the Language row, then select a language. It's machine translation and it can break some of the page functionality; use the reset icon or refresh the page to get back to English. There is also a community-made Chinese localization at https://www.8desk.top

### What does Azgaar mean?

It's a nickname of the Generator creator, it has no meaning. The full name of the tool is Azgaar's Fantasy Map generator. The short form is FMG

### How can I help to improve the Generator?

Just use it, log defects and suggest enhancements. Share the Generator link within your community! Post on FB, Twitter etc. We also accept donations on Patreon (https://www.patreon.com/azgaar)

### What is the team behind the project?

There is no team, but there is a Community. The tool is created by me, Azgaar. The community is based on our Reddit and Discord servers. Thanks for contributors, Community moderators and all our community members

### Do you accept donations? Can I donate?

Yes, you can support the project on Patreon. If you don't want to pay monthly, you are able to decline the donation at any moment in time. Other donation platforms are not supported

### Is there a place where I can discuss the Generator, share created maps and so on?

Yes, we have a dedicated Discord server and Reddit community. Both have a very active and supportive community

### Can I underline at the name of the capitals?

You cannot using the UI, but if you are comfortable with dev tools, you can amend the svg part directly. Open the console (F12) and run: `d3.select('#labels-capital').style('text-decoration', 'underline')`. Use another burg group name instead of `capital` if needed. The change may be lost when labels are re-rendered

### I have a height map but it doesn’t work in Roblox Studio. How do I get the map on Roblox?

Azgaar's Fantasy Map Generator (FMG) and Roblox Studio are two separate tools that aren't compatible with each other. FMG heightmaps are just an array of values, but you can also set Layer preset to Heightmap and Style to Monochrome in FMG and then export an image in png format. This format should be possible to use in Roblox Studio

### Is there any way for me to take a small snippet of a map and make that a new map?

Yes, you can use Submap tool for that. Submap is a tool that generates a new map out of a part of the current one. Menu -> Tools -> Submap

### Is there a way to generate heightmap based on current one? Basically I want to keep roughly same shape of continents but regenerate details \ add more islands

You can use the Submap tool (for a part of the map) or the Transform tool (for the whole map). Both recreate the map based on the current one and try to keep the shape, but details are regenerated. Both are available in Tools -> Create

### Can I create a ruler or a leader of the state?

Rulers and dynasties are not supported as data. As a workaround describe the ruler in the state's notes (legend); the Notes Editor can also generate the text with AI if you provide your own API key or run a local Ollama model

### How to make my map larger in terms of miles?

To make your map cover more distance, go to Tools -> Units and increase the '1 map pixel' distance scale value

### How do you encourage countries to grow land territory first before expanding across the sea?

Open the States Editor and set the state type to Nomadic: nomads have a huge sea and lake crossing penalty. Then open the regeneration menu (cog button) in the same editor and click on 'Recalculate states'. The type is inherited from the state's culture on generation, so you may want to change the culture type in the Cultures Editor as well

### What is Azgaar's Fantasy Map Generator?

Fantasy Map Generator (FMG) is a free tool that procedurally generates highly customizable fantasy maps. You can use auto-generated maps or create your own world from scratch

### How can I use the application / website?

You can create and customize your map. Here're the ways you can use the tool: 1. Exploration - click on the "New map!" button to get a random map. Open the "Layers" tab (press Tab) and select a desired layers preset. Zoom in and explore the generated world. 2. Tuning - go to "Options", change the default settings like map template and states number and generate a new map to better fit your needs. 3. Customization - open the "Tools" tab, select one of the available editors and change the map in any desired way. 4. Controlled generation - open the "Tools" tab, then click on Heightmap and select an Erase mode. Click on Template editor and create your own heightmap template. Apply the template to see the result. 5. Conversion - if you already have a map image and want to re-create it in a generator, open the Image converter (the button next to Template editor), load the image and fine-tune the conversion into a heightmap. Then edit the map using the provided tools. 6. Drawing - use the Paint brushes to draw a map from scratch. It may takes a lot of time, so I would recommend you to follow the Controlled generation approach to get a basic landmass and then use Paint brushes for a fine-tuning

### I'm new to the tool, is there a video tutorial?

Yes, the video tutorial is available. Here is the YouTube link: https://www.youtube.com/playlist?list=PLtgiuDC8iVR2gIG8zMTRn7T_L0arl9h1C

### I'm new to the tool, is there a tutorial?

You can ask questions here or go to our Discord server. If you want a basic guide, check out the Quick Start Tutorial: https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Quick-Start-Tutorial

### Is there a Reddit community?

We have a Reddit community on https://www.reddit.com/r/FantasyMapGenerator

### Can I create a battle between armies?

You can use Battle Simulator. It allows to simulate battles between two or more regiments. It works based on units power parameter that can be set in the Military units editor. To start a battle select a regiment, click on the Attack foreign regiment button and then click on another regiment to attack it. You cannot attack regiments of the same state as the selected regiment or regiments without any forces. It does not matter where attacked regiment is located and whether it's reachable or not - attacker regiment will be moved straight to the selected one

### How can I upload a new icon for cities?

Custom icons for burgs are not supported. You can set a custom image (an image URL or a data URI) as an icon for Markers and for Military regiments via the Select Icon dialog

### How can I create a new country?

To create a new country open the States editor: Go to "Tools" -> "States". Look for a button to add a new state at the bottom of State Editor. Click on it and then click on a map to place a new state there. You can adjust the borders of your country using the States editor brush tool

### How can I invade one country to another?

You could represent an invasion or conquest manually by following these steps: Go to Tools -> States. Use the brush tool to "paint" the territory of the invading country over the invaded country's land. This would effectively expand the borders of the invading nation. You might need to adjust other elements like cultures, religions, or burgs to reflect the changes caused by the invasion. You could use the Markers tool (Tools -> Markers) to add custom markers representing battles or significant events of the invasion

### I would like to use my own list of names for States, Provinces, and Burgs. How can I do it?

You can create your own namebases in the corresponding tool, and select them when you place custom cultures and states

### Is it possible to use the map generator to create a fantasy map based on an actual city map?

The map maker works better for country-sized regions. It doesn't have city blocks, buildings or anything for city-sized mapping.

### Is there a way to make culture sets with custom namebases?

Culture sets themselves are hardcoded and cannot be extended. You can create custom namesbases in Tools -> Namesbase and assign them to individual cultures in the Cultures Editor

### Is there a way to use custom namebases for generating worlds?

You can use custom namesbases: create them one by one in Tools -> Namesbase and then set the namesbase per culture in the Cultures Editor; states and burgs use the namesbase of their culture

### Can I share my map with my players so that its still interactive?

There's no 'View Only' mode, but you can share your .map file with them and they can open it in Azgaar's FMG. They'll be able to edit it, so keep a copy for yourself. You can also embed the map into a web page, see the guide: https://sites.google.com/view/fantasy-map-generator-embedded/home

### What are the culture types?

Each culture gets a type assigned on generation. The type defines how the culture will grow and what territories it will get, but also serves world-building needs. Nomadic cultures are generated in hot desert, cold desert or grassland cells with height less than 70 points. Highland cultures are generated in cells where height is over 50 points. Lake cultures are generated in cells around lakes that are over 5 cells in size. Naval cultures have a chance of being generated in coastal cells; the chance is slightly higher if the cell is next to an ocean (as opposed to a lake), and significantly higher if the cell is on an island. River cultures are generated in cells with a river of over 100 flux points. Hunting cultures are generated in cells that are more than two cells away from a coast where the biome is Savanna, Tropical rainforest, Temperate rainforest, Taiga, Tundra or Wetland. A culture is set to be generic when its spawn location is ineligible for any other culture type, or, in the case of the Naval type, failed a random probability check. Culture spread is a competitive system, where each culture tries to get more cells considering the cost of it. Culture type is crucial in defining cell 'cost' and the way the culture will spread

### Is there a way to generate a map from an image? How can I convert image into a map?

Yes, there is a way to generate a map from an image using the Image Converter. The image should ideally be a heightmap, where lighter areas represent higher elevations and darker areas represent lower elevations. Go to Tools -> Heightmap. Click on Erase. Look for the "Image Converter" option. Once clicked, you'll be prompted to select an image file from your computer. After importing, you may have options to adjust how the image is interpreted: for each color of image you need to assign a height value. It can be done automatically via the converter tool, but ofter requires manual fine-tuning. Once you're satisfied with the settings, confirm the conversion. The generator will create a new map based on your imported image. After generation, you can use the regular FMG tools to adjust terrain, add features, etc.

### Is there a way to take a very basic heightmap and apply some template to it in order to achieve better feature placement than I can do by hand?

Not within the tool, I'm afraid. You can import heightmaps, but there's no function to generate more patterns onto it. You could, for example, generate a random map from which you like the features, export it as an image, then use some Photoshop-adjacent tool to mix it with your basic heightmap and then import that

### Am I able to up the culture limit?

You can manually add as many cultures as you want. Or change the Cultures set to Random, it'll let you move the slider up to 100

### How population is calculated?

Population depends mainly on by area / biome, but there are other factors as well: river or lake nearby, specific featurs like river estuary or if there is a safe sea harbor, cell elevation, burg status, etc.

### Is there a way that I can add a lake to a landmass without resetting all the rivers and stuff?

Not really. Lakes are derived from the heightmap, so a new lake requires a heightmap edit: Tools -> Heightmap -> Risk mode keeps most of the data, but rivers and lakes are recalculated on edit completion, so manual river edits will be lost

### I have issues with download. The button disappeared after I clicked it. Even though I didnt download the app

You can also install the tool using Chrome menu. Chome menu -> Cast, save and share -> Install page as app...

### Is there an app?

There is no native app, it's a browser tool, but you can install it as a PWA (Chrome and other Chromium browsers offer the Install button, or use Chrome menu -> Cast, save and share -> Install page as app). It runs in its own window and works offline once cached

### I want to move the point at which the ice caps start further away from the equator, but I don't want to change my biomes. Any ideas?

The Ice layer is generated from temperature with a fixed threshold, so the starting point cannot be moved without changing temperatures, which also affects biomes. What you can do is edit the ice manually: turn the Ice layer on and click on a glacier or iceberg to edit or remove it, and add new icebergs from the same editor

### How can I regenerate name of a particular state?

Go to Tools -> edit States. Click the State name, you'll see 2 buttons, a refresh icon and a book icon, click the book icon to re-roll the name using the namesbase of its culture: click the refresh icon if you just want a random name

### How to create landmass on an already generated map?

Open Heightmap editor in Erase or Risk mode and then add the new land using the Brushes

### Is there a way to add a new military unit type without removing my hand placed regiments?

Not without a recalculation. Unit types are edited in Tools -> Military -> Edit Military Units, and applying the changes recalculates forces and regenerates regiments for all states. You can add and edit individual regiments manually in the Regiments Overview, but the unit types list cannot be changed without regenerating the forces

### Is there any way I can, after making a map, select a specific state and only work on that state as a seperate map?

No, but you could visually fog the other states by pinning the State you want on the Sates Editor window, or make a submap that mostly encompasses the territory of the desired state (zoom in until your state is occupying most of the screen and then use the Submap tool)

### How to increase the map size?

Map size in pixels is irrelevant, the detail is assigned by the points number: the more points, the more detail. If you mean the size of the map in km or miles, go to Tools -> Units and increase the '1 map pixel' distance scale. To change the number of cells on an existing map use the Transform tool

### Is there any way to remove capitals for states?

Every state must have a capital, so it cannot be removed. You can only hide capitals visually: toggle off the whole Burg icons or Labels layer, or set the opacity of the capital group to 0 in the Style menu

### Is there any way to get the system to automatically number the hexes on the map? I have a grid layer, set to 16 mile hexes on my map. Is there a way to count how many hexes are in the grid, or a way to set the system to automatically number each hex?

No, grid overlay is just visual

### I'm trying to find a way of making the fog of war's edges a little more blurry, is there a way?

No, fog edges cannot be made blurry

### Is there a way to change the dimensions of the map?

Go to Tools -> Units and change the '1 map pixel' distance scale. To change how much of the world the map covers, use Map size in Options -> Configure World

### How to merge provinces?

Open the Provinces Editor and click the 'Annex provinces' button (crown icon) at the dialog bottom. Click the province that absorbs the others on the map, then click the provinces to annex; hold Shift to keep annexing several. A confirmation lists what will be merged, so a mis-click can be cancelled. To pick from a list instead, filter by the state the provinces belong to and use the 'Merge several provinces into one' button. Provinces of different states cannot be merged, reassign them in the States Editor first. Alternatively remove a province and repaint its territory to another one with the Paint brush

### Can you colour in the relief icons?

You cannot change the colors of individual icons, but you can make them semi-transparent and color what is below. There are also three icon sets to choose from - Simple, Colored and Gray - select the set in Style -> Relief Icons or in the Relief Editor

### My landmass color turned transparent (so it shows the ocean) and i don't know how can i do it back

Edit the heightmap in Risk mode, change some land cells, it should help. Probably your coastline is too complex, the algorithm cannot handle it

### How do I make it so whenever I generate a state I get names from a specific language? I wanted to create states with portuguese sounding names

You need to change the namesbase of the culture where you're spawning states and regenerate burg names for this culture. Tools -> edit Cultures

### Hi, where is the right place to suggest new features?

Suggest new featured on our Discord server on #fmg-suggestions channel

### Can I speak with a real human?

You can speak with meatbags on Discord

### Who are you?

I'm just an AI bot who can help you with the tool

### Can I create a lake?

To create a lake go to Tools -> Heightmap -> Risk or Erase and then depress the rigion to be below the sea level. Then complete the edit and it will create a lake there. There is no other way to do it

### How do I set up the map maker in offline mode / not using a web browser, but its own app?

Install the tool as a PWA: use the Install button offered by Chromium-based browsers, or Chrome menu -> Cast, save and share -> Install page as app. It's the same web app running in its own window, there is no Electron-based desktop build. Open it once online so the files get cached, then it works offline with some limitations

### Is there a licensing agreement for things generated by the tool?

The tool and created maps are availalbe for free under the MIT license, see the details https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/LICENSE

### Is there a way to covert a state into a province of another state?

Using States Editor you can paint with the color of other state in that region. Alternatively in Provinces Editor you can make the province independent and then merge that state into another one in States Editor

### How to change borders?

State borders can be changed using Tools => States Editor. You can paint with a brush with the state that wins that terrain

### Is there any way to import an image so it can generate the terrain? I have a map made already.

There's an Image Converter on the Heightmap Editor, but the tool cannot generate random terrain on top of an imported map.

### Is there any way to generate a map without any cultures or population? I like to work on those by hand

You can set States number to 0 in Options and regenerate. Cultures number cannot be set below 1, but you can remove cultures one by one in the Cultures Editor (and burgs in the Burgs Overview) after generation. Population is calculated from cells and burgs, so removing burgs and states leaves you with neutral lands to work on by hand

### How to make map to open in specific zoom and focus on specific area on load?

Follow the steps. 1. Save the map to storage. 2. Go to Options and set 'Onload behavior' to 'Open last saved map'. 3. Add URL parameters to make it look like this: https://azgaar.github.io/Fantasy-Map-Generator/?scale=4&x=800&y=200. 4. Change scale, x and y values as you need and use the link

### How the map is rendered? Is it on GPU or CPU?

The map is rendered in SVG by browser. SVG rendering in GPU-supported, but it's not optimized and hence you can observe lags when there are too many elements to render. The rendering depends on browser and can only be controlled by user with 'Rendering' option. We recommend to set it to 'Best performance' in case of significant lag

### If I've changed a setting, how do I generate a new map without changing the seed number?

Press enter when on the seed input in Options

### Is there a time progression/calendar system that you can advance or is it a static moment in time?

The map is static. Over-time simulation is planned, but not yet implemented

### When creating a new world, in which order do you add elements

Follow the order the generator itself uses. Heightmap and Configure World in Options first, let that determine the biomes, then Units (height scale), goods, cultures, states, Units again (population and distance scale), burgs and routes, religions, provinces, then the economy (markets, production and taxes), ice, military, and optionally zones and markers

### Is there a means to get the width of a river at a particular point along its length?

No, only the width at the river mouth is available. Click on the river to see its details, or open Tools -> Rivers to see length, discharge and mouth width for all rivers

### Where can I enable or disable the rendering of ocean cells?

Rendering of ocean cells can be set via the checkbox in Style -> Heightmap -> oceanHeights group

### Is temperature the averaged temperature across the entire year (all temps added, then divided by 365)? Or is it something else?

Temperature is annual average

### Is there any way that I can recreate a map if all I have is a screenshot?

Sadly, not in a two-click kind of process. You could use the image converter found in the Heightmap editor in Erase mode, if you have a screenshot of the heightmap you could auto-assign the heights, but if it's political, you'll need to assign a flat height to each and every color on the map to get the distinction between land and sea. Whichever of the two processes you follow, you'll still need to place all other layers manually (burgs, states, cultures, etc.) and adjust the heightmap to recreate rivers, lakes and biomes

### Is there a way to overlay an image over a map?

Yes. You can put it as Texture. Click on Style -> select element -> Texture. And next to the image dropdown there is a Plus icon. Provide the URL of the image and apply. Make sure the server where the image is hosted allow CORS requests. You can put any image there

### Is there anyway to show underwater towns/colonies/kingdoms?

Underwater towns and cultures are not supported. However some users suggested a workaround: style your ocean to look like land and land to look like an ocean. Then roleplay like that land is water from an ocean and the outside water has no population

### Is there a travelling time calculator or such built in?

There is no travel time calculator. You can measure distances with the Measurers Editor (Tools -> Measurers): the ruler, opisometer and route opisometer report length in your distance units. For markers there is also a 'Markers in Radius' tool that lists all markers within a given distance. You can set the current year and era name in Options, but time is not simulated

### In the Style editor, for Heightmap element, what does the Reduce layers slider do?

Reduce layers: the program has a lot of steps in height and it may look too crowdy. "Reduce layers" skips each x-th step in heightmap. So the higher the value is, the less steps is rendered

### In the Style editor, for Heightmap element, what does the Simplify line slider do?

Simplify line defines line simplification level. Heightmap isoline consists of multiple points to draw a curve, simplification defines how many points can be skipped to make the line less detailed and more smooth

### What does Stroke dash mean?

These are SVG standard Dash endcaps. Round: The ends of lines taper smoothly into a semicircle. Butt: The ends of lines cut abruptly at the specified length with a straight line. Square: The ends of lines cut with a straight line that overhangs slightly off the limit of the line segment. Inherit: the system will use the settings of the parent elements

### How can I place states without filling whole map?

There's a Growth rate slider in Options that you can set to a smaller value, it defines how far states expand into neutral lands. The States Editor regeneration menu (cog button) has the same growth rate control plus 'Recalculate states', so you can tune it without regenerating the whole map. You can also lower individual expansion values and/or remove some states

### How can i create lakes?

Tools -> Heightmap -> Erase or Risk and make sure that whatever cells you put under sea level are surrounded by land cells. It'll automatically be considered a lake

### Is there a way to make relief icons render above routes?

You can change the layer order on the Layers Tab by draging the toggle button. It can be done for most of layers

### My map colors are inverted, how can I fix it?

It looks that you have a browser extension like Dark Mode that affects the map colors. You need to toggle it off or disable to run on the Generator page

### What is the biggest country?

Let's find out. Open Tools -> edit States. Make sure the list of states is sorted by Area. The first state displayed in the list should be the biggest one. If you want, you can change the table sorting

### How can I start a battle?

To start a battle ensure the Military layer is on. Then click on any Regiment and press the button to attack. Then select a regiment you want to attack. It will open the Battle Simulation dialog, where you can add more regiments, change battle settings and simulate the battle

### How do I color multiple nations?

To change the fill color of a State, open Tools -> edit State. Then locate the State you want and click on a box with its current color. Select the color you want. Then do the same for all other States

### How to change all emblems in a state?

You can either regenerate emblems for all states (via Tools -> regenerate Emblems) or for an individual state, province or burg. For that click on an emblem and click on Regenerate in the Edit Emblem dialog

### What would be the best Precipitation setting?

We recommend to set Precipitation to 100 for a Earth-like world. Obviously, the real climate is different and it depends on multiple factors, but 100 is considered to be default setting for a "pretty wet" world

### How can I make my map more desert-like?

To make your map more desert-like, adjust the precipitation level in the Options -> Configure World. Setting it to zero will create an unlivable desert across most of the map

### How to make wind direction similar to earth?

Keep wind directions default. The default settings are already similar to Earth

### How can i see through which towns and cities does a route or river go through?

Click on the route or river. In the Editor dialog click on the button to show the Elevation profile. It will display burgs the route/river is passing

### How to delete a state capital?

Each state must have a capital. So to remove the capital burg, you need to reassign the capital status to another burg first and then remove the initial burg. Alternativelly you can remove the entire state, it will make the old capital a usual neutral burg

### Do you take suggestions?

Yes, please suggest new features or changes on our Discord server

### Where can I set population settings?

Please use the Units Editor. It's available in Tools

### Can you create a name of a Castillian kingdom?

Go to the "Tools" menu and select "States". There, you can find the specific state you want to rename, click on its name, and use the available options to regenerate the name. If you want to change the culture, do it first using States Editor as well

### Can I auto generate borders instead of manually painting them in after battles?

No, this feature is not supported. You can only adjust borders manually using the States Editor

### Is it possible to change the Heightmap in risk mode without regenerating the rivers?

No. Risk mode tries to keep the data, but rivers, lakes and biomes directly depend on the heightmap and are regenerated on edit completion. Unchecking 'Allow water erosion' in the heightmap customization menu keeps the heights as you drew them, but rivers are still recalculated

### Is there any way to make the .map file size a little smaller?

Not really. The size mostly depends on the points number and cannot be changed for an existing map; turning off some layers can help a bit. You can gzip the file with an external tool: the Generator loads gzip-compressed files (.gz) directly, so there is no need to unpack it before loading

### How to clean this chat dialog? How can I remove the chat history?

The assistant remembers the conversation for the current browser tab only, and the service forgets it two hours after the last question. Close the tab or open the Generator in a new one to start fresh; the assistant marks the boundary with a 'new conversation' line

### How can I toggle you off? How can I hide the Assistant?

To hide the Assistant, go to Options -> Generator settings and set `Azgaar assistant` to Hide

### The assistant says 'No questions left today'. What now?

Questions are budgeted per day to keep the shared service affordable. Anonymous use gets a small allowance; click 'Sign in' at the bottom of the assistant panel to sign in with Discord for a larger one. The wiki and the Discord server hold the same knowledge the assistant answers from

### What does the assistant send, and where?

Only the question you type and a conversation id go to the project's help gateway at ask.azgaarsfmg.com; nothing from your map or browser is sent. Answers are drawn from the wiki and Discord knowledge. Signing in with Discord stores a token in this browser, and 'Sign out' removes it. Questions are kept for 90 days to improve the documentation; the 'Policy' link at the bottom of the panel opens the full details at https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Policy

### How to make a river?

There are two ways to create a new river. Open the Rivers Overview (Tools -> Rivers), click on the Add River button and then click on a map cell to spawn a river from it, the river will be created automatically. Another way is to draw a river manually with the 'Create a new river selecting river cells' button. The same automatic placement is available as Tools -> Add -> River (Shift + 4)

### Is it possible to raise the amount of cells without affecting the coastline?

You can Transform the map into a new one with larger amount of cells. The new map will be based on the existing one and the Generator will try to keep the details as they were, but it's still a new map, so some data can be changed. You can find the Transform tool in Tools

### How to create an army?

You can create a new Regiment using the Regiments Overview. In can open if you click on a button with list icon in the Military Overview (available in Tools). In the Regiments Overview you can select a state and add a Regiment for this state. Then you can click on this new Regiment to edit its name, icon and military forces

### How do I merge countries?

To merge states (countries) open the States Editor from Tools and click the "Annex states" button (crown icon) at the dialog bottom. Click the state that annexes the others on the map, then click the states to annex; hold Shift to keep annexing several. A confirmation lists what will be removed, so a mis-click can be cancelled. To pick from a list instead, use the "Merge several states into one" button next to it and tick the states to merge

### How to start a war?

The Generator doesn't simulate wars, but you can set a Diplomatic relations between countries to "Enemy", which means a state of war in the Tool. You can also start a Battle between two or more Regiments. The Generator has a simple Battle Simulator

### Where can I find a real-world heightmap to import to the Tool?

You can create a heightmap of any region of the Earth using the Heightmapper tool available at tangrams.github.io/heightmapper

### Where is the Tools located?

The Tools tab is one of the main tabs of the Menu. You can open the Menu if you click on the arrow button at the top left corner of the screen

### Is there a way to see dynasty trees?

No, dynasties are not currently supported

### Does it give names for mountains, forests, seas and other features?

Rivers and lakes are named automatically (as well as states, provinces, burgs and religions). Mountains, forests, seas and other features are not named, but you can add custom labels for them: Tools -> Add -> Label (Shift + 2), and manage them in the Labels Overview

### How can I change the language on the Tool?

In Options click on the "Init Google Translate" button. Then select a language of your choise. Please note that it's only a machine translation, it's not that good in terms of quality. You can ask here if you need a better translation

### Is there a way I can use the map generator to generate galactic maps?

The generator is supposed to work with Earth-like maps, but with some creativily you can use Style to make your map look like a Galactic map. You may find some examples on our Discord server

### Can i build a world instead of generating one?

To start with a Blank Map go to Tools -> Heightmap and select an Erase mode to clear the existing land. Use the brushes available in the Heightmap editor to manually build your landmasses. This will be the foundation of your map. Then you can set the climate basics in the Configure World menu in options. Once your heightmap and climate are set, you can edit rivers and other features. Go to Tools -> Biomes to adjust the biomes associated with your landmasses. Use the States and Cultures editors under the tools to define the political entities and cultures on your map. Customize labels, roads, and other details using different tools available under the Tools tab. Remember to save your map frequently, save .map file to your machine

### Is there a way to have a province inside a province?

No. You can create Provinces inside States, but not Provinces inside other Provinces and not States inside other States

### Can I add a city?

Yes, you can add a city. Use the shortcut Shift + 1 (Tools -> Add -> Burg) and click on the map to add a burg. Then open the burg and change its group to 'city'; burg groups and their criteria are configured in the Burg Groups configurator. Alternatively you can add new burgs from the Burgs Overview

### What does shanty town mean?

A shanty town feature refers to a type of settlement characterized by informal housing and typically lower living conditions. In the context of the Tool, it represents a specific attribute of a burg, indicating that the area may be populated by lower-income individuals or lacks formal infrastructure.

### What is new? What is the latest updated?

The see the latest changes, please check out the Changelog: https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog

### What does “growth rate” setting do?

The "growth rate" setting defines how far states and cultures will expand into neutral lands during generation. A lower value will result in more lands remaining politically neutral

### What does size variety setting do?

The "size variety" setting determines how much the areas of states should differ from each other. A lower value results in more uniform state areas

### Does is use cookies or cache?

Yes, the application data is stored in browser cache, so it's important to clear it in case of issues. Cache issues are common after major releases, it's happening because browser is still using the old files instead of the new, updated ones. Cookies are not used by the Tool, so no need to clear them

### Is there a way of editing the temperature of a specific biome?

No, temperature can only be set for the entire world

### How do I import biome-related data?

You cannot import it, but you can set it up using the Biomes Editor in Tools

### How do i customize heightmap color?

You can select one of the available heightmap color schemes or create a custom one in Style -> heightmap element

### How do I control meridian length?

The meridian length and world size can be adjusted in the Configure World section, specifically using the Map Size parameter. After that, you can further refine settings in the Units Editor

### Can i change the size of each region?

If you mean states, you can change them using the State Editor. You can find it in Tools

### What is the current version of the Generator?

Reload the page: the version is displayed under the logo on the loading screen and is also appended to the browser tab title. To see what changed check the Changelog: https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog

### How to see the whole map? I can only see a portion of it

To see the whole map set the zoom to a minimal level. You can also press the '-' key to zoom out. If it's still not the whole map, try changing the Zoom Extent min value to a fraction of 1, e.g. 0.6. This will help is the map canvas you are working is bigger than your browser window.

### Does the Generator simulate economy and trade?

Yes. FMG has an economy layer: cells can hold a resource (good), rural population produces raw goods, burgs manufacture goods from recipes, markets collect and price everything, surpluses are traded between markets and states collect taxes from the deals. It's a single calculated cycle, not a running simulation - the numbers change only when you regenerate the economy, not over time. Toggle the Goods, Markets and Trade layers to see it on the map

### What are goods?

Goods are resources and products like grain, iron, wood or wine. Raw goods are produced by the rural population depending on the biome, and a cell can also hold a bonus resource that boosts one specific good there. Manufactured goods are produced in burgs from recipes, using ingredients bought on the market. Open Tools -> Goods to see the full list with production and stock numbers, filter goods by tags, add your own good, or click on a good to edit its value, demand and multipliers

### What is a market?

A market is a regional economic hub anchored at a burg. Markets are placed on the biggest burgs (capitals and ports get a bonus) and their territories expand over the surrounding cells following routes and avoiding mountains and state borders. Every flow of goods passes through a market: rural cells deliver their production, burgs buy ingredients and sell products, and markets trade surpluses with each other. Toggle the Markets layer to see the territories, click on a territory to open the Market Stock dialog, or open Tools -> Markets for the overview

### How is production calculated?

Rural cells produce raw goods based on population, biome output and multipliers (culture type, culture, state, religion and biome). Burgs produce manufactured goods: for each recipe they buy the ingredients from their market and sell the output back to it. Prices are set per market from supply and demand, so the same good costs differently in different places. Click on a burg plate in the Goods layer or use the production button in the Burg Editor to open the Production Overview for that burg. Tools -> Goods -> production chains shows how goods depend on each other

### How does trade work? What is the Trade layer?

After production every market compares its prices with other markets and buys where a good is cheap and sells where it's expensive, if the route makes it profitable - distance, land and sea friction and the exporter's sales tax are all taken into account. Each transaction is stored as a deal. The Trade layer animates deals as flows moving between burgs; click on a flow to see the deals behind it. Tools -> Trade opens the Trade Animation editor where you can change the speed and the look of the animation

### Where can I see how rich a state is? What are the taxes?

Open Tools -> States: there is a Treasury column, and clicking on a value opens the taxes dialog for that state. Each state has a Sales tax, applied to deals where the state is the seller, and a Poll tax, a flat fee per population point. Base rates depend on the state form (a Theocracy taxes sales heavily, a Monarchy taxes people more, an Anarchy collects nothing) and are randomized a bit per state. Neutral lands collect nothing

### How do I regenerate the economy?

Tools -> Regenerate has the relevant buttons: Goods re-places bonus resources on the cells, Markets rebuilds markets and their territories, Production recalculates production and trade deals, and Economy does all of it at once, including state taxes. The Goods and Markets editors have the same buttons at the bottom of the dialog

### Can I place a resource where I want? How to assign goods to cells manually?

Yes. Open Tools -> Goods, click on the brush button and paint the good on the map. A cell can hold only one good. Where a good can appear automatically is defined by its distribution expression, which you can edit in the good's own dialog - see the Goods spread functions wiki page: https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Goods-spread-functions

### Where can I compare prices between markets?

Open Tools -> Markets and click on the compare button, or open a good in the Goods Editor and use the compare option there. The Compare Prices dialog shows the stock and the price of the selected good in every market, so you can find where it's cheap and where it's expensive

### Is there a 3D view?

Yes. Open the Layers tab and use the View mode buttons at its bottom: Standard, 3D scene and Globe. The 3D scene shows your heightmap as a 3D landscape. The settings dialog opens with it (press O to toggle it) and lets you change height scale, lighting, sun position, time of day presets, sky and water, 3D labels and more. The 3D view is presentation-only, you cannot edit the map while it's open

### Can I see my map as a globe?

Yes, open the Layers tab and switch the View mode to Globe. The map is projected onto a sphere with an equirectangular projection, so maps with a 2:1 aspect ratio look best and distortion is the strongest near the poles. Texture resolution and auto-rotation speed can be set in the 3D settings dialog

### Can I make the 3D terrain look more realistic?

There are two options for that in the 3D settings. 'Eroded terrain' bakes a dense detailed mesh with ridges, gullies and carved river valleys (mesh detail, gully strength and river valleys depth are configurable). 'Satellite texture' replaces the map texture with a procedural satellite-like render: biome colors, rock and snow on slopes, and animated water. Both are display-only, they never change your heightmap data

### Can I export the 3D scene?

Yes. The 3D settings dialog has a screenshot button that saves the current view as a .jpeg, and an OBJ export button that saves the terrain mesh as an .obj file for Blender and similar tools (the eroded mesh produces large files). OBJ export is not available in Globe mode

### How do I switch between political, cultural and other map types?

Use the Layers preset select at the top of the Layers tab: Political, Cultural, Religions, Provinces, Biomes, Heightmap, Physical, Places of interest, Goods, Trade animation, Military, Emblems and Pure landmass. You can also toggle individual layers and save the current combination as your own preset with the plus button

### Is there a minimap?

Yes, Tools -> Show -> Minimap. It displays the whole map with the current viewport marked, click anywhere on the minimap to center the view there

### How can I see all the data for a particular cell?

Open Tools -> Cells (Shift + E) and move the pointer over the map. The Cell info panel shows the cell id, coordinates, latitude, longitude, geozone, area, feature type, elevation and depth, temperature, precipitation, river, biome, population, state, province, culture, religion, burg, assigned good, market and production

### Are there any statistics or charts?

Yes, Tools -> Show -> Charts (Shift + A). You can plot states, cultures, religions, provinces, biomes and other entities by total, urban or rural population, land area or number of cells, group them by another entity and display the result as a stacked or normalized bar chart

### How do I quickly open the style of a layer?

Ctrl + click on a layer button in the Layers tab opens the Style tab with that element already selected. Most editors also have a style button (brush or adjust icon) that opens the Style editor for their layer

### How do religions work?

Religions are generated on top of cultures. A Folk religion belongs to a single culture and spreads with it, an Organized religion spreads across cultures and states, a Cult is small and local, and a Heresy splits off from an existing organized religion. Open Tools -> Religions to rename and recolor them, change type and expansion, repaint the borders with the brush, add or remove religions, see the hierarchy tree and toggle extinct ones

### What are zones?

Zones are arbitrary highlighted areas used for events and world-building: invasions, rebels, proselytism, crusades, diseases, disasters, eruptions, avalanches, faults, floods and tsunamis. They are generated automatically and edited in Tools -> Zones (Shift + Z), where you can add a zone, paint its cells, change its type, color and description, filter zones by type and hide the ones you don't need

### How are routes generated? Can I add a road?

Routes are generated between burgs and grouped into roads, trails and sea routes. Open Tools -> Routes to browse them, lock the ones you want to keep and remove the unlocked ones. To add a route use Tools -> Add -> Route (Shift + 5), or the 'create a new route selecting route cells' button in the Routes Overview, and click the cells the route should pass. Click on a route on the map to edit its points, group and name, or to see its elevation profile

### Can I create my own type of road?

Yes, route groups are configurable. Open a route (or the Routes Overview) and go to the route groups editor: there you can add a group, set its style and move routes between groups

### How do I add my own description to a state, burg or marker?

Every map object can have a note (legend). Click on the object and use its notes button, or open Tools -> Notes to browse all notes. The notes editor is a rich text editor, so you can add formatting, links, images, and raw HTML through the source code button

### Can AI generate descriptions for my world?

Yes. The Notes editor has a 'Generate note with AI' button. You can use OpenAI, Anthropic or a local Ollama model; the model and the API key are entered in the dialog and stored in your browser only. See the Ollama text generation wiki page for a local setup that needs no API key: https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Ollama-text-generation

### How do emblems (coats of arms) work?

Emblems are generated for states, provinces and burgs and drawn in the Emblems layer. Click on an emblem or open Tools -> Emblems to regenerate it, change its shape and size, edit it in Armoria (a dedicated heraldry editor), download it as an image or upload your own png, jpg or svg. Tools -> Regenerate -> Emblems re-rolls all of them, and the editor can export the whole gallery as an html document

### How do markers work? Can I add my own marker types?

Markers are icons for points of interest. Generated markers follow placement rules (a bridge needs a river and so on) and get a note attached. Add your own with Tools -> Add -> Marker (Shift + 3) and click on the map, then click the marker to change its type, icon (any emoji or an image URL), size, pin shape and colors - style changes apply to all markers of the same type. Tools -> Markers lists all markers, filters them by state, culture and type and exports them as .csv, and the generation settings dialog sets the number multiplier per type

### How do I protect my manual changes from being overwritten by regeneration?

Use locks. States, provinces, cultures, religions, burgs, routes and markers have a lock icon, and locked elements are skipped by the corresponding Regenerate command. Options rows have lock icons too - a locked option keeps its value when you generate a new map

### What are burg groups?

Burg groups (capital, city, town, village, hamlet, fort, monastery and others) define which icon and label style a burg gets and which preview generator is used for it. Groups are assigned automatically by population and burg features, but you can change the group of a particular burg in the Burg Editor and edit the criteria, order and icons in the Burg Groups configurator

### Can I see a city map for my burg?

Yes. Click on a burg to open the Burg Editor - it shows a live preview generated by Watabou's generators: the City generator for cities, the Village generator for smaller settlements and Dwellings for the smallest ones. You can zoom and pan the preview, open the full generator in a new tab, or set a custom link for the burg

### How do I save my own map style?

Open the Style tab and click on the plus button next to the preset select to save the current style as a custom preset. The Style Saver dialog also lets you download the style as a .json file and load a style file back, so styles can be reused and shared between maps

### Can I use my own font?

Yes. In the Style editor, next to a font select there is a plus button that opens the Add font dialog. You can add a Google font by name, use a font installed on your machine, or provide a font name together with a direct URL to a font file (woff2). Fonts loaded from external URLs require an internet connection

### What is the Legend box and how do I use it?

The Legend box is a text box drawn on the map. The States, Cultures, Religions, Biomes and Zones editors have a 'Toggle Legend box' button that fills it with the list of the corresponding elements. The box can be dragged around the map and restyled in Style -> Legend

### Can I highlight one state and dim the rest?

Yes, use the focus (pin) icon. Open Tools -> States (or Provinces) and click on the pin icon of the element you want to focus on - everything else gets covered by the fog of war. Click the pin again to remove the fog

### Are there any keyboard shortcuts?

Yes, plenty. The full list is on the Hotkeys wiki page: https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Hotkeys (F1 in the app opens the info dialog that links to it). The most used ones are Tab (toggle the menu), F2 (new map), Ctrl + S (save to machine), F6 and F9 (quick save to browser storage and quick load), single letters to toggle layers, and Shift + letter to open editors

### Where can I find the documentation?

The wiki is the main documentation: https://github.com/Azgaar/Fantasy-Map-Generator/wiki. It covers the Quick Start Tutorial, hotkeys, the user interface, heightmap customization and the template editor, culture sets and types, military forces, markers, the battle simulator, scale and distance, URL parameters, GIS data export and more. The About tab in the app links to the key pages

### Is there a guided tour for beginners?

Yes. Open the About tab in the menu and click on 'Take an Interactive Tour'. It walks you through the map, the menu tabs, layers and presets, and the main tools step by step

### How do I generate the same map again? What is the seed?

The seed is the number that defines the random generation, it's shown in Options -> Map seed. The same seed reproduces the same map only if the canvas size, the generation options and the Generator version are the same. Click on the hourglass icon next to the seed to open the seed history and re-apply a previous seed, or use the copy icon to get a URL that reproduces the map. To share the exact map it's still safer to share the .map file

### How do I share my map with a link?

Save the map to Dropbox (Save -> Dropbox, or Ctrl + C), then open the Load dialog and use the Share button to create a sharable link. Anyone who opens the link gets the map loaded into FMG. The file has to be hosted on a server that allows CORS requests - Dropbox does, Google Drive doesn't

### How do I stop the 'don't forget to save' reminder?

Press Ctrl + Q to turn the save reminder off, and press it again to turn it back on. The reminder shows up every 15 minutes and is independent of the autosave

### How do I get my map into QGIS or another GIS software?

Use Export -> Export to GeoJSON: cells, routes, rivers, markers and zones can be saved as separate GeoJSON files and opened in QGIS, ArcGIS and similar tools. There is a step-by-step guide in the wiki: https://github.com/Azgaar/Fantasy-Map-Generator/wiki/GIS-data-export

### How do I find a specific state, burg or river in a long list?

Overview dialogs (Burgs, Rivers, Routes, Markers, Labels, States and others) have a search field that filters the table, sortable columns, and pagination for big maps. The sliders button in the dialog header lets you show or hide columns. Click on the target icon in a row to zoom to that element on the map

### Can I contribute code to the project?

Yes, the project is open source and pull requests are welcome. Discuss your idea on our Discord first, then follow CONTRIBUTING.md in the repository
