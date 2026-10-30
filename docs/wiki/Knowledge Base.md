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

For real-world maps open Options -> Heightmap and pick one from the gallery (Earth, Europe, Africa and more). Maps made by others are shared at https://cartographyassets.com/asset-category/specific-assets/azgaars-generator. To recreate any other map from its image, use Tools -> Heightmap -> Erase -> Image Converter

### How can I get an empty map to start with?

To get a blank map go Tools -> Heightmap -> Erase and use the brushes on the top right to delete all the land

### How can I show burg labels from afar?

Labels are shown and hidden based on zoom bounds defined per label group. Open Tools -> Labels and click on the groups configuration button. There you can check 'Show all labels' to ignore zoom bounds completely, or raise the max zoom value for a specific group

### How do I force state labels to show the full state name?

Open Tools -> Labels, click the groups configuration button and set the state group's Mode to 'full'. 'Auto' uses the full name only when it fits, 'short' always uses the short one

### How do I import an image? Can I put an image to create world based on it?

Yes, it can be done via the Image Converter. Go to Tools -> Heightmap -> Erase -> Image converter

### Why cant I make a border stop at the rivers?

This its because the border of states or provinces follow the border of the cells while the river flows through the centre of the cell (for making them pretty)

### Why is there no autosave?

There is an autosave. Go to Options -> Configure -> Advanced -> Autosave interval and set the interval in minutes (0 disables it). The map is saved to the browser storage, and browser storage can be cleared accidentally, so also save .map file backups to your machine from time to time

### Why is there no undo button?

There is no global undo for the whole map, but undo and redo (Ctrl + Z / Ctrl + Y) work in the editors that support it: Heightmap brushes and Template Editor, Paint brushes, Wrap Tool, Notes Editor, Routes Overview and Transform tool. It's still recommended to save the project as a .map file at least once every 30 minutes of work

### Can I increase the number of cells?

Use Tools -> Create -> Transform: it rebuilds the map with a different points number and tries to keep the details. Submap does the same for a part of the map

### What do the buttons at the bottom of the Options tab do?

Climate sets the map's position on the globe, temperatures and precipitation. Lore sets the map name, calendar and world description. Advanced holds map size, the cell grid, growth rate, autosave and other settings; hover one to see what it does. Reset restores all options to their defaults and reloads the page, so save the map first

### Can I make a map with hexagonal or square cells?

Yes. Open Options -> Advanced (bottom row), pick a Lattice preset such as Hex board, Square board or Isometric board, then generate a new map. It applies to new maps only. See https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Advanced-options

### Can I export map data as a text file?

Yes. Most overviews in Tools (Burgs, States, Rivers, Markers and others) have a download button that saves the table as .csv. Export also offers GeoJSON for GIS tools and JSON for your own scripts. Only the CSV tables, notes, namesbases, heightmap templates and styles can be uploaded back: https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Data-import

### Can I upload states, religions, burgs or other data from a CSV file?

Yes, to update existing entries. In an overview such as Tools -> States or Burgs, download the table as .csv, edit it in a spreadsheet and upload it back with the button next to download. A preview shows every change and anything that won't be applied; press Apply to confirm. Rows are matched by Id, and empty cells keep the current value. Columns per editor: https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Data-import

### Can I add new states, burgs or other entries with a CSV upload?

No, an upload only updates existing entries. If an Id is not on the map, nothing is changed and the missing ids are listed. Create the entries in the editor first, download the CSV again to see their ids and fill them in

### Why are some values in my CSV upload skipped?

The upload preview lists each skipped value with the reason. Usually a name that points at another entry (a culture, state or capital) doesn't match exactly, or the column is calculated from the map (cells, area) and can't be uploaded. Names cannot contain " < or >

### Which CSV format does the upload accept?

Only comma-separated files. A spreadsheet in a language with decimal commas may save with semicolons, so choose the comma when saving. Save from Excel as CSV UTF-8 so names with accents survive

### Can I add new relief icons?

Yes, add and remove relief icons on the map with the Relief Editor: turn the Relief icons layer on and click on an icon, or use the bulk add and bulk remove brushes. You can also switch between the bundled icon sets (Simple, Colored, Gray, Illustrated and Stickers). To use your own art, see "Can I use my own images as relief icons?"

### Can I use my own images as relief icons?

Yes. In the Relief Editor select an icon and press the plus button in the bottom line to give it any icon, including your own uploaded or linked image. To make a biome generate your icons, open Tools -> Biomes, edit its Relief column ("Add any icon...") and press "Apply and re-place". See https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Icons

### How can I use rulers in a map?

Open Tools -> Measurers (Shift + =) and pick a ruler, an opisometer (curve length), a route opisometer (follows routes) or a planimeter (area), then draw on the map. Remove them in the same editor and style them in Style -> Rulers

### Why do lakes appear after editing the heightmap? How do I see where water flows?

Water must be able to flow to the sea, so when you finish a heightmap edit, closed hollows are filled or turned into lakes. To see them while editing, tick "Show drainage" in the Tools tab of the heightmap editor: arrows show where water flows and hatched areas are hollows. Lower a rim or raise the floor until the hatching is gone

### How do I change the heightmap on a small scale?

Open Tools -> Heightmap and pick an edit mode, then use the brushes on the top right with a small radius. If the elevation is already right and you only dislike the outline, reshape the cells themselves with the Wrap Tool (Tools -> Create -> Wrap, or Shift + W)

### How do I change borders on a small scale?

To give land to another state, province, culture, religion, biome or zone, open its editor, click the brush button and paint over the cells. To only reshape the border line, use Tools -> Create -> Wrap (Shift + W)

### How do I make the coastlines more rugged or smoother?

Open Tools -> Coastlines and pick a preset (Smooth, Rocky, Fjords, Skerries) or tune roughness and bays, for the whole map or a single island or lake. It changes only how the shore is drawn; to move the coast itself, edit the heightmap. See https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Coastline-Editor

### How do I fine-tune the shape of a coastline, lake shore or border?

Use the Wrap Tool: Tools -> Create -> Wrap (Shift + W). Drag on the map and the cell corners under the brush move with the pointer, so coastlines, lake shores and all cell-based borders bend with them. It is meant for small adjustments only — do 99.9% of the shaping with the Heightmap tool and finesse the result with Wrap

### I have white bits on the map why they are?

You may have pushed cell shapes too far with the Wrap Tool, in which case use its Revert all button and do the changes of land with the Heightmap tool, or you may have a way too complex shape for the generator

### Does time exists?

There is no a thing as time at the moment on the generator. The era and year thing in Options -> Configure -> Lore is just to define time messages on legends of military regiments, battles and similar things with a date on the notes

### I have made the menu too big. How to put it normal again?

Zoom out the browser (ctrl and the wheel) to 100%. Or set Interface size to 1 in Options

### How do I change state / culture / religion / province borders?

Go to tools and select the desired option. Click on the brush button on the bottom, click and drag to paint on the map, remember to confirm the changes when done

### How do I change habitability?

