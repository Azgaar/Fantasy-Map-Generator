**Fantasy Map Generator** is a web tool, but the application logic can run offline once the app assets are available locally. For source code, download or clone the repository, run `npm install`, and start the local Vite server as described in [Run FMG locally](Run-FMG-locally).

*Known Limitations:*

* Fonts and textures loaded from external URLs require an internet connection unless they have been downloaded or embedded locally.
* A production build or installed PWA can work without network access after its assets have been cached.

This repository does not build an Electron desktop application. Use the local Vite app or install the web app as a PWA when supported by your browser.
