Part of the [FMG Q&A](Q&A). Related topics are listed there.

## Interface and performance

### Where is the Tools menu?
Click the arrow button at the top left corner of the screen to open the Menu. Tools is one of its main tabs.

### Is there a list of keyboard shortcuts?
Yes — see [Hotkeys](Hotkeys), or press <kbd>F1</kbd> in the app. Handy ones: <kbd>Tab</kbd> (options pane), <kbd>Ctrl+S</kbd> (save), <kbd>F2</kbd> (new map), <kbd>+</kbd>/<kbd>-</kbd> (zoom), <kbd>Shift+1</kbd> then click (add a burg).

### How do I zoom out / see the whole map?
Use the mouse wheel or the <kbd>-</kbd> key. If you still can't see everything, set the Zoom extent min value in Options to 1 or a fraction like 0.6. Don't confuse map zoom with browser zoom (<kbd>Ctrl</kbd>+wheel), which scales the whole page.

### The menu or interface is too big or too small. How do I fix it?
Set browser zoom back to 100% (<kbd>Ctrl+0</kbd>), then adjust the tool's own scaling in Options → Interface size.

### My map colors look inverted or wrong.
A browser extension such as a dark-mode/dark-reader is usually the cause. Disable it for the Generator page.

### The map performance is poor, how can I improve it?
The performance mainly depends on the number of visible elements and visible map area. The optimization strategies are:
* Toggle off unnecessary layers. Be mindful of the _Relief Icons_ layer in particular – it's the most resource-demanding one.
* Open the Generator in a separate browser window, make it _much_ smaller (about 900 x 560 pixels) and re-generate the map. Then, zoom in to see the map in detail. It will reduce the rendering area and _drastically_ improve the performance.
* When generating maps, set _Points number_ to 10K. Points (cells) number highly affects performance.
* Set the _Rendering_ option to "Best performance".
* Toggle off map and element filters.
* Close all irrelevant browser tabs and applications.
* Use a leading edge browser (fresh versions of Chrome or Edge). Firefox is reported to be slower.

### How is the map rendered — CPU or GPU?
The map is SVG, rendered by the browser. SVG rendering is GPU-supported but not optimized, so very detailed maps can lag. Use the _Rendering_ option (set to "Best performance") in case of significant lag.

### Which browsers are supported?
Any modern browser except Safari. Chrome is the development browser and performs best; Firefox works but is slower; recent Edge, Opera and Yandex are fine. Internet Explorer and unusual browsers like Brave are not supported.

### Can I use the Generator on mobile?
You can, but you probably won't enjoy the experience. The GUI is not suitable for mobile devices and performance is subpar. In general, mobile devices are not supported.

### Can I use the Generator offline or as a desktop app?
Yes:
* PWA (easiest): Chromium browsers show an Install button (or Chrome menu → Cast, save and share → Install page as app). Open it once online so files get cached; it then works offline with some limitations (additional fonts and textures need network) — see [Working offline](Working-offline).
* From source: clone the [repository](https://github.com/Azgaar/Fantasy-Map-Generator), then `npm install` and `npm run dev` (requires Node.js 24+), or `npm run build` and serve the generated `dist` folder with any web server — see [Run FMG locally](Run-FMG-locally). Serving the raw files without a build step no longer works.

### I have issues with the Generator, what should I do?
Please try to reproduce the issue on your own. If it's reproducible, please log [an issue](https://github.com/Azgaar/Fantasy-Map-Generator/issues). A lot of issues are caused by browsers — try incognito mode and/or another browser. Chrome is recommended as the fastest browser for svg rendering.

### Does it use cookies or cache?
No cookies. Application data lives in the browser cache and storage — after major releases a stale cache can cause glitches, so clear the site cache if the tool misbehaves after an update.

### Is FMG available in other languages?
Localization is planned, but not ready from the coding side; once code support is done the community will be asked to help with translations. Meanwhile, in Options click "Init Google Translate" for a machine translation — quality is limited.

### How do I hide the AI assistant?
Options → Generator settings → set "Azgaar assistant" to Hide.

### How do I get exact values on sliders?
Use the arrow keys while a slider is focused to step precisely.