Habitability is determined by biomes. Go to Tools -> Biomes, here you can change biome habitability percentage

### Is there a way to place a marker for a dungeon yourself and have it generate a dungeon map for it?

You need to know the dungeon seed. Create a new marker, and edit the notes. Then click the Source code button on the top-left and enter something like this (change YOUR_SEED): <p><a href="https://watabou.github.io/one-page-dungeon/?seed=YOUR_SEED" target="_blank">Click here to go to the dungeon</a></p><p><iframe src="https://watabou.github.io/one-page-dungeon/?seed=YOUR_SEED"></iframe></p>

### How can I cover both ends of my map with ice? Top and bottom

Options -> Configure -> Climate -> Change the temperature of the poles. After that, Tools -> regenerate ice

### How can I make mountains taller?

Edit the heightmap in Erase or Risk mode. Alternatively go to the Tools -> Units editor, then the altitude subsection and change the exponent a bit

### What does each city feature icon mean?

Hover it over, you will see some tips at the bottom on the page

### How can I remove part of my map to expand my ocean?

Open Tools -> Heightmap, choose Risk mode (it keeps states, burgs and other data), lower the land with the brushes and finish the edit. Land under a burg is never sunk, so remove or move those burgs first

### What is burg? What is berg?

Burg is an internal name used for all settlements in the Fantasy Map Generator. It comes from German 'burg' meaning 'fortified settlement'

### I have issues with the Generator, what should I do?

Search the existing issues first, then report at https://github.com/Azgaar/Fantasy-Map-Generator/issues/new?template=bug_report.yml with the FMG version, browser, steps to reproduce and the .map file in a ZIP. On Discord, use /bug or ask in #fmg-bugs. See https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Reporting-bugs-and-ideas

### What should a useful bug report look like?

Say what happened, what you expected and how to repeat it, for example: "Load the attached map, rename Northport to Southport, save and reload: the name is Northport again." Add the FMG version, browser and OS, the .map file in a ZIP and any error text or screenshots

### Does telling the assistant about a bug submit it to GitHub?

No, chatting only gets advice. To file a report on Discord use /bug or /idea, or the message menu's Apps -> Report this as a bug. A moderator reviews it before it reaches GitHub; follow the GitHub link you get. You can also use the GitHub forms directly

### The map performance is poor, how can I improve it?

Turn off layers you don't need, especially Relief icons. Set the Performance preset in the Options tab to Speed. Generate maps with fewer points, such as 10K. Use a recent Chrome or Edge and close other heavy tabs. A smaller browser window also renders faster

### Who owns the maps created?

You. The Generator is licensed under MIT license and derivative works such as maps are free of charge. You can sell them or make them available for free

### My saved map is not working properly. What should I do?

Maps saved since v0.70.0 are updated automatically on load; older ones need the matching old version of the Generator. If a newer map fails, report it at https://github.com/Azgaar/Fantasy-Map-Generator/issues/new?template=bug_report.yml with the .map file in a ZIP, the exact error and the versions used to save and load it

### Can I export a created map?

Yes. Open the menu (Tab) and click Export at the bottom. Pick .svg for the full map as a vector image, .png or .jpeg for the current view (up to 8x resolution), tiles for a ZIP of image chunks, or GeoJSON and JSON for data. To keep an editable copy, use Save instead, which makes a .map file

### Can I export a PNG with a transparent background?

Not directly: image exports always include the ocean. Export .svg, open it in a vector editor such as Inkscape, delete the `ocean` group and export a PNG from there

### Can I choose where the map file is saved?

Yes, in Chrome and Edge: Save to machine (Ctrl + S) asks for a name and location and creates a new file each time. To overwrite the last saved file, press Ctrl + Shift + S. Firefox and Safari save to the browser's download folder

### Can I share a map that others can view but not edit?

Yes. Tick View-only at the bottom of the Save dialog and save to machine or Dropbox. The map then opens for browsing only: layers, zoom, search, notes and export work, editing doesn't. It is not a protection, as the file can still be edited by hand

### How can I open a saved .gz or .map file?

Open the generator, click on Load and select the file. Or just drag and drop the file onto the Generator window

### Can I manually edit save file?

`.map` files are plain text, so it's technically possible, but it's better not to do it as broken formatting makes the file unloadable. The common error is that most text editors automatically split the embedded svg into separate lines. `.gz` files are gzip-compressed and have to be decompressed first

### Can I use the Generator offline?

Yes. Install the desktop app from https://github.com/Azgaar/Fantasy-Map-Generator/releases, which works offline. Or install the web version as a PWA (the Install button in Chrome's address bar) and open it once online so it gets cached. External fonts and styles still need a connection

### Is there a desktop version?

Yes, for Windows, macOS and Linux: download the installer from https://github.com/Azgaar/Fantasy-Map-Generator/releases. It's the same Generator in its own window, works offline and checks for updates. Without installing anything, Chrome and Edge can install the web app with the Install button in the address bar

### Why does the desktop app warn about an unknown developer?

The builds are not code-signed yet, so the system warns on the first launch. On macOS right-click the app -> Open -> Open, on Windows click More info -> Run anyway

### Which browsers are supported?

Chrome, Edge and other Chromium browsers work best, as the tool is developed in Chrome. Firefox and others work but may be slower. Old browsers like Internet Explorer are not supported

### Can I use the Generator on mobile?

You can, but I doubt you will enjoy the experience. The Generator GUI is not suitable for mobile devices and performance is subpar. In general, I would say mobile devices are not supported

### What about non-English localization?

The interface is translated into several languages; change it in Options -> Interface settings -> Language. Generated names and notes stay in English. The Assistant and the docs use English button names, so look for a control in the same place rather than by its name

### What does Azgaar mean?

It's a nickname of the Generator creator, it has no meaning. The full name of the tool is Azgaar's Fantasy Map generator. The short form is FMG

### How can I help to improve the Generator?

Use it, report bugs at https://github.com/Azgaar/Fantasy-Map-Generator/issues/new?template=bug_report.yml, suggest or upvote ideas at https://github.com/Azgaar/Fantasy-Map-Generator/discussions/categories/ideas, share the Generator with your community, or support it on Patreon: https://www.patreon.com/azgaar

### What is the team behind the project?

There is no team, but there is a Community. The tool is created by me, Azgaar. The community is based on our Reddit and Discord servers. Thanks for contributors, Community moderators and all our community members

### Do you accept donations? Can I donate?

Yes, you can support the project on Patreon. If you don't want to pay monthly, you are able to decline the donation at any moment in time. Other donation platforms are not supported

### Is there a place where I can discuss the Generator, share created maps and so on?

Yes, we have a dedicated Discord server and Reddit community. Both have a very active and supportive community

### Can I underline at the name of the capitals?

You cannot using the UI, but if you are comfortable with dev tools, you can amend the svg part directly. Open the console (F12) and run: `document.querySelector('#labels-capital').style.textDecoration = 'underline'`. Use another burg group name instead of `capital` if needed. The change may be lost when labels are re-rendered

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

