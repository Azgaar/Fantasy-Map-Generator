**Fantasy Map Generator** is a web tool, but it runs offline once the app assets are available locally. The simplest option is the desktop app: installers for Windows, macOS and Linux are attached to every [release](https://github.com/Azgaar/Fantasy-Map-Generator/releases) (Nix users see [Install with Nix](Install-with-Nix)). To run from source instead, download or clone the repository, run `npm install`, and start the local Vite server as described in [Run FMG locally](Run-FMG-locally).

*Known Limitations:*

* Fonts and textures loaded from external URLs require an internet connection unless they have been downloaded or embedded locally.
* The installed PWA downloads the full app for offline use. Open it while online and allow the download to finish before disconnecting. Failed downloads are retried when the app is reopened or the connection returns.
* Ordinary browser tabs cache files as they are used. Editors and other resources that have not been downloaded may be unavailable offline.

The desktop app is an Electron build of the same code and needs no browser; the source of the app is in the `electron` directory of the repository.
