Here I want to answer the most common questions _Fantasy Map Generator_ (FMG) users may have. Please feel free to raise a new [issue](https://github.com/Azgaar/Fantasy-Map-Generator/issues) in order to request additional answers.

### I have issues with the Generator, what should I do?
Please try to reproduce the issue on your own. If it's reproducible, please log [an issue](https://github.com/Azgaar/Fantasy-Map-Generator/issues). A lot of issues are caused by browsers, please also try to use incognito mode and/or another browser. I recommend Chrome as the fastest browser in terms of svg rendering.

### The map performance is poor, how can I improve it?
The performance mainly depends on the number of visible elements and visible map area. The optimization strategies are: 
* Toggle off unnecessary layers. Be mindful of the _Relief Icons_ layer in particular – it’s the most resource-demanding one.
* Open the Generator in a separate browser window, make it _much_ smaller (about 900 x 560 pixels) and re-generate the map. Then, zoom in to see the map in detail. It will reduce the rending area and _drastically_ improve the performance.
* When generating maps, set _Points number_ to 10K. Points (cells) number highly affects performance. 
* Toggle off map and element filters.
* Close all irrelevant browser tabs and applications.
* Use a leading edge browser (fresh versions on Chrome or Edge). Firefox is reported to be slower.

### Who owns the maps created?
You. The Generator is licensed under [MIT license](https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/LICENSE) and derivative works such as maps are free of charge. You can sell them or make them available for free.

### My saved map is not working properly. What should I do?
If there is no version conflict, please [raise a defect](https://github.com/Azgaar/Fantasy-Map-Generator/issues/new). Compatible older maps are auto-updated when loaded. Maps older than `0.70.0`, maps from a newer version, and invalid files require the matching Generator version or a repair/recreation. The tool is under development and version conflicts are inevitable.

### Can I export a created map?
Sure, there are a number of available options: 
* Save to machine: save file can be directly loaded to the Generator.
* Save to Dropbox: save file can be directly loaded to the Generator.
* Save to storage: save map data to the browser's internal database. File will be loaded automatically on page refresh. Bear in mind that saving to desktop is safer since browser storage can be accidentally cleared

* Export .svg: save a full map as a scalable vector image. You can open the file in a browser or edit it using a vector graphics editor.
* Export .png or .jpeg: save the currently displayed map fragment as a raster image, at up to 8× resolution. You can edit the file in any raster graphics editor.
* Export to tiles as .zip: split map on .png chunks and save them all as a single .zip file. it allows to save giant raster images once chunks are combined.
* Export to GeoJSON: save cells, routes, rivers, markers or zones to be used in GIS software (see [GIS data export](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/GIS-data-export)).
* Export to JSON: save the raw map data (full, minimal, pack cells or grid cells) for your own tooling.

### How can I open a saved .gz or .map file?
Open the generator, click on _Load_ and select the file. Or just drag and drop the file onto the Generator window.

### Can I manually edit a save file?
`.map` files are plain text, so yes, you can edit them in any text editor. `.gz` files are gzip-compressed and have to be decompressed first. However, if you break the formatting the file won't be loading. The common error is that most text editors automatically split embedded svg into separate lines.

### Can I use the Generator offline?
Yes, but it's more complex. You must have a source code editor ([VS Code](https://code.visualstudio.com/) is the best free one) and [node.js](https://nodejs.org) installed.

Download the [source code](https://github.com/Azgaar/Fantasy-Map-Generator/archive/refs/heads/master.zip) and unzip _all files_ from the archive.

Open the folder in VS Code and run `npm install` in the terminal to install dependencies. Then run `npm run dev` to start the development server. The tool will normally be available at `http://localhost:5173/Fantasy-Map-Generator/` — open the URL printed by Vite in your browser. Node.js 24 or newer is required.

See [Run FMG locally](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Run-FMG-locally) for details.

### Is there a desktop version?
The supported desktop-like option is a PWA. Chromium-based browsers (Chrome, Edge, etc.) may offer an **Install** button; the installed app can be opened from the desktop or app launcher. A normal browser shortcut is also possible, but this repository does not build a separate Electron app.

### Which browsers are supported?
The Generator targets modern browsers. Chromium browsers are the primary tested environment; Firefox and other browsers may differ in performance or feature support. Internet Explorer is not supported. Browser behavior can change with browser and FMG versions, so report reproducible compatibility issues.

### Can I use the Generator on mobile?
You can, but I doubt you will enjoy the experience. The Generator GUI is not suitable for mobile devices and performance is subpar. In general, I would say mobile devices are not supported.

### What about non-English localization?
There is no hand-written localization yet. As a workaround, the Options tab has a _Language_ row with an **Init Google Translate** button that loads Google Translate and lets you pick a language. Automatic translation can break some of the page functionality — if that happens, use the reset icon to go back to English or refresh the page.

### Can I embed the map to my website?
Yes, you can and it's easy to do. Please follow the guide [here](https://sites.google.com/view/fantasy-map-generator-embedded/home).

### What does _Azgaar_ mean?
It's my nickname, it has no meaning. The name of the tool is _Azgaar's Fantasy Map generator_, pointing to me as creator. The short form is _FMG_.

### You've mentioned a Medieval Dynasty simulator. What is it?
It's my meta-project. A CK2-style genealogical game focused on genetics. Generally a wedding/dynasty breeding simulator (see the [screenshot](https://i2.wp.com/azgaar.files.wordpress.com/2018/02/screenshot-2018-2-9-dynasty-v0-11.png)). It's in pre-alpha and currently on hold, so no demo is available. 

### How can I help to improve the Generator?
Just use it, log defects and suggest enhancements (please use the [issues](https://github.com/Azgaar/Fantasy-Map-Generator/issues) page for both cases). Share the Generator link within your community! Post on FB, Twitter etc. 

We need a good video-tutorial. Please contact me if you have a video-blog and want to help.

Professional help from coders / UI designers is highly appreciated.

We also accept donations on [Patreon](https://www.patreon.com/azgaar).

### What is the team behind the project?
There is no team, but there is a Community. The tool is created by me, Azgaar. The community is based on our Reddit and Discord servers. Thanks for [contributors](https://github.com/Azgaar/Fantasy-Map-Generator/graphs/contributors), Community moderators and all our community members.

### Do you accept donations?
Yes, you can support the project on [Patreon](https://www.patreon.com/azgaar). If you don't want to pay monthly, you are able to decline the donation at any moment in time. Other donation platforms are not supported.

### Is there a place where I can discuss the Generator, share created maps and so on?
Yes, we have a dedicated [Discord server](https://discordapp.com/invite/X7E84HU) and [Reddit community](https://www.reddit.com/r/FantasyMapGenerator/). Both have a very active and supportive community.

### How can I contact you directly?
Please PM me on Discord or [send me an email](mailto:azgaar.fmg@yandex.com).