Press New map! for a random world and explore it with the presets in the Layers tab. Change Options (template, number of states and so on) and generate again to get closer to what you want. Then edit anything with the editors in the Tools tab. To shape your own continents, use Tools -> Heightmap: erase the land and paint it, apply a template, or convert an image. New here? Try the Quick Start Tutorial: https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Quick-Start-Tutorial

### I'm new to the tool, is there a video tutorial?

Yes, the video tutorial is available. Here is the YouTube link: https://www.youtube.com/playlist?list=PLtgiuDC8iVR2gIG8zMTRn7T_L0arl9h1C

### I'm new to the tool, is there a tutorial?

You can ask questions here or go to our Discord server. If you want a basic guide, check out the Quick Start Tutorial: https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Quick-Start-Tutorial

### Is there a Reddit community?

We have a Reddit community on https://www.reddit.com/r/FantasyMapGenerator

### Can I create a battle between armies?

Yes, with the Battle Simulator. Click a regiment, press Attack foreign regiment and click a regiment of another state: the attacker moves to it and the battle opens. Unit power, set in the Military units editor, decides the strength

### How can I upload a new icon for cities?

Open Style -> Icons, select the burg group (city, town and so on) and click its icon. Pick a bundled icon or emoji, or open Custom to upload or link your own image. All burgs of the group use it. See https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Icons

### How do I use my own images as icons?

Click any icon to open the icon picker (burg groups, goods, markers, regiments, relief and so on), open Custom and upload an image (SVG up to 200 kB, or PNG, JPEG or WebP up to 2 MB) or paste a link. Uploading is safer: a linked icon disappears if its site removes the image. Replace swaps the picture everywhere it is used. Guide: https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Icons

### Where are custom icons stored? Will they be lost?

They are saved in the .map file, so they travel with the map. The browser also keeps them for your next new maps. Linked icons show only while their website is reachable

### Why is my linked icon missing in the PNG export or on another computer?

A linked icon is loaded from its website each time, so it is missing offline, when the site removes the image or when the site blocks other pages from using it, which also drops it from PNG exports. Upload the image instead: select the icon in the picker's Custom list, press Replace and upload the file

### How can I create a new country?

To create a new country open the States editor: Go to "Tools" -> "States". Look for a button to add a new state at the bottom of State Editor. Click on it and then click on a map to place a new state there. You can adjust the borders of your country using the States editor brush tool

### How can I invade one country to another?

Open Tools -> States, click the brush button and paint the invader's state over the conquered land. To mark the war, set the states as Enemy in the Diplomacy editor or add markers

### I would like to use my own list of names for States, Provinces, and Burgs. How can I do it?

Create a namesbase in Tools -> Namesbase (or upload a .txt list) and assign it to a culture in the Cultures Editor; new names for that culture come from it. To rename existing entries in bulk, download the overview table as .csv, edit the names and upload it back

### Is it possible to use the map generator to create a fantasy map based on an actual city map?

The map maker works better for country-sized regions. It doesn't have city blocks, buildings or anything for city-sized mapping.

### Is there a way to make culture sets with custom namebases?

Culture sets themselves are hardcoded and cannot be extended. You can create custom namesbases in Tools -> Namesbase and assign them to individual cultures in the Cultures Editor

### Is there a way to use custom namebases for generating worlds?

You can use custom namesbases: create them one by one in Tools -> Namesbase and then set the namesbase per culture in the Cultures Editor; states and burgs use the namesbase of their culture

### Can I share my map with my players so that its still interactive?

Send them the .map file; they open it in the Generator and can explore layers, search and notes. Tick View-only in the Save dialog if they shouldn't edit it. You can also embed the map in a web page: https://sites.google.com/view/fantasy-map-generator-embedded/home

### What are the culture types?

Generic, Naval, Lake, Highland, River, Nomadic and Hunting. The type comes from where the culture starts: Nomadic in deserts and grasslands, Highland in mountains, Lake by big lakes, Naval on coasts and islands, River along big rivers, Hunting in forests, tundra and wetlands, Generic elsewhere. It decides which land the culture spreads into easily. Change it in Tools -> Cultures

### What is culture ancestry and how does it work?

An optional label such as Elfish, Dwarven or Human, set in Tools -> Cultures. It shows next to the culture name in tooltips, and cultures with the same ancestry share a Folk religion when religions are generated

### Is there a way to generate a map from an image? How can I convert image into a map?

Use the Image Converter: Tools -> Heightmap -> Erase -> Image Converter. Load an image, ideally a grayscale heightmap where lighter means higher, assign heights to its colors (auto-assign helps) and confirm. Then edit the new map with the usual tools

### Is there a way to take a very basic heightmap and apply some template to it in order to achieve better feature placement than I can do by hand?

Not within the tool, I'm afraid. You can import heightmaps, but there's no function to generate more patterns onto it. You could, for example, generate a random map from which you like the features, export it as an image, then use some Photoshop-adjacent tool to mix it with your basic heightmap and then import that

### Am I able to up the culture limit?

You can manually add as many cultures as you want. Or change the Cultures set to Random, it'll let you move the slider up to 100

### How population is calculated?

Population depends mainly on by area / biome, but there are other factors as well: river or lake nearby, specific featurs like river estuary or if there is a safe sea harbor, cell elevation, burg status, etc.

### Is there a way that I can add a lake to a landmass without resetting all the rivers and stuff?

A lake needs a heightmap edit: Tools -> Heightmap in Risk mode keeps most data. With 'Allow water erosion' on, rivers are regenerated when you finish, so lock the rivers you want to keep first (the lock button in Tools -> Rivers)

### I have issues with download. The button disappeared after I clicked it. Even though I didnt download the app

The browser's Install button only appears until the PWA is installed, check your desktop or app launcher. You can also install the tool using Chrome menu: Chrome menu -> Cast, save and share -> Install page as app. If you want a regular installer instead, download the desktop app from https://github.com/Azgaar/Fantasy-Map-Generator/releases

### Is there an app?

Yes, a desktop app for Windows, macOS and Linux: https://github.com/Azgaar/Fantasy-Map-Generator/releases. There is no mobile app. Chrome and Edge can also install the web version with the Install button in the address bar

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

Go to Tools -> Units and change the '1 map pixel' distance scale. To change how much of the world the map covers, use Map size in Options -> Configure -> Climate

### How to merge provinces?

Open Tools -> Provinces, click Annex provinces (crown icon), click the province that absorbs the others, then click the ones to merge (hold Shift for several). Only provinces of the same state can be merged

### Can you colour in the relief icons?

Not per icon. Style -> Relief sets the outline color and opacity of all relief icons and switches between the Simple, Colored, Gray, Illustrated and Stickers sets. For your own colors, use your own art as custom icons: https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Icons

### My landmass color turned transparent (so it shows the ocean) and i don't know how can i do it back

Edit the heightmap in Risk mode, change some land cells, it should help. Probably your coastline is too complex, the algorithm cannot handle it

### How do I make it so whenever I generate a state I get names from a specific language? I wanted to create states with portuguese sounding names

You need to change the namesbase of the culture where you're spawning states and regenerate burg names for this culture. Tools -> edit Cultures

### Hi, where is the right place to suggest new features?

Search and upvote ideas at https://github.com/Azgaar/Fantasy-Map-Generator/discussions/categories/ideas, or post a new one there with the problem and how you'd use the feature. On Discord, use /idea or #fmg-suggestions

### What should a useful feature suggestion look like?

Describe the problem and how you'd use the feature, for example: "Group journeys by campaign. I run two campaigns on one map, and filtering by campaign would show only its journeys." Search existing ideas first and upvote instead of duplicating

### Can I speak with a real human?

Ask the community or a moderator in the FMG Discord server: https://discord.com/invite/X7E84HU. Use #fmg-bugs for problems and #fmg-suggestions for ideas. You can also ask usage questions at https://github.com/Azgaar/Fantasy-Map-Generator/discussions/new?category=q-a

### Who are you?

I'm just an AI bot who can help you with the tool

### Can I create a lake?

Open Tools -> Heightmap in Risk mode, lower an area below sea level and finish the edit: it becomes a lake. Then rename it or change its type (freshwater, salt, frozen and so on) in the Lake Editor

### How do I set up the map maker in offline mode / not using a web browser, but its own app?

Install the desktop app from https://github.com/Azgaar/Fantasy-Map-Generator/releases: it runs in its own window and works offline. Or, in Chrome or Edge, install the web version with the Install button in the address bar and open it once online

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

Follow the steps. 1. Save the map to storage. 2. Go to Options -> Configure -> Advanced and set 'On load' to 'Open last saved map'. 3. Add URL parameters to make it look like this: https://azgaar.github.io/Fantasy-Map-Generator/?scale=4&x=800&y=200. 4. Change scale, x and y values as you need and use the link

### How the map is rendered? Is it on GPU or CPU?

The browser draws the map as SVG, which is not fully GPU-accelerated, so big maps can lag. If it does, set the Performance preset in the Options tab to Speed

### If I've changed a setting, how do I generate a new map without changing the seed number?

Press enter when on the seed input in Options

### Is there a time progression/calendar system that you can advance or is it a static moment in time?

The map is static. Over-time simulation is planned, but not yet implemented

### When creating a new world, in which order do you add elements

Follow the generator's own order: heightmap and climate (Options -> Configure), biomes, cultures, states, burgs and routes, religions, provinces, then the economy, military, zones and markers

### Is there a means to get the width of a river at a particular point along its length?

No, only the width at the river mouth is available. Click on the river to see its details, or open Tools -> Rivers to see length, discharge and mouth width for all rivers

### Where can I enable or disable the rendering of ocean cells?

Rendering of ocean cells can be set via the checkbox in Style -> Heightmap -> oceanHeights group

### Is temperature the averaged temperature across the entire year (all temps added, then divided by 365)? Or is it something else?

Temperature is annual average

### Is there any way that I can recreate a map if all I have is a screenshot?

Not automatically. Load the screenshot in Tools -> Heightmap -> Erase -> Image Converter: a heightmap image converts almost by itself, a political map needs you to assign land or sea to each color. States, burgs and the rest then have to be redone by hand

### Is there a way to overlay an image over a map?

Yes. You can put it as Texture. Click on Style -> select element -> Texture. And next to the image dropdown there is a Plus icon. Provide the URL of the image and apply. Make sure the server where the image is hosted allow CORS requests. You can put any image there

### Is there anyway to show underwater towns/colonies/kingdoms?

Underwater towns and cultures are not supported. However some users suggested a workaround: style your ocean to look like land and land to look like an ocean. Then roleplay like that land is water from an ocean and the outside water has no population

### Is there a travelling time calculator or such built in?

Yes, Journeys: Tools -> Journeys (Shift + J). Add a journey and pick a transport for each leg (on foot, horse, ship and so on); it finds the route along roads, sea lanes and rivers and calculates distance and travel time. To just measure a distance, use Tools -> Measurers. See https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Journeys

### In the Style editor, for Heightmap element, what does the Reduce layers slider do?

Reduce layers: the program has a lot of steps in height and it may look too crowdy. "Reduce layers" skips each x-th step in heightmap. So the higher the value is, the less steps is rendered

### In the Style editor, for Heightmap element, what does the Simplify line slider do?

Simplify line defines line simplification level. Heightmap isoline consists of multiple points to draw a curve, simplification defines how many points can be skipped to make the line less detailed and more smooth

### What does Stroke dash mean?

In Style, Dash array makes a line dashed: the numbers are dash and gap lengths, such as '2 1'; leave it empty for a solid line. Linecap sets how line and dash ends look: butt cuts them flat, round rounds them, square extends them slightly

### How can I place states without filling whole map?

Lower Growth rate in Options -> Configure -> Advanced: states expand less and leave neutral land. On an existing map, use the same slider in the States Editor's regenerate menu (cog button) and press Recalculate states. You can also lower individual states' Expansion

### How can i create lakes?

Tools -> Heightmap -> Erase or Risk and make sure that whatever cells you put under sea level are surrounded by land cells. It'll automatically be considered a lake. See also 'Can I create a lake?' above

### Is there a way to make relief icons render above routes?

You can change the layer order on the Layers Tab: the sort button at the end of the _Layers preset_ row opens a list where you drag the layers. It can be done for most of layers

### My map colors are inverted, how can I fix it?

It looks that you have a browser extension like Dark Mode that affects the map colors. You need to toggle it off or disable to run on the Generator page

### What is the biggest country?

Let's find out. Open Tools -> edit States. Make sure the list of states is sorted by Area. The first state displayed in the list should be the biggest one. If you want, you can change the table sorting

### How can I start a battle?

To start a battle ensure the Military layer is on. Then click on any Regiment and press the button to attack. Then select a regiment you want to attack. It will open the Battle Simulation dialog, where you can add more regiments, change battle settings and simulate the battle

### How do I color multiple nations?

Open Tools -> States and click a state's color box to open the Color Picker; pick a color and the map updates. Repeat for each state. The same picker works for provinces, cultures, religions, biomes and zones

### Can I fill a state or zone with hatching? Can hatching be colored?

Yes. In the Color Picker click a hatching pattern in the row below the preset colors, then pick a color above to color the hatching. Click the selected pattern again to go back to a solid fill

### How to change all emblems in a state?

You can either regenerate emblems for all states (via Tools -> regenerate Emblems) or for an individual state, province or burg. For that click on an emblem and click on Regenerate in the Edit Emblem dialog

### What would be the best Precipitation setting?

We recommend to set Precipitation to 100 for a Earth-like world. Obviously, the real climate is different and it depends on multiple factors, but 100 is considered to be default setting for a "pretty wet" world

### How can I make my map more desert-like?

To make your map more desert-like, adjust the precipitation level in Options -> Configure -> Climate. Setting it to zero will create an unlivable desert across most of the map

### How to make wind direction similar to earth?

Keep wind directions default. The default settings are already similar to Earth

### How can i see through which towns and cities does a route or river go through?

Click on the route or river. In the Editor dialog click on the button to show the Elevation profile. It will display burgs the route/river is passing

### How to delete a state capital?

Each state must have a capital. So to remove the capital burg, you need to reassign the capital status to another burg first and then remove the initial burg. Alternativelly you can remove the entire state, it will make the old capital a usual neutral burg

### Why can't I delete a burg that is a market center?

Remove its market first: in Tools -> Markets delete the market (trash icon), or move it to another burg with Relocate in the Market Stock dialog. Then the burg can be removed

### Do you take suggestions?

Yes. Post or upvote ideas at https://github.com/Azgaar/Fantasy-Map-Generator/discussions/categories/ideas, or use /idea on Discord. A chat message alone doesn't create a suggestion

### Where can I set population settings?

Please use the Units Editor. It's available in Tools

### Can you create a name of a Castillian kingdom?

Go to the "Tools" menu and select "States". There, you can find the specific state you want to rename, click on its name, and use the available options to regenerate the name. If you want to change the culture, do it first using States Editor as well

### Can I auto generate borders instead of manually painting them in after battles?

No, this feature is not supported. You can only adjust borders manually using the States Editor

### Is it possible to change the Heightmap in risk mode without regenerating the rivers?

Yes. Uncheck 'Allow water erosion' in the heightmap editor before finishing: rivers stay, ending at the new coast. With erosion on, rivers are regenerated except locked ones (the lock button in Tools -> Rivers)

### Is there any way to make the .map file size a little smaller?

Not really. The size mostly depends on the points number and cannot be changed for an existing map; turning off some layers can help a bit. You can gzip the file with an external tool: the Generator loads gzip-compressed files (.gz) directly, so there is no need to unpack it before loading

### How do I start or delete an Assistant chat?

Open Chats in the Azgaar Assistant title bar. New chat starts an empty chat for the open map. Each chat stays in this browser until you delete it with the trash button. A chat from another map or answerer can be read, but you must start a new chat to continue.

### How can I hide Azgaar Assistant?

Go to Options -> Interface settings and set Azgaar Assistant to Hide. This hides the call bubble.

### The Assistant says 'No questions left today'. What now?

The free daily allowance is set by the Azgaar server. A Guest can sign in with Discord for a larger allowance, or connect an AI key or local model for unlimited questions.

### What does Azgaar Assistant send, and where?

Guest and Member questions send only your question and the server chat id to the Azgaar server. Nothing from the open map is sent. A connected key or local model sends your questions, chat history, a map summary, and results of map reads directly to that Provider. The Policy page has details.

### Can Azgaar Assistant answer questions about my map?

Yes, with a connected AI key or local model. Ask in the same panel you use for Generator questions. The Assistant can read the open map to answer exact questions, and can download CSV or JSON built from it. Guests and Members can ask documentation questions but the Azgaar server cannot see their map.

### Do I need an API key for Azgaar Assistant?

Guests and Members on the official site can ask documentation questions without a key. Connect a key to ask about your map, edit it and remove the daily limit. A local model needs no key. On a self-hosted copy or in the desktop app, connect a key or local model to use the Assistant.

### Which AI providers and models can Azgaar Assistant use?

Anthropic, OpenAI, Mistral, Qwen, DeepSeek, and an OpenAI-compatible local server such as Ollama. Choose a Provider in the key sheet. The Assistant discovers models available to the key and also accepts any typed model id. One default is offered while discovery is pending.

### Can Azgaar Assistant see my map or images?

Yes, with a connected key or local model that supports images. It can look at the map or a place on it, and you can paste up to four images, such as a sketch or a style reference, into the question box. Guests and Members cannot attach images

### What is sent to my AI Provider?

Your question and any images you paste, earlier messages in the chat, the Assistant's instructions, a summary of the open map, the open note and selection if any, and results of the map reads the Assistant performs. Those results can include names, statistics, note text or pictures of the map. Your key and data go directly to the Provider, never through the Azgaar server.

### Can Azgaar Assistant change my map?

Yes, with a connected key or local model. It proposes changes as a card listing each change before -> after; nothing happens until you press Apply, and Discard drops it. If a detail is missing, such as where to place a new state, it asks first

### Which edits can Azgaar Assistant make?

Most of what the editors do: renaming, recoloring and retyping; notes; creating, removing and moving states, provinces, burgs, cultures, religions, rivers, routes, markers, zones, labels, regiments and journeys; repainting territories and merging states or provinces; diplomacy, taxes and treasuries; population; emblems, lake types and coastlines; goods and market names; and the map's name, year and description. Just ask: it says when it can't do something

### What can't Azgaar Assistant edit?

The heightmap, relief icons, ice, name bases, transport types, the placement of goods and markets, styles and settings. Use the editors for those. The Assistant should tell you when it has no operation for a request

### How do I undo an Assistant change?

Press Undo on the applied card in the chat; it reverts the whole batch. If you have edited the same things since, the button reads Changed since and can't undo

### How much does a Key-tier Assistant chat cost?

The project charges nothing; your chosen Provider may bill you. The footer shows the tokens used by this chat. Each question resends the chat's earlier messages, so long chats cost more and take longer. When a chat gets long, start a new one from the notice.

### How to make a river?

Open Tools -> Rivers, press Add River and click a cell: the river is generated downhill from there (also Tools -> Add -> River, Shift + 4). To draw one by hand, use the 'Create a new river selecting river cells' button

### How do I make a river wider or narrower?

Click the river to open the River Editor and change Source width (extra width at the source, 0 by default) or Width modifier (a multiplier for the whole river width, 1 by default). The mouth width follows

### Is it possible to raise the amount of cells without affecting the coastline?

You can Transform the map into a new one with larger amount of cells. The new map will be based on the existing one and the Generator will try to keep the details as they were, but it's still a new map, so some data can be changed. You can find the Transform tool in Tools

### How to create an army?

You can create a new Regiment using the Regiments Overview. In can open if you click on a button with list icon in the Military Overview (available in Tools). In the Regiments Overview you can select a state and add a Regiment for this state. Then you can click on this new Regiment to edit its name, icon and military forces

### How do I merge countries?

Open Tools -> States, click Annex states (crown icon), click the state that absorbs the others, then click the states to annex (hold Shift for several). Or use 'Merge several states into one' to pick from a list. Tick the checkbox in the confirmation to keep annexed states as provinces

### How to start a war?

The Generator doesn't simulate wars, but you can set a Diplomatic relations between countries to "Enemy", which means a state of war in the Tool. You can also start a Battle between two or more Regiments. The Generator has a simple Battle Simulator

### Where can I find a real-world heightmap to import to the Tool?

You can create a heightmap of any region of the Earth using the Heightmapper tool available at tangrams.github.io/heightmapper

### Where is the Tools located?

The Tools tab is one of the main tabs of the Menu. You can open the Menu if you click on the arrow button at the top left corner of the screen

### Is there a way to see dynasty trees?

No, dynasties are not currently supported

### Does it give names for mountains, forests, seas and other features?

Rivers, lakes, islands and oceans get names automatically; mountains and forests don't. Rename features in Tools -> Features. To show a name on the map, add a label with Tools -> Add -> Label (Shift + 2)

### How can I change the language on the Tool?

Open Options -> Interface settings -> Language, pick a language and press Reload. Save the map first, as the page reloads

### The Assistant names a button or menu I can't find. Is my interface in another language?

Probably. The Assistant and the docs use English names, such as Tools -> Edit -> States. In another language, look for the control in the same place: tabs, buttons, icons and shortcuts don't move. Hover a control to see its tooltip, or switch to English for a moment

### Is there a way I can use the map generator to generate galactic maps?

The generator is supposed to work with Earth-like maps, but with some creativily you can use Style to make your map look like a Galactic map. You may find some examples on our Discord server

### Can i build a world instead of generating one?

Yes. Open Tools -> Heightmap, choose Erase and paint your land with the brushes, or apply a template. Finish the edit, set the climate in Options -> Configure -> Climate, then shape biomes, cultures, states and burgs with the editors in Tools. Save the .map file often

### Is there a way to have a province inside a province?

No. You can create Provinces inside States, but not Provinces inside other Provinces and not States inside other States

### Can I add a city?

Yes, you can add a city. Use the shortcut Shift + 1 (Tools -> Add -> Burg) and click on the map to add a burg. Then open the burg and change its group to 'city'; burg groups and their criteria are configured in the Burg Groups configurator. Alternatively you can add new burgs from the Burgs Overview

### What does shanty town mean?

A shanty town feature refers to a type of settlement characterized by informal housing and typically lower living conditions. In the context of the Tool, it represents a specific attribute of a burg, indicating that the area may be populated by lower-income individuals or lacks formal infrastructure.

### What is new? What is the latest updated?

The see the latest changes, please check out the Changelog: https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog

### What does “growth rate” setting do?

The "growth rate" setting defines how far states and cultures will expand into neutral lands during generation. A lower value will result in more lands remaining politically neutral. It is in Options -> Configure -> Advanced

### What does size variety setting do?

The "size variety" setting determines how much the areas of states should differ from each other. A lower value results in more uniform state areas. It is in Options -> Configure -> Advanced

### Does is use cookies or cache?

Yes, the application data is stored in browser cache, so it's important to clear it in case of issues. Cache issues are common after major releases, it's happening because browser is still using the old files instead of the new, updated ones. Cookies are not used by the Tool, so no need to clear them

### Is there a way of editing the temperature of a specific biome?

No, temperature can only be set for the entire world

### How do I import biome-related data?

You cannot import it, but you can set it up using the Biomes Editor in Tools

### Can I draw contour lines or hachures on the heightmap?

Yes. In Style -> Heightmap turn on Contours for elevation lines (set Font size above 0 to label them) or Hachures for slope strokes. Both change only the look, not the heights

### How do I use the new Ink, Cinderwood and Frostbite styles?

Pick Ink, Cinderwood or Frostbite in the preset select at the top of the Style tab. To mix their effects into your own style, see https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Map-embellishments

### What do Quality, Balance and Speed change?

They are Performance presets in the Options tab. Quality looks best; Speed is fastest, as it hides state halos and redraws the map only after you stop zooming; Balance sits between. They change only the display, not the map

### How do i customize heightmap color?

You can select one of the available heightmap color schemes or create a custom one in Style -> heightmap element

### How do I control meridian length?

The meridian length and world size can be adjusted in the World Configurator (Options -> Configure -> Climate), specifically using the Map Size parameter. After that, you can further refine settings in the Units Editor

### Can i change the size of each region?

If you mean states, you can change them using the State Editor. You can find it in Tools

### What is the current version of the Generator?

Reload the page: the version is displayed under the logo on the loading screen and is also appended to the browser tab title. To see what changed check the Changelog: https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog

### How to see the whole map? I can only see a portion of it

To see the whole map set the zoom to a minimal level. You can also press the '-' key to zoom out. If it's still not the whole map, try changing the Zoom Extent min value to a fraction of 1, e.g. 0.6. This will help is the map canvas you are working is bigger than your browser window.

### Does the Generator simulate economy and trade?

Yes. The countryside produces raw goods, burgs make products, markets trade them and states tax the deals. It shows one typical day; the numbers change only when you regenerate the economy. Turn on the Goods, Markets and Trade layers to see it, and read https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Economy

### What are goods?

Resources and products like grain, iron, wood or wine. The countryside produces raw goods, and burgs make products from them. Open Tools -> Goods to see them all, add your own or click a good to edit its price and demand

### Can I use my own images for goods? How do I change a good's icon?

Yes. Open Tools -> Goods, click a good, then click its icon to open the icon picker. Choose a bundled icon or emoji, or open Custom to upload or link your own image

### What is a market?

A trade hub at a big burg. The countryside around it sells its produce there, and burgs buy and sell goods there. Turn on the Markets layer to see their areas, click one for its stock and prices, or open Tools -> Markets

### Where are markets placed?

On the biggest burgs, favoring capitals, ports and crossroads. To change them, open Tools -> Markets: add a market on any burg, remove one, paint market areas or move a market to another burg

### What is the market margin?

A market buys below its price and sells above it by its margin, which goes to the merchants of the burg at its center, so busy markets make their hub rich. It is 4% where the market pays little or no license and rises with the state's license fee: 5% under a typical monarchy, up to 8% under a greedy theocracy. See it in the Markets overview

### What do Sales, Buys and Value mean in the Markets overview?

Sales is what burgs paid the market for its goods, Buys is what it paid burgs for theirs, and Value is Sales minus Buys plus its unsold stock

### How is production calculated?

The countryside produces raw goods depending on its people and biome. Burgs make products from those goods and sell where they get the most. Prices differ between markets with supply and demand. To see what a burg makes, click its pie on the Goods layer or the production button in the Burg Editor; Tools -> Goods -> production chains shows what each product needs

### What does the Goods layer show?

Each cell in the color of its most valuable good, icons on deposits, and pies of each burg's main goods. Select goods in Tools -> Goods to show only them, and click a burg pie to see its production. Style -> Goods turns the cells, icons and pies on or off

### What is prosperity? How happy are a burg's people?

How well people live, from 0% to 100%, based on what they can buy; bare needs is about 20%. It is not happiness. See it in Tools -> Burgs, the Burg Editor and Tools -> States

### How does trade work?

Burgs buy from their own market; when it lacks a good, they buy it from the cheapest other market they can reach. They sell to whichever market pays best. Turn on the Trade layer to watch the deals

### How is carriage (transport cost) calculated?

Moving goods costs carriage along roads and sea routes; sea is five times cheaper. Each good has a Carriage Price in its editor (Tools -> Goods): bulky goods stay local, valuable ones travel far

### What is the Trade layer?

It animates the day's deals as flows between burgs. Click a flow to see the deals behind it. Tools -> Trade changes the animation's speed and look

### Where can I see how rich a state is?

Open Tools -> States: Treasury shows what the state keeps and Prosperity how well its people live. Click either to open the state's Economy dialog with its product, wealth, trade and main goods

### What taxes does a state collect?

A sales tax on every sale, a poll tax per person, a license fee from each market and tariffs on imports. Rates start from the state form: monarchies tax most, republics lightly, anarchies not at all. To change them, see "How do I change a state's taxes?"

### How do I change a state's taxes?

Open Tools -> States and click the state's Treasury to open its Economy dialog, then press the bank button. There you set taxes, tariffs and how the budget is spent

### What are tariffs and embargoes?

A tariff is a tax on goods a burg buys from or sells to another state's market, levied by the state the goods go to; an embargo stops that trade both ways. Set them per state and per good in the state's taxes dialog. They start from diplomacy: allies trade freely, rivals pay more, enemies are under embargo

### What is the market license?

A fixed fee a day that each market's center burg pays its state, whatever its trade. Unions and anarchies charge nothing, trade republics little, monarchies more and theocracies the most. States with dear licenses get fewer markets, farther apart, their markets charge a higher margin, and a quiet market under a greedy state goes into debt

### What is corruption?

The share of state spending officials pocket. It depends on the form of government, the state's size and its minorities, and is higher in far provinces. Spending on administration lowers it. Set it in the state's taxes dialog

### What does a state spend its taxes on?

Court and clergy, administration, infrastructure and military; the treasury keeps the rest. Change the shares in the state's taxes dialog

### What does each state expense achieve?

Military keeps the army strong in battles, infrastructure raises prosperity, administration cuts corruption, and court and clergy support stability. A bigger state must spend more for the same effect

### What is stability?

How firmly a province holds together, from 0% to 100%. Prosperity, court and clergy and a well-paid army raise it; distance from the capital, minorities, corruption and high taxes lower it. Unstable states get more rebels. See it in Tools -> States and Tools -> Provinces

### Do provinces have their own economy?

They have no taxes or budget of their own. To see a province's economy, click its Prosperity in Tools -> Provinces

### What is a burg's treasury?

What the burg has at the end of the day after selling, buying and paying taxes. See it in the burg's Economy Overview (the production button in the Burg Editor). It can be negative

### How do I make a burg richer or poorer?

Open the burg's Economy Overview, expand its Adjustments row and add lines, each with a name and an amount a day; use a negative amount for debts. They apply when you regenerate production

### How do I regenerate the economy?

Tools -> Regenerate has the relevant buttons: Goods re-places the deposits on the cells, Markets rebuilds markets and their territories, Production recalculates production and trade deals, and Economy does all of it at once, including state taxes. The Goods and Markets editors have the same buttons at the bottom of the dialog

### Why is a market not making an expensive product even though its ingredients exist?

Burgs make what pays best for their workers, so an expensive product with a long chain, dear inputs or high taxes can lose to a simpler one. On maps made before 1.153.0, run Tools -> Regenerate -> Production to use the corrected planner

### Can I place a resource where I want? How to assign goods to cells manually?

Yes. Open Tools -> Goods, click the brush button and paint the good on the map; each cell holds one good. To change where a good appears on generation, edit its spread function: https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Goods-spread-functions

### Where can I compare prices between markets?

Open Tools -> Markets and click on the compare button, or open a good in the Goods Editor and use the compare option there. The Compare Prices dialog shows the stock and the price of the selected good in every market, so you can find where it's cheap and where it's expensive

### Is there a 3D view?

Yes. In the Layers tab switch View mode to 3D scene. Press O for settings like height scale, lighting, sky and water. You can't edit the map in 3D

### Can I see my map as a globe?

Yes, open the Layers tab and switch the View mode to Globe. The map is projected onto a sphere with an equirectangular projection, so maps with a 2:1 aspect ratio look best and distortion is the strongest near the poles. Texture resolution and auto-rotation speed can be set in the 3D settings dialog

### Can I make the 3D terrain look more realistic?

Yes. In the 3D settings turn on 'Eroded terrain' for ridges and valleys and 'Satellite texture' for a satellite-like look. Neither changes your map

### Can I export the 3D scene?

Yes. The 3D settings dialog has a screenshot button that saves the current view as a .jpeg, and an OBJ export button that saves the terrain mesh as an .obj file for Blender and similar tools (the eroded mesh produces large files). OBJ export is not available in Globe mode

### How do I switch between political, cultural and other map types?

Use the Layers preset select at the top of the Layers tab: Political, Cultural, Religions, Provinces, Biomes, Heightmap, Physical, Places of interest, Goods and production, Trade map, Military, Emblems and Pure landmass. You can also toggle individual layers and save the current combination as your own preset with the plus button

### Is there a search? How do I find a burg, state or river by name?

Yes, press Space and type a name: states, burgs, rivers, markers and most other things are found, also by their notes. Select a result to open its editor. Start with > to search commands. See https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Omnibar

### What does right-click on the map do? How do I reach something hidden under another element?

It lists everything at that spot across all layers, including what is hidden under other elements or on hidden layers. Click a row to open its editor. Shift + right-click opens the browser's own menu

### How do I undo a point while drawing a journey path?

In the Journey path editor, press Backspace to undo the last drawn point, and double-click a control point to remove it

### Is there a minimap?

Yes, Tools -> Show -> Minimap. It displays the whole map with the current viewport marked, click anywhere on the minimap to center the view there

### How can I see all the data for a particular cell?

Open Tools -> Cells (Shift + E) and move the pointer over the map. The Cell info panel shows the cell id, coordinates, latitude, longitude, geozone, area, feature type, elevation and depth, temperature, precipitation, river, biome, population, state, province, culture, religion, burg, assigned good, market and production

### Are there any statistics or charts?

Yes, Tools -> Show -> Charts (Shift + A). You can plot states, cultures, religions, provinces, biomes and other entities by total, urban or rural population, land area or number of cells, group them by another entity and display the result as a stacked or normalized bar chart

### How do I quickly open the style of a layer?

Ctrl + click on a layer button in the Layers tab opens the Style tab with that element already selected. Most editors also have a style button (brush or adjust icon) that opens the Style editor for their layer

### How do religions work?

Religions are generated from cultures: Folk religions follow one culture, Organized ones spread across cultures and states, Cults are small and Heresies split off. Edit them in Tools -> Religions: rename, recolor, repaint borders with the brush, add or remove

### What are zones?

Highlighted areas for events such as invasions, rebels, plagues or disasters. Edit them in Tools -> Zones (Shift + Z): add a zone, paint its cells and set its type, color and description

### How are routes generated? Can I add a road?

Roads, trails and sea routes are generated between burgs. To add one, use Tools -> Add -> Route (Shift + 5) and click the cells it should pass. Click a route to edit it, and manage all of them in Tools -> Routes

### Can I create my own type of road?

Yes, route groups are configurable. Open a route (or the Routes Overview) and go to the route groups editor: there you can add a group, set its style and move routes between groups

### How do I add my own description to a state, burg or marker?

Click the object (a state, burg, marker, river and most others) and press its notes button. The notes editor supports formatting, links and images. Tools -> Notes lists all notes

### Can AI generate descriptions for my world?

Yes. In the Notes editor press 'Generate note with AI' and use an OpenAI or Anthropic key, or a local Ollama model: https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Ollama-text-generation

### How do emblems (coats of arms) work?

States, provinces and burgs get generated emblems. Click an emblem (or open Tools -> Emblems) to regenerate it, edit it in Armoria, download it or upload your own image. Tools -> Regenerate -> Emblems re-rolls all of them

### How do markers work? Can I add my own marker types?

Markers are icons for points of interest. Add one with Tools -> Add -> Marker (Shift + 3) and click the map, then click it to change its icon, size and colors. Type a new name in its Type field to make your own type; style changes apply to all markers of a type. Tools -> Markers lists them all

### How do I protect my manual changes from being overwritten by regeneration?

Use locks. States, provinces, cultures, religions, burgs, routes and markers have a lock icon, and locked elements are skipped by the corresponding Regenerate command. Options rows have lock icons too - a locked option keeps its value when you generate a new map

### Can I regenerate provinces of just one state?

Yes. Tools -> Regenerate -> Provinces opens a dialog listing all states with their province counts. Check one or several states (or All states) and click Regenerate: only the selected states get new provinces, others keep theirs, and locked provinces stay as they are

### What are burg groups?

Groups like capital, city, town, village or fort set a burg's icon and label style. They are assigned by population, but you can change a burg's group in the Burg Editor and edit the groups in the Burg Groups configurator

### Can I see a city map for my burg?

Yes. Click on a burg to open the Burg Editor - it shows a live preview generated by Watabou's generators: the City generator for cities, the Village generator for smaller settlements and Dwellings for the smallest ones. You can zoom and pan the preview, open the full generator in a new tab, or set a custom link for the burg

### How do I save my own map style?

Open the Style tab and click on the plus button next to the preset select to save the current style as a custom preset. The Style Saver dialog also lets you download the style as a .json file and load a style file back, so styles can be reused and shared between maps

### Can I use my own font?

Yes. In the Style editor, next to a font select there is a plus button that opens the Add font dialog. You can add a Google font by name, use a font installed on your machine, or provide a font name together with a direct URL to a font file (woff2). Fonts loaded from external URLs require an internet connection

### What is the Legend box and how do I use it?

In the States, Cultures, Religions, Biomes, Zones or Goods editor press 'Toggle Legend box'. Drag the box to place it, click it to hide it, and style it in Style -> Legend. You can show several at once

### Is there a height (altitude) legend?

Yes, press the Legend box button in the Units editor to show the heightmap colors with their elevations

### A dialog opened off-screen or with a weird size. How do I reset it?

Dialog positions and sizes are remembered by the browser between sessions. When a dialog has a saved position, column layout or sort, a reset button (circular arrow) appears in its title bar next to minimize and close. It restores the default position and, for tables, the default columns and sorting. Table filters and map data are kept

### Can I highlight one state and dim the rest?

Yes, use the focus (pin) icon. Open Tools -> States (or Provinces) and click on the pin icon of the element you want to focus on - everything else gets covered by the fog of war. Click the pin again to remove the fog

### Are there any keyboard shortcuts?

Yes: Tab toggles the menu, F2 makes a new map, Ctrl + S saves, single letters toggle layers and Shift + letter opens editors. Full list: https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Hotkeys

### Where can I find the documentation?

In the wiki: https://github.com/Azgaar/Fantasy-Map-Generator/wiki. Start with the Quick Start Tutorial; the About tab in the app links to the key pages

### Is there a guided tour for beginners?

Yes. Press F1 or open the About tab in the menu, then click 'Interactive Tour'. It walks you through the map, the menu tabs, layers and presets, and the main tools step by step

### How do I generate the same map again? What is the seed?

The seed is the number behind a random map, shown in Options -> Map seed. The same seed gives the same map only with the same options, window size and version, so share the .map file to be sure. The copy icon next to the seed gives a link to the map

### How do I share my map with a link?

Save the map to Dropbox (Save -> Dropbox, or Ctrl + C), then open the Load dialog and use the Share button to create a sharable link. Anyone who opens the link gets the map loaded into FMG. The file has to be hosted on a server that allows CORS requests - Dropbox does, Google Drive doesn't

### How do I stop the 'don't forget to save' reminder?

Press Ctrl + Q to turn the save reminder off, and press it again to turn it back on. The reminder shows up every 15 minutes and is independent of the autosave

### How do I get my map into QGIS or another GIS software?

Use Export -> Export to GeoJSON: cells, routes, rivers, markers and zones can be saved as separate GeoJSON files and opened in QGIS, ArcGIS and similar tools. There is a step-by-step guide in the wiki: https://github.com/Azgaar/Fantasy-Map-Generator/wiki/GIS-data-export

### How do I find a specific state, burg or river in a long list?

Overview dialogs (Burgs, Rivers, Routes, Markers, Labels, Features, States and others) have a search field that filters the table, sortable columns, and pagination for big maps. The sliders button in the dialog header lets you show or hide columns. Click on the target icon in a row to zoom to that element on the map

### How do I keep burgs alphabetical within each province?

In Tools -> Burgs click the Burg column header, then the Province header. Burgs are then grouped by province and alphabetical inside each

### Is there a list of all islands, lakes and oceans on my map?

Yes, Tools -> Features (Shift + F) lists every island, lake and ocean with its type and area. Use the target icon to zoom to one

### How do I rename an island or a landmass?

Open Tools -> Features (Shift + F) and type the new name in its row. To show the name on the map, add a label with Tools -> Add -> Label (Shift + 2)

### Why can't I add or delete a feature in the Features Overview?

Islands, lakes and oceans come straight from the heightmap: an island exists because those cells are above sea level. To add or remove one, change the terrain in Tools -> Heightmap. The Features Overview only changes how an existing feature is named, classified and drawn

### What is the difference between a feature's subtype and its group?

The subtype is what the feature is, and generation uses it: dry, frozen and lava lakes get no ports, for example. The group only sets how it is drawn

### I changed a lake to dry (or frozen, or lava) and its ports are still there

Changing a subtype relabels the feature, it does not regenerate anything - same as the other editors. Ports, goods and markers stay as they were until you regenerate them yourself (for example Tools -> Regenerate -> Burgs)

### How do I give some of my lakes a different colour?

Click a lake, press the plus next to Group and name a new group; the lake moves into it. Style the group in Style -> Lakes and move more lakes into it from Tools -> Features

### Can I contribute code to the project?

Yes, the project is open source and pull requests are welcome. Discuss your idea on our Discord first, then follow CONTRIBUTING.md in the repository
